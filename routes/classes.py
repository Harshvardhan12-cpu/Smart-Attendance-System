from flask import Blueprint, jsonify, session
from models.db import execute_query

classes_bp = Blueprint('classes', __name__)

@classes_bp.route('/classes', methods=['GET'])
def get_classes():
    teacher_id = session.get('teacher_id')
    # If a teacher is logged in, only fetch their classes
    if teacher_id:
        query = """
            SELECT DISTINCT c.*, s.subject_name 
            FROM classes c
            JOIN teacher_subjects ts ON c.class_id = ts.class_id
            JOIN subjects s ON ts.subject_id = s.subject_id
            WHERE ts.teacher_id = %s
        """
        classes = execute_query(query, (teacher_id,), fetchall=True)
    else:
        # Admin or other role: fetch all classes
        query = "SELECT * FROM classes"
        classes = execute_query(query, fetchall=True)
        
    # Get student counts
    for cls in classes:
        count = execute_query("SELECT COUNT(*) as count FROM students WHERE class_id = %s", (cls['class_id'],), fetchone=True)
        cls['student_count'] = count['count'] if count else 0

    return jsonify(classes), 200

@classes_bp.route('/classes/<int:class_id>', methods=['GET'])
def get_class(class_id):
    query = "SELECT * FROM classes WHERE class_id = %s"
    cls = execute_query(query, (class_id,), fetchone=True)
    if not cls:
        return jsonify({'error': 'Class not found'}), 404
    return jsonify(cls), 200

@classes_bp.route('/classes/<int:class_id>/students', methods=['GET'])
def get_class_students(class_id):
    query = """
        SELECT student_id, roll_number, enrollment_number, full_name, email, phone 
        FROM students 
        WHERE class_id = %s AND is_active = 1
        ORDER BY roll_number
    """
    students = execute_query(query, (class_id,), fetchall=True)
    return jsonify(students), 200
