from flask import Blueprint, jsonify
from models.db import execute_query

students_bp = Blueprint('students', __name__)

@students_bp.route('/students', methods=['GET'])
def get_students():
    query = """
        SELECT s.*, c.section_name 
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
    """
    students = execute_query(query, fetchall=True)
    return jsonify(students), 200

@students_bp.route('/students/<int:student_id>', methods=['GET'])
def get_student(student_id):
    query = """
        SELECT s.*, c.section_name 
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        WHERE student_id = %s
    """
    student = execute_query(query, (student_id,), fetchone=True)
    if not student:
        return jsonify({'error': 'Student not found'}), 404
    return jsonify(student), 200
