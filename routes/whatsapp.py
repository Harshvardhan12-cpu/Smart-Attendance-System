from flask import Blueprint, jsonify, session
from models.db import execute_query

whatsapp_bp = Blueprint('whatsapp', __name__)

@whatsapp_bp.route('/logs', methods=['GET'])
def get_whatsapp_logs():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    teacher_id = session.get('teacher_id')
    if not teacher_id:
        return jsonify([]), 200

    query = """
        SELECT DISTINCT w.*, s.full_name as student_name
        FROM whatsapp_logs w
        JOIN students s ON w.student_id = s.student_id
        JOIN classes c ON s.class_id = c.class_id
        JOIN teacher_subjects ts ON c.class_id = ts.class_id
        WHERE ts.teacher_id = %s
        ORDER BY w.created_at DESC
        LIMIT 50
    """
    logs = execute_query(query, (teacher_id,), fetchall=True) or []
    for log in logs:
        log['created_at'] = str(log['created_at']) if log.get('created_at') else ''
        log['sent_at'] = str(log['sent_at']) if log.get('sent_at') else None
    return jsonify(logs), 200

import urllib.request
import json
import ssl
from flask import current_app

def send_whatsapp_message(to_number, message_body):
    token = current_app.config.get('WHATSAPP_ACCESS_TOKEN')
    phone_id = current_app.config.get('WHATSAPP_PHONE_NUMBER_ID')
    
    if not token or not phone_id:
        return False, "WhatsApp configuration missing in .env"
        
    to_number = ''.join(filter(str.isdigit, str(to_number)))
    if len(to_number) == 10:
        to_number = '91' + to_number  # Default to India if 10 digits
        
    url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Send custom text message directly to recipient without demo template message
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_number,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": message_body
        }
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx) as response:
            response.read()
            return True, None
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode('utf-8')
        try:
            error_json = json.loads(error_msg)
            return False, error_json.get('error', {}).get('message', error_msg)
        except:
            return False, error_msg
    except Exception as e:
        return False, str(e)
