# backend/database.py
import os
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://guptgoo:guptgoo_secret@localhost:5432/guptgoo")

Base = declarative_base()

engine = create_engine(
    DATABASE_URL,
    pool_size=20,        # 20 persistent connections per worker (×4 workers = 80 total)
    max_overflow=40,     # 40 extra under spike (×4 workers = 160 burst capacity → ~240 total)
    pool_timeout=30,     # Seconds to wait for a connection before raising error
    pool_pre_ping=True,  # Health-check connections before use (prevents stale conn errors)
    pool_recycle=1800,   # Recycle connections every 30 min (avoids DB-side timeouts)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class ChatMessage(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    role = Column(String)  # "user" or "ai"
    content = Column(Text)
    mode = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def save_message(session_id: str, role: str, content: str, mode: str, is_vault: bool):
    if is_vault:
        return  # DO NOT SAVE in Vault mode

    db = SessionLocal()
    msg = ChatMessage(session_id=session_id, role=role, content=content, mode=mode)
    db.add(msg)
    db.commit()
    db.close()

def get_history(session_id: str):
    db = SessionLocal()
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).all()
    db.close()
    return messages
