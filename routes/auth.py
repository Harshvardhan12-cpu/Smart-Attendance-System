from flask import Blueprint, request, jsonify, session
from models.db import execute_query
import bcrypt

auth_bp = Blueprint('auth', __name__)

def log_login_attempt(email, status, user_id=None, failure_reason=None):
    try:
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr or '127.0.0.1').split(',')[0].strip()
        user_agent = request.user_agent.string if request.user_agent else 'Unknown'
        execute_query(
            """INSERT INTO login_logs (user_id, email, ip_address, user_agent, status, failure_reason)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (user_id, email, ip_address, user_agent, status, failure_reason),
            commit=True
        )
    except Exception as e:
        print(f"Error recording login audit log: {e}")

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

    # Check if user already exists by email
    existing = execute_query(
        "SELECT user_id FROM users WHERE email = %s",
        (email,),
        fetchone=True
    )
    if existing:
        return jsonify({'error': 'An account with this email already exists'}), 400

    # Hash password securely with bcrypt
    salt = bcrypt.gensalt()
    password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    # Insert user record
    insert_user_query = """
        INSERT INTO users (password_hash, role, full_name, email, is_active)
        VALUES (%s, %s, %s, %s, 1)
    """
    user_id = execute_query(insert_user_query, (password_hash, db_role, full_name, email), commit=True)

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
            'role': db_role,
            'full_name': full_name,
            'email': email,
            'teacher_id': teacher_id
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or data.get('username') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        log_login_attempt(email or 'unknown', 'failed', failure_reason='Missing email or password')
        return jsonify({'error': 'Email and password are required'}), 400

    user = execute_query(
        "SELECT * FROM users WHERE email = %s AND is_active = 1", 
        (email,), fetchone=True
    )

    if not user:
        log_login_attempt(email, 'failed', failure_reason='Account not found or inactive')
        return jsonify({'error': 'Invalid email or password'}), 401

    if bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
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

        # Log successful authentication attempt
        log_login_attempt(email, 'success', user_id=user['user_id'])

        return jsonify({
            'message': 'Login successful',
            'user': {
                'user_id': user['user_id'],
                'role': user['role'],
                'full_name': user['full_name'],
                'email': user['email'],
                'teacher_id': teacher_id
            }
        }), 200
    
    # Password mismatch
    log_login_attempt(email, 'failed', user_id=user['user_id'], failure_reason='Invalid password')
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

@auth_bp.route('/login-logs', methods=['GET'])
def get_login_logs():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    logs = execute_query("""
        SELECT l.*, u.full_name 
        FROM login_logs l 
        LEFT JOIN users u ON l.user_id = u.user_id 
        ORDER BY l.logged_at DESC LIMIT 100
    """, fetchall=True) or []
    
    for log in logs:
        if log.get('logged_at'):
            log['logged_at'] = str(log['logged_at'])
            
    return jsonify(logs), 200
