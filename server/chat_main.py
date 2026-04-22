from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# ======================
# DB 초기화
# ======================
def init_db():
    conn = sqlite3.connect("chat.db")
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            message TEXT,
            time TEXT
        )
    """)

    conn.commit()
    conn.close()

init_db()

# ======================
# 서버 상태 확인
# ======================
@app.route("/")
def home():
    return {"message": "chat server alive"}

# ======================
# 메시지 전송
# ======================
@app.route("/send", methods=["POST"])
def send():
    data = request.get_json()

    if not data:
        return {"error": "no data"}, 400

    name = data.get("name", "")
    message = data.get("message", "")
    time = data.get("time", datetime.now().strftime("%Y/%m/%d %H:%M:%S"))

    conn = sqlite3.connect("chat.db")
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO messages (name, message, time) VALUES (?, ?, ?)",
        (name, message, time)
    )

    conn.commit()
    conn.close()

    return {"status": "ok"}

# ======================
# 메시지 조회
# ======================
@app.route("/messages", methods=["GET"])
def get_messages():
    conn = sqlite3.connect("chat.db")
    cur = conn.cursor()

    cur.execute("SELECT name, message, time FROM messages ORDER BY id ASC")
    rows = cur.fetchall()

    conn.close()

    result = []
    for r in rows:
        result.append({
            "name": r[0],
            "message": r[1],
            "time": r[2]
        })

    return jsonify(result)

# ======================
# 실행
# ======================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
