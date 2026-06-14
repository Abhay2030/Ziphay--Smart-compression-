"""
Ziphay Database Setup — SQLAlchemy + SQLite (Security Hardened)

Security features:
  ✅ String column length constraints (prevent oversized data)
  ✅ Indexed columns for efficient queries and cleanup
  ✅ Hashed client IP column for abuse detection (GDPR-safe)
  ✅ Non-nullable constraints on critical fields
  ✅ Created_at index for efficient auto-deletion queries

Upgrade to PostgreSQL by changing SQLALCHEMY_DATABASE_URL
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Index
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

import os

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ziphay.db")
# For PostgreSQL: "postgresql://user:password@localhost/ziphay"

# Detect if using SQLite for connection args
_is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # Limit pool size to prevent connection exhaustion
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before use
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CompressionLog(Base):
    __tablename__ = "compression_logs"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(36), unique=True, index=True, nullable=False)  # UUID length
    filename = Column(String(500), nullable=False)  # Truncated safe filename
    original_size_bytes = Column(Integer, nullable=False)
    compressed_size_bytes = Column(Integer, nullable=False)
    saving_percent = Column(Float, default=0.0)
    goal = Column(String(20), default="auto")
    quality = Column(String(20), default="auto")
    output_format = Column(String(20))
    client_ip_hash = Column(String(12), index=True)  # SHA-256 prefix for abuse detection
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # Indexed for cleanup queries

    # Composite index for efficient filtering by date + IP (abuse detection)
    __table_args__ = (
        Index("ix_created_ip", "created_at", "client_ip_hash"),
    )

    def __repr__(self):
        return f"<Log {self.filename} saved {self.saving_percent}%>"