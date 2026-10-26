
from flask import Flask, jsonify, request
from config import Config
from models.db import close_db_connection

from routes.auth import auth_bp
from routes.classes import classes_bp
from routes.students import students_bp
from routes.attendance import attendance_bp
from routes.timetable import timetable_bp
from routes.reports import reports_bp
from routes.whatsapp import whatsapp_bp
from routes.chatbot import chatbot_bp


def create_app():
    app = Flask(__name__, static_folder='.', static_url_path='')
    app.config.from_object(Config)

    # Register database teardown
    app.teardown_appcontext(close_db_connection)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(classes_bp, url_prefix='/api')
    app.register_blueprint(students_bp, url_prefix='/api')
    app.register_blueprint(attendance_bp, url_prefix='/api')
    app.register_blueprint(timetable_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')
    app.register_blueprint(chatbot_bp, url_prefix='/api')

    # Health check
    @app.route('/api/health', methods=['GET'])
    def health_check():
        try:
            from models.db import execute_query

            res = execute_query(
                "SELECT 1 as connected",
                fetchone=True
            )

            if res and res.get('connected') == 1:
                return jsonify({
                    'status': 'healthy',
                    'mysql': 'connected'
                }), 200

            return jsonify({
                'status': 'unhealthy',
                'mysql': 'query failed'
            }), 500

        except Exception as e:
            return jsonify({
                'status': 'unhealthy',
                'mysql': 'disconnected',
                'error': str(e)
            }), 503

    # Handle server errors
    @app.errorhandler(500)
    def handle_500(e):
        return jsonify({
            'error': 'Server Error. Please check MySQL database connection.'
        }), 500

    # Home page
    @app.route('/')
    def index():
        from flask import session, redirect

        if 'user_id' in session:
            return redirect('/dashboard')

        return app.send_static_file('Authentication/login.html')

    # Dashboard
    @app.route('/dashboard')
    def dashboard():
        from flask import session, redirect

        if 'user_id' not in session:
            return redirect('/login')

        return app.send_static_file('teacher-dashboard.html')

    # Login page
    @app.route('/login')
    def login():
        from flask import session, redirect

        if 'user_id' in session:
            return redirect('/dashboard')

        return app.send_static_file('Authentication/login.html')

    # Signup page
    @app.route('/signup')
    def signup():
        from flask import session, redirect

        if 'user_id' in session:
            return redirect('/dashboard')

        return app.send_static_file('Authentication/signup.html')

    # Forgot password page
    @app.route('/forgot-password')
    def forgot_password():
        return app.send_static_file(
            'Authentication/forgot-password.html'
        )

    # Reset password page
    @app.route('/reset-password')
    def reset_password():
        return app.send_static_file(
            'Authentication/reset-password.html'
        )

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )

