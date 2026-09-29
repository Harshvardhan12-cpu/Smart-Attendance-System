from flask import Blueprint, jsonify, request, session
from models.db import execute_query
from datetime import datetime

students_bp = Blueprint('students', __name__)

@students_bp.route('/students', methods=['GET'])
def get_students():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    query = """
        SELECT DISTINCT s.*, c.section_name 
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE ts.teacher_id = %s
        ORDER BY c.section_name, CAST(s.roll_number AS UNSIGNED), s.roll_number
    """
    students = execute_query(query, (teacher_id,), fetchall=True) or []
    return jsonify(students), 200

@students_bp.route('/students', methods=['POST'])
def add_student():
    if 'user_id' not in session or 'teacher_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session['teacher_id']
    data = request.json or {}

    class_id = data.get('class_id')
    roll_number = str(data.get('roll_number') or '').strip()
    full_name = (data.get('full_name') or data.get('fullName') or '').strip()
    email = (data.get('email') or '').strip()
    parent_name = (data.get('parent_name') or data.get('parentName') or '').strip()
    parent_phone = (data.get('parent_phone') or data.get('parentPhone') or '').strip()
    enrollment_number = (data.get('enrollment_number') or f"EN{datetime.now().year}{roll_number.zfill(3)}").strip()

    if not class_id or not roll_number or not full_name:
        return jsonify({'error': 'Class ID, roll number, and student full name are required'}), 400

    # Verify class belongs to this teacher
    ts = execute_query("SELECT teacher_subject_id FROM teacher_subjects WHERE class_id = %s AND teacher_id = %s", (class_id, teacher_id), fetchone=True)
    if not ts and session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden access to target class'}), 403

    try:
        student_id = execute_query("""
            INSERT INTO students (class_id, roll_number, enrollment_number, full_name, email, parent_name, parent_phone, admission_year)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (class_id, roll_number, enrollment_number, full_name, email, parent_name, parent_phone, datetime.now().year), commit=True)

        return jsonify({
            'message': 'Student added successfully',
            'student': {
                'student_id': student_id,
                'class_id': class_id,
                'roll_number': roll_number,
                'enrollment_number': enrollment_number,
                'full_name': full_name,
                'email': email,
                'parent_name': parent_name,
                'parent_phone': parent_phone
            }
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@students_bp.route('/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')

    query = """
        SELECT s.*, c.section_name 
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE s.student_id = %s AND ts.teacher_id = %s
    """
    student = execute_query(query, (student_id, teacher_id), fetchone=True)
    if not student:
        return jsonify({'error': 'Student not found or access denied'}), 404
    return jsonify(student), 200

