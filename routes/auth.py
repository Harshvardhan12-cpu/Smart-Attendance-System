from flask import Blueprint, request, jsonify, session
from models.db import execute_query
import bcrypt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
@auth_bp.route('/signup', methods=['POST'])
def register():
    data = request.json or {}
    full_name = (data.get('full_name') or data.get('fullName') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    role_input = (data.get('role') or 'teacher').strip().lower()

    if not full_name or not email or not password:
        return jsonify({'error': 'Full name, email, and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long'}), 400

    # Map role input to database enum ('admin', 'teacher', 'student')
    if role_input in ['professor', 'teacher', 'faculty']:
        db_role = 'teacher'
    elif role_input in ['admin', 'administrator']:
        db_role = 'admin'
    elif role_input in ['student']:
        db_role = 'student'
    else:
        db_role = 'teacher'

    username = email.split('@')[0]

    # Check if user already exists
    existing = execute_query(
        "SELECT user_id FROM users WHERE username = %s OR email = %s",
        (username, email),
        fetchone=True
    )
    if existing:
        return jsonify({'error': 'An account with this email already exists'}), 400

    # Hash password securely with bcrypt
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    # Insert user record
    insert_user_query = """
        INSERT INTO users (username, password_hash, role, full_name, email, is_active)
        VALUES (%s, %s, %s, %s, %s, 1)
    """
    user_id = execute_query(insert_user_query, (username, password_hash, db_role, full_name, email), commit=True)

    teacher_id = None
    if db_role == 'teacher':
        emp_id = f"EMP{user_id:04d}"
        insert_teacher_query = """
            INSERT INTO teachers (user_id, employee_id, full_name, email)
            VALUES (%s, %s, %s, %s)
        """
        teacher_id = execute_query(insert_teacher_query, (user_id, emp_id, full_name, email), commit=True)

    # Establish session
    session['user_id'] = user_id
    session['role'] = db_role
    session['full_name'] = full_name
    if teacher_id:
        session['teacher_id'] = teacher_id

    return jsonify({
        'message': 'Registration successful',
        'user': {
            'user_id': user_id,
            'username': username,
            'role': db_role,
            'full_name': full_name,
            'email': email,
            'teacher_id': teacher_id
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    username = (data.get('username') or data.get('email') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'error': 'Email/username and password are required'}), 400

    user = execute_query(
        "SELECT * FROM users WHERE (username = %s OR email = %s) AND is_active = 1", 
        (username, username), fetchone=True
    )

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        session['user_id'] = user['user_id']
        session['role'] = user['role']
        session['full_name'] = user['full_name']
        
        teacher_id = None
        if user['role'] == 'teacher':
            teacher = execute_query("SELECT teacher_id FROM teachers WHERE user_id = %s", (user['user_id'],), fetchone=True)
            if teacher:
                teacher_id = teacher['teacher_id']
            else:
                emp_id = f"EMP{user['user_id']:04d}"
                teacher_id = execute_query(
                    "INSERT INTO teachers (user_id, employee_id, full_name, email) VALUES (%s, %s, %s, %s)",
                    (user['user_id'], emp_id, user['full_name'], user.get('email')),
                    commit=True
                )
            session['teacher_id'] = teacher_id

        return jsonify({
            'message': 'Login successful',
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'role': user['role'],
                'full_name': user['full_name'],
                'teacher_id': teacher_id
            }
        }), 200
    
    return jsonify({'error': 'Invalid email or password'}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@auth_bp.route('/current-user', methods=['GET'])
def current_user():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
        
    return jsonify({
        'user_id': session.get('user_id'),
        'role': session.get('role'),
        'full_name': session.get('full_name'),
        'teacher_id': session.get('teacher_id')
    }), 200

