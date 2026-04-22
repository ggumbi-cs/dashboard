from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 🔥 CORS 허용 (이게 핵심)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 접속 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

messages = []

@app.get("/")
def root():
    return {"message": "chat server alive"}

@app.get("/messages")
def get_messages():
    return messages

@app.post("/send")
def send_message(data: dict):
    messages.append(data)
    return {"status": "ok"}
