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

def create_app():
    app = Flask(__name__, static_folder='.', static_url_path='')
    app.config.from_object(Config)

    # Register Teardown
    app.teardown_appcontext(close_db_connection)

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(classes_bp, url_prefix='/api')
    app.register_blueprint(students_bp, url_prefix='/api')
    app.register_blueprint(attendance_bp, url_prefix='/api')
    app.register_blueprint(timetable_bp, url_prefix='/api')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(whatsapp_bp, url_prefix='/api/whatsapp')

    @app.route('/')
    def index():
        return app.send_static_file('index.html')
        
    @app.route('/dashboard')
    def dashboard():
        return app.send_static_file('teacher-dashboard.html')
        
    @app.route('/login')
    def login():
        return app.send_static_file('Authentication/login.html')

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000)
