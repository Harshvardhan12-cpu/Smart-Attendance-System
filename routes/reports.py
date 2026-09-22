from flask import Blueprint, jsonify, session
from models.db import execute_query
from datetime import datetime

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    teacher_id = session.get('teacher_id')
    today = datetime.now().date()
    today_str = today.strftime('%Y-%m-%d')
    day_name = datetime.now().strftime('%A')
    
    # Base params
    stats = {
        'todays_classes': 0,
        'todays_classes_completed': 0,
        'students_assigned': 0,
        'attendance_submitted': 0,
        'students_present': 0,
        'students_absent': 0,
        'pending_attendance': 0
    }
    
    if not teacher_id:
        return jsonify(stats), 200
        
    # 1. Today's Classes
    tt_query = """
        SELECT t.timetable_id 
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s AND t.day_of_week = %s
    """
    todays_tts = execute_query(tt_query, (teacher_id, day_name), fetchall=True)
    stats['todays_classes'] = len(todays_tts)
    
    timetable_ids = [tt['timetable_id'] for tt in todays_tts]
    
    # 2. Students Assigned
    assigned_query = """
        SELECT COUNT(DISTINCT s.student_id) as count
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE ts.teacher_id = %s
    """
    assigned = execute_query(assigned_query, (teacher_id,), fetchone=True)
    stats['students_assigned'] = assigned['count'] if assigned else 0
    
    # 3. Attendance Submitted & Pending
    if timetable_ids:
        format_strings = ','.join(['%s'] * len(timetable_ids))
        sub_query = f"""
            SELECT COUNT(DISTINCT timetable_id) as count
            FROM attendance
            WHERE attendance_date = %s AND timetable_id IN ({format_strings})
        """
        params = [today_str] + timetable_ids
        submitted = execute_query(sub_query, tuple(params), fetchone=True)
        stats['attendance_submitted'] = submitted['count'] if submitted else 0
        stats['pending_attendance'] = stats['todays_classes'] - stats['attendance_submitted']
        
        # 4. Students Present / Absent Today
        pres_query = f"""
            SELECT COUNT(*) as count
            FROM attendance
            WHERE attendance_date = %s AND status = 'present' AND timetable_id IN ({format_strings})
        """
        pres = execute_query(pres_query, tuple(params), fetchone=True)
        stats['students_present'] = pres['count'] if pres else 0
        
        abs_query = f"""
            SELECT COUNT(*) as count
            FROM attendance
            WHERE attendance_date = %s AND status = 'absent' AND timetable_id IN ({format_strings})
        """
        abse = execute_query(abs_query, tuple(params), fetchone=True)
        stats['students_absent'] = abse['count'] if abse else 0
        
    return jsonify(stats), 200

@reports_bp.route('/attendance-summary', methods=['GET'])
def get_attendance_summary():
    # Example logic for reports page
    # Just returning some placeholder structure since full reports require complex grouping
    summary = {
        'total_lectures': 120,
        'average_attendance': 85.5
    }
    return jsonify(summary), 200
