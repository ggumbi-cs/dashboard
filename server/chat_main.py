from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 🔥 CORS 허용 (이거 없으면 프론트 연결 안됨)

# 메모리 저장 (임시 DB)
messages = []

# 서버 확인용
@app.route("/")
def home():
    return {"message": "chat server alive"}

# 메시지 전송
@app.route("/send", methods=["POST"])
def send():
    data = request.get_json()

    if not data:
        return {"error": "no data"}, 400

    name = data.get("name", "익명")
    message = data.get("message", "")

    messages.append({
        "name": name,
        "message": message
    })

    return {"status": "ok"}

# 메시지 조회
@app.route("/messages", methods=["GET"])
def get_messages():
    return jsonify(messages)


# 🔥 Railway용 (중요)
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
