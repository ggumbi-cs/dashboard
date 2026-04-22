from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sqlite3
from datetime import datetime

try:
    import psycopg2
except ImportError:
    psycopg2 = None

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_POSTGRES = bool(DATABASE_URL and psycopg2 is not None)


def get_sqlite_conn():
    conn = sqlite3.connect("chat.db")
    conn.row_factory = sqlite3.Row
    return conn


def get_postgres_conn():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    if USE_POSTGRES:
        conn = get_postgres_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                message TEXT NOT NULL,
                time TEXT NOT NULL
            )
        """)
        conn.commit()
        cur.close()
        conn.close()
    else:
        conn = get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                message TEXT NOT NULL,
                time TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()


def save_message(name: str, message: str, time_str: str):
    if USE_POSTGRES:
        conn = get_postgres_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO messages (name, message, time) VALUES (%s, %s, %s)",
            (name, message, time_str)
        )
        conn.commit()
        cur.close()
        conn.close()
    else:
        conn = get_sqlite_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO messages (name, message, time) VALUES (?, ?, ?)",
            (name, message, time_str)
        )
        conn.commit()
        conn.close()


def load_messages():
    if USE_POSTGRES:
        conn = get_postgres_conn()
        cur = conn.cursor()
        cur.execute("SELECT name, message, time FROM messages ORDER BY id ASC")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [{"name": r[0], "message": r[1], "time": r[2]} for r in rows]
    else:
        conn = get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("SELECT name, message, time FROM messages ORDER BY id ASC")
        rows = cur.fetchall()
        conn.close()
        return [{"name": r["name"], "message": r["message"], "time": r["time"]} for r in rows]


init_db()


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "chat server alive",
        "db": "postgres" if USE_POSTGRES else "sqlite"
    })


@app.route("/messages", methods=["GET"])
def get_messages():
    return jsonify(load_messages())


@app.route("/send", methods=["POST"])
def send():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"status": "error", "reason": "no json body"}), 400

    name = str(data.get("name", "")).strip()
    message = str(data.get("message", "")).strip()
    time_str = str(data.get("time", "")).strip()

    if not name or not message:
        return jsonify({"status": "error", "reason": "name or message empty"}), 400

    if not time_str:
        time_str = datetime.now().strftime("%Y/%m/%d %H:%M:%S")

    save_message(name, message, time_str)
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
