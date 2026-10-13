from flask import Blueprint, jsonify, request, session
from models.db import execute_query
from datetime import datetime
from routes.whatsapp import send_whatsapp_message

attendance_bp = Blueprint('attendance', __name__)

@attendance_bp.route('/attendance', methods=['GET'])
def get_attendance():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    query = """
        SELECT a.attendance_id, a.attendance_date, a.status, a.marked_at,
               s.full_name as student_name, s.roll_number,
               c.section_name as class_name,
               sub.subject_name, sub.subject_code
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects sub ON ts.subject_id = sub.subject_id
        WHERE ts.teacher_id = %s
        ORDER BY a.attendance_date DESC, a.marked_at DESC
        LIMIT 200
    """
    records = execute_query(query, (teacher_id,), fetchall=True) or []
    for record in records:
        if record.get('attendance_date'):
            record['attendance_date'] = record['attendance_date'].strftime('%Y-%m-%d')
        if record.get('marked_at'):
            record['marked_at'] = record['marked_at'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(records), 200

@attendance_bp.route('/attendance', methods=['POST'])
def mark_attendance():
    data = request.json or {}
    timetable_id = data.get('timetable_id')
    date_str = data.get('date') # Format YYYY-MM-DD
    attendance_records = data.get('attendance') # List of {student_id, status}
    marked_by = session.get('user_id')
    teacher_id = session.get('teacher_id')
    
    if not marked_by or not teacher_id:
        return jsonify({'error': 'Unauthorized'}), 401

    if not timetable_id or not date_str or not attendance_records:
        return jsonify({'error': 'Missing required fields'}), 400

    # Security Check: Verify timetable belongs to this teacher
    tt_check = execute_query("""
        SELECT ts.teacher_id 
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE t.timetable_id = %s AND ts.teacher_id = %s
    """, (timetable_id, teacher_id), fetchone=True)

    if not tt_check and session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden access to lecture timetable'}), 403

    try:
        results = {'success': 0, 'errors': 0, 'duplicates': 0, 'whatsapp_sent': 0, 'whatsapp_errors': []}
        
        for record in attendance_records:
            student_id = record.get('student_id')
            status = record.get('status')
            
            # Check for existing record
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
                
            # Queue and send WhatsApp message log for all status types
            student = execute_query("SELECT full_name, roll_number, parent_phone FROM students WHERE student_id = %s", (student_id,), fetchone=True)
            subject = execute_query("""
                SELECT s.subject_name, s.subject_code, c.section_name 
                FROM subjects s 
                JOIN teacher_subjects ts ON s.subject_id = ts.subject_id 
                JOIN timetables t ON ts.teacher_subject_id = t.teacher_subject_id 
                JOIN classes c ON ts.class_id = c.class_id
                WHERE t.timetable_id = %s
            """, (timetable_id,), fetchone=True)
            faculty = execute_query("SELECT full_name FROM users WHERE user_id = %s", (marked_by,), fetchone=True)
            faculty_name = faculty['full_name'] if faculty and faculty.get('full_name') else session.get('full_name', 'Faculty Member')
            if not faculty_name.startswith('Prof.'):
                faculty_name = f"Prof. {faculty_name}"

            if student and subject and student['parent_phone']:
                if status == 'absent':
                    status_badge = "❌ ABSENT"
                elif status == 'late':
                    status_badge = "⏳ LATE"
                else:
                    status_badge = "✅ PRESENT"

                roll_info = f" (Roll No: {student['roll_number']})" if student.get('roll_number') else ""
                subj_info = f"{subject['subject_name']}" + (f" ({subject['subject_code']})" if subject.get('subject_code') else "")
                class_info = f"{subject['section_name']}" if subject.get('section_name') else "Class"

                msg = (
                    f"🎓 *Smart Attendance System Alert*\n\n"
                    f"Dear Parent,\n\n"
                    f"This is an official attendance update regarding your ward:\n\n"
                    f"👤 *Student*: {student['full_name']}{roll_info}\n"
                    f"📌 *Status*: {status_badge}\n"
                    f"📖 *Subject*: {subj_info}\n"
                    f"🏫 *Class*: {class_info}\n"
                    f"👨‍🏫 *Professor*: {faculty_name}\n"
                    f"📅 *Date*: {date_str}\n\n"
                    f"Thank you,\n"
                    f"*Department of Computer Engineering*"
                )
                
                success, error_reason = send_whatsapp_message(student['parent_phone'], msg)
                log_status = 'sent' if success else 'failed'
                
                msg_query = """
                    INSERT INTO whatsapp_logs (student_id, phone_number, message, message_type, status, error_message)
                    VALUES (%s, %s, %s, 'attendance_alert', %s, %s)
                """
                execute_query(msg_query, (student_id, student['parent_phone'], msg, log_status, error_reason), commit=True)
                
                if success:
                    results['whatsapp_sent'] += 1
                else:
                    results['whatsapp_errors'].append({
                        'student': student['full_name'],
                        'error': error_reason
                    })

        return jsonify({'message': 'Attendance marked successfully', 'details': results}), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

