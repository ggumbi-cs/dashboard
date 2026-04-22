from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2

app = Flask(__name__)
CORS(app)


def get_conn():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL 환경변수가 없습니다.")
    return psycopg2.connect(database_url)


def ensure_table():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cur.close()
    conn.close()


@app.route("/")
def home():
    return "OK"


@app.route("/messages", methods=["GET"])
def get_messages():
    try:
        ensure_table()

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT name, message, created_at
            FROM messages
            ORDER BY id DESC
        """)

        rows = cur.fetchall()

        result = []
        for row in rows:
            result.append({
                "name": row[0],
                "message": row[1],
                "created_at": row[2].strftime("%Y/%m/%d %H:%M:%S") if row[2] else ""
            })

        cur.close()
        conn.close()

        return jsonify(result)

    except Exception as e:
        print("GET /messages 오류:", str(e))
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/send", methods=["POST"])
def send_message():
    try:
        data = request.get_json(silent=True) or {}

        name = str(data.get("name", "")).strip()
        message = str(data.get("message", "")).strip()

        if not name or not message:
            return jsonify({
                "status": "error",
                "message": "name 또는 message가 비어 있습니다."
            }), 400

        ensure_table()

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO messages (name, message)
            VALUES (%s, %s)
        """, (name, message))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "ok"})

    except Exception as e:
        print("POST /send 오류:", str(e))
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
