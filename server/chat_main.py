from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

messages = []

@app.route("/")
def home():
    return jsonify({"message": "chat server alive"})

@app.route("/send", methods=["POST"])
def send_message():
    data = request.json
    print("받은 데이터:", data)
    messages.append(data)
    return jsonify({"status": "ok"})

@app.route("/messages", methods=["GET"])
def get_messages():
    return jsonify(messages)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))  # 🔥 핵심
    app.run(host="0.0.0.0", port=port)
