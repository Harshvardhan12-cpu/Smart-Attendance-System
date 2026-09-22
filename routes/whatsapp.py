from flask import Blueprint, jsonify
from models.db import execute_query

whatsapp_bp = Blueprint('whatsapp', __name__)

@whatsapp_bp.route('/logs', methods=['GET'])
def get_whatsapp_logs():
    query = """
        SELECT w.*, s.full_name as student_name
        FROM whatsapp_logs w
        JOIN students s ON w.student_id = s.student_id
        ORDER BY w.created_at DESC
        LIMIT 50
    """
    logs = execute_query(query, fetchall=True)
    for log in logs:
        log['created_at'] = str(log['created_at'])
        if log['sent_at']:
            log['sent_at'] = str(log['sent_at'])
    return jsonify(logs), 200
