import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "studyai.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn