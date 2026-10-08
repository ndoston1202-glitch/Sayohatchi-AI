"""Sayohatchi AI backend: auth (3 rol), umumiy ma'lumotlar, analitika va AI xatolari jurnali.

Ishga tushirish:  uvicorn server.main:app --host 0.0.0.0 --port 8000
Muhit o'zgaruvchilari:
  SECRET_KEY  — token imzolash kaliti (majburiy, production'da)
  ANALYST_CODE — analitik sifatida ro'yxatdan o'tish kodi (standart: analitik2026)
  ADMIN_CODE   — admin sifatida ro'yxatdan o'tish kodi (standart: admin2026)
  DB_PATH     — SQLite fayli (standart: data/sayohatchi.db)
"""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
SECRET = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
CODES = {"analyst": os.environ.get("ANALYST_CODE") or os.environ.get("DEV_CODE") or "analitik2026",
         "admin": os.environ.get("ADMIN_CODE", "admin2026")}
DB_PATH = Path(os.environ.get("DB_PATH", ROOT / "data" / "sayohatchi.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

COLLECTIONS = {"resorts", "reviews", "orgs", "visits"}
ROLES = {"client", "org", "analyst", "admin"}
STAFF = {"analyst", "admin"}  # analitikani ko'ra oladi

app = FastAPI(title="Sayohatchi AI API", version="1.0")
# Ilova (APK) boshqa manbadan so'rov yuboradi, shuning uchun CORS ochiq; token Authorization sarlavhasida
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


with db() as c:
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, pw TEXT, role TEXT, created REAL);
    CREATE TABLE IF NOT EXISTS docs(col TEXT, id TEXT, owner TEXT, data TEXT, updated REAL, PRIMARY KEY(col, id));
    CREATE TABLE IF NOT EXISTS events(ts REAL, visitor TEXT, user TEXT, role TEXT, platform TEXT, type TEXT, page TEXT, meta TEXT);
    CREATE TABLE IF NOT EXISTS ai_logs(ts REAL, kind TEXT, resort TEXT, user TEXT, detail TEXT);
    CREATE INDEX IF NOT EXISTS ev_ts ON events(ts);
    CREATE INDEX IF NOT EXISTS docs_col ON docs(col);
    """)
    if "blocked" not in [r[1] for r in c.execute("PRAGMA table_info(users)")]:
        c.execute("ALTER TABLE users ADD COLUMN blocked INTEGER DEFAULT 0")


# ---------- Auth ----------
def hash_pw(pw: str, salt: str = None) -> str:
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()
    return f"{salt}${h}"


def check_pw(pw: str, stored: str) -> bool:
    salt = stored.split("$")[0]
    return hmac.compare_digest(hash_pw(pw, salt), stored)


def make_token(uid: str) -> str:
    exp = str(int(time.time()) + 30 * 86400)
    sig = hmac.new(SECRET.encode(), f"{uid}|{exp}".encode(), "sha256").hexdigest()
    return f"{uid}|{exp}|{sig}"


def current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        uid, exp, sig = authorization[7:].split("|")
    except ValueError:
        return None
    good = hmac.new(SECRET.encode(), f"{uid}|{exp}".encode(), "sha256").hexdigest()
    if not hmac.compare_digest(good, sig) or int(exp) < time.time():
        return None
    with db() as c:
        r = c.execute("SELECT id,name,email,role,blocked FROM users WHERE id=?", (uid,)).fetchone()
    return dict(r) if r and not r["blocked"] else None


def need_user(u=Depends(current_user)):
    if not u:
        raise HTTPException(401, "Kirish talab qilinadi")
    return u


# Oddiy rate limit: IP bo'yicha daqiqasiga N so'rov
_hits = defaultdict(deque)


def limit(request: Request, n: int = 120):
    ip = request.client.host if request.client else "?"
    # Har bir endpoint guruhi (n) uchun alohida hisoblagich — ko'rish so'rovlari kirish limitini to'ldirmasin
    q, now = _hits[(ip, n)], time.time()
    while q and q[0] < now - 60:
        q.popleft()
    if len(q) >= n:
        raise HTTPException(429, "Juda ko'p so'rov, birozdan keyin urinib ko'ring")
    q.append(now)


def public_user(u):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"]}


@app.post("/api/v1/auth/register")
async def register(request: Request):
    limit(request, 20)
    b = await request.json()
    name, email, pw, role = (b.get("name") or "").strip(), (b.get("email") or "").strip().lower(), b.get("password") or "", b.get("role")
    if role not in ROLES:
        raise HTTPException(400, "Noto'g'ri rol")
    if len(name) < 2 or "@" not in email or len(pw) < 6:
        raise HTTPException(400, "Ism, email va kamida 6 belgili parol kiriting")
    if role in CODES and not hmac.compare_digest(str(b.get("code") or ""), CODES[role]):
        raise HTTPException(403, "Kirish kodi noto'g'ri")
    uid = "u" + secrets.token_hex(6)
    try:
        with db() as c:
            c.execute("INSERT INTO users(id,name,email,pw,role,created,blocked) VALUES(?,?,?,?,?,?,0)", (uid, name, email, hash_pw(pw), role, time.time()))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Bu email bilan ro'yxatdan o'tilgan")
    u = {"id": uid, "name": name, "email": email, "role": role}
    return {"token": make_token(uid), "user": u}


@app.post("/api/v1/auth/login")
async def login(request: Request):
    limit(request, 20)
    b = await request.json()
    with db() as c:
        r = c.execute("SELECT * FROM users WHERE email=?", ((b.get("email") or "").strip().lower(),)).fetchone()
    if not r or not check_pw(b.get("password") or "", r["pw"]):
        raise HTTPException(401, "Email yoki parol noto'g'ri")
    if r["blocked"]:
        raise HTTPException(403, "Hisobingiz bloklangan. Admin bilan bog'laning")
    return {"token": make_token(r["id"]), "user": public_user(r)}


# ---------- Ma'lumotlar ----------
@app.get("/api/v1/state")
def state(request: Request, u=Depends(current_user)):
    limit(request)
    out = {k: [] for k in COLLECTIONS}
    with db() as c:
        for r in c.execute("SELECT col,owner,data FROM docs"):
            if r["col"] == "visits" and (not u or r["owner"] != u["id"]):
                continue  # sayohatlar tarixi — shaxsiy
            out[r["col"]].append(json.loads(r["data"]))
    return out


@app.post("/api/v1/seed")
async def seed(request: Request):
    """Baza bo'sh bo'lsa demo maskan va sharhlarni yuklaydi (faqat bir marta)."""
    b = await request.json()
    with db() as c:
        if c.execute("SELECT COUNT(*) FROM docs WHERE col='resorts'").fetchone()[0]:
            return {"seeded": False}
        for col in ("resorts", "reviews"):
            for d in (b.get(col) or [])[:500]:
                c.execute("INSERT OR IGNORE INTO docs VALUES(?,?,?,?,?)", (col, str(d["id"]), "system", json.dumps(d), time.time()))
    return {"seeded": True}


def can_write(col, doc, old, u):
    if u["role"] == "admin":
        return True
    if u["role"] == "analyst":
        return False  # analitik faqat ko'radi
    if old is None:  # yangi hujjat
        if col == "resorts":
            return u["role"] == "org"
        return True
    owner = old["owner"]
    if owner == u["id"]:
        return True
    # Tashkilot o'z maskaniga yozilgan sharhga javob bera oladi (faqat orgReply maydoni)
    if col == "reviews" and u["role"] == "org":
        prev = json.loads(old["data"])
        with db() as c:
            res = c.execute("SELECT owner FROM docs WHERE col='resorts' AND id=?", (str(prev.get("resortId")),)).fetchone()
        if res and res["owner"] == u["id"]:
            changed = {k for k in set(prev) | set(doc) if prev.get(k) != doc.get(k)}
            return changed <= {"orgReply"}
    return False


@app.put("/api/v1/docs/{col}/{doc_id}")
async def put_doc(col: str, doc_id: str, request: Request, u=Depends(current_user)):
    limit(request)
    if col not in COLLECTIONS:
        raise HTTPException(404)
    doc = await request.json()
    if len(json.dumps(doc)) > 3_000_000:
        raise HTTPException(413, "Hujjat juda katta")
    with db() as c:
        old = c.execute("SELECT owner,data FROM docs WHERE col=? AND id=?", (col, doc_id)).fetchone()
    if u is None:
        # Mehmon faqat yangi sharh qoldira oladi
        if not (col == "reviews" and old is None):
            raise HTTPException(401, "Kirish talab qilinadi")
        owner = None
    else:
        if not can_write(col, doc, old, u):
            raise HTTPException(403, "Ruxsat yo'q")
        owner = old["owner"] if old else u["id"]
    with db() as c:
        c.execute("INSERT OR REPLACE INTO docs VALUES(?,?,?,?,?)", (col, doc_id, owner, json.dumps(doc), time.time()))
    return {"ok": True}


@app.delete("/api/v1/docs/{col}/{doc_id}")
def del_doc(col: str, doc_id: str, u=Depends(need_user)):
    with db() as c:
        old = c.execute("SELECT owner FROM docs WHERE col=? AND id=?", (col, doc_id)).fetchone()
        if not old:
            return {"ok": True}
        if u["role"] != "admin" and old["owner"] != u["id"]:
            raise HTTPException(403, "Ruxsat yo'q")
        c.execute("DELETE FROM docs WHERE col=? AND id=?", (col, doc_id))
        if col == "resorts":
            for r in c.execute("SELECT id,data FROM docs WHERE col='reviews'").fetchall():
                if str(json.loads(r["data"]).get("resortId")) == doc_id:
                    c.execute("DELETE FROM docs WHERE col='reviews' AND id=?", (r["id"],))
    return {"ok": True}


# ---------- Analitika va AI jurnali ----------
@app.post("/api/v1/events")
async def events(request: Request):
    limit(request, 240)
    b = await request.json()
    rows = []
    for e in (b.get("events") or [])[:200]:
        rows.append((float(e.get("ts") or time.time() * 1000) / 1000, str(e.get("visitor"))[:40], str(e.get("user") or "")[:40],
                     str(e.get("role") or "guest")[:20], str(e.get("platform") or "web")[:10], str(e.get("type"))[:30],
                     str(e.get("page") or "")[:60], json.dumps(e.get("meta") or {})[:2000]))
    with db() as c:
        c.executemany("INSERT INTO events VALUES(?,?,?,?,?,?,?,?)", rows)
        for e in (b.get("aiLogs") or [])[:100]:
            c.execute("INSERT INTO ai_logs VALUES(?,?,?,?,?)", (float(e.get("ts") or time.time() * 1000) / 1000, str(e.get("kind"))[:20],
                      str(e.get("resortId") or ""), str(e.get("user") or ""), json.dumps(e)[:4000]))
    return {"ok": True, "n": len(rows)}


@app.get("/api/v1/analytics")
def analytics(u=Depends(need_user)):
    if u["role"] not in STAFF:
        raise HTTPException(403, "Faqat analitik va admin uchun")
    with db() as c:
        ev = [dict(r) for r in c.execute("SELECT * FROM events WHERE ts>? ORDER BY ts DESC LIMIT 50000", (time.time() - 90 * 86400,))]
        logs = [json.loads(r["detail"]) for r in c.execute("SELECT detail FROM ai_logs ORDER BY ts DESC LIMIT 2000")]
        users = [dict(r) for r in c.execute("SELECT id,name,email,role,created,blocked FROM users ORDER BY created DESC")]
    for e in ev:
        e["ts"] = e["ts"] * 1000
        e["meta"] = json.loads(e["meta"] or "{}")
    return {"events": ev, "aiLogs": logs, "users": users}


@app.put("/api/v1/users/{user_id}")
async def update_user(user_id: str, request: Request, u=Depends(need_user)):
    """Admin: foydalanuvchini bloklash yoki rolini o'zgartirish."""
    if u["role"] != "admin":
        raise HTTPException(403, "Faqat admin uchun")
    if user_id == u["id"]:
        raise HTTPException(400, "O'z hisobingizni o'zgartira olmaysiz")
    b = await request.json()
    with db() as c:
        if "blocked" in b:
            c.execute("UPDATE users SET blocked=? WHERE id=?", (1 if b["blocked"] else 0, user_id))
        if b.get("role") in ROLES:
            c.execute("UPDATE users SET role=? WHERE id=?", (b["role"], user_id))
    return {"ok": True}


@app.get("/api/v1/version")
def version():
    """Ilovaning so'nggi versiyasi — qo'ng'iroqcha (🔔) shu orqali yangilanishni ko'rsatadi."""
    try:
        return json.loads((ROOT / "web" / "version.json").read_text(encoding="utf-8"))  # sayt bilan bitta manba
    except (OSError, ValueError):
        return {"version": "0", "notes": []}


@app.get("/api/v1/health")
def health():
    return {"ok": True}


# Sayt fayllari (web/) — API bilan bitta domenda
(ROOT / "download").mkdir(exist_ok=True)
app.mount("/download", StaticFiles(directory=ROOT / "download"), name="download")  # yangi APK shu yerga qo'yiladi
app.mount("/", StaticFiles(directory=ROOT / "web", html=True), name="web")
