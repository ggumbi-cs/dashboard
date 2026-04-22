from flask import Flask, request, jsonify
import os
import psycopg2
from datetime import datetime

app = Flask(__name__)

# =========================
# DB 연결 함수 (지연 연결)
# =========================
def get_conn():
    return psycopg2.connect(os.environ.get("DATABASE_URL"))

# =========================
# 기본 테스트
# =========================
@app.route("/")
def home():
    return "OK"

# =========================
# 메시지 저장
# =========================
@app.route("/send", methods=["POST"])
def send_message():
    data = request.json
    name = data.get("name")
    message = data.get("message")

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            name TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute(
        "INSERT INTO messages (name, message) VALUES (%s, %s)",
        (name, message)
    )

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"status": "ok"})

# =========================
# 메시지 불러오기
# =========================
@app.route("/messages")
def get_messages():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT name, message, created_at FROM messages ORDER BY id DESC")
    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "name": r[0],
            "message": r[1],
            "created_at": str(r[2])
        })

    return jsonify(result)

# =========================
# 실행
# =========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
