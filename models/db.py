import mysql.connector
from config import Config
from flask import g

def get_db_connection():
    if 'db' not in g:
        try:
            g.db = mysql.connector.connect(
                host=Config.DB_HOST,
                port=Config.DB_PORT,
                user=Config.DB_USER,
                password=Config.DB_PASSWORD,
                database=Config.DB_NAME
            )
        except mysql.connector.Error as err:
            raise RuntimeError(f"Database connection failed: Cannot connect to MySQL at {Config.DB_HOST}:{Config.DB_PORT}/{Config.DB_NAME}. Please ensure MySQL service is running. (Error: {err})")
    return g.db

def close_db_connection(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    conn = get_db_connection()
    # buffered=True ensures all rows are read into memory immediately,
    # preventing "Unread result found" errors when closing the cursor.
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute(query, params or ())
        
        result = None
        if fetchone:
            result = cursor.fetchone()
        elif fetchall:
            result = cursor.fetchall()
            
        if commit:
            conn.commit()
            return cursor.lastrowid
            
        return result
    finally:
        cursor.close()
