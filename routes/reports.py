from flask import Blueprint, jsonify, session
from models.db import execute_query
from datetime import datetime
from datetime import timedelta
import calendar
import io


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


@reports_bp.route('/attendance-analytics', methods=['GET'])
def get_attendance_analytics():
    """Returns dynamic weekly attendance trend, present vs absent breakdown, and class-wise attendance stats for the dashboard."""
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({
            'weekly_trend': [],
            'present_absent': {'present_count': 0, 'absent_count': 0, 'late_count': 0, 'total_count': 0, 'present_pct': 0.0, 'absent_pct': 0.0, 'avg_pct': 0.0},
            'class_wise': []
        }), 200

    today = datetime.now().date()

    # 1. Weekly Trend (Monday to Friday of current week)
    start_of_week = today - timedelta(days=today.weekday())
    week_days = []
    day_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    for i in range(5):
        day_date = start_of_week + timedelta(days=i)
        is_today = (day_date == today)
        is_future = (day_date > today)
        week_days.append({
            'date': day_date.strftime('%Y-%m-%d'),
            'label': 'Today' if is_today else day_labels[i],
            'day_name': day_labels[i],
            'is_today': is_today,
            'is_future': is_future
        })

    format_dates = ','.join(['%s'] * len(week_days))
    dates_list = [d['date'] for d in week_days]

    weekly_query = f"""
        SELECT a.attendance_date,
               COUNT(*) as total_records,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s AND a.attendance_date IN ({format_dates})
        GROUP BY a.attendance_date
    """
    weekly_records = execute_query(weekly_query, tuple([teacher_id] + dates_list), fetchall=True) or []
    rec_by_date = {}
    for r in weekly_records:
        rec_by_date[str(r['attendance_date'])] = r

    weekly_trend = []
    for d in week_days:
        r = rec_by_date.get(d['date'])
        if r and r['total_records'] > 0:
            pct = round((r['present_count'] / r['total_records']) * 100, 1)
        else:
            pct = 0.0

        weekly_trend.append({
            'date': d['date'],
            'label': d['label'],
            'day_name': d['day_name'],
            'percentage': pct,
            'is_today': d['is_today'],
            'is_future': d['is_future'],
            'has_data': (r is not None and r['total_records'] > 0)
        })

    # 2. Present vs Absent Ratio (Cumulative attendance for this teacher)
    dist_query = """
        SELECT 
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
            COUNT(*) as total_count
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s
    """
    dist = execute_query(dist_query, (teacher_id,), fetchone=True) or {}
    pres_count = int(dist.get('present_count') or 0)
    abse_count = int(dist.get('absent_count') or 0)
    late_count = int(dist.get('late_count') or 0)
    total_att = pres_count + abse_count + late_count

    if total_att > 0:
        pres_pct = round((pres_count / total_att) * 100, 1)
        abse_pct = round((abse_count / total_att) * 100, 1)
        late_pct = round((late_count / total_att) * 100, 1)
        avg_pct = pres_pct
    else:
        pres_pct = 0.0
        abse_pct = 0.0
        late_pct = 0.0
        avg_pct = 0.0

    present_absent = {
        'present_count': pres_count,
        'absent_count': abse_count,
        'late_count': late_count,
        'total_count': total_att,
        'present_pct': pres_pct,
        'absent_pct': abse_pct,
        'late_pct': late_pct,
        'avg_pct': avg_pct
    }

    # 3. Class-Wise Attendance (for classes taught by this teacher)
    class_query = """
        SELECT c.class_id, c.section_name,
               COUNT(a.attendance_id) as total_records,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count
        FROM classes c
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        LEFT JOIN timetables t ON ts.teacher_subject_id = t.teacher_subject_id
        LEFT JOIN attendance a ON t.timetable_id = a.timetable_id
        WHERE ts.teacher_id = %s
        GROUP BY c.class_id, c.section_name
        ORDER BY c.section_name
    """
    class_records = execute_query(class_query, (teacher_id,), fetchall=True) or []
    class_wise = []
    for cr in class_records:
        tot = int(cr.get('total_records') or 0)
        p_cnt = int(cr.get('present_count') or 0)
        rate = round((p_cnt / tot * 100), 1) if tot > 0 else 0.0
        class_wise.append({
            'class_id': cr['class_id'],
            'section_name': cr['section_name'],
            'total_records': tot,
            'present_count': p_cnt,
            'attendance_rate': rate
        })

    return jsonify({
        'weekly_trend': weekly_trend,
        'present_absent': present_absent,
        'class_wise': class_wise
    }), 200


