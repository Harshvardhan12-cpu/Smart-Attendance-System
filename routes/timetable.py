from flask import Blueprint, jsonify, session
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

@timetable_bp.route('/timetable/today', methods=['GET'])
def get_today_timetable():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

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
        
        if now > end_t:
            item['status'] = 'Completed'
        elif now < start_t:
            item['status'] = 'Scheduled'
        else:
            item['status'] = 'In Progress'
            
    return jsonify(tt), 200

