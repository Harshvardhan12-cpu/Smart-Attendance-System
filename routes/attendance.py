from flask import Blueprint, jsonify, request, session
from models.db import execute_query
from datetime import datetime

attendance_bp = Blueprint('attendance', __name__)

@attendance_bp.route('/attendance', methods=['GET'])
def get_attendance():
    # Simple history endpoint
    query = """
        SELECT a.attendance_id, a.attendance_date, a.status, a.marked_at,
               s.full_name as student_name, s.roll_number,
               c.section_name as class_name,
               sub.subject_name
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects sub ON ts.subject_id = sub.subject_id
        ORDER BY a.attendance_date DESC, a.marked_at DESC
        LIMIT 100
    """
    records = execute_query(query, fetchall=True)
    for record in records:
        record['attendance_date'] = record['attendance_date'].strftime('%Y-%m-%d')
        record['marked_at'] = record['marked_at'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(records), 200

@attendance_bp.route('/attendance', methods=['POST'])
def mark_attendance():
    data = request.json
    timetable_id = data.get('timetable_id')
    date_str = data.get('date') # Format YYYY-MM-DD
    attendance_records = data.get('attendance') # List of {student_id, status}
    marked_by = session.get('user_id')
    
    if not timetable_id or not date_str or not attendance_records:
        return jsonify({'error': 'Missing required fields'}), 400
        
    if not marked_by:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        # We process each student
        results = {'success': 0, 'errors': 0, 'duplicates': 0}
        
        for record in attendance_records:
            student_id = record.get('student_id')
            status = record.get('status')
            
            # Check for duplicate
            check_query = "SELECT attendance_id FROM attendance WHERE student_id = %s AND timetable_id = %s AND attendance_date = %s"
            existing = execute_query(check_query, (student_id, timetable_id, date_str), fetchone=True)
            
            if existing:
                # Update existing record
                update_query = "UPDATE attendance SET status = %s, marked_by = %s WHERE attendance_id = %s"
                execute_query(update_query, (status, marked_by, existing['attendance_id']), commit=True)
                results['duplicates'] += 1
            else:
                # Insert new record
                insert_query = """
                    INSERT INTO attendance (student_id, timetable_id, attendance_date, status, marked_by)
                    VALUES (%s, %s, %s, %s, %s)
                """
                execute_query(insert_query, (student_id, timetable_id, date_str, status, marked_by), commit=True)
                results['success'] += 1
                
            # If absent, queue a WhatsApp message log
            if status == 'absent':
                student = execute_query("SELECT full_name, parent_phone FROM students WHERE student_id = %s", (student_id,), fetchone=True)
                subject = execute_query("""
                    SELECT s.subject_name 
                    FROM subjects s 
                    JOIN teacher_subjects ts ON s.subject_id = ts.subject_id 
                    JOIN timetables t ON ts.teacher_subject_id = t.teacher_subject_id 
                    WHERE t.timetable_id = %s
                """, (timetable_id,), fetchone=True)
                
                if student and subject and student['parent_phone']:
                    msg = f"Dear Parent, your ward {student['full_name']} was absent for {subject['subject_name']} on {date_str}."
                    msg_query = """
                        INSERT INTO whatsapp_logs (student_id, phone_number, message, message_type, status)
                        VALUES (%s, %s, %s, 'attendance_alert', 'pending')
                    """
                    execute_query(msg_query, (student_id, student['parent_phone'], msg), commit=True)

        return jsonify({'message': 'Attendance marked successfully', 'details': results}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500