@reports_bp.route('/notifications', methods=['GET'])
def get_notifications():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    notifications = []
    today = datetime.now().date()
    today_str = today.strftime('%Y-%m-%d')
    day_name = datetime.now().strftime('%A')

    # 1. Pending attendance notifications
    pending_query = """
        SELECT t.timetable_id, s.subject_name, c.section_name,
               t.start_time, t.end_time
        FROM timetables t
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects s ON ts.subject_id = s.subject_id
        JOIN classes c ON ts.class_id = c.class_id
        WHERE ts.teacher_id = %s AND t.day_of_week = %s
          AND t.timetable_id NOT IN (
              SELECT DISTINCT timetable_id FROM attendance WHERE attendance_date = %s
          )
        ORDER BY t.start_time
    """
    pending = execute_query(pending_query, (teacher_id, day_name, today_str), fetchall=True) or []
    for p in pending:
        start_time = str(p.get('start_time', ''))
        notifications.append({
            'type': 'pending',
            'icon': 'fa-solid fa-circle-exclamation',
            'color': 'var(--pending)',
            'message': f"Pending attendance for <strong>{p['section_name']}</strong> — {p['subject_name']}",
            'sub': f"Scheduled at {start_time}",
            'action': 'Mark Attendance',
            'time': 'Today'
        })

    # 2. Recent WhatsApp notification status (last 24 hours)
    wa_query = """
        SELECT w.status, COUNT(*) as count, MAX(w.created_at) as latest
        FROM whatsapp_logs w
        JOIN students s ON w.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE ts.teacher_id = %s AND w.created_at >= %s
        GROUP BY w.status
    """
    yesterday_str = (today - timedelta(days=1)).strftime('%Y-%m-%d')
    wa_stats = execute_query(wa_query, (teacher_id, yesterday_str), fetchall=True) or []
    for ws in wa_stats:
        if ws['status'] == 'sent':
            notifications.append({
                'type': 'whatsapp_sent',
                'icon': 'fa-solid fa-circle-check',
                'color': 'var(--present)',
                'message': f"<strong>{ws['count']}</strong> WhatsApp alert(s) sent successfully",
                'sub': 'Last 24 hours',
                'action': 'Reports',
                'time': 'Recent'
            })
        elif ws['status'] == 'failed':
            notifications.append({
                'type': 'whatsapp_failed',
                'icon': 'fa-solid fa-triangle-exclamation',
                'color': 'var(--absent)',
                'message': f"<strong>{ws['count']}</strong> WhatsApp alert(s) failed to send",
                'sub': 'Check configuration',
                'action': 'Reports',
                'time': 'Recent'
            })

    # 3. Low attendance students alert
    low_query = """
        SELECT COUNT(*) as low_count
        FROM (
            SELECT s.student_id,
                   ROUND(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as pct
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN timetables t ON a.timetable_id = t.timetable_id
            JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
            WHERE ts.teacher_id = %s AND s.is_active = 1
            GROUP BY s.student_id
            HAVING pct < 75
        ) low_students
    """
    low_result = execute_query(low_query, (teacher_id,), fetchone=True)
    low_count = low_result['low_count'] if low_result else 0
    if low_count > 0:
        notifications.append({
            'type': 'low_attendance',
            'icon': 'fa-solid fa-user-xmark',
            'color': 'var(--absent)',
            'message': f"<strong>{low_count}</strong> student(s) below 75% attendance",
            'sub': 'Requires attention',
            'action': 'Reports',
            'time': 'Active'
        })

    # 4. Attendance completed today
    completed_query = """
        SELECT COUNT(DISTINCT a.timetable_id) as completed
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s AND a.attendance_date = %s
    """
    completed_res = execute_query(completed_query, (teacher_id, today_str), fetchone=True)
    completed_count = completed_res['completed'] if completed_res else 0
    if completed_count > 0:
        notifications.append({
            'type': 'completed',
            'icon': 'fa-solid fa-clipboard-check',
            'color': 'var(--present)',
            'message': f"Attendance marked for <strong>{completed_count}</strong> class(es) today",
            'sub': 'Today\'s progress',
            'action': 'Attendance History',
            'time': 'Today'
        })

    return jsonify(notifications), 200


