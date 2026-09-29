from flask import Blueprint, jsonify, session, request
from models.db import execute_query
from datetime import datetime

classes_bp = Blueprint('classes', __name__)

@classes_bp.route('/classes', methods=['GET'])
def get_classes():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    query = """
        SELECT DISTINCT c.class_id, c.academic_year, c.semester, c.year_name, c.division, c.section_name, 
               s.subject_name, s.subject_code, ts.teacher_subject_id
        FROM classes c
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        JOIN subjects s ON ts.subject_id = s.subject_id
        WHERE ts.teacher_id = %s
    """
    classes = execute_query(query, (teacher_id,), fetchall=True) or []

    for cls in classes:
        count = execute_query("SELECT COUNT(*) as count FROM students WHERE class_id = %s", (cls['class_id'],), fetchone=True)
        cls['student_count'] = count['count'] if count else 0

    return jsonify(classes), 200

@classes_bp.route('/classes', methods=['POST'])
def create_class():
    if 'user_id' not in session or 'teacher_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session['teacher_id']
    data = request.json or {}

    section_name = (data.get('section_name') or data.get('className') or '').strip()
    subject_name = (data.get('subject_name') or data.get('subjectName') or '').strip()
    subject_code = (data.get('subject_code') or data.get('subjectCode') or f"SUB{datetime.now().strftime('%M%S')}").strip()
    semester = int(data.get('semester') or 1)
    academic_year = (data.get('academic_year') or '2026-27').strip()

    if not section_name or not subject_name:
        return jsonify({'error': 'Class name and subject name are required'}), 400

    try:
        # 1. Insert into classes table
        class_id = execute_query("""
            INSERT INTO classes (academic_year, semester, year_name, division, section_name)
            VALUES (%s, %s, 'Year', 'A', %s)
        """, (academic_year, semester, section_name), commit=True)

        # 2. Check/Insert into subjects table
        existing_sub = execute_query("SELECT subject_id FROM subjects WHERE subject_code = %s", (subject_code,), fetchone=True)
        if existing_sub:
            subject_id = existing_sub['subject_id']
        else:
            subject_id = execute_query("""
                INSERT INTO subjects (subject_code, subject_name, semester, credits)
                VALUES (%s, %s, %s, 4)
            """, (subject_code, subject_name, semester), commit=True)

        # 3. Create teacher_subjects mapping
        teacher_subject_id = execute_query("""
            INSERT INTO teacher_subjects (teacher_id, subject_id, class_id)
            VALUES (%s, %s, %s)
        """, (teacher_id, subject_id, class_id), commit=True)

        # 4. Create sample timetables for all weekdays so attendance can be taken immediately
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        for day in days:
            execute_query("""
                INSERT INTO timetables (teacher_subject_id, day_of_week, start_time, end_time, room_number)
                VALUES (%s, %s, '09:00:00', '10:00:00', 'Room 101')
            """, (teacher_subject_id, day), commit=True)

        return jsonify({
            'message': 'Class created successfully',
            'class': {
                'class_id': class_id,
                'section_name': section_name,
                'subject_name': subject_name,
                'subject_code': subject_code,
                'semester': semester,
                'student_count': 0,
                'teacher_subject_id': teacher_subject_id
            }
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@classes_bp.route('/classes/<int:class_id>', methods=['GET'])
def get_class(class_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    # Verify ownership
    ts = execute_query("SELECT teacher_subject_id FROM teacher_subjects WHERE class_id = %s AND teacher_id = %s", (class_id, teacher_id), fetchone=True)
    if not ts and session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden access to class'}), 403

    query = "SELECT * FROM classes WHERE class_id = %s"
    cls = execute_query(query, (class_id,), fetchone=True)
    if not cls:
        return jsonify({'error': 'Class not found'}), 404
    return jsonify(cls), 200

@classes_bp.route('/classes/<int:class_id>/students', methods=['GET'])
def get_class_students(class_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    # Check if teacher has access to this class
    ts = execute_query("SELECT teacher_subject_id FROM teacher_subjects WHERE class_id = %s AND teacher_id = %s", (class_id, teacher_id), fetchone=True)
    if not ts and session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden access to class students'}), 403

    query = """
        SELECT student_id, roll_number, enrollment_number, full_name, email, phone, parent_name, parent_phone 
        FROM students 
        WHERE class_id = %s AND is_active = 1
        ORDER BY CAST(roll_number AS UNSIGNED), roll_number
    """
    students = execute_query(query, (class_id,), fetchall=True) or []
    return jsonify(students), 200

