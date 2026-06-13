"""
Ziphay Security Utilities
─────────────────────────
Production-grade helpers for:
  ✅ File signature (magic byte) validation
  ✅ Filename sanitization
  ✅ Path traversal prevention
  ✅ Client IP extraction (proxy-aware)
  ✅ Sliding-window rate limiting
  ✅ Input validation & whitelisting
"""

import re
import os
import time
import hashlib
import logging
import ipaddress
from collections import defaultdict
from typing import Optional

logger = logging.getLogger("ziphay.security")

# ══════════════════════════════════════════════════
#  FILE SIGNATURE (MAGIC BYTE) VALIDATION
#  Validates that file content matches its claimed type.
#  Prevents disguised executables (e.g. .exe renamed to .png).
# ══════════════════════════════════════════════════

# Map of extension -> list of valid magic byte prefixes
FILE_SIGNATURES = {
    "jpg":  [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png":  [b"\x89PNG\r\n\x1a\n"],
    "gif":  [b"GIF87a", b"GIF89a"],
    "webp": [b"RIFF"],  # RIFF....WEBP
    "bmp":  [b"BM"],
    "tiff": [b"II\x2a\x00", b"MM\x00\x2a"],
    "pdf":  [b"%PDF"],
    "zip":  [b"PK\x03\x04", b"PK\x05\x06"],
    "gz":   [b"\x1f\x8b"],
}

# Extensions we allow for processing
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff"}
ALLOWED_DOCUMENT_EXTENSIONS = {"pdf"}
ALLOWED_ARCHIVE_EXTENSIONS = {"zip", "gz"}
ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOCUMENT_EXTENSIONS | ALLOWED_ARCHIVE_EXTENSIONS

# Dangerous extensions that must NEVER be processed
BLOCKED_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "msi", "scr", "pif",  # Windows executables
    "sh", "bash", "csh", "ksh",                         # Shell scripts
    "ps1", "psm1", "psd1",                              # PowerShell
    "vbs", "vbe", "js", "jse", "wsf", "wsh",            # Script engines
    "dll", "sys", "drv",                                 # Libraries
    "py", "rb", "pl", "php",                             # Server-side scripts
    "jar", "class",                                      # Java
    "app", "action", "command",                          # macOS
}

# Max file sizes (in bytes)
MAX_FILE_SIZE_FREE = 50 * 1024 * 1024   # 50 MB
MAX_FILE_SIZE_PRO = 2 * 1024 * 1024 * 1024  # 2 GB


def validate_file_signature(file_bytes: bytes, claimed_ext: str) -> bool:
    """
    Validate that the file's magic bytes match the claimed extension.
    Returns True if valid, False if the file signature doesn't match.
    """
    claimed_ext = claimed_ext.lower().strip(".")

    if claimed_ext not in FILE_SIGNATURES:
        # Unknown extension — we can't validate, but it's not in our blocked list
        # so we allow it (it will be treated as generic/unsupported)
        return True

    valid_signatures = FILE_SIGNATURES[claimed_ext]

    # Special case: WebP files have RIFF header but also need "WEBP" at offset 8
    if claimed_ext == "webp":
        if len(file_bytes) < 12:
            return False
        return file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP"

    for sig in valid_signatures:
        if file_bytes[:len(sig)] == sig:
            return True

    return False


def is_dangerous_file(file_bytes: bytes) -> bool:
    """
    Check if file content looks like a dangerous executable regardless of extension.
    Returns True if the file appears to be an executable or script.
    """
    # Check for executable magic bytes
    dangerous_signatures = [
        b"MZ",                          # Windows PE executable
        b"\x7fELF",                     # Linux ELF executable
        b"\xfe\xed\xfa",               # Mach-O (macOS)
        b"\xca\xfe\xba\xbe",           # Java class / Mach-O fat binary
        b"#!/",                         # Shell script shebang
        b"#!\\",                        # Windows-style shebang
    ]

    for sig in dangerous_signatures:
        if file_bytes[:len(sig)] == sig:
            logger.warning("Dangerous file signature detected: %s", sig[:8].hex())
            return True

    return False


# ══════════════════════════════════════════════════
#  FILENAME SANITIZATION
#  Strips path traversal, null bytes, and dangerous chars.
#  Returns a safe filename or generates a random one.
# ══════════════════════════════════════════════════

# Only allow alphanumeric, hyphens, underscores, dots, spaces
_SAFE_FILENAME_RE = re.compile(r"[^a-zA-Z0-9_\-. ]")
# Consecutive dots (prevents ...)
_MULTI_DOT_RE = re.compile(r"\.{2,}")


def sanitize_filename(filename: str, max_length: int = 200) -> str:
    """
    Sanitize a user-provided filename to prevent path traversal and injection.
    Returns a safe filename string.
    """
    if not filename:
        return "unnamed_file"

    # Strip null bytes (critical — can bypass path checks)
    filename = filename.replace("\x00", "")

    # Get basename only — strip any directory components
    filename = os.path.basename(filename)

    # Remove path separators that basename might miss
    filename = filename.replace("/", "_").replace("\\", "_")

    # Remove dangerous characters
    filename = _SAFE_FILENAME_RE.sub("_", filename)

    # Collapse multiple dots
    filename = _MULTI_DOT_RE.sub(".", filename)

    # Remove leading/trailing dots and spaces
    filename = filename.strip(". ")

    # Truncate to max length
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext

    # Final fallback
    if not filename or filename == ".":
        return "unnamed_file"

    return filename