@reports_bp.route('/monthly-report', methods=['GET'])
def get_monthly_report():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({'error': 'Teacher session not found'}), 403

    from flask import request as req
    month = int(req.args.get('month', datetime.now().month))
    year = int(req.args.get('year', datetime.now().year))
    class_id = req.args.get('class_id', None)

    _, last_day = calendar.monthrange(year, month)
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{last_day:02d}"
    month_name = calendar.month_name[month]

    # Get classes for this teacher
    if class_id:
        classes_query = """
            SELECT DISTINCT c.class_id, c.section_name
            FROM classes c
            JOIN teacher_subjects ts ON c.class_id = ts.class_id
            WHERE ts.teacher_id = %s AND c.class_id = %s
        """
        classes = execute_query(classes_query, (teacher_id, class_id), fetchall=True) or []
    else:
        classes_query = """
            SELECT DISTINCT c.class_id, c.section_name
            FROM classes c
            JOIN teacher_subjects ts ON c.class_id = ts.class_id
            WHERE ts.teacher_id = %s
            ORDER BY c.section_name
        """
        classes = execute_query(classes_query, (teacher_id,), fetchall=True) or []

    report_data = {
        'month': month,
        'year': year,
        'month_name': month_name,
        'start_date': start_date,
        'end_date': end_date,
        'classes': [],
        'summary': {
            'total_classes': 0,
            'total_students': 0,
            'total_present': 0,
            'total_absent': 0,
            'total_late': 0,
            'overall_attendance_pct': 0.0,
            'total_defaulters': 0
        }
    }

    total_present_all = 0
    total_absent_all = 0
    total_late_all = 0
    total_students_all = 0
    total_defaulters_all = 0
    total_pct_sum = 0.0

    for cls in classes:
        student_query = """
            SELECT s.roll_number, s.full_name,
                   COUNT(a.attendance_id) as total_lectures,
                   SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
                   SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                   SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
                   ROUND(IFNULL(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0) * 100, 0), 1) as attendance_percentage
            FROM students s
            LEFT JOIN attendance a ON s.student_id = a.student_id
                AND a.attendance_date >= %s AND a.attendance_date <= %s
                AND a.timetable_id IN (
                    SELECT t.timetable_id FROM timetables t
                    JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
                    WHERE ts.teacher_id = %s AND ts.class_id = %s
                )
            WHERE s.class_id = %s AND s.is_active = 1
            GROUP BY s.student_id, s.roll_number, s.full_name
            ORDER BY CAST(s.roll_number AS UNSIGNED), s.roll_number
        """
        students = execute_query(student_query, (start_date, end_date, teacher_id, cls['class_id'], cls['class_id']), fetchall=True) or []

        cls_total_present = 0
        cls_total_absent = 0
        cls_total_late = 0
        cls_defaulters = 0
        cls_lectures_held = 0

        # Convert Decimal types to float for JSON serialization
        for s in students:
            if s.get('attendance_percentage') is not None:
                s['attendance_percentage'] = float(s['attendance_percentage'])
            else:
                s['attendance_percentage'] = 0.0

            if s.get('total_lectures') is not None:
                s['total_lectures'] = int(s['total_lectures'])
            else:
                s['total_lectures'] = 0

            if s.get('present_count') is not None:
                s['present_count'] = int(s['present_count'])
            else:
                s['present_count'] = 0

            if s.get('absent_count') is not None:
                s['absent_count'] = int(s['absent_count'])
            else:
                s['absent_count'] = 0

            if s.get('late_count') is not None:
                s['late_count'] = int(s['late_count'])
            else:
                s['late_count'] = 0

            is_defaulter = s['attendance_percentage'] < 75.0
            s['status'] = 'Defaulter' if is_defaulter else 'Regular'

            cls_total_present += s['present_count']
            cls_total_absent += s['absent_count']
            cls_total_late += s['late_count']
            if s['total_lectures'] > cls_lectures_held:
                cls_lectures_held = s['total_lectures']
            if is_defaulter:
                cls_defaulters += 1

        total_students = len(students)
        avg_attendance = round(sum(s['attendance_percentage'] for s in students) / total_students, 1) if total_students > 0 else 0.0

        report_data['classes'].append({
            'class_id': cls['class_id'],
            'class_name': cls['section_name'],
            'students': students,
            'total_students': total_students,
            'total_lectures': cls_lectures_held,
            'total_present': cls_total_present,
            'total_absent': cls_total_absent,
            'total_late': cls_total_late,
            'defaulters_count': cls_defaulters,
            'average_attendance': avg_attendance
        })

        total_students_all += total_students
        total_present_all += cls_total_present
        total_absent_all += cls_total_absent
        total_late_all += cls_total_late
        total_defaulters_all += cls_defaulters
        total_pct_sum += (avg_attendance * total_students)

    overall_avg = round(total_pct_sum / total_students_all, 1) if total_students_all > 0 else 0.0
    report_data['summary'] = {
        'total_classes': len(report_data['classes']),
        'total_students': total_students_all,
        'total_present': total_present_all,
        'total_absent': total_absent_all,
        'total_late': total_late_all,
        'overall_attendance_pct': overall_avg,
        'total_defaulters': total_defaulters_all
    }

    return jsonify(report_data), 200


