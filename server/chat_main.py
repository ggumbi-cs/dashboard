from flask import Flask, request, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

messages = []

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "chat server alive"
    })

@app.route("/messages", methods=["GET"])
def get_messages():
    return jsonify(messages)

@app.route("/send", methods=["POST"])
def send_message():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"status": "error", "reason": "no json body"}), 400

    name = str(data.get("name", "")).strip()
    message = str(data.get("message", "")).strip()

    if not name or not message:
        return jsonify({"status": "error", "reason": "name or message empty"}), 400

    messages.append({
        "name": name,
        "message": message
    })

    return jsonify({"status": "ok"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