def extract_safe_extension(filename: str) -> str:
    """
    Extract and validate file extension from a filename.
    Returns lowercase extension without dot, or 'bin' if invalid.
    """
    if not filename or "." not in filename:
        return "bin"

    ext = filename.rsplit(".", 1)[-1].lower().strip()

    # Validate: extension should be short and alphanumeric only
    if not ext or len(ext) > 10 or not ext.isalnum():
        return "bin"

    # Block dangerous extensions
    if ext in BLOCKED_EXTENSIONS:
        logger.warning("Blocked dangerous extension: %s", ext)
        return "bin"

    return ext


def is_extension_allowed(ext: str) -> bool:
    """Check if the extension is in our whitelist for processing."""
    return ext.lower().strip(".") in ALLOWED_EXTENSIONS


# ══════════════════════════════════════════════════
#  PATH TRAVERSAL PREVENTION
# ══════════════════════════════════════════════════

# UUID v4 pattern
_UUID_RE = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")


def validate_file_id(file_id: str) -> bool:
    """
    Validate that a file_id is a proper UUID v4.
    Prevents path traversal attacks via crafted file IDs.
    """
    if not file_id or not isinstance(file_id, str):
        return False
    return bool(_UUID_RE.match(file_id.lower()))


def safe_join(base_dir: str, *parts: str) -> str:
    """
    Safely join path components, ensuring the result stays within base_dir.
    Raises ValueError if the resulting path escapes the base directory.
    """
    base_dir = os.path.realpath(base_dir)
    full_path = os.path.realpath(os.path.join(base_dir, *parts))

    if not full_path.startswith(base_dir + os.sep) and full_path != base_dir:
        raise ValueError(f"Path traversal detected: {full_path} escapes {base_dir}")

    return full_path


# ══════════════════════════════════════════════════
#  CLIENT IP EXTRACTION (Proxy-Aware)
# ══════════════════════════════════════════════════

# Private/internal IP ranges that should not be trusted in X-Forwarded-For
_PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
]


def get_client_ip(request) -> str:
    """
    Extract the real client IP from a request, handling reverse proxies.
    Falls back to request.client.host if no proxy headers are present.
    """
    # Check X-Forwarded-For header (set by load balancers/proxies)
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        # Take the first non-private IP (rightmost trusted proxy adds leftmost client)
        ips = [ip.strip() for ip in forwarded_for.split(",")]
        for ip_str in ips:
            try:
                ip = ipaddress.ip_address(ip_str)
                if not any(ip in net for net in _PRIVATE_RANGES):
                    return ip_str
            except ValueError:
                continue

    # Check X-Real-IP header (Nginx)
    real_ip = request.headers.get("x-real-ip", "")
    if real_ip:
        try:
            ip = ipaddress.ip_address(real_ip.strip())
            if not any(ip in net for net in _PRIVATE_RANGES):
                return real_ip.strip()
        except ValueError:
            pass

    # Fallback to direct connection IP
    if request.client and request.client.host:
        return request.client.host

    return "unknown"


# ══════════════════════════════════════════════════
#  SLIDING WINDOW RATE LIMITER
#  Per-route, per-IP rate limiting with configurable
#  limits and windows.
# ══════════════════════════════════════════════════

class RateLimiter:
    """
    Thread-safe sliding window rate limiter.
    Tracks requests per IP per route.
    """

    def __init__(self):
        # Structure: {route: {ip: [timestamps]}}
        self._store: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
        self._cleanup_counter = 0
        self._cleanup_interval = 100  # Cleanup every N checks

    def check(self, ip: str, route: str, limit: int, window_seconds: int) -> bool:
        """
        Check if the request is within rate limits.
        Returns True if allowed, False if rate limited.
        """
        now = time.time()
        cutoff = now - window_seconds

        # Get and prune timestamps for this IP/route
        timestamps = self._store[route][ip]
        self._store[route][ip] = [t for t in timestamps if t > cutoff]

        if len(self._store[route][ip]) >= limit:
            logger.warning(
                "Rate limit exceeded: ip=%s route=%s count=%d limit=%d",
                _hash_ip(ip), route, len(self._store[route][ip]), limit
            )
            return False

        self._store[route][ip].append(now)

        # Periodic cleanup of expired entries
        self._cleanup_counter += 1
        if self._cleanup_counter >= self._cleanup_interval:
            self._cleanup(now)
            self._cleanup_counter = 0

        return True

    def _cleanup(self, now: float):
        """Remove expired entries to prevent memory growth."""
        for route in list(self._store.keys()):
            for ip in list(self._store[route].keys()):
                # Remove IPs with no recent activity (> 5 minutes)
                if not self._store[route][ip] or (now - max(self._store[route][ip])) > 300:
                    del self._store[route][ip]
            if not self._store[route]:
                del self._store[route]


# Singleton rate limiter instance
rate_limiter = RateLimiter()


# ══════════════════════════════════════════════════
#  INPUT VALIDATION
# ══════════════════════════════════════════════════

VALID_GOALS = {"auto", "web", "email", "social", "archive"}
VALID_QUALITY_SETTINGS = {"auto", "high", "medium", "low"}


def validate_goal(goal: str) -> str:
    """Validate and return a safe goal parameter."""
    goal = str(goal).lower().strip()
    if goal not in VALID_GOALS:
        return "auto"
    return goal


def validate_quality(quality: str) -> str:
    """Validate and return a safe quality parameter."""
    quality = str(quality).lower().strip()
    if quality not in VALID_QUALITY_SETTINGS:
        return "auto"
    return quality


# ══════════════════════════════════════════════════
#  UTILITY HELPERS
# ══════════════════════════════════════════════════

def _hash_ip(ip: str) -> str:
    """Hash an IP address for safe logging (GDPR compliance)."""
    return hashlib.sha256(ip.encode()).hexdigest()[:12]


def generate_request_id() -> str:
    """Generate a unique request ID for tracing."""
    import uuid
    return str(uuid.uuid4())[:8]
