from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2

app = Flask(__name__)
CORS(app)


def get_conn():
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL 없음")

    # 🔥 핵심 수정 (Railway 호환)
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

    # checked_by 컬럼이 없을 수 있으므로 안전하게 추가
    cur.execute("""
        ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS checked_by TEXT
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
            SELECT id, name, message, created_at, checked_by
            FROM messages
            ORDER BY id DESC
        """)

        rows = cur.fetchall()

        result = []
        for row in rows:
            result.append({
                "id": row[0],
                "name": row[1],
                "message": row[2],
                "created_at": row[3].strftime("%Y/%m/%d %H:%M:%S") if row[3] else "",
                "checked_by": row[4] if row[4] else ""
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
        return jsonify({"error": str(e)}), 500


@app.route("/check", methods=["POST"])
def check_message():
    try:
        data = request.get_json(silent=True) or {}

        message_id = data.get("id")
        checker = str(data.get("checker", "")).strip()

        if not message_id:
            return jsonify({"error": "id 없음"}), 400

        ensure_table()

        conn = get_conn()
        cur = conn.cursor()

        # 이미 체크한 사람이 있으면 해제, 없으면 등록
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

        current_checked_by = row[0] if row[0] else ""

        if current_checked_by:
            cur.execute("""
                UPDATE messages
                SET checked_by = NULL
                WHERE id = %s
            """, (message_id,))
            checked_by = ""
        else:
            cur.execute("""
                UPDATE messages
                SET checked_by = %s
                WHERE id = %s
            """, (checker, message_id))
            checked_by = checker

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
