from flask import Blueprint, jsonify, session
from models.db import execute_query
from datetime import datetime

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    today = datetime.now().date()
    today_str = today.strftime('%Y-%m-%d')
    day_name = datetime.now().strftime('%A')
    
    stats = {
        'todays_classes': 0,
        'todays_classes_completed': 0,
        'students_assigned': 0,
        'attendance_submitted': 0,
        'students_present': 0,
        'students_absent': 0,
        'pending_attendance': 0,
        'attendance_rate': 0
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
    todays_tts = execute_query(tt_query, (teacher_id, day_name), fetchall=True) or []
    stats['todays_classes'] = len(todays_tts)
    
    timetable_ids = [tt['timetable_id'] for tt in todays_tts]
    
    # 2. Students Assigned across this teacher's classes
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

        total_marked = stats['students_present'] + stats['students_absent']
        if total_marked > 0:
            stats['attendance_rate'] = round((stats['students_present'] / total_marked) * 100, 1)

    return jsonify(stats), 200

@reports_bp.route('/attendance-summary', methods=['GET'])
def get_attendance_summary():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({'total_lectures': 0, 'average_attendance': 0}), 200

    query = """
        SELECT COUNT(DISTINCT a.attendance_id) as total_records,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s
    """
    res = execute_query(query, (teacher_id,), fetchone=True)
    total = res['total_records'] if res else 0
    present = res['present_count'] if res else 0
    rate = round((present / total * 100), 1) if total > 0 else 0

    summary = {
        'total_lectures': total,
        'average_attendance': rate
    }
    return jsonify(summary), 200

