"""
Attendance Assistant Chatbot — Backend Route
Rule-based NLU with safe parameterized queries.
All queries are scoped by the logged-in teacher's teacher_id.
"""

from flask import Blueprint, jsonify, request, session
from models.db import execute_query
from datetime import datetime, timedelta
import re

chatbot_bp = Blueprint('chatbot', __name__)


# =============================================================================
# Date Parsing Utility
# =============================================================================

def parse_date(text):
    """
    Extract a date from natural language text.
    Returns a date string (YYYY-MM-DD) or None.
    """
    text_lower = text.lower().strip()
    today = datetime.now().date()

    # Explicit keywords
    if 'today' in text_lower:
        return today.strftime('%Y-%m-%d')
    if 'yesterday' in text_lower:
        return (today - timedelta(days=1)).strftime('%Y-%m-%d')
    if 'day before yesterday' in text_lower:
        return (today - timedelta(days=2)).strftime('%Y-%m-%d')
    if 'tomorrow' in text_lower:
        return (today + timedelta(days=1)).strftime('%Y-%m-%d')

    # "last monday", "last tuesday", etc.
    days_of_week = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for i, day_name in enumerate(days_of_week):
        if f'last {day_name}' in text_lower:
            current_weekday = today.weekday()  # Monday=0
            days_back = (current_weekday - i) % 7
            if days_back == 0:
                days_back = 7
            return (today - timedelta(days=days_back)).strftime('%Y-%m-%d')

    # "this monday", "this tuesday", etc.
    for i, day_name in enumerate(days_of_week):
        if f'this {day_name}' in text_lower:
            current_weekday = today.weekday()
            days_forward = (i - current_weekday) % 7
            return (today + timedelta(days=days_forward)).strftime('%Y-%m-%d')

    # ISO format: 2026-10-05
    iso_match = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', text_lower)
    if iso_match:
        try:
            d = datetime(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))).date()
            return d.strftime('%Y-%m-%d')
        except ValueError:
            pass

    # Formats like "5 October 2026", "5 Oct 2026", "October 5 2026", "Oct 5, 2026"
    months = {
        'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
        'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
        'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
        'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
    }
    # "5 October 2026" or "5 October" or "5th October 2026"
    pattern1 = r'(\d{1,2})(?:st|nd|rd|th)?\s+(' + '|'.join(months.keys()) + r')(?:\s+(\d{4}))?'
    m = re.search(pattern1, text_lower)
    if m:
        day = int(m.group(1))
        month = months[m.group(2)]
        year = int(m.group(3)) if m.group(3) else today.year
        try:
            return datetime(year, month, day).date().strftime('%Y-%m-%d')
        except ValueError:
            pass

    # "October 5, 2026" or "October 5"
    pattern2 = r'(' + '|'.join(months.keys()) + r')\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?'
    m = re.search(pattern2, text_lower)
    if m:
        month = months[m.group(1)]
        day = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else today.year
        try:
            return datetime(year, month, day).date().strftime('%Y-%m-%d')
        except ValueError:
            pass

    # DD/MM/YYYY or DD-MM-YYYY
    dmy_match = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', text_lower)
    if dmy_match:
        try:
            d = datetime(int(dmy_match.group(3)), int(dmy_match.group(2)), int(dmy_match.group(1))).date()
            return d.strftime('%Y-%m-%d')
        except ValueError:
            pass

    return None


# =============================================================================
# Student Name Extraction
# =============================================================================

