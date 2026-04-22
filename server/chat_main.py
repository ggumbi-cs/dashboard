from flask import Flask, request, jsonify
import os
import psycopg2
from datetime import datetime

app = Flask(__name__)

# =========================
# DB 연결
# =========================
DATABASE_URL = os.environ.get("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# =========================
# 테이블 생성 (최초 1회)
# =========================
cur.execute("""
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    name TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")
conn.commit()

# =========================
# 서버 확인용
# =========================
@app.route("/")
def home():
    return {"db": "postgres", "message": "chat server alive"}

# =========================
# 메시지 저장
# =========================
@app.route("/send", methods=["POST"])
def send():
    data = request.get_json()

    if not data:
        return {"error": "no data"}, 400

    name = data.get("name", "익명")
    message = data.get("message", "")

    cur.execute(
        "INSERT INTO messages (name, message) VALUES (%s, %s)",
        (name, message)
    )
    conn.commit()

    return {"status": "ok"}

# =========================
# 메시지 조회
# =========================
@app.route("/messages", methods=["GET"])
def get_messages():
    cur.execute("SELECT name, message, created_at FROM messages ORDER BY id ASC")
    rows = cur.fetchall()

    result = []
    for row in rows:
        result.append({
            "name": row[0],
            "message": row[1],
            "time": row[2].strftime("%Y/%m/%d %H:%M:%S")
        })

    return jsonify(result)

# =========================
# Railway 필수
# =========================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
