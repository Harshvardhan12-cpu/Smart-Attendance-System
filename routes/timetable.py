from flask import Blueprint, jsonify, session, request
from models.db import execute_query
from datetime import datetime

timetable_bp = Blueprint('timetable', __name__)

@timetable_bp.route('/timetable', methods=['GET'])
def get_timetable():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    query = """
        SELECT t.timetable_id, t.day_of_week, t.start_time, t.end_time, t.room_number,
               s.subject_name, s.subject_code, c.section_name as class_name, c.class_id, ts.teacher_subject_id
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects s ON ts.subject_id = s.subject_id
        JOIN classes c ON ts.class_id = c.class_id
        WHERE ts.teacher_id = %s
        ORDER BY FIELD(t.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'), t.start_time
    """
    tt = execute_query(query, (teacher_id,), fetchall=True) or []
    
    # Format times to strings
    for item in tt:
        item['start_time'] = str(item['start_time'])
        item['end_time'] = str(item['end_time'])
        
    return jsonify(tt), 200


@timetable_bp.route('/timetable', methods=['POST'])
def create_timetable():
    """
    Create a new timetable slot.
    Called by the Edit Today's Classes modal when the teacher adds a new session.
    Body: { teacher_subject_id, day_of_week, start_time, end_time, room_number }
    """
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({'error': 'Teacher session not found'}), 403

    data = request.json or {}
    teacher_subject_id = data.get('teacher_subject_id')
    day_of_week = data.get('day_of_week', '').strip()
    start_time = data.get('start_time', '').strip()
    end_time = data.get('end_time', '').strip()
    room_number = data.get('room_number', 'Room 101').strip()

    if not teacher_subject_id or not day_of_week or not start_time or not end_time:
        return jsonify({'error': 'teacher_subject_id, day_of_week, start_time and end_time are required'}), 400

    # Validate allowed days
    allowed_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    if day_of_week not in allowed_days:
        return jsonify({'error': f'day_of_week must be one of: {", ".join(allowed_days)}'}), 400

    # Verify the teacher_subject_id belongs to this teacher
    ownership = execute_query(
        "SELECT teacher_subject_id FROM teacher_subjects WHERE teacher_subject_id = %s AND teacher_id = %s",
        (teacher_subject_id, teacher_id),
        fetchone=True
    )
    if not ownership:
        return jsonify({'error': 'You do not have access to this class/subject.'}), 403

    try:
        new_id = execute_query(
            """
            INSERT INTO timetables (teacher_subject_id, day_of_week, start_time, end_time, room_number)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (teacher_subject_id, day_of_week, start_time, end_time, room_number),
            commit=True
        )
        return jsonify({'message': 'Timetable slot created successfully', 'timetable_id': new_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@timetable_bp.route('/timetable/today', methods=['GET'])
def get_today_timetable():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    today_date = datetime.now().date()
    today_str = today_date.strftime('%Y-%m-%d')
    today_name = datetime.now().strftime('%A')
    
    query = """
        SELECT t.timetable_id, t.day_of_week, t.start_time, t.end_time, t.room_number,
               s.subject_name, s.subject_code, c.section_name as class_name, c.class_id, ts.teacher_subject_id
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects s ON ts.subject_id = s.subject_id
        JOIN classes c ON ts.class_id = c.class_id
        WHERE t.day_of_week = %s AND ts.teacher_id = %s
        ORDER BY t.start_time
    """
    tt = execute_query(query, (today_name, teacher_id), fetchall=True) or []
    
    now = datetime.now().time()
    for item in tt:
        # Check if attendance is already marked for today
        att_check = execute_query(
            "SELECT COUNT(*) as count FROM attendance WHERE timetable_id = %s AND attendance_date = %s",
            (item['timetable_id'], today_str),
            fetchone=True
        )
        is_marked = bool(att_check and att_check['count'] > 0)
        item['is_marked'] = is_marked
        item['marked_count'] = att_check['count'] if att_check else 0

        # Convert timedelta from db to time object (mysql returns timedelta for TIME)
        if hasattr(item['start_time'], 'total_seconds'):
            start_t = (datetime.min + item['start_time']).time()
            end_t = (datetime.min + item['end_time']).time()
        else:
            start_t = datetime.strptime(str(item['start_time']), '%H:%M:%S').time() if isinstance(item['start_time'], str) else item['start_time']
            end_t = datetime.strptime(str(item['end_time']), '%H:%M:%S').time() if isinstance(item['end_time'], str) else item['end_time']

        item['start_time_str'] = start_t.strftime('%I:%M %p')
        item['end_time_str'] = end_t.strftime('%I:%M %p')
        item['start_time'] = str(item['start_time'])
        item['end_time'] = str(item['end_time'])
        
        if is_marked:
            item['status'] = 'Marked'
        elif now > end_t:
            item['status'] = 'Completed'
        elif now < start_t:
            item['status'] = 'Scheduled'
        else:
            item['status'] = 'In Progress'
            
    return jsonify(tt), 200