def extract_student_name(text):
    """
    Extract a student name from natural language text.
    Removes common words/phrases to isolate the student name.
    """
    text_clean = text.strip()

    # Patterns to extract student name
    patterns = [
        r"(?:show|get|find|display|what is|what's|check)\s+(.+?)(?:'s|'s)?\s*(?:attendance|history|percentage|record|status)",
        r"(?:attendance|history|percentage|record|status)\s+(?:of|for)\s+(.+?)(?:\s+today|\s+yesterday|\s+this|\s+last|\s*$)",
        r"(?:was|is)\s+(.+?)\s+(?:absent|present|late)",
        r"(?:show|get|find|display)\s+(.+?)(?:'s|'s)\s",
        r"(?:about|for)\s+(.+?)(?:\s+today|\s+yesterday|\s+this|\s+last|\s*$)",
    ]

    for pattern in patterns:
        m = re.search(pattern, text_clean, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            # Clean up common words that might be captured
            remove_words = ['student', 'the', 'a', 'an', 'please', 'me', 'roll', 'number', 'no', 'of', 'for']
            words = name.split()
            cleaned = [w for w in words if w.lower() not in remove_words]
            if cleaned:
                return ' '.join(cleaned)

    return None


# =============================================================================
# Percentage / Threshold Extraction
# =============================================================================

def extract_percentage(text):
    """Extract a percentage threshold from text like 'below 75%' or 'less than 80'."""
    m = re.search(r'(?:below|less\s+than|under|lower\s+than|beneath)\s+(\d+)(?:\s*%)?', text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    m = re.search(r'(\d+)\s*%\s*(?:attendance|or less|or below|and below)', text, re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


# =============================================================================
# Class Name Extraction
# =============================================================================

def extract_class_name(text):
    """Extract a class/section name from text."""
    # Match patterns like "CS-A", "SY Computer A", "TY IT B", "Final Year CS"
    patterns = [
        r'(?:class|section|batch|division)\s+(.+?)(?:\s+today|\s+yesterday|\s+on|\s*$)',
        r'(?:of|for)\s+((?:SY|TY|FY|Final|SE|TE|BE)\s+.+?)(?:\s+today|\s+yesterday|\s+on|\s*$)',
        r'((?:SY|TY|FY|Final|SE|TE|BE)\s+(?:Computer|IT|CS|Comp|Mech|Civil|Elect)\s*[A-Z]?)',
        r'([A-Z]{2,3}[\s\-][A-Z])\b',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


# =============================================================================
# Intent Classification
# =============================================================================

def classify_intent(message, history=None):
    """
    Classify the user's message into an intent and extract parameters.
    Returns (intent, params_dict).
    """
    msg = message.lower().strip()
    params = {}

    # Extract date (default to today if not specified for most queries)
    parsed_date = parse_date(message)

    # --- Follow-up context handling ---
    if history and len(history) >= 2:
        last_bot = None
        last_user_intent = None
        # Find the most recent bot response context
        for item in reversed(history):
            if item.get('role') == 'assistant' and item.get('_intent'):
                last_user_intent = item['_intent']
                last_bot = item
                break

        # "what about yesterday/today/[date]" follow-ups
        if re.search(r'^(what about|how about|and|show for|for)\s', msg):
            if parsed_date and last_user_intent:
                params['date'] = parsed_date
                # Carry forward the previous intent with new date
                if last_bot and last_bot.get('_params'):
                    params.update(last_bot['_params'])
                    params['date'] = parsed_date
                return last_user_intent, params

        # "show their roll numbers" / "show details" follow-ups
        if re.search(r'(their|those|these|the)\s+(roll|detail|name|number|info|list)', msg):
            if last_user_intent:
                if last_bot and last_bot.get('_params'):
                    params.update(last_bot['_params'])
                params['show_details'] = True
                return last_user_intent, params

    # --- Unrelated question detection ---
    attendance_keywords = [
        'absent', 'present', 'attendance', 'student', 'class', 'roll',
        'lecture', 'percentage', 'low', 'history', 'record', 'status',
        'who', 'how many', 'show', 'list', 'count', 'total', 'today',
        'yesterday', 'month', 'week', 'frequent', 'below', 'above'
    ]
    is_relevant = any(kw in msg for kw in attendance_keywords)

    if not is_relevant:
        # Check for greetings
        greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'namaste']
        if any(g in msg for g in greetings):
            return 'greeting', params
        if any(w in msg for w in ['help', 'what can you do', 'what do you do', 'features', 'commands']):
            return 'help', params
        if any(w in msg for w in ['thank', 'thanks', 'thank you', 'thx']):
            return 'thanks', params
        return 'unrelated', params

    # --- Most frequently absent ---
    if re.search(r'(most\s+(?:frequently|often)\s+absent|frequently\s+absent|most\s+absent|highest\s+absence)', msg):
        params['date'] = parsed_date
        return 'most_absent', params

    # --- Lowest attendance / worst attendance ---
    if re.search(r'(lowest\s+attendance|worst\s+attendance|least\s+attendance|minimum\s+attendance)', msg):
        return 'lowest_attendance', params

    # --- Low attendance / below percentage ---
    threshold = extract_percentage(message)
    if threshold is not None:
        params['threshold'] = threshold
        return 'low_attendance', params
    if re.search(r'(low\s+attendance|poor\s+attendance|bad\s+attendance|weak\s+attendance)', msg):
        params['threshold'] = 75.0  # Default threshold
        return 'low_attendance', params

    # --- Student attendance history ---
    if re.search(r'(history|record|log|all\s+attendance)', msg):
        name = extract_student_name(message)
        if name:
            params['student_name'] = name
            return 'student_history', params
        # Class-specific history
        class_name = extract_class_name(message)
        if class_name:
            params['class_name'] = class_name
        return 'student_history', params

    # --- Student attendance percentage ---
    if re.search(r'(percentage|percent|%)', msg):
        name = extract_student_name(message)
        if name:
            params['student_name'] = name
            return 'student_percentage', params

    # --- Student-specific attendance ---
    name = extract_student_name(message)
    if name and not re.search(r'(how many|count|total|class[\s-]wise|all)', msg):
        params['student_name'] = name
        params['date'] = parsed_date
        # Check if specifically asking about absent/present status
        if re.search(r'(was|is)\s+.+\s+(absent|present|late)', msg):
            return 'student_status', params
        return 'student_attendance', params

    # --- Class-wise attendance ---
    class_name = extract_class_name(message)
    if class_name:
        params['class_name'] = class_name
        params['date'] = parsed_date or datetime.now().date().strftime('%Y-%m-%d')
        return 'class_attendance', params
    if re.search(r'class[\s\-]*wise', msg):
        params['date'] = parsed_date or datetime.now().date().strftime('%Y-%m-%d')
        return 'class_attendance', params

    # --- Attendance count ---
    if re.search(r'how\s+many', msg):
        params['date'] = parsed_date or datetime.now().date().strftime('%Y-%m-%d')
        if 'absent' in msg:
            params['status_filter'] = 'absent'
        elif 'present' in msg:
            params['status_filter'] = 'present'
        if re.search(r'(this\s+month|monthly)', msg):
            return 'monthly_count', params
        return 'attendance_count', params

    # --- Monthly stats ---
    if re.search(r'(this\s+month|monthly|month)', msg):
        return 'monthly_count', params

    # --- Absent students ---
    if re.search(r'(absent|absentee)', msg):
        params['date'] = parsed_date or datetime.now().date().strftime('%Y-%m-%d')
        return 'absent_students', params

    # --- Present students ---
    if re.search(r'present', msg):
        params['date'] = parsed_date or datetime.now().date().strftime('%Y-%m-%d')
        return 'present_students', params

    # --- Total counts ---
    if re.search(r'(total\s+student|total\s+count|how\s+many\s+student)', msg):
        return 'total_counts', params

    # --- Generic "show attendance" / "today's attendance" ---
    if re.search(r'(show|display|get|list|view|see)\s+(today|attendance|the)', msg) or 'attendance' in msg:
        params['date'] = parsed_date or datetime.now().date().strftime('%Y-%m-%d')
        return 'show_attendance', params

    return 'unknown', params


# =============================================================================
# Query Functions — All scoped by teacher_id
# =============================================================================

def get_teacher_classes(teacher_id):
    """Get all class IDs accessible to this teacher."""
    query = """
        SELECT DISTINCT ts.class_id, c.section_name
        FROM teacher_subjects ts
        JOIN classes c ON ts.class_id = c.class_id
        WHERE ts.teacher_id = %s
    """
    return execute_query(query, (teacher_id,), fetchall=True) or []


def get_absent_students(date, teacher_id):
    """Get students absent on a given date for this teacher's classes."""
    query = """
        SELECT DISTINCT s.roll_number, s.full_name, c.section_name, a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE a.attendance_date = %s
          AND a.status = 'absent'
          AND ts.teacher_id = %s
        ORDER BY c.section_name, CAST(s.roll_number AS UNSIGNED)
    """
    return execute_query(query, (date, teacher_id), fetchall=True) or []


def get_present_students(date, teacher_id):
    """Get students present on a given date for this teacher's classes."""
    query = """
        SELECT DISTINCT s.roll_number, s.full_name, c.section_name, a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE a.attendance_date = %s
          AND a.status = 'present'
          AND ts.teacher_id = %s
        ORDER BY c.section_name, CAST(s.roll_number AS UNSIGNED)
    """
    return execute_query(query, (date, teacher_id), fetchall=True) or []


def get_attendance_count(date, teacher_id, status_filter=None):
    """Get attendance count on a given date."""
    if status_filter:
        query = """
            SELECT COUNT(DISTINCT a.attendance_id) as count
            FROM attendance a
            JOIN timetables t ON a.timetable_id = t.timetable_id
            JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
            WHERE a.attendance_date = %s AND a.status = %s AND ts.teacher_id = %s
        """
        result = execute_query(query, (date, status_filter, teacher_id), fetchone=True)
    else:
        query = """
            SELECT
                COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.attendance_id END) as present_count,
                COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.attendance_id END) as absent_count,
                COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.attendance_id END) as late_count,
                COUNT(DISTINCT a.attendance_id) as total
            FROM attendance a
            JOIN timetables t ON a.timetable_id = t.timetable_id
            JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
            WHERE a.attendance_date = %s AND ts.teacher_id = %s
        """
        result = execute_query(query, (date, teacher_id), fetchone=True)
    return result


def get_student_by_name(name, teacher_id):
    """Find students by name (fuzzy match), scoped to teacher's classes."""
    query = """
        SELECT DISTINCT s.student_id, s.roll_number, s.full_name, s.email, c.section_name, c.class_id
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE ts.teacher_id = %s AND s.full_name LIKE %s AND s.is_active = 1
        ORDER BY s.full_name
    """
    return execute_query(query, (teacher_id, f'%{name}%'), fetchall=True) or []


def get_student_attendance_records(student_id, teacher_id, limit=20):
    """Get attendance records for a specific student."""
    query = """
        SELECT a.attendance_date, a.status, sub.subject_name, c.section_name
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        JOIN subjects sub ON ts.subject_id = sub.subject_id
        JOIN classes c ON ts.class_id = c.class_id
        WHERE a.student_id = %s AND ts.teacher_id = %s
        ORDER BY a.attendance_date DESC
        LIMIT %s
    """
    records = execute_query(query, (student_id, teacher_id, limit), fetchall=True) or []
    for r in records:
        if r.get('attendance_date'):
            r['attendance_date'] = r['attendance_date'].strftime('%Y-%m-%d')
    return records


def get_student_percentage(student_id, teacher_id):
    """Calculate attendance percentage for a student across this teacher's classes."""
    query = """
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE a.student_id = %s AND ts.teacher_id = %s
    """
    return execute_query(query, (student_id, teacher_id), fetchone=True)


def get_low_attendance_students(threshold, teacher_id):
    """Get students with attendance below the given percentage threshold."""
    query = """
        SELECT s.roll_number, s.full_name, c.section_name,
               COUNT(*) as total_lectures,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
               ROUND(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as percentage
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s AND s.is_active = 1
        GROUP BY s.student_id, s.roll_number, s.full_name, c.section_name
        HAVING percentage < %s
        ORDER BY percentage ASC
    """
    return execute_query(query, (teacher_id, threshold), fetchall=True) or []


def get_most_absent_students(teacher_id, limit=10):
    """Get students most frequently marked absent."""
    query = """
        SELECT s.roll_number, s.full_name, c.section_name,
               COUNT(*) as absent_count
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE a.status = 'absent' AND ts.teacher_id = %s AND s.is_active = 1
        GROUP BY s.student_id, s.roll_number, s.full_name, c.section_name
        ORDER BY absent_count DESC
        LIMIT %s
    """
    return execute_query(query, (teacher_id, limit), fetchall=True) or []


def get_lowest_attendance_students(teacher_id, limit=10):
    """Get students with the lowest attendance percentages."""
    query = """
        SELECT s.roll_number, s.full_name, c.section_name,
               COUNT(*) as total_lectures,
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
               ROUND(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(*) * 100, 1) as percentage
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE ts.teacher_id = %s AND s.is_active = 1
        GROUP BY s.student_id, s.roll_number, s.full_name, c.section_name
        ORDER BY percentage ASC
        LIMIT %s
    """
    return execute_query(query, (teacher_id, limit), fetchall=True) or []


def get_class_attendance(class_name, date, teacher_id):
    """Get attendance for a specific class on a specific date."""
    if class_name:
        query = """
            SELECT s.roll_number, s.full_name, c.section_name, a.status, a.attendance_date
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN classes c ON s.class_id = c.class_id
            JOIN timetables t ON a.timetable_id = t.timetable_id
            JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
            WHERE ts.teacher_id = %s
              AND a.attendance_date = %s
              AND c.section_name LIKE %s
            ORDER BY CAST(s.roll_number AS UNSIGNED)
        """
        records = execute_query(query, (teacher_id, date, f'%{class_name}%'), fetchall=True) or []
    else:
        # All classes attendance summary
        query = """
            SELECT c.section_name,
                   COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.attendance_id END) as present,
                   COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.attendance_id END) as absent,
                   COUNT(DISTINCT a.attendance_id) as total
            FROM attendance a
            JOIN students s ON a.student_id = s.student_id
            JOIN classes c ON s.class_id = c.class_id
            JOIN timetables t ON a.timetable_id = t.timetable_id
            JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
            WHERE ts.teacher_id = %s AND a.attendance_date = %s
            GROUP BY c.section_name
            ORDER BY c.section_name
        """
        records = execute_query(query, (teacher_id, date), fetchall=True) or []

    for r in records:
        if r.get('attendance_date'):
            r['attendance_date'] = r['attendance_date'].strftime('%Y-%m-%d')
    return records


def get_monthly_absent_count(teacher_id):
    """Get the count of absent records this month."""
    today = datetime.now().date()
    first_of_month = today.replace(day=1)
    query = """
        SELECT COUNT(DISTINCT a.attendance_id) as absent_count
        FROM attendance a
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE a.status = 'absent'
          AND ts.teacher_id = %s
          AND a.attendance_date >= %s
          AND a.attendance_date <= %s
    """
    return execute_query(query, (teacher_id, first_of_month.strftime('%Y-%m-%d'), today.strftime('%Y-%m-%d')), fetchone=True)


def get_total_students(teacher_id):
    """Get total students across this teacher's classes."""
    query = """
        SELECT COUNT(DISTINCT s.student_id) as total
        FROM students s
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE ts.teacher_id = %s AND s.is_active = 1
    """
    return execute_query(query, (teacher_id,), fetchone=True)


def get_show_attendance(date, teacher_id):
    """Get all attendance records for a given date."""
    query = """
        SELECT DISTINCT s.roll_number, s.full_name, c.section_name, a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN timetables t ON a.timetable_id = t.timetable_id
        JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
        WHERE a.attendance_date = %s AND ts.teacher_id = %s
        ORDER BY c.section_name, CAST(s.roll_number AS UNSIGNED)
    """
    return execute_query(query, (date, teacher_id), fetchall=True) or []


# =============================================================================
# Response Formatting
# =============================================================================

def format_date_display(date_str):
    """Format a date string nicely for display."""
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d').date()
        today = datetime.now().date()
        if d == today:
            return f"today ({d.strftime('%d %B %Y')})"
        elif d == today - timedelta(days=1):
            return f"yesterday ({d.strftime('%d %B %Y')})"
        else:
            return d.strftime('%d %B %Y')
    except Exception:
        return date_str


def build_table_html(headers, rows):
    """Build an HTML table string for the chatbot response."""
    html = '<table class="chatbot-table"><thead><tr>'
    for h in headers:
        html += f'<th>{h}</th>'
    html += '</tr></thead><tbody>'
    for row in rows:
        html += '<tr>'
        for cell in row:
            # Apply status styling
            cell_str = str(cell) if cell is not None else '-'
            if cell_str.lower() == 'absent':
                cell_str = '<span class="cb-status-absent">Absent</span>'
            elif cell_str.lower() == 'present':
                cell_str = '<span class="cb-status-present">Present</span>'
            elif cell_str.lower() == 'late':
                cell_str = '<span class="cb-status-late">Late</span>'
            html += f'<td>{cell_str}</td>'
        html += '</tr>'
    html += '</tbody></table>'
    return html


# =============================================================================
# Response Builder — Maps intents to query results and formats output
# =============================================================================

def build_response(intent, params, teacher_id):
    """Execute the appropriate query and build a formatted response."""

    # ---- Greeting ----
    if intent == 'greeting':
        name = session.get('full_name', 'Professor')
        return {
            'response': f"Hello, {name}! 👋 I'm your Attendance Assistant. You can ask me things like:\n\n"
                        "• \"Who is absent today?\"\n"
                        "• \"Show Varad's attendance\"\n"
                        "• \"Which students have attendance below 75%?\"\n"
                        "• \"Show attendance for yesterday\"\n\n"
                        "How can I help you?",
            'type': 'text'
        }

    # ---- Help ----
    if intent == 'help':
        return {
            'response': "Here's what I can help you with:\n\n"
                        "📋 **Attendance Queries**\n"
                        "• \"Who is absent today?\"\n"
                        "• \"Who is present today?\"\n"
                        "• \"How many students are absent today?\"\n"
                        "• \"Show today's attendance\"\n\n"
                        "📅 **Date-specific**\n"
                        "• \"Show attendance for yesterday\"\n"
                        "• \"Show attendance for 5 October 2026\"\n\n"
                        "👤 **Student-specific**\n"
                        "• \"Show Rahul's attendance\"\n"
                        "• \"Was Rahul absent yesterday?\"\n"
                        "• \"Show Rahul's attendance history\"\n\n"
                        "📊 **Analytics**\n"
                        "• \"Who has attendance below 75%?\"\n"
                        "• \"Who has the lowest attendance?\"\n"
                        "• \"Which students were absent most frequently?\"\n\n"
                        "🏫 **Class-wise**\n"
                        "• \"Show class-wise attendance\"\n"
                        "• \"Show attendance for SY Computer A\"",
            'type': 'text'
        }

    # ---- Thanks ----
    if intent == 'thanks':
        return {'response': "You're welcome! Feel free to ask if you need anything else. 😊", 'type': 'text'}

    # ---- Unrelated ----
    if intent == 'unrelated':
        return {
            'response': "I can help you with student and attendance-related information. 📚\n\n"
                        "Try asking something like:\n"
                        "• \"Who is absent today?\"\n"
                        "• \"Show students below 75% attendance\"\n"
                        "• \"Show Rahul's attendance history\"",
            'type': 'text'
        }

    # ---- Unknown ----
    if intent == 'unknown':
        return {
            'response': "Sorry, I didn't understand that. You can ask me things like:\n\n"
                        "• \"Who is absent today?\"\n"
                        "• \"Show students below 75% attendance\"\n"
                        "• \"Show Rahul's attendance history\"\n"
                        "• \"How many students are present today?\"",
            'type': 'text'
        }

    # ---- Absent students ----
    if intent == 'absent_students':
        date = params.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        students = get_absent_students(date, teacher_id)
        date_display = format_date_display(date)

        if not students:
            return {'response': f"No students were marked absent {date_display}. ✅\n\n(This could also mean attendance hasn't been recorded yet for this date.)", 'type': 'text'}

        response = f"**{len(students)} student(s) were absent {date_display}:**\n\n"
        headers = ['Roll No.', 'Student', 'Class', 'Status']
        rows = [[s['roll_number'], s['full_name'], s['section_name'], s['status']] for s in students]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Present students ----
    if intent == 'present_students':
        date = params.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        students = get_present_students(date, teacher_id)
        date_display = format_date_display(date)

        if not students:
            return {'response': f"No students were marked present {date_display}.\n\n(This could also mean attendance hasn't been recorded yet.)", 'type': 'text'}

        response = f"**{len(students)} student(s) were present {date_display}:**\n\n"
        headers = ['Roll No.', 'Student', 'Class', 'Status']
        rows = [[s['roll_number'], s['full_name'], s['section_name'], s['status']] for s in students]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Attendance count ----
    if intent == 'attendance_count':
        date = params.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        status_filter = params.get('status_filter')
        date_display = format_date_display(date)

        if status_filter:
            result = get_attendance_count(date, teacher_id, status_filter)
            count = result['count'] if result else 0
            return {'response': f"**{count}** student(s) were marked **{status_filter}** {date_display}.", 'type': 'text', '_intent': intent, '_params': params}
        else:
            result = get_attendance_count(date, teacher_id)
            if result:
                present = result.get('present_count') or 0
                absent = result.get('absent_count') or 0
                late = result.get('late_count') or 0
                total = result.get('total') or 0

                if total == 0:
                    return {'response': f"No attendance records found for {date_display}.", 'type': 'text'}

                response = f"**Attendance summary for {date_display}:**\n\n"
                response += f"✅ Present: **{present}**\n"
                response += f"❌ Absent: **{absent}**\n"
                if late > 0:
                    response += f"⏳ Late: **{late}**\n"
                response += f"📊 Total records: **{total}**"
                return {'response': response, 'type': 'text', '_intent': intent, '_params': params}
            return {'response': f"No attendance records found for {date_display}.", 'type': 'text'}

    # ---- Monthly count ----
    if intent == 'monthly_count':
        result = get_monthly_absent_count(teacher_id)
        count = result['absent_count'] if result else 0
        month_name = datetime.now().strftime('%B %Y')
        return {'response': f"**{count}** absence record(s) have been logged this month ({month_name}).", 'type': 'text', '_intent': intent, '_params': params}

    # ---- Student attendance ----
    if intent in ('student_attendance', 'student_status'):
        name = params.get('student_name')
        if not name:
            return {'response': "Which student would you like me to look up? Please provide the student's name.", 'type': 'text'}

        students = get_student_by_name(name, teacher_id)
        if not students:
            return {'response': f"Sorry, I couldn't find a student with the name \"{name}\" in your classes. Please check the spelling and try again.", 'type': 'text'}

        # If multiple matches, show first and mention others
        student = students[0]
        pct_data = get_student_percentage(student['student_id'], teacher_id)
        total = pct_data['total'] if pct_data else 0
        present = pct_data['present'] if pct_data else 0
        absent = pct_data['absent'] if pct_data else 0
        pct = round((present / total * 100), 1) if total > 0 else 0

        response = f"**{student['full_name']}** (Roll: {student['roll_number']}, {student['section_name']})\n\n"

        if total > 0:
            response += f"📊 Attendance: **{pct}%** ({present}/{total} lectures present)\n"
            response += f"✅ Present: {present} | ❌ Absent: {absent}"
            if pct_data.get('late') and pct_data['late'] > 0:
                response += f" | ⏳ Late: {pct_data['late']}"
        else:
            response += "No attendance records found for this student in your classes."

        # Check specific date status if asked
        if intent == 'student_status' and params.get('date'):
            date = params['date']
            date_display = format_date_display(date)
            # Query specific date
            date_query = """
                SELECT a.status, sub.subject_name
                FROM attendance a
                JOIN timetables t ON a.timetable_id = t.timetable_id
                JOIN teacher_subjects ts ON t.teacher_subject_id = ts.teacher_subject_id
                JOIN subjects sub ON ts.subject_id = sub.subject_id
                WHERE a.student_id = %s AND a.attendance_date = %s AND ts.teacher_id = %s
            """
            date_records = execute_query(date_query, (student['student_id'], date, teacher_id), fetchall=True) or []
            if date_records:
                response += f"\n\n**Status on {date_display}:**\n"
                for rec in date_records:
                    status_icon = '✅' if rec['status'] == 'present' else ('❌' if rec['status'] == 'absent' else '⏳')
                    response += f"{status_icon} {rec['subject_name']}: {rec['status'].capitalize()}\n"
            else:
                response += f"\n\nNo attendance record found for {date_display}."

        if len(students) > 1:
            other_names = ', '.join([s['full_name'] for s in students[1:3]])
            response += f"\n\n_Also found: {other_names}_"

        return {'response': response, 'type': 'text', '_intent': intent, '_params': params}

    # ---- Student history ----
    if intent == 'student_history':
        name = params.get('student_name')
        if not name:
            return {'response': "Which student's attendance history would you like to see? Please provide the student's name.", 'type': 'text'}

        students = get_student_by_name(name, teacher_id)
        if not students:
            return {'response': f"Sorry, I couldn't find a student with the name \"{name}\" in your classes.", 'type': 'text'}

        student = students[0]
        records = get_student_attendance_records(student['student_id'], teacher_id, limit=20)

        if not records:
            return {'response': f"No attendance history found for **{student['full_name']}** in your classes.", 'type': 'text'}

        response = f"**Attendance history for {student['full_name']}** (Roll: {student['roll_number']}, {student['section_name']}):\n\n"
        response += f"_Showing last {len(records)} records_\n\n"

        headers = ['Date', 'Subject', 'Status']
        rows = [[r['attendance_date'], r['subject_name'], r['status']] for r in records]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Student percentage ----
    if intent == 'student_percentage':
        name = params.get('student_name')
        if not name:
            return {'response': "Which student's attendance percentage would you like to check?", 'type': 'text'}

        students = get_student_by_name(name, teacher_id)
        if not students:
            return {'response': f"Sorry, I couldn't find a student with the name \"{name}\" in your classes.", 'type': 'text'}

        student = students[0]
        pct_data = get_student_percentage(student['student_id'], teacher_id)
        total = pct_data['total'] if pct_data else 0
        present = pct_data['present'] if pct_data else 0

        if total > 0:
            pct = round((present / total * 100), 1)
            emoji = '✅' if pct >= 75 else '⚠️'
            return {'response': f"{emoji} **{student['full_name']}**'s attendance is **{pct}%** ({present}/{total} lectures present).", 'type': 'text'}
        else:
            return {'response': f"No attendance records found for **{student['full_name']}** in your classes.", 'type': 'text'}

    # ---- Low attendance ----
    if intent == 'low_attendance':
        threshold = params.get('threshold', 75.0)
        students = get_low_attendance_students(threshold, teacher_id)

        if not students:
            return {'response': f"✅ Great news! No students have attendance below {threshold}% in your classes.", 'type': 'text'}

        response = f"**{len(students)} student(s) have attendance below {threshold}%:**\n\n"
        headers = ['Roll No.', 'Student', 'Class', 'Attendance %']
        rows = [[s['roll_number'], s['full_name'], s['section_name'], f"{s['percentage']}%"] for s in students]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Lowest attendance ----
    if intent == 'lowest_attendance':
        students = get_lowest_attendance_students(teacher_id, limit=10)

        if not students:
            return {'response': "No attendance records found to determine lowest attendance.", 'type': 'text'}

        response = f"**Students with the lowest attendance:**\n\n"
        headers = ['Roll No.', 'Student', 'Class', 'Attendance %']
        rows = [[s['roll_number'], s['full_name'], s['section_name'], f"{s['percentage']}%"] for s in students]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Most absent ----
    if intent == 'most_absent':
        students = get_most_absent_students(teacher_id)

        if not students:
            return {'response': "No absence records found.", 'type': 'text'}

        response = f"**Most frequently absent students:**\n\n"
        headers = ['Roll No.', 'Student', 'Class', 'Times Absent']
        rows = [[s['roll_number'], s['full_name'], s['section_name'], s['absent_count']] for s in students]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Class attendance ----
    if intent == 'class_attendance':
        class_name = params.get('class_name')
        date = params.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        date_display = format_date_display(date)

        records = get_class_attendance(class_name, date, teacher_id)

        if not records:
            if class_name:
                return {'response': f"No attendance records found for class \"{class_name}\" on {date_display}.", 'type': 'text'}
            return {'response': f"No attendance records found for {date_display}.", 'type': 'text'}

        if class_name:
            # Student-level detail
            response = f"**Attendance for {class_name} on {date_display}:**\n\n"
            headers = ['Roll No.', 'Student', 'Class', 'Status']
            rows = [[r['roll_number'], r['full_name'], r['section_name'], r['status']] for r in records]
        else:
            # Class-wise summary
            response = f"**Class-wise attendance summary for {date_display}:**\n\n"
            headers = ['Class', 'Present', 'Absent', 'Total']
            rows = [[r['section_name'], r.get('present', 0), r.get('absent', 0), r.get('total', 0)] for r in records]

        response += build_table_html(headers, rows)
        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # ---- Total counts ----
    if intent == 'total_counts':
        result = get_total_students(teacher_id)
        total = result['total'] if result else 0
        classes = get_teacher_classes(teacher_id)
        class_names = ', '.join([c['section_name'] for c in classes]) if classes else 'None'
        return {
            'response': f"You have **{total}** student(s) across **{len(classes)}** class(es).\n\nClasses: {class_names}",
            'type': 'text',
            '_intent': intent, '_params': params
        }

    # ---- Show attendance (generic) ----
    if intent == 'show_attendance':
        date = params.get('date', datetime.now().date().strftime('%Y-%m-%d'))
        date_display = format_date_display(date)
        records = get_show_attendance(date, teacher_id)

        if not records:
            return {'response': f"No attendance records found for {date_display}.\n\n(Attendance may not have been recorded yet.)", 'type': 'text'}

        present = sum(1 for r in records if r['status'] == 'present')
        absent = sum(1 for r in records if r['status'] == 'absent')
        late = sum(1 for r in records if r['status'] == 'late')

        response = f"**Attendance for {date_display}** — ✅ {present} present, ❌ {absent} absent"
        if late > 0:
            response += f", ⏳ {late} late"
        response += f" (Total: {len(records)})\n\n"

        headers = ['Roll No.', 'Student', 'Class', 'Status']
        rows = [[r['roll_number'], r['full_name'], r['section_name'], r['status']] for r in records]
        response += build_table_html(headers, rows)

        return {'response': response, 'type': 'html', '_intent': intent, '_params': params}

    # Fallback
    return {
        'response': "Sorry, I didn't understand that. You can ask me things like \"Who is absent today?\" or \"Show students below 75% attendance.\"",
        'type': 'text'
    }


# =============================================================================
# Main Chatbot Endpoint
# =============================================================================

@chatbot_bp.route('/chatbot', methods=['POST'])
def chatbot():
    """
    Main chatbot endpoint.
    Expects JSON: { "message": "...", "history": [...] }
    Returns JSON: { "response": "...", "type": "text|html" }
    """
    # Auth check
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify({'response': 'This chatbot is available for teachers only. Please log in with a teacher account.', 'type': 'text'}), 200

    data = request.json or {}
    message = (data.get('message') or '').strip()
    history = data.get('history') or []

    if not message:
        return jsonify({'response': 'Please type a message to get started!', 'type': 'text'}), 200

    try:
        # Classify intent
        intent, params = classify_intent(message, history)

        # Build response
        result = build_response(intent, params, teacher_id)

        return jsonify(result), 200

    except Exception as e:
        print(f"Chatbot error: {e}")
        return jsonify({
            'response': 'Sorry, something went wrong while processing your query. Please try again.',
            'type': 'text'
        }), 200