@reports_bp.route('/monthly-report/download', methods=['GET'])
def download_monthly_report_pdf():
    """Generate and download monthly attendance report as PDF with class-wise totals and executive summary."""
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({'error': 'Teacher session not found'}), 403

    from flask import request as req, make_response
    month = int(req.args.get('month', datetime.now().month))
    year = int(req.args.get('year', datetime.now().year))
    class_id = req.args.get('class_id', None)

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    except ImportError:
        return jsonify({'error': 'PDF generation library (reportlab) not installed. Run: pip install reportlab'}), 500

    _, last_day = calendar.monthrange(year, month)
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{last_day:02d}"
    month_name = calendar.month_name[month]

    # Get classes
    if class_id:
        classes_query = """
            SELECT DISTINCT c.class_id, c.section_name
            FROM classes c JOIN teacher_subjects ts ON c.class_id = ts.class_id
            WHERE ts.teacher_id = %s AND c.class_id = %s
        """
        classes = execute_query(classes_query, (teacher_id, class_id), fetchall=True) or []
    else:
        classes_query = """
            SELECT DISTINCT c.class_id, c.section_name
            FROM classes c JOIN teacher_subjects ts ON c.class_id = ts.class_id
            WHERE ts.teacher_id = %s ORDER BY c.section_name
        """
        classes = execute_query(classes_query, (teacher_id,), fetchall=True) or []

    # Gather data for all classes first to build summary + rosters
    class_reports = []
    total_students_all = 0
    total_present_all = 0
    total_absent_all = 0
    total_late_all = 0
    max_lectures_all = 0
    total_defaulters_all = 0
    pct_weighted_sum = 0.0

    for cls in classes:
        student_query = """
            SELECT s.roll_number, s.full_name,
                   COUNT(a.attendance_id) as total_lectures,
                   SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
                   SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                   SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
                   ROUND(IFNULL(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0) * 100, 0), 1) as pct
            FROM students s
            LEFT JOIN attendance a ON s.student_id = a.student_id
                AND a.attendance_date >= %s AND a.attendance_date <= %s
                AND a.timetable_id IN (
                    SELECT t.timetable_id FROM timetables t
                    JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
                    WHERE ts.teacher_id = %s AND ts.class_id = %s
                )
            WHERE s.class_id = %s AND s.is_active = 1
            GROUP BY s.student_id, s.roll_number, s.full_name
            ORDER BY CAST(s.roll_number AS UNSIGNED), s.roll_number
        """
        students = execute_query(student_query, (start_date, end_date, teacher_id, cls['class_id'], cls['class_id']), fetchall=True) or []

        cls_total_present = 0
        cls_total_absent = 0
        cls_total_late = 0
        cls_defaulters = 0
        cls_lectures_held = 0

        for s in students:
            s_lectures = int(s.get('total_lectures') or 0)
            s_present = int(s.get('present_count') or 0)
            s_absent = int(s.get('absent_count') or 0)
            s_late = int(s.get('late_count') or 0)
            s_pct = float(s.get('pct') or 0.0)

            cls_total_present += s_present
            cls_total_absent += s_absent
            cls_total_late += s_late
            if s_lectures > cls_lectures_held:
                cls_lectures_held = s_lectures
            if s_pct < 75.0:
                cls_defaulters += 1

        total_s = len(students)
        avg_pct = round(sum(float(s['pct'] or 0.0) for s in students) / total_s, 1) if total_s > 0 else 0.0

        total_students_all += total_s
        total_present_all += cls_total_present
        total_absent_all += cls_total_absent
        total_late_all += cls_total_late
        total_defaulters_all += cls_defaulters
        if cls_lectures_held > max_lectures_all:
            max_lectures_all = cls_lectures_held
        pct_weighted_sum += (avg_pct * total_s)

        class_reports.append({
            'class_id': cls['class_id'],
            'section_name': cls['section_name'],
            'students': students,
            'total_students': total_s,
            'lectures_held': cls_lectures_held,
            'total_present': cls_total_present,
            'total_absent': cls_total_absent,
            'total_late': cls_total_late,
            'average_pct': avg_pct,
            'defaulters_count': cls_defaulters
        })

    overall_avg_pct = round(pct_weighted_sum / total_students_all, 1) if total_students_all > 0 else 0.0

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=12 * mm,
        rightMargin=12 * mm
    )
    elements = []
    styles = getSampleStyleSheet()

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Title'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0f4c5c'),
        alignment=0,
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#555555'),
        alignment=0,
        spaceAfter=12
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#0f4c5c'),
        spaceBefore=10,
        spaceAfter=6
    )
    class_meta_style = ParagraphStyle(
        'ClassMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#444444'),
        spaceAfter=6
    )

    teacher_name = session.get('full_name', 'Teacher')
    now_str = datetime.now().strftime('%d %b %Y, %I:%M %p')

    # Main Report Title Block
    elements.append(Paragraph('Smart Attendance System — Monthly Class-Wise Attendance Report', title_style))
    elements.append(Paragraph(
        f'<b>Reporting Month:</b> {month_name} {year} &nbsp;|&nbsp; '
        f'<b>Period:</b> {start_date} to {end_date} &nbsp;|&nbsp; '
        f'<b>Generated By:</b> {teacher_name} &nbsp;|&nbsp; '
        f'<b>Date:</b> {now_str}',
        subtitle_style
    ))
    elements.append(Spacer(1, 6))

    # =========================================================================
    # 1. EXECUTIVE SUMMARY: CLASS-WISE TOTAL ATTENDANCE TABLE
    # =========================================================================
    elements.append(Paragraph('Executive Summary: Class-Wise Total Attendance', section_heading))

    summary_headers = ['Class Name', 'Enrolled', 'Lectures Held', 'Total Present', 'Total Absent', 'Total Late', 'Class Avg %', 'Defaulters (<75%)', 'Status']
    summary_data = [summary_headers]

    for cr in class_reports:
        c_status = 'Needs Review' if cr['defaulters_count'] > 0 else 'Good'
        summary_data.append([
            str(cr['section_name']),
            str(cr['total_students']),
            str(cr['lectures_held']),
            str(cr['total_present']),
            str(cr['total_absent']),
            str(cr['total_late']),
            f"{cr['average_pct']}%",
            str(cr['defaulters_count']),
            c_status
        ])

    # Grand Total Row for Executive Summary
    all_status = 'Needs Attention' if total_defaulters_all > 0 else 'Optimal'
    summary_data.append([
        'OVERALL TOTAL / ALL CLASSES',
        str(total_students_all),
        str(max_lectures_all),
        str(total_present_all),
        str(total_absent_all),
        str(total_late_all),
        f"{overall_avg_pct}%",
        str(total_defaulters_all),
        all_status
    ])

    summary_col_widths = [120, 65, 80, 75, 75, 65, 85, 95, 85]
    summary_table = Table(summary_data, colWidths=summary_col_widths, repeatRows=1)
    summary_table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f4c5c')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d0d7de')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8f9fa')]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        # Highlight Grand Total Row
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f4f8')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#0f4c5c')),
    ]

    # Tag defaulter cells in executive table if defaulters > 0
    for r_idx, cr in enumerate(class_reports, 1):
        if cr['defaulters_count'] > 0:
            summary_table_style.append(('TEXTCOLOR', (7, r_idx), (7, r_idx), colors.HexColor('#dc2626')))
            summary_table_style.append(('FONTNAME', (7, r_idx), (7, r_idx), 'Helvetica-Bold'))

    summary_table.setStyle(TableStyle(summary_table_style))
    elements.append(summary_table)
    elements.append(Spacer(1, 16))

    # =========================================================================
    # 2. CLASS-WISE DETAILED STUDENT ATTENDANCE ROSTERS
    # =========================================================================
    elements.append(Paragraph('Class-Wise Detailed Student Attendance Rosters', section_heading))

    for cr in class_reports:
        # Class Section Header with badges
        c_title = f"Class: {cr['section_name']}"
        elements.append(Paragraph(c_title, ParagraphStyle('ClsHead', parent=section_heading, fontSize=11, spaceBefore=8, spaceAfter=2)))
        elements.append(Paragraph(
            f"<b>Enrolled Students:</b> {cr['total_students']} &nbsp;|&nbsp; "
            f"<b>Lectures Held:</b> {cr['lectures_held']} &nbsp;|&nbsp; "
            f"<b>Total Present Attendance:</b> {cr['total_present']} &nbsp;|&nbsp; "
            f"<b>Total Absent:</b> {cr['total_absent']} &nbsp;|&nbsp; "
            f"<b>Class Average:</b> <b>{cr['average_pct']}%</b> &nbsp;|&nbsp; "
            f"<b>Defaulters (&lt;75%):</b> <font color=\"#dc2626\"><b>{cr['defaulters_count']}</b></font>",
            class_meta_style
        ))

        students = cr['students']
        if not students:
            elements.append(Paragraph('<i>No student attendance recorded for this class in selected period.</i>', styles['Normal']))
            elements.append(Spacer(1, 12))
            continue

        detail_headers = ['Roll No', 'Student Name', 'Total Lectures', 'Present', 'Absent', 'Late', 'Attendance %', 'Status']
        detail_data = [detail_headers]

        defaulter_rows = []

        for row_idx, s in enumerate(students, start=1):
            s_pct = float(s['pct']) if s['pct'] is not None else 0.0
            is_defaulter = s_pct < 75.0
            status_text = 'Defaulter' if is_defaulter else 'Regular'
            if is_defaulter:
                defaulter_rows.append(row_idx)

            detail_data.append([
                str(s['roll_number']),
                str(s['full_name']),
                str(int(s['total_lectures'] or 0)),
                str(int(s['present_count'] or 0)),
                str(int(s['absent_count'] or 0)),
                str(int(s['late_count'] or 0)),
                f"{s_pct}%",
                status_text
            ])

        # Bottom Summary Row for this class
        detail_data.append([
            '',
            f"CLASS TOTAL / AVERAGE ({cr['total_students']} students)",
            str(cr['lectures_held']),
            str(cr['total_present']),
            str(cr['total_absent']),
            str(cr['total_late']),
            f"{cr['average_pct']}%",
            f"{cr['defaulters_count']} Defaulter(s)"
        ])

        col_widths = [60, 185, 75, 65, 65, 55, 80, 85]
        detail_table = Table(detail_data, colWidths=col_widths, repeatRows=1)
        detail_table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f4c5c')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8.5),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d0d7de')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8f9fa')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            # Summary Row
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8f4f8')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#0f4c5c')),
        ]

        # Highlight defaulters in red
        for r_num in defaulter_rows:
            detail_table_style.append(('BACKGROUND', (0, r_num), (-1, r_num), colors.HexColor('#fff5f5')))
            detail_table_style.append(('TEXTCOLOR', (6, r_num), (7, r_num), colors.HexColor('#dc2626')))
            detail_table_style.append(('FONTNAME', (7, r_num), (7, r_num), 'Helvetica-Bold'))

        detail_table.setStyle(TableStyle(detail_table_style))
        elements.append(detail_table)
        elements.append(Spacer(1, 14))

    doc.build(elements)
    buffer.seek(0)

    filename = f"Monthly_Attendance_Report_{month_name}_{year}.pdf"
    if class_id and len(class_reports) == 1:
        c_label = class_reports[0]['section_name'].replace(' ', '_')
        filename = f"Monthly_Attendance_Report_{c_label}_{month_name}_{year}.pdf"

    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    return response


