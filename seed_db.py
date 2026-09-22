import mysql.connector
import os
from dotenv import load_dotenv
import bcrypt
from datetime import datetime, timedelta
import random

load_dotenv()

DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT', 3306)
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_database():
    try:
        # First connect without database to create it if not exists
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        cursor.execute(f"USE {DB_NAME}")
        
        # Read and execute schema
        with open('database/schema.sql', 'r') as f:
            schema_script = f.read()
        
        # Split schema by ';' and execute
        for statement in schema_script.split(';'):
            if statement.strip():
                cursor.execute(statement)
        print("Schema created successfully.")

        # Insert Admin
        admin_pass = hash_password('admin123')
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, full_name, email, is_active)
            VALUES ('admin', %s, 'admin', 'System Administrator', 'admin@college.edu', 1)
        """, (admin_pass,))

        # Insert Teachers
        teacher_pass = hash_password('teacher123')
        teachers = [
            ('jsmith', 'Prof. John Smith', 'john.smith@college.edu', 'EMP001'),
            ('pjoshi', 'Prof. Priya Joshi', 'priya.joshi@college.edu', 'EMP002'),
            ('rsharma', 'Prof. Rajesh Sharma', 'rajesh.sharma@college.edu', 'EMP003')
        ]
        teacher_ids = {}
        for username, name, email, emp_id in teachers:
            cursor.execute("""
                INSERT INTO users (username, password_hash, role, full_name, email, is_active)
                VALUES (%s, %s, 'teacher', %s, %s, 1)
            """, (username, teacher_pass, name, email))
            user_id = cursor.lastrowid
            
            cursor.execute("""
                INSERT INTO teachers (user_id, employee_id, full_name, email)
                VALUES (%s, %s, %s, %s)
            """, (user_id, emp_id, name, email))
            teacher_ids[username] = cursor.lastrowid

        # Insert Classes
        classes = [
            ('2023-24', 3, 'SY', 'A', 'SY Computer A'),
            ('2023-24', 3, 'SY', 'B', 'SY Computer B'),
            ('2023-24', 5, 'TY', 'A', 'TY Computer A'),
            ('2023-24', 5, 'TY', 'B', 'TY Computer B'),
            ('2023-24', 7, 'Final', 'A', 'Final Year CS')
        ]
        class_ids = {}
        for acad_year, sem, year_name, div, sec_name in classes:
            cursor.execute("""
                INSERT INTO classes (academic_year, semester, year_name, division, section_name)
                VALUES (%s, %s, %s, %s, %s)
            """, (acad_year, sem, year_name, div, sec_name))
            class_ids[sec_name] = cursor.lastrowid

        # Insert Subjects
        subjects = [
            ('CS201', 'Data Structures', 3, 4),
            ('CS202', 'Object Oriented Programming', 3, 4),
            ('CS301', 'Operating Systems', 5, 4),
            ('CS302', 'Database Management System', 5, 4),
            ('CS303', 'Software Engineering', 5, 3),
            ('CS401', 'Machine Learning', 7, 4)
        ]
        subject_ids = {}
        for code, name, sem, credits in subjects:
            cursor.execute("""
                INSERT INTO subjects (subject_code, subject_name, semester, credits)
                VALUES (%s, %s, %s, %s)
            """, (code, name, sem, credits))
            subject_ids[name] = cursor.lastrowid

        # Insert Teacher-Subject Mappings
        teacher_subject_mappings = [
            (teacher_ids['jsmith'], subject_ids['Data Structures'], class_ids['SY Computer A']),
            (teacher_ids['jsmith'], subject_ids['Software Engineering'], class_ids['SY Computer A']),
            (teacher_ids['pjoshi'], subject_ids['Operating Systems'], class_ids['TY Computer A']),
            (teacher_ids['rsharma'], subject_ids['Database Management System'], class_ids['TY Computer A']),
            (teacher_ids['rsharma'], subject_ids['Machine Learning'], class_ids['Final Year CS'])
        ]
        ts_ids = []
        for t_id, sub_id, c_id in teacher_subject_mappings:
            cursor.execute("""
                INSERT INTO teacher_subjects (teacher_id, subject_id, class_id)
                VALUES (%s, %s, %s)
            """, (t_id, sub_id, c_id))
            ts_ids.append(cursor.lastrowid)

        # Insert Timetables
        timetables = [
            (ts_ids[0], 'Monday', '09:00:00', '10:00:00', 'Lab 5'), # J.Smith, DS, SY Comp A
            (ts_ids[0], 'Wednesday', '10:00:00', '11:00:00', 'Lab 5'),
            (ts_ids[1], 'Monday', '14:00:00', '15:00:00', 'Room 204'), # J.Smith, SE, SY Comp A
            (ts_ids[1], 'Thursday', '11:15:00', '12:15:00', 'Room 204'),
            (ts_ids[2], 'Tuesday', '11:15:00', '12:15:00', 'Room 302'), # P.Joshi, OS, TY Comp A
            (ts_ids[3], 'Friday', '09:00:00', '10:00:00', 'Room 303'), # R.Sharma, DBMS, TY Comp A
            (ts_ids[4], 'Monday', '15:45:00', '16:45:00', 'Lab 2'), # R.Sharma, ML, Final Year CS
        ]
        timetable_ids = []
        for ts_id, day, start, end, room in timetables:
            cursor.execute("""
                INSERT INTO timetables (teacher_subject_id, day_of_week, start_time, end_time, room_number)
                VALUES (%s, %s, %s, %s, %s)
            """, (ts_id, day, start, end, room))
            timetable_ids.append(cursor.lastrowid)

        # Insert Students (e.g. SY Computer A)
        student_pass = hash_password('student123')
        sy_a_students = [
            ('101', 'EN2022001', 'Rahul Sharma', 'rahul@college.edu', 'Mr. Ramesh Sharma', '9876543210'),
            ('102', 'EN2022002', 'Amit Patil', 'amit@college.edu', 'Mr. Sunil Patil', '9876543211'),
            ('103', 'EN2022003', 'Sneha Kulkarni', 'sneha@college.edu', 'Mrs. V. Kulkarni', '9876543212'),
            ('104', 'EN2022004', 'Vikram Singh', 'vikram@college.edu', 'Mr. Rajendra Singh', '9876543213'),
            ('105', 'EN2022005', 'Priya Joshi', 'priyastudent@college.edu', 'Mr. Anant Joshi', '9876543214'),
            ('106', 'EN2022006', 'Rohan Mehta', 'rohan@college.edu', 'Mr. K. Mehta', '9876543215'),
            ('107', 'EN2022007', 'Neha Shinde', 'neha@college.edu', 'Mr. P. Shinde', '9876543216')
        ]
        
        student_records = []
        for roll, enroll, name, email, parent, p_phone in sy_a_students:
            # Create user
            cursor.execute("""
                INSERT INTO users (username, password_hash, role, full_name, email, is_active)
                VALUES (%s, %s, 'student', %s, %s, 1)
            """, (enroll, student_pass, name, email))
            u_id = cursor.lastrowid
            
            cursor.execute("""
                INSERT INTO students (user_id, class_id, roll_number, enrollment_number, full_name, email, parent_name, parent_phone, admission_year)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 2022)
            """, (u_id, class_ids['SY Computer A'], roll, enroll, name, email, parent, p_phone))
            student_records.append(cursor.lastrowid)
            
        # Add a few to TY Computer A
        ty_a_students = [
            ('201', 'EN2021001', 'Akash Verma', 'akash@college.edu', 'Mr. S. Verma', '9876543220'),
            ('202', 'EN2021002', 'Pooja Nair', 'pooja@college.edu', 'Mr. R. Nair', '9876543221'),
        ]
        for roll, enroll, name, email, parent, p_phone in ty_a_students:
            cursor.execute("""
                INSERT INTO users (username, password_hash, role, full_name, email, is_active)
                VALUES (%s, %s, 'student', %s, %s, 1)
            """, (enroll, student_pass, name, email))
            u_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO students (user_id, class_id, roll_number, enrollment_number, full_name, email, parent_name, parent_phone, admission_year)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 2021)
            """, (u_id, class_ids['TY Computer A'], roll, enroll, name, email, parent, p_phone))

        # Insert Attendance
        # We will insert for the last 5 days
        today = datetime.now().date()
        for i in range(5):
            date = today - timedelta(days=i)
            day_name = date.strftime('%A')
            
            # Find timetables for this day
            cursor.execute("SELECT timetable_id, teacher_subject_id FROM timetables WHERE day_of_week = %s", (day_name,))
            daily_tts = cursor.fetchall()
            
            for tt_id, ts_id in daily_tts:
                # Find class for this ts_id
                cursor.execute("SELECT class_id FROM teacher_subjects WHERE teacher_subject_id = %s", (ts_id,))
                c_id = cursor.fetchone()[0]
                
                # Find students in this class
                cursor.execute("SELECT student_id FROM students WHERE class_id = %s", (c_id,))
                class_students = cursor.fetchall()
                
                for (s_id,) in class_students:
                    # Random attendance
                    status = random.choices(['present', 'absent', 'late'], weights=[0.8, 0.15, 0.05])[0]
                    # If it's today and we want to simulate pending, maybe skip some
                    if i == 0 and random.random() < 0.3:
                        continue
                        
                    cursor.execute("""
                        INSERT INTO attendance (student_id, timetable_id, attendance_date, status, marked_by)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (s_id, tt_id, date, status, 1)) # Marked by admin/teacher (id=1)

        conn.commit()
        print("Dummy data inserted successfully.")

    except mysql.connector.Error as err:
        print(f"Error: {err}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    seed_database()
