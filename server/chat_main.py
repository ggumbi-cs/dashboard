from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2
from datetime import timedelta

app = Flask(__name__)
CORS(app)


def get_conn():
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL 없음")

    # Railway 호환
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

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

    # 기존 DB 호환용
    cur.execute("""
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS checked_by TEXT
    """)

    conn.commit()
    cur.close()
    conn.close()


def normalize_checked_list(raw_text):
    if not raw_text:
        return []

    result = []
    seen = set()

    for item in str(raw_text).split(","):
        name = item.strip()
        if not name:
            continue
        if name in seen:
            continue
        seen.add(name)
        result.append(name)

    return result


@app.route("/")
def home():
    return "OK"


# 서버 시작 시 1회만 테이블 확인
with app.app_context():
    ensure_table()


@app.route("/messages", methods=["GET"])
def get_messages():
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, name, message, created_at, checked_by
            FROM messages
            ORDER BY id DESC
            LIMIT 100
        """)

        rows = cur.fetchall()

        result = []
        for row in rows:
            created_at = row[3]
            created_at_kst = ""

            if created_at:
                # Railway/DB UTC 저장 기준 보정
                created_at_kst = (created_at + timedelta(hours=9)).strftime("%Y/%m/%d %H:%M:%S")

            checked_list = normalize_checked_list(row[4])

            result.append({
                "id": row[0],
                "name": row[1],
                "message": row[2],
                "created_at": created_at_kst,
                "checked_by": ", ".join(checked_list)
            })

        cur.close()
        conn.close()

        return jsonify(result)

    except Exception as e:
        print("GET /messages 오류:", str(e))
        return jsonify({"error": str(e)}), 500


@app.route("/send", methods=["POST"])
def send_message():
    try:
        data = request.get_json(silent=True) or {}

        name = str(data.get("name", "")).strip()
        message = str(data.get("message", "")).strip()

        if not name or not message:
            return jsonify({"error": "값 없음"}), 400

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
        return jsonify({"error": str(e)}), 500


@app.route("/check", methods=["POST"])
def check_message():
    try:
        data = request.get_json(silent=True) or {}

        message_id = data.get("id")
        checker = str(data.get("checker", "")).strip()

        if not message_id:
            return jsonify({"error": "id 없음"}), 400

        if not checker:
            return jsonify({"error": "checker 없음"}), 400

        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
            SELECT checked_by
            FROM messages
            WHERE id = %s
        """, (message_id,))

        row = cur.fetchone()

        if row is None:
            cur.close()
            conn.close()
            return jsonify({"error": "메시지 없음"}), 404

        checked_list = normalize_checked_list(row[0])

        # 토글 제거 / 사람별 누적만
        if checker not in checked_list:
            checked_list.append(checker)

        checked_by = ", ".join(checked_list)

        cur.execute("""
            UPDATE messages
            SET checked_by = %s
            WHERE id = %s
        """, (checked_by, message_id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "status": "ok",
            "checked_by": checked_by
        })

    except Exception as e:
        print("POST /check 오류:", str(e))
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
