from flask import Blueprint, request, jsonify, session
from models.db import execute_query
import bcrypt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    user = execute_query(
        "SELECT * FROM users WHERE (username = %s OR email = %s) AND is_active = 1", 
        (username, username), fetchone=True
    )

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        session['user_id'] = user['user_id']
        session['role'] = user['role']
        session['full_name'] = user['full_name']
        
        # If teacher, get teacher_id
        if user['role'] == 'teacher':
            teacher = execute_query("SELECT teacher_id FROM teachers WHERE user_id = %s", (user['user_id'],), fetchone=True)
            if teacher:
                session['teacher_id'] = teacher['teacher_id']

        return jsonify({
            'message': 'Login successful',
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'role': user['role'],
                'full_name': user['full_name']
            }
        }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

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
