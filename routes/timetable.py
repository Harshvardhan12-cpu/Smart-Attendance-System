from flask import Blueprint, jsonify, session
from models.db import execute_query
from datetime import datetime

timetable_bp = Blueprint('timetable', __name__)

@timetable_bp.route('/timetable', methods=['GET'])
def get_timetable():
    teacher_id = session.get('teacher_id')
    query = """
        SELECT t.timetable_id, t.day_of_week, t.start_time, t.end_time, t.room_number,
               s.subject_name, c.section_name as class_name, c.class_id
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects s ON ts.subject_id = s.subject_id
        JOIN classes c ON ts.class_id = c.class_id
    """
    params = []
    if teacher_id:
        query += " WHERE ts.teacher_id = %s"
        params.append(teacher_id)
        
    query += " ORDER BY t.day_of_week, t.start_time"
    
    tt = execute_query(query, params, fetchall=True)
    
    # Format times to strings
    for item in tt:
        item['start_time'] = str(item['start_time'])
        item['end_time'] = str(item['end_time'])
        
    return jsonify(tt), 200

@timetable_bp.route('/timetable/today', methods=['GET'])
def get_today_timetable():
    teacher_id = session.get('teacher_id')
    today_name = datetime.now().strftime('%A')
    
    query = """
        SELECT t.timetable_id, t.day_of_week, t.start_time, t.end_time, t.room_number,
               s.subject_name, c.section_name as class_name, c.class_id, ts.teacher_subject_id
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects s ON ts.subject_id = s.subject_id
        JOIN classes c ON ts.class_id = c.class_id
        WHERE t.day_of_week = %s
    """
    params = [today_name]
    
    if teacher_id:
        query += " AND ts.teacher_id = %s"
        params.append(teacher_id)
        
    query += " ORDER BY t.start_time"
    
    tt = execute_query(query, params, fetchall=True)
    
    # Format times to strings and determine status (Scheduled, Completed, In Progress)
    now = datetime.now().time()
    for item in tt:
        # Convert timedelta from db to time object (mysql returns timedelta for TIME)
        start_t = (datetime.min + item['start_time']).time()
        end_t = (datetime.min + item['end_time']).time()
        
        item['start_time'] = start_t.strftime('%I:%M %p')
        item['end_time'] = end_t.strftime('%I:%M %p')
        
        if now > end_t:
            item['status'] = 'Completed'
        elif now < start_t:
            item['status'] = 'Scheduled'
        else:
            item['status'] = 'In Progress'
            
    return jsonify(tt), 200