@reports_bp.route('/monthly-report/excel', methods=['GET'])
def download_monthly_report_excel():
    """Generate and download monthly attendance report as Excel with executive summary sheet and per-class sheets."""
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({'error': 'Teacher session not found'}), 403

    from flask import request as req, make_response
    month = int(req.args.get('month', datetime.now().month))
    year = int(req.args.get('year', datetime.now().year))
    class_id = req.args.get('class_id', None)

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        return jsonify({'error': 'Excel generation library (openpyxl) not installed. Run: pip install openpyxl'}), 500

    _, last_day = calendar.monthrange(year, month)
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{last_day:02d}"
    month_name = calendar.month_name[month]

    # Get classes
    if class_id:
        classes_query = """
            SELECT DISTINCT c.class_id, c.section_name
            FROM classes c JOIN teacher_subjects ts ON c.class_id = ts.class_id
            WHERE ts.teacher_id = %s AND c.class_id = %s
        """
        classes = execute_query(classes_query, (teacher_id, class_id), fetchall=True) or []
    else:
        classes_query = """
            SELECT DISTINCT c.class_id, c.section_name
            FROM classes c JOIN teacher_subjects ts ON c.class_id = ts.class_id
            WHERE ts.teacher_id = %s ORDER BY c.section_name
        """
        classes = execute_query(classes_query, (teacher_id,), fetchall=True) or []

    wb = Workbook()
    wb.remove(wb.active)  # Remove default blank sheet

    # Styling definitions
    header_font = Font(name='Calibri', bold=True, color='FFFFFF', size=10)
    header_fill = PatternFill(start_color='0F4C5C', end_color='0F4C5C', fill_type='solid')
    data_font = Font(name='Calibri', size=9)
    summary_fill = PatternFill(start_color='E8F4F8', end_color='E8F4F8', fill_type='solid')
    summary_font = Font(name='Calibri', bold=True, size=9, color='0F4C5C')
    defaulter_fill = PatternFill(start_color='FEE2E2', end_color='FEE2E2', fill_type='solid')
    defaulter_font = Font(name='Calibri', bold=True, color='DC2626', size=9)
    regular_font = Font(name='Calibri', bold=True, color='15803D', size=9)

    thin_border = Border(
        left=Side(style='thin', color='D0D7DE'),
        right=Side(style='thin', color='D0D7DE'),
        top=Side(style='thin', color='D0D7DE'),
        bottom=Side(style='thin', color='D0D7DE')
    )
    center_align = Alignment(horizontal='center', vertical='center')
    left_align = Alignment(horizontal='left', vertical='center')

    teacher_name = session.get('full_name', 'Teacher')
    now_str = datetime.now().strftime('%d %b %Y, %I:%M %p')

    # Gather data for all classes
    class_reports = []
    total_students_all = 0
    total_present_all = 0
    total_absent_all = 0
    total_late_all = 0
    max_lectures_all = 0
    total_defaulters_all = 0
    pct_weighted_sum = 0.0

    for cls in classes:
        student_query = """
            SELECT s.roll_number, s.full_name,
                   COUNT(a.attendance_id) as total_lectures,
                   SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
                   SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                   SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
                   ROUND(IFNULL(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.attendance_id), 0) * 100, 0), 1) as pct
            FROM students s
            LEFT JOIN attendance a ON s.student_id = a.student_id
                AND a.attendance_date >= %s AND a.attendance_date <= %s
                AND a.timetable_id IN (
                    SELECT t.timetable_id FROM timetables t
                    JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
                    WHERE ts.teacher_id = %s AND ts.class_id = %s
                )
            WHERE s.class_id = %s AND s.is_active = 1
            GROUP BY s.student_id, s.roll_number, s.full_name
            ORDER BY CAST(s.roll_number AS UNSIGNED), s.roll_number
        """
        students = execute_query(student_query, (start_date, end_date, teacher_id, cls['class_id'], cls['class_id']), fetchall=True) or []

        cls_total_present = 0
        cls_total_absent = 0
        cls_total_late = 0
        cls_defaulters = 0
        cls_lectures_held = 0

        for s in students:
            s_lectures = int(s.get('total_lectures') or 0)
            s_present = int(s.get('present_count') or 0)
            s_absent = int(s.get('absent_count') or 0)
            s_late = int(s.get('late_count') or 0)
            s_pct = float(s.get('pct') or 0.0)

            cls_total_present += s_present
            cls_total_absent += s_absent
            cls_total_late += s_late
            if s_lectures > cls_lectures_held:
                cls_lectures_held = s_lectures
            if s_pct < 75.0:
                cls_defaulters += 1

        total_s = len(students)
        avg_pct = round(sum(float(s['pct'] or 0.0) for s in students) / total_s, 1) if total_s > 0 else 0.0

        total_students_all += total_s
        total_present_all += cls_total_present
        total_absent_all += cls_total_absent
        total_late_all += cls_total_late
        total_defaulters_all += cls_defaulters
        if cls_lectures_held > max_lectures_all:
            max_lectures_all = cls_lectures_held
        pct_weighted_sum += (avg_pct * total_s)

        class_reports.append({
            'class_id': cls['class_id'],
            'section_name': cls['section_name'],
            'students': students,
            'total_students': total_s,
            'lectures_held': cls_lectures_held,
            'total_present': cls_total_present,
            'total_absent': cls_total_absent,
            'total_late': cls_total_late,
            'average_pct': avg_pct,
            'defaulters_count': cls_defaulters
        })

    overall_avg_pct = round(pct_weighted_sum / total_students_all, 1) if total_students_all > 0 else 0.0

    # =========================================================================
    # SHEET 1: ATTENDANCE SUMMARY (Class-Wise Totals & Grand Total)
    # =========================================================================
    ws_sum = wb.create_sheet(title='Attendance Summary')
    ws_sum.views.sheetView[0].showGridLines = True

    # Title row
    ws_sum.merge_cells('A1:I1')
    t_cell = ws_sum['A1']
    t_cell.value = f"Monthly Attendance Report — Executive Class Summary ({month_name} {year})"
    t_cell.font = Font(name='Calibri', bold=True, size=14, color='0F4C5C')
    t_cell.alignment = left_align

    # Subtitle row
    ws_sum.merge_cells('A2:I2')
    sub_cell = ws_sum['A2']
    sub_cell.value = f"Period: {start_date} to {end_date} | Generated by: {teacher_name} | Generated on: {now_str}"
    sub_cell.font = Font(name='Calibri', size=9, color='666666')
    sub_cell.alignment = left_align

    # Headers
    summary_headers = ['Class Name', 'Enrolled Students', 'Lectures Held', 'Total Present', 'Total Absent', 'Total Late', 'Average Attendance %', 'Defaulters (<75%)', 'Status']
    for col_idx, header in enumerate(summary_headers, 1):
        c = ws_sum.cell(row=4, column=col_idx, value=header)
        c.font = header_font
        c.fill = header_fill
        c.alignment = center_align
        c.border = thin_border

    sum_row = 5
    for cr in class_reports:
        c_status = 'Needs Review' if cr['defaulters_count'] > 0 else 'Good'
        row_vals = [
            cr['section_name'],
            cr['total_students'],
            cr['lectures_held'],
            cr['total_present'],
            cr['total_absent'],
            cr['total_late'],
            f"{cr['average_pct']}%",
            cr['defaulters_count'],
            c_status
        ]
        for col_idx, val in enumerate(row_vals, 1):
            cell = ws_sum.cell(row=sum_row, column=col_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            cell.alignment = left_align if col_idx == 1 else center_align

            if col_idx == 8 and cr['defaulters_count'] > 0:
                cell.font = defaulter_font
                cell.fill = defaulter_fill
        sum_row += 1

    # Grand Total row on Summary sheet
    grand_vals = [
        'OVERALL TOTAL / ALL CLASSES',
        total_students_all,
        max_lectures_all,
        total_present_all,
        total_absent_all,
        total_late_all,
        f"{overall_avg_pct}%",
        total_defaulters_all,
        'Needs Attention' if total_defaulters_all > 0 else 'Optimal'
    ]
    for col_idx, val in enumerate(grand_vals, 1):
        cell = ws_sum.cell(row=sum_row, column=col_idx, value=val)
        cell.font = summary_font
        cell.fill = summary_fill
        cell.border = thin_border
        cell.alignment = left_align if col_idx == 1 else center_align

    # Adjust widths for summary sheet
    sum_widths = {'A': 20, 'B': 18, 'C': 16, 'D': 15, 'E': 15, 'F': 14, 'G': 22, 'H': 18, 'I': 16}
    for col_letter, width in sum_widths.items():
        ws_sum.column_dimensions[col_letter].width = width

    # =========================================================================
    # SHEETS 2..N: INDIVIDUAL CLASS SHEETS WITH STUDENT ROSTERS
    # =========================================================================
    for cr in class_reports:
        ws_name = cr['section_name'][:31]  # Max 31 chars
        ws = wb.create_sheet(title=ws_name)
        ws.views.sheetView[0].showGridLines = True

        # Class Title
        ws.merge_cells('A1:H1')
        title_cell = ws['A1']
        title_cell.value = f"Class Attendance Roster — {cr['section_name']} — {month_name} {year}"
        title_cell.font = Font(name='Calibri', bold=True, size=13, color='0F4C5C')
        title_cell.alignment = left_align

        # Subtitle with class totals
        ws.merge_cells('A2:H2')
        sub_c = ws['A2']
        sub_c.value = (
            f"Enrolled: {cr['total_students']} | Lectures Held: {cr['lectures_held']} | "
            f"Total Present: {cr['total_present']} | Total Absent: {cr['total_absent']} | "
            f"Class Average: {cr['average_pct']}% | Defaulters: {cr['defaulters_count']}"
        )
        sub_c.font = Font(name='Calibri', size=9, color='666666')
        sub_c.alignment = left_align

        # Headers
        detail_headers = ['Roll No', 'Student Name', 'Total Lectures', 'Present', 'Absent', 'Late', 'Attendance %', 'Status']
        for col_idx, header in enumerate(detail_headers, 1):
            c = ws.cell(row=4, column=col_idx, value=header)
            c.font = header_font
            c.fill = header_fill
            c.alignment = center_align
            c.border = thin_border

        # Student records
        r_num = 5
        for s in cr['students']:
            s_pct = float(s['pct']) if s['pct'] is not None else 0.0
            is_defaulter = s_pct < 75.0
            status_text = 'Defaulter' if is_defaulter else 'Regular'

            row_data = [
                str(s['roll_number']),
                s['full_name'],
                int(s['total_lectures'] or 0),
                int(s['present_count'] or 0),
                int(s['absent_count'] or 0),
                int(s['late_count'] or 0),
                f"{s_pct}%",
                status_text
            ]

            for col_idx, val in enumerate(row_data, 1):
                cell = ws.cell(row=r_num, column=col_idx, value=val)
                cell.font = data_font
                cell.border = thin_border
                cell.alignment = left_align if col_idx == 2 else center_align

                if is_defaulter:
                    cell.fill = defaulter_fill
                    if col_idx == 8:
                        cell.font = defaulter_font
                else:
                    if col_idx == 8:
                        cell.font = regular_font
            r_num += 1

        # Class Summary Row
        cls_summary_data = [
            '',
            f"CLASS TOTAL / AVERAGE ({cr['total_students']} students)",
            cr['lectures_held'],
            cr['total_present'],
            cr['total_absent'],
            cr['total_late'],
            f"{cr['average_pct']}%",
            f"{cr['defaulters_count']} Defaulter(s)"
        ]
        for col_idx, val in enumerate(cls_summary_data, 1):
            cell = ws.cell(row=r_num, column=col_idx, value=val)
            cell.font = summary_font
            cell.fill = summary_fill
            cell.border = thin_border
            cell.alignment = left_align if col_idx == 2 else center_align

        # Column widths for class sheet
        cls_widths = {'A': 12, 'B': 28, 'C': 15, 'D': 10, 'E': 10, 'F': 10, 'G': 15, 'H': 15}
        for col_letter, width in cls_widths.items():
            ws.column_dimensions[col_letter].width = width

    if not classes:
        ws_empty = wb.create_sheet(title='No Data')
        ws_empty['A1'].value = 'No classes or attendance records found for this teacher.'

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"Monthly_Attendance_Report_{month_name}_{year}.xlsx"
    if class_id and len(class_reports) == 1:
        c_label = class_reports[0]['section_name'].replace(' ', '_')
        filename = f"Monthly_Attendance_Report_{c_label}_{month_name}_{year}.xlsx"

    response = make_response(buffer.getvalue())
    response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    response.headers['Content-Disposition'] = f'attachment; filename={filename}'
    return response


