from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 메모리 저장소 (임시)
messages = []

@app.route("/")
def home():
    return jsonify({"message": "chat server alive"})

# 메시지 저장
@app.route("/send", methods=["POST"])
def send_message():
    data = request.json
    messages.append(data)
    return jsonify({"status": "ok"})

# 메시지 조회
@app.route("/messages", methods=["GET"])
def get_messages():
    return jsonify(messages)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
