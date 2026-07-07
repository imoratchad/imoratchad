"""
IMORA Tchad - Backend FastAPI
Plateforme immobilière du Tchad
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, Header, Query
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import csv
import io
from openpyxl import Workbook
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(_app):
    # Startup
    # Background cleanup: archive notifications older than 90 days
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    try:
        result = await db.notifications.delete_many({"created_at": {"$lt": cutoff}})
        if result.deleted_count:
            logging.info(f"Archived {result.deleted_count} old notifications")
    except Exception:
        logging.exception("Notification cleanup failed")
    yield
    # Shutdown
    client.close()


app = FastAPI(title="IMORA Tchad API", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
ADMIN_EMAILS = {"imoratchad@gmail.com"}

# ============================================================
# Models
# ============================================================
UserRole = Literal["particulier", "agence", "promoteur", "admin"]
PropertyStatus = Literal["pending", "active", "sold", "rented", "rejected"]
TransactionType = Literal["vente", "achat", "location_journaliere", "location_hebdomadaire", "location_mensuelle", "location_annuelle"]
LocationVisibility = Literal["exact", "neighborhood", "approximate"]


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    role: UserRole = "particulier"
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    agency_name: Optional[str] = ""
    bio: Optional[str] = ""
    verified_agency: bool = False
    suspended: bool = False
    last_login: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RoleUpdate(BaseModel):
    # Self-service role selection: users may only claim non-privileged roles.
    # Admin role is granted exclusively via the ADMIN_EMAILS allowlist on Google login
    # or by an existing admin via /api/admin/users/{user_id}. Never trust client input for admin.
    role: Literal["particulier", "agence", "promoteur", "demarcheur"]
    name: Optional[str] = None
    picture: Optional[str] = None
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    agency_name: Optional[str] = ""
    bio: Optional[str] = ""


class Property(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    description: str
    property_type: str  # terrain_residentiel, terrain_commercial, terrain_agricole, terrain_industriel, chambre, studio, appartement, maison, villa, duplex, immeuble, bureau, boutique, magasin, entrepot
    transaction_type: TransactionType
    price: float
    negotiable: bool = False
    currency: str = "XAF"
    city: str
    neighborhood: str
    arrondissement: Optional[str] = ""
    address: Optional[str] = ""
    rooms: int = 0
    bathrooms: int = 0
    living_rooms: int = 0
    land_area: float = 0
    living_area: float = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_visibility: LocationVisibility = "neighborhood"
    photos: List[str] = []  # base64 or URLs
    videos: List[str] = []
    virtual_tour_url: Optional[str] = ""  # YouTube/Vimeo/external embed
    documents: List[dict] = []  # {type, name, data}
    contact_name: str
    contact_phone: str
    contact_whatsapp: Optional[str] = ""
    contact_email: Optional[str] = ""
    status: PropertyStatus = "active"
    sold_at: Optional[str] = None
    rented_at: Optional[str] = None
    rejection_reason: Optional[str] = ""
    testimonial: Optional[str] = ""  # Client testimonial after transaction
    testimonial_author: Optional[str] = ""
    tags: List[str] = []  # admin tags: "Premium", "Coup de cœur", "Vendu en 1 semaine", etc.
    verified: bool = False
    featured: bool = False
    views: int = 0
    contact_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PropertyCreate(BaseModel):
    title: str
    description: str
    property_type: str
    transaction_type: TransactionType
    price: float
    negotiable: bool = False
    city: str
    neighborhood: str
    arrondissement: Optional[str] = ""
    address: Optional[str] = ""
    rooms: int = 0
    bathrooms: int = 0
    living_rooms: int = 0
    land_area: float = 0
    living_area: float = 0
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_visibility: LocationVisibility = "neighborhood"
    photos: List[str] = []
    videos: List[str] = []
    virtual_tour_url: Optional[str] = ""
    documents: List[dict] = []
    contact_name: str
    contact_phone: str
    contact_whatsapp: Optional[str] = ""
    contact_email: Optional[str] = ""


class Favorite(BaseModel):
    user_id: str
    property_id: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_user_id: str
    to_user_id: str
    property_id: Optional[str] = None
    content: str
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MessageCreate(BaseModel):
    to_user_id: str
    property_id: Optional[str] = None
    content: str


class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # premium, verification, agency_subscription, boost
    property_id: Optional[str] = None
    amount: float
    method: str  # airtel, moov
    transaction_id: str
    payer_phone: Optional[str] = ""
    status: str = "pending"  # pending, confirmed, rejected
    note: Optional[str] = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaymentCreate(BaseModel):
    type: str
    property_id: Optional[str] = None
    amount: float
    method: str
    transaction_id: str
    payer_phone: Optional[str] = ""
    note: Optional[str] = ""


class Feedback(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    rating: int = 5
    type: str  # suggestion, issue, feature, report
    message: str
    property_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class FeedbackCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    phone: Optional[str] = ""
    rating: int = 5
    type: str = "suggestion"
    message: str
    property_id: Optional[str] = None


class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # property_verified, property_featured, property_status, payment_confirmed, payment_rejected
    title: str
    message: str
    property_id: Optional[str] = None
    payment_id: Optional[str] = None
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def build_whatsapp_url(phone: str, message: str) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in phone if ch.isdigit())
    from urllib.parse import quote
    return f"https://wa.me/{digits}?text={quote(message)}"


import asyncio
import resend as resend_sdk

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev").strip() or "onboarding@resend.dev"
if RESEND_API_KEY:
    resend_sdk.api_key = RESEND_API_KEY


def _email_template(title: str, message: str, cta_url: Optional[str] = None, cta_label: Optional[str] = None) -> str:
    """Simple inline-CSS HTML email template with IMORA branding.
    All caller-supplied strings are HTML-escaped to prevent HTML/tag injection
    from user-controlled property titles or rejection reasons."""
    import html as _html_mod
    safe_title = _html_mod.escape(title or "")
    safe_message = _html_mod.escape(message or "").replace("\n", "<br>")
    cta_html = ""
    if cta_url and cta_label:
        # cta_url is server-built from FRONTEND_PUBLIC_URL + trusted id; still escape defensively.
        safe_cta_url = _html_mod.escape(cta_url, quote=True)
        safe_cta_label = _html_mod.escape(cta_label)
        cta_html = (
            f'<tr><td style="padding:16px 0 8px 0;">'
            f'<a href="{safe_cta_url}" style="display:inline-block;background:#FF6B1A;color:#ffffff;'
            f'text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;'
            f'font-family:Arial,sans-serif;font-size:14px;">{safe_cta_label}</a>'
            f'</td></tr>'
        )
    return f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Arial,Helvetica,sans-serif;color:#0A0A0A;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F5F5F5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="background:linear-gradient(135deg,#FF6B1A,#00B4FF);padding:24px;text-align:center;">
          <div style="font-family:Arial,sans-serif;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">IMORA <span style="opacity:0.85;font-weight:600;">TCHAD</span></div>
          <div style="color:rgba(255,255,255,0.9);font-size:12px;margin-top:4px;">La plateforme immobilière du Tchad</div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px 28px;">
          <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:800;color:#0A0A0A;">{safe_title}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#333333;">{safe_message}</p>
        </td></tr>
        <tr><td style="padding:0 28px 24px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">{cta_html}</table>
        </td></tr>
        <tr><td style="border-top:1px solid #EEEEEE;padding:16px 28px;text-align:center;font-size:12px;color:#888888;">
          Cet e-mail vous est envoyé automatiquement par IMORA Tchad.<br>
          Contact : <a href="mailto:imoratchad@gmail.com" style="color:#FF6B1A;text-decoration:none;">imoratchad@gmail.com</a> · WhatsApp +235 64 92 73 80
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_email(recipient: str, subject: str, html: str) -> bool:
    """Fire-and-forget email send. Returns True on success, False on any failure."""
    if not RESEND_API_KEY:
        logging.info(f"[email] RESEND_API_KEY not configured — skipping email to {recipient}")
        return False
    if not recipient or "@" not in recipient:
        return False
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [recipient],
            "subject": subject,
            "html": html,
        }
        await asyncio.to_thread(resend_sdk.Emails.send, params)
        logging.info(f"[email] sent to {recipient} — {subject}")
        return True
    except Exception:
        logging.exception(f"[email] failed to send to {recipient}")
        return False


async def notify_user(user_id: str, ntype: str, title: str, message: str, property_id: str = None, payment_id: str = None) -> dict:
    notif = Notification(user_id=user_id, type=ntype, title=title, message=message, property_id=property_id, payment_id=payment_id)
    await db.notifications.insert_one(notif.model_dump())
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    phone = (user or {}).get("whatsapp") or (user or {}).get("phone") or ""
    email = (user or {}).get("email") or ""

    # Fire-and-forget email (non-blocking) for property lifecycle events
    if email and ntype in ("property_verified", "property_approved", "property_rejected", "property_status"):
        cta_url = None
        cta_label = None
        if property_id:
            frontend_url = os.environ.get("FRONTEND_PUBLIC_URL", "").strip()
            if frontend_url:
                cta_url = f"{frontend_url.rstrip('/')}/property/{property_id}"
                cta_label = "Voir mon annonce"
        html = _email_template(title, message, cta_url, cta_label)
        asyncio.create_task(send_email(email, f"IMORA Tchad — {title}", html))

    return {"notification": notif.model_dump(), "whatsapp_url": build_whatsapp_url(phone, f"{title}\n\n{message}\n\n— IMORA Tchad")}


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None


# ============================================================
# Auth helpers
# ============================================================
async def get_session_token(request: Request, authorization: Optional[str] = Header(None)) -> Optional[str]:
    token = request.cookies.get("session_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    return token


async def get_current_user(request: Request, authorization: Optional[str] = Header(None)) -> Optional[dict]:
    token = await get_session_token(request, authorization)
    if not token:
        return None
    # SEC hardening: block hard-coded test session tokens in production to defeat
    # attackers who might guess the well-known test token names. Enable by setting
    # DISABLE_TEST_SESSIONS=1 in the prod backend .env.
    if os.environ.get("DISABLE_TEST_SESSIONS", "").lower() in ("1", "true", "yes") and token.startswith("test_session_"):
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user


async def require_user(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(request, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user.get("suspended"):
        raise HTTPException(status_code=403, detail="Account suspended")
    return user


async def require_admin(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    user = await require_user(request, authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ============================================================
# Auth routes
# ============================================================
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleCallbackPayload(BaseModel):
    code: str
    redirect_uri: str


async def _upsert_google_user(email: str, name: str, picture: str) -> tuple[str, str]:
    """Create or update a user from Google profile, return (user_id, session_token)."""
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email in ADMIN_EMAILS else "particulier"
        user_obj = User(user_id=user_id, email=email, name=name, picture=picture, role=role)
        await db.users.insert_one(user_obj.model_dump())

    session_token = f"imora_{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return user_id, session_token


@api_router.post("/auth/google")
async def google_oauth_callback(payload: GoogleCallbackPayload, response: Response):
    """Direct Google OAuth 2.0 callback — replaces Emergent-managed auth.
    The frontend receives ?code= at /auth/google, then POSTs { code, redirect_uri } here.
    Backend exchanges the code for tokens, fetches the user profile, upserts the user,
    creates an IMORA session and returns it. No Emergent branding anywhere in the flow.

    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth non configuré côté serveur")

    async with httpx.AsyncClient(timeout=15) as http:
        # 1. Exchange authorization code for access token
        token_resp = await http.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": payload.code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": payload.redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            logging.warning(f"[google-oauth] token exchange failed: {token_resp.status_code} {token_resp.text[:200]}")
            try:
                g_err = token_resp.json().get("error", "")
            except Exception:
                g_err = ""
            messages = {
                "invalid_client": "Secret client Google invalide (GOOGLE_CLIENT_SECRET incorrect — vérifiez qu'il correspond au nouveau client OAuth).",
                "deleted_client": "Le client OAuth Google a été supprimé (GOOGLE_CLIENT_ID obsolète).",
                "redirect_uri_mismatch": "URI de redirection non autorisée dans Google Cloud Console.",
                "invalid_grant": "Code Google expiré ou déjà utilisé. Réessayez de vous connecter.",
            }
            detail = messages.get(g_err, f"Échange du code Google échoué ({g_err or token_resp.status_code})")
            raise HTTPException(status_code=401, detail=detail)
        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Token d'accès manquant")

        # 2. Fetch user profile
        userinfo_resp = await http.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Impossible de récupérer le profil Google")
        info = userinfo_resp.json()

    email = info.get("email")
    if not email or not info.get("email_verified", False):
        raise HTTPException(status_code=401, detail="E-mail Google non vérifié")
    name = info.get("name") or email
    picture = info.get("picture", "")

    user_id, session_token = await _upsert_google_user(email, name, picture)
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 3600,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}


@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    """LEGACY: Emergent-managed Google Auth. Kept for backward compatibility with the
    old mobile builds. Now gated by ENABLE_LEGACY_EMERGENT_AUTH=1 — return 410 by default
    so this parallel auth path can't be silently exploited (SEC-003)."""
    if os.environ.get("ENABLE_LEGACY_EMERGENT_AUTH", "").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=410, detail="Endpoint retiré. Utilisez /api/auth/google.")
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()

    email = data["email"]
    name = data.get("name", email)
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email in ADMIN_EMAILS else "particulier"
        user_obj = User(user_id=user_id, email=email, name=name, picture=picture, role=role)
        await db.users.insert_one(user_obj.model_dump())

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 3600,
        path="/",
        httponly=True,
        secure=True,
        samesite="none"
    )

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}


@api_router.get("/auth/me")
async def auth_me(request: Request, authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response, authorization: Optional[str] = Header(None)):
    token = await get_session_token(request, authorization)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.put("/auth/profile")
async def update_profile(payload: RoleUpdate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    update = {}
    # Never allow self-promotion to admin. Also never allow an existing admin to demote
    # themselves via this endpoint — role changes for admins go through /api/admin/users/{id}.
    if user.get("role") != "admin":
        update["role"] = payload.role
    if payload.name is not None:
        name = payload.name.strip()[:80]
        if not name:
            raise HTTPException(status_code=400, detail="Le nom ne peut pas être vide")
        update["name"] = name
    if payload.picture is not None:
        pic = payload.picture.strip()
        # Cap avatar size at ~1 MB base64 (~730 KB raw) to avoid DoS
        if len(pic) > 1024 * 1024:
            raise HTTPException(status_code=413, detail="Photo de profil trop lourde (max 1 MB)")
        update["picture"] = pic
    if payload.phone is not None:
        update["phone"] = payload.phone.strip()[:40]
    if payload.whatsapp is not None:
        update["whatsapp"] = payload.whatsapp.strip()[:40]
    if payload.agency_name is not None:
        update["agency_name"] = payload.agency_name.strip()[:120]
    if payload.bio is not None:
        update["bio"] = payload.bio.strip()[:500]
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated


# ============================================================
# Properties
# ============================================================
@api_router.get("/properties")
async def list_properties(
    city: Optional[str] = None,
    neighborhood: Optional[str] = None,
    arrondissement: Optional[str] = None,
    property_type: Optional[str] = None,
    transaction_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_area: Optional[float] = None,
    verified: Optional[bool] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    query = {}
    if status:
        query["status"] = status
    elif not user_id:
        # Public listing: default to active only. When fetching a specific user's listings, show all statuses.
        query["status"] = "active"
    if city: query["city"] = city
    if neighborhood: query["neighborhood"] = neighborhood
    if arrondissement: query["arrondissement"] = arrondissement
    if property_type: query["property_type"] = property_type
    if transaction_type: query["transaction_type"] = transaction_type
    if user_id: query["user_id"] = user_id
    if verified is not None: query["verified"] = verified
    price_q = {}
    if min_price is not None: price_q["$gte"] = min_price
    if max_price is not None: price_q["$lte"] = max_price
    if price_q: query["price"] = price_q
    if min_area is not None:
        area_clause = [{"land_area": {"$gte": min_area}}, {"living_area": {"$gte": min_area}}]
        if "$or" in query:
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": area_clause}, query]}
        else:
            query["$or"] = area_clause
    if q:
        # Escape user input so it's treated as a literal search (defends against
        # MongoDB $regex ReDoS / catastrophic backtracking attacks).
        import re as _re
        q_escaped = _re.escape(q[:100])  # also cap length
        q_clause = [
            {"title": {"$regex": q_escaped, "$options": "i"}},
            {"description": {"$regex": q_escaped, "$options": "i"}},
            {"neighborhood": {"$regex": q_escaped, "$options": "i"}},
        ]
        if "$or" in query:
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": q_clause}, query]}
        elif "$and" in query:
            query["$and"].append({"$or": q_clause})
        else:
            query["$or"] = q_clause

    cursor = db.properties.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    # Expose total via response header so frontend can drive pagination "Afficher plus" reliably.
    try:
        total = await db.properties.count_documents(query)
    except Exception:
        total = len(items) + skip
    return JSONResponse(content=items, headers={"X-Total-Count": str(total), "Access-Control-Expose-Headers": "X-Total-Count"})


@api_router.get("/properties/featured")
async def featured_properties():
    items = await db.properties.find(
        {"status": "active", "$or": [{"featured": True}, {"verified": True}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(8).to_list(length=8)
    return items


@api_router.get("/properties/archives")
async def archived_properties(
    transaction_type: Optional[str] = None,
    neighborhood: Optional[str] = None,
    year: Optional[int] = None,
    limit: int = 60,
):
    """Return sold and rented properties — public 'success stories' archive."""
    q = {"status": {"$in": ["sold", "rented"]}}
    if transaction_type:
        q["transaction_type"] = transaction_type
    if neighborhood:
        q["neighborhood"] = neighborhood
    if year:
        q["$or"] = [
            {"sold_at": {"$gte": f"{year}-01-01", "$lt": f"{year+1}-01-01"}},
            {"rented_at": {"$gte": f"{year}-01-01", "$lt": f"{year+1}-01-01"}},
        ]
    items = await db.properties.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    return items


@api_router.get("/properties/archives/stats")
async def archives_stats():
    """Public archive stats — used for trust building on the home page."""
    archives = await db.properties.find(
        {"status": {"$in": ["sold", "rented"]}},
        {"_id": 0, "status": 1, "sold_at": 1, "rented_at": 1, "created_at": 1, "neighborhood": 1}
    ).to_list(length=2000)
    sold = [p for p in archives if p["status"] == "sold"]
    rented = [p for p in archives if p["status"] == "rented"]
    current_year = datetime.now(timezone.utc).year
    this_year = 0
    by_year = {}
    by_neighborhood = {}
    by_month = {}
    for p in archives:
        ts = p.get("sold_at") or p.get("rented_at") or p.get("created_at")
        try:
            y = int(ts[:4])
            ym = ts[:7]
        except Exception:
            continue
        by_year[y] = by_year.get(y, 0) + 1
        by_month[ym] = by_month.get(ym, 0) + 1
        if y == current_year:
            this_year += 1
        n = p.get("neighborhood") or "Autre"
        by_neighborhood[n] = by_neighborhood.get(n, 0) + 1
    return {
        "total": len(archives),
        "sold": len(sold),
        "rented": len(rented),
        "this_year": this_year,
        "current_year": current_year,
        "by_year": [{"year": k, "count": v} for k, v in sorted(by_year.items())],
        "by_month": [{"month": k, "count": v} for k, v in sorted(by_month.items())[-12:]],
        "top_neighborhoods": sorted(
            [{"name": k, "count": v} for k, v in by_neighborhood.items()],
            key=lambda x: -x["count"]
        )[:6],
    }


# Media size caps applied on both create AND update to prevent DoS via large base64 blobs
# (SEC-002). Each dataURL string is ~1.37× the raw bytes, so the max base64 length caps
# reflect the effective raw size targets we want to allow.
_MAX_PHOTOS = 10
_MAX_PHOTO_BYTES = 5 * 1024 * 1024        # 5 MB raw ≈ 6.85 MB base64
_MAX_VIDEOS = 2
_MAX_VIDEO_BYTES = 25 * 1024 * 1024       # 25 MB raw ≈ 34 MB base64
_MAX_DOCUMENTS = 5
_MAX_DOCUMENT_BYTES = 8 * 1024 * 1024     # 8 MB raw


def _validate_property_media(payload: "PropertyCreate") -> None:
    """Enforce per-field count/size caps on photos/videos/documents. Raises HTTPException(413)."""
    if len(payload.photos) > _MAX_PHOTOS:
        raise HTTPException(status_code=413, detail=f"Maximum {_MAX_PHOTOS} photos par annonce")
    for ph in payload.photos:
        if len(ph) > _MAX_PHOTO_BYTES * 1.4:
            raise HTTPException(status_code=413, detail=f"Chaque photo doit faire moins de {_MAX_PHOTO_BYTES // (1024 * 1024)} MB")
    if len(payload.videos or []) > _MAX_VIDEOS:
        raise HTTPException(status_code=413, detail=f"Maximum {_MAX_VIDEOS} vidéos par annonce")
    for vid in (payload.videos or []):
        if len(vid) > _MAX_VIDEO_BYTES * 1.4:
            raise HTTPException(status_code=413, detail=f"Chaque vidéo doit faire moins de {_MAX_VIDEO_BYTES // (1024 * 1024)} MB")
    if len(payload.documents or []) > _MAX_DOCUMENTS:
        raise HTTPException(status_code=413, detail=f"Maximum {_MAX_DOCUMENTS} documents par annonce")
    for doc in (payload.documents or []):
        # documents are {type, name, data} dicts — measure the base64 payload, not the dict itself
        data_str = (doc or {}).get("data", "") if isinstance(doc, dict) else ""
        if len(data_str) > _MAX_DOCUMENT_BYTES * 1.4:
            raise HTTPException(status_code=413, detail=f"Chaque document doit faire moins de {_MAX_DOCUMENT_BYTES // (1024 * 1024)} MB")


@api_router.post("/properties")
async def create_property(payload: PropertyCreate, request: Request, authorization: Optional[str] = Header(None)):
    import hashlib
    user = await require_user(request, authorization)
    _validate_property_media(payload)
    # Duplicate photo detection (SHA256)
    photo_hashes = []
    for ph in payload.photos:
        h = hashlib.sha256(ph.encode("utf-8")).hexdigest()
        photo_hashes.append(h)
        existing = await db.photo_hashes.find_one({"hash": h, "user_id": {"$ne": user["user_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Une photo identique existe déjà sur la plateforme")
    prop = Property(user_id=user["user_id"], **payload.model_dump())
    # MODERATION: Agencies, démarcheurs and promoteurs publish directly (trusted pros).
    # Only particuliers (owners) go through admin moderation to filter spam/fakes.
    if user.get("role") in ("admin", "agence", "promoteur", "demarcheur"):
        prop.status = "active"
    else:
        prop.status = "pending"
    await db.properties.insert_one(prop.model_dump())
    # Store hashes for future dedup
    for h in photo_hashes:
        await db.photo_hashes.update_one(
            {"hash": h},
            {"$set": {"hash": h, "user_id": user["user_id"], "property_id": prop.id, "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    # Notify admins that a new ad needs moderation
    if prop.status == "pending":
        admins = await db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}).to_list(length=20)
        for adm in admins:
            await notify_user(
                adm["user_id"], "moderation_pending",
                f"Nouvelle annonce à modérer",
                f"\"{prop.title}\" ({prop.neighborhood}, {int(prop.price):,} XAF) — soumise par {user.get('name', user['email'])}",
                property_id=prop.id,
            )
    return prop.model_dump()


@api_router.get("/properties/{prop_id}")
async def get_property(prop_id: str):
    p = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    await db.properties.update_one({"id": prop_id}, {"$inc": {"views": 1}})
    p["views"] = p.get("views", 0) + 1
    owner = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0, "email": 0})
    p["owner"] = owner
    return p


@api_router.put("/properties/{prop_id}")
async def update_property(prop_id: str, payload: PropertyCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    _validate_property_media(payload)
    p = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if p["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.properties.update_one({"id": prop_id}, {"$set": payload.model_dump()})
    return await db.properties.find_one({"id": prop_id}, {"_id": 0})


@api_router.delete("/properties/{prop_id}")
async def delete_property(prop_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    p = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if p["user_id"] != user["user_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.properties.delete_one({"id": prop_id})
    return {"ok": True}


@api_router.post("/properties/{prop_id}/contact")
async def increment_contact(prop_id: str):
    await db.properties.update_one({"id": prop_id}, {"$inc": {"contact_count": 1}})
    return {"ok": True}


class ReportPayload(BaseModel):
    reason: str
    details: Optional[str] = ""
    reporter_name: Optional[str] = ""
    reporter_phone: Optional[str] = ""
    reporter_email: Optional[str] = ""


@api_router.post("/properties/{prop_id}/report")
async def report_property(prop_id: str, payload: ReportPayload, request: Request, authorization: Optional[str] = Header(None)):
    """User-driven scam/abuse reporting. Anonymous or authenticated.
    Rate-limited per IP/user to prevent anonymous spam that would flood admin notifications."""
    user = await get_current_user(request, authorization)
    rate_key = f"report:u:{user['user_id']}" if user else f"report:ip:{_client_ip(request)}"
    # Reuse the AI rate-limiter helper (6/min sliding window)
    if not _check_ai_rate_limit(rate_key):
        raise HTTPException(status_code=429, detail="Trop de signalements. Réessayez dans une minute.")
    prop = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Annonce introuvable")
    reason = (payload.reason or "").strip()[:60]
    if not reason:
        raise HTTPException(status_code=400, detail="Merci d'indiquer un motif")
    report = {
        "id": str(uuid.uuid4()),
        "property_id": prop_id,
        "property_title": prop.get("title", ""),
        "reporter_user_id": user.get("user_id") if user else None,
        "reporter_name": (payload.reporter_name or (user or {}).get("name", "") or "Anonyme")[:80],
        "reporter_phone": (payload.reporter_phone or (user or {}).get("phone", ""))[:40],
        "reporter_email": (payload.reporter_email or (user or {}).get("email", ""))[:120],
        "reason": reason,
        "details": (payload.details or "").strip()[:800],
        "status": "open",  # open | reviewed | dismissed | actioned
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reports.insert_one(report)
    # Notify all admins
    try:
        admins = await db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}).to_list(length=20)
        for adm in admins:
            await notify_user(
                adm["user_id"],
                "property_reported",
                f"🚨 Signalement : {prop.get('title', '')[:50]}",
                f"Motif : {reason}\n\nDétails : {report['details'] or '(aucun détail)'}",
                property_id=prop_id,
            )
    except Exception:
        logging.exception("report notify admins failed")
    return {"ok": True, "id": report["id"]}


@api_router.get("/admin/reports")
async def admin_list_reports(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    items = await db.reports.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    return items


@api_router.put("/admin/reports/{report_id}")
async def admin_update_report(report_id: str, body: dict, request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    status = (body.get("status") or "").strip()
    if status not in ("open", "reviewed", "dismissed", "actioned"):
        raise HTTPException(status_code=400, detail="Statut invalide")
    await db.reports.update_one({"id": report_id}, {"$set": {"status": status, "reviewed_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


# ============================================================
# Favorites
# ============================================================
@api_router.get("/favorites")
async def list_favorites(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    favs = await db.favorites.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(length=200)
    prop_ids = [f["property_id"] for f in favs]
    props = await db.properties.find({"id": {"$in": prop_ids}}, {"_id": 0}).to_list(length=200)
    return props


@api_router.post("/favorites/{prop_id}")
async def add_favorite(prop_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    await db.favorites.update_one(
        {"user_id": user["user_id"], "property_id": prop_id},
        {"$setOnInsert": Favorite(user_id=user["user_id"], property_id=prop_id).model_dump()},
        upsert=True
    )
    return {"ok": True}


@api_router.delete("/favorites/{prop_id}")
async def remove_favorite(prop_id: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    await db.favorites.delete_one({"user_id": user["user_id"], "property_id": prop_id})
    return {"ok": True}


# ============================================================
# Messages
# ============================================================
@api_router.get("/messages")
async def list_messages(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    msgs = await db.messages.find(
        {"$or": [{"from_user_id": user["user_id"]}, {"to_user_id": user["user_id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(length=200)
    return msgs


@api_router.post("/messages")
async def send_message(payload: MessageCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    msg = Message(from_user_id=user["user_id"], **payload.model_dump())
    await db.messages.insert_one(msg.model_dump())
    return msg.model_dump()


# ============================================================
# Payments
# ============================================================
@api_router.post("/payments")
async def create_payment(payload: PaymentCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    p = Payment(user_id=user["user_id"], **payload.model_dump())
    await db.payments.insert_one(p.model_dump())
    return p.model_dump()


@api_router.get("/payments/mine")
async def my_payments(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    items = await db.payments.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return items


# ============================================================
# Feedback
# ============================================================
@api_router.post("/feedback")
async def create_feedback(payload: FeedbackCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await get_current_user(request, authorization)
    fb = Feedback(user_id=user["user_id"] if user else None, **payload.model_dump())
    await db.feedback.insert_one(fb.model_dump())
    return fb.model_dump()


# ============================================================
# Admin
# ============================================================
@api_router.get("/admin/stats")
async def admin_stats(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    total_users = await db.users.count_documents({})
    total_agencies = await db.users.count_documents({"role": "agence"})
    total_properties = await db.properties.count_documents({})
    verified_properties = await db.properties.count_documents({"verified": True})
    pending_properties = await db.properties.count_documents({"status": "pending"})
    pending_payments = await db.payments.count_documents({"status": "pending"})
    confirmed_payments = await db.payments.aggregate([
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(length=1)
    revenue = confirmed_payments[0]["total"] if confirmed_payments else 0
    # active sessions
    now = datetime.now(timezone.utc)
    active_sessions = await db.user_sessions.count_documents({"expires_at": {"$gt": now}})
    return {
        "total_users": total_users,
        "total_agencies": total_agencies,
        "total_properties": total_properties,
        "verified_properties": verified_properties,
        "pending_properties": pending_properties,
        "pending_payments": pending_payments,
        "revenue": revenue,
        "active_sessions": active_sessions,
    }


@api_router.get("/admin/users")
async def admin_users(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    items = await db.users.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    return items


@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: dict, request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    allowed = {k: body[k] for k in ["role", "suspended", "verified_agency"] if k in body}
    await db.users.update_one({"user_id": user_id}, {"$set": allowed})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


@api_router.put("/admin/properties/{prop_id}/verify")
async def admin_verify_property(prop_id: str, body: dict, request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    prop = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Not found")
    set_fields = {"verified": bool(body.get("verified", True))}
    if "featured" in body:
        set_fields["featured"] = bool(body["featured"])
    if "status" in body:
        new_status = body["status"]
        set_fields["status"] = new_status
        now_iso = datetime.now(timezone.utc).isoformat()
        if new_status == "sold" and not prop.get("sold_at"):
            set_fields["sold_at"] = now_iso
        if new_status == "rented" and not prop.get("rented_at"):
            set_fields["rented_at"] = now_iso
    if "testimonial" in body:
        set_fields["testimonial"] = body["testimonial"]
    if "testimonial_author" in body:
        set_fields["testimonial_author"] = body["testimonial_author"]
    if "tags" in body and isinstance(body["tags"], list):
        set_fields["tags"] = [str(t)[:40] for t in body["tags"][:5]]
    rejection_reason = (body.get("rejection_reason") or "").strip()
    if rejection_reason:
        set_fields["rejection_reason"] = rejection_reason
    await db.properties.update_one({"id": prop_id}, {"$set": set_fields})

    # Build notification
    notif_payload = {"whatsapp_url": ""}
    if set_fields.get("verified") and not prop.get("verified"):
        notif_payload = await notify_user(
            prop["user_id"], "property_verified",
            f"Votre annonce a été vérifiée ✓",
            f"Félicitations ! Votre annonce \"{prop['title']}\" est maintenant marquée Vérifiée sur IMORA Tchad.",
            property_id=prop_id,
        )
    elif "status" in body:
        new_status = body["status"]
        if new_status == "rejected":
            msg = f"Votre annonce \"{prop['title']}\" n'a pas pu être validée."
            if rejection_reason:
                msg += f"\n\nRaison : {rejection_reason}\n\nVous pouvez la modifier et la soumettre à nouveau."
            else:
                msg += " Vous pouvez la modifier et la soumettre à nouveau."
            notif_payload = await notify_user(
                prop["user_id"], "property_rejected",
                "Annonce non validée",
                msg,
                property_id=prop_id,
            )
        elif new_status == "active":
            notif_payload = await notify_user(
                prop["user_id"], "property_approved",
                "✓ Votre annonce est publiée",
                f"Bonne nouvelle ! \"{prop['title']}\" est maintenant en ligne sur IMORA Tchad et visible par tous les utilisateurs.",
                property_id=prop_id,
            )
        else:
            notif_payload = await notify_user(
                prop["user_id"], "property_status",
                f"Statut mis à jour : {new_status}",
                f"Le statut de \"{prop['title']}\" est maintenant : {new_status}.",
                property_id=prop_id,
            )
    updated = await db.properties.find_one({"id": prop_id}, {"_id": 0})
    return {**updated, "whatsapp_url": notif_payload.get("whatsapp_url", "")}


@api_router.get("/admin/payments")
async def admin_payments(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    items = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    return items


@api_router.put("/admin/payments/{payment_id}")
async def admin_update_payment(payment_id: str, body: dict, request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    status = body.get("status")
    if status not in ("pending", "confirmed", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    pay = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(status_code=404, detail="Not found")
    await db.payments.update_one({"id": payment_id}, {"$set": {"status": status}})
    notif_payload = await notify_user(
        pay["user_id"],
        f"payment_{status}",
        f"Paiement {status} ✓" if status == "confirmed" else f"Paiement {status}",
        f"Votre paiement de {int(pay['amount']):,} XAF ({pay['type']}) via {pay['method']} a été {status}.",
        payment_id=payment_id,
    )
    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return {**updated, "whatsapp_url": notif_payload.get("whatsapp_url", "")}


@api_router.get("/admin/monthly-report")
async def admin_monthly_report(year: Optional[int] = None, month: Optional[int] = None, request: Request = None, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month
    start = f"{y:04d}-{m:02d}-01"
    next_month = (datetime(y, m, 1) + timedelta(days=32)).replace(day=1)
    end = next_month.strftime("%Y-%m-%d")

    # Properties added this month
    new_props = await db.properties.count_documents({"created_at": {"$gte": start, "$lt": end}})
    # Sold + rented this month
    sold = await db.properties.find(
        {"sold_at": {"$gte": start, "$lt": end}},
        {"_id": 0, "id": 1, "title": 1, "price": 1, "property_type": 1, "neighborhood": 1}
    ).to_list(length=500)
    rented = await db.properties.find(
        {"rented_at": {"$gte": start, "$lt": end}},
        {"_id": 0, "id": 1, "title": 1, "price": 1, "property_type": 1, "neighborhood": 1}
    ).to_list(length=500)
    # Verified this month (approximate via property creation)
    verified = await db.properties.count_documents({"verified": True, "created_at": {"$gte": start, "$lt": end}})
    # New users
    new_users = await db.users.count_documents({"created_at": {"$gte": start, "$lt": end}})
    new_agencies = await db.users.count_documents({"role": "agence", "created_at": {"$gte": start, "$lt": end}})
    # Payments
    pays = await db.payments.find({"status": "confirmed", "created_at": {"$gte": start, "$lt": end}}, {"_id": 0}).to_list(length=500)
    revenue = sum(p.get("amount", 0) for p in pays)
    return {
        "year": y, "month": m,
        "month_label": ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][m-1],
        "new_listings": new_props,
        "sold_count": len(sold),
        "rented_count": len(rented),
        "verified_count": verified,
        "new_users": new_users,
        "new_agencies": new_agencies,
        "revenue": revenue,
        "sold_total_value": sum(p.get("price", 0) for p in sold),
        "rented_total_value": sum(p.get("price", 0) for p in rented),
        "top_sold": sorted(sold, key=lambda p: -p.get("price", 0))[:3],
        "top_rented": sorted(rented, key=lambda p: -p.get("price", 0))[:3],
    }


@api_router.get("/admin/properties/pending")
async def admin_pending_properties(request: Request, authorization: Optional[str] = Header(None)):
    """Admin moderation queue — pending properties oldest first."""
    await require_admin(request, authorization)
    items = await db.properties.find({"status": "pending"}, {"_id": 0}).sort("created_at", 1).limit(200).to_list(length=200)
    # Batch fetch all owners in one query (avoid N+1)
    user_ids = list({it["user_id"] for it in items})
    if user_ids:
        owners = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1, "role": 1}
        ).to_list(length=len(user_ids))
        owner_map = {o["user_id"]: o for o in owners}
        for it in items:
            it["owner"] = owner_map.get(it["user_id"], {})
    return items


@api_router.get("/admin/feedback")
async def admin_feedback(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    items = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    return items


# ============================================================
# Admin — Export (CSV / Excel)
# ============================================================
ROLE_LABELS_FR = {
    "particulier": "Propriétaire (particulier)",
    "agence": "Agence immobilière",
    "promoteur": "Promoteur immobilier",
    "demarcheur": "Démarcheur",
    "admin": "Administrateur",
}

PROPERTY_COLUMNS = [
    ("id", "ID"),
    ("title", "Titre"),
    ("property_type", "Type de bien"),
    ("transaction_type", "Transaction"),
    ("price", "Prix (FCFA)"),
    ("currency", "Devise"),
    ("negotiable", "Négociable"),
    ("city", "Ville"),
    ("neighborhood", "Quartier"),
    ("address", "Adresse"),
    ("rooms", "Chambres"),
    ("bathrooms", "Salles de bain"),
    ("surface", "Surface (m²)"),
    ("status", "Statut"),
    ("verified", "Vérifié"),
    ("featured", "Mis en avant"),
    ("views", "Vues"),
    ("contact_name", "Nom contact"),
    ("contact_phone", "Téléphone contact"),
    ("owner_name", "Propriétaire"),
    ("owner_email", "Email propriétaire"),
    ("owner_role", "Rôle propriétaire"),
    ("photos_count", "Nombre de photos"),
    ("rejection_reason", "Motif de rejet"),
    ("created_at", "Créée le"),
]

USER_COLUMNS = [
    ("user_id", "ID"),
    ("name", "Nom"),
    ("email", "Email"),
    ("phone", "Téléphone"),
    ("whatsapp", "WhatsApp"),
    ("role", "Rôle"),
    ("agency_name", "Agence"),
    ("verified_agency", "Agence vérifiée"),
    ("suspended", "Suspendu"),
    ("properties_count", "Nb annonces"),
    ("created_at", "Inscrit le"),
    ("last_login", "Dernière connexion"),
]


def _neutralize_formula(s: str) -> str:
    """Prefix a leading '=' / '+' / '-' / '@' / TAB / CR with an apostrophe so that
    spreadsheet software (Excel, Sheets, LibreOffice) treats the cell as literal text
    instead of evaluating a formula. Mitigates CSV Formula Injection (CWE-1236)."""
    if not s:
        return s
    if s[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + s
    return s


def _to_cell(val):
    """Coerce values to a cell-friendly primitive with formula-injection protection."""
    if val is None:
        return ""
    if isinstance(val, bool):
        return "Oui" if val else "Non"
    if isinstance(val, (list, tuple)):
        return _neutralize_formula(", ".join(str(v) for v in val))
    if isinstance(val, dict):
        return _neutralize_formula(str(val))
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, str):
        return _neutralize_formula(val)
    return val


def _build_csv(headers, rows) -> bytes:
    buf = io.StringIO()
    # BOM so Excel opens UTF-8 correctly (accents preserved)
    buf.write("\ufeff")
    writer = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    for r in rows:
        writer.writerow([_to_cell(v) for v in r])
    return buf.getvalue().encode("utf-8")


def _build_xlsx(sheet_name, headers, rows) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]  # Excel limit
    ws.append(headers)
    # Bold header
    for cell in ws[1]:
        cell.font = cell.font.copy(bold=True)
    for r in rows:
        ws.append([_to_cell(v) for v in r])
    # Auto-fit column width (approximate)
    for col_idx, header in enumerate(headers, start=1):
        max_len = len(str(header))
        letter = ws.cell(row=1, column=col_idx).column_letter
        for row in ws.iter_rows(min_col=col_idx, max_col=col_idx, min_row=2, values_only=True):
            v = row[0]
            if v is not None:
                length = len(str(v))
                if length > max_len:
                    max_len = length
        ws.column_dimensions[letter].width = min(max_len + 2, 60)
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.getvalue()


def _stream_file(content: bytes, filename: str, mime: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(content),
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(content)),
        },
    )


@api_router.get("/admin/export/properties")
async def export_properties(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    request: Request = None,
    authorization: Optional[str] = Header(None),
):
    """Export all properties in CSV or Excel format."""
    await require_admin(request, authorization)
    props = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=10000)

    # Batch fetch owners for enrichment
    user_ids = list({p.get("user_id") for p in props if p.get("user_id")})
    owner_map = {}
    if user_ids:
        owners = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1},
        ).to_list(length=len(user_ids))
        owner_map = {o["user_id"]: o for o in owners}

    headers_fr = [label for _, label in PROPERTY_COLUMNS]
    rows = []
    for p in props:
        owner = owner_map.get(p.get("user_id"), {})
        row_dict = {
            **p,
            "owner_name": owner.get("name", ""),
            "owner_email": owner.get("email", ""),
            "owner_role": ROLE_LABELS_FR.get(owner.get("role", ""), owner.get("role", "")),
            "photos_count": len(p.get("photos") or []),
        }
        rows.append([row_dict.get(key, "") for key, _ in PROPERTY_COLUMNS])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    if format == "xlsx":
        content = _build_xlsx("Annonces IMORA", headers_fr, rows)
        return _stream_file(
            content,
            f"imora_annonces_{ts}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    content = _build_csv(headers_fr, rows)
    return _stream_file(content, f"imora_annonces_{ts}.csv", "text/csv; charset=utf-8")


@api_router.get("/admin/export/users")
async def export_users(
    format: str = Query("csv", pattern="^(csv|xlsx)$"),
    request: Request = None,
    authorization: Optional[str] = Header(None),
):
    """Export all users in CSV or Excel format."""
    await require_admin(request, authorization)
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=10000)

    # Count properties per user
    pipeline = [{"$group": {"_id": "$user_id", "count": {"$sum": 1}}}]
    counts = await db.properties.aggregate(pipeline).to_list(length=10000)
    count_map = {c["_id"]: c["count"] for c in counts}

    headers_fr = [label for _, label in USER_COLUMNS]
    rows = []
    for u in users:
        row_dict = {
            **u,
            "role": ROLE_LABELS_FR.get(u.get("role", "particulier"), u.get("role", "")),
            "properties_count": count_map.get(u.get("user_id"), 0),
        }
        rows.append([row_dict.get(key, "") for key, _ in USER_COLUMNS])

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
    if format == "xlsx":
        content = _build_xlsx("Utilisateurs IMORA", headers_fr, rows)
        return _stream_file(
            content,
            f"imora_utilisateurs_{ts}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    content = _build_csv(headers_fr, rows)
    return _stream_file(content, f"imora_utilisateurs_{ts}.csv", "text/csv; charset=utf-8")


# ============================================================
# Notifications (user inbox)
# ============================================================
@api_router.get("/notifications/mine")
async def my_notifications(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    items = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(length=50)
    return items


@api_router.post("/notifications/{nid}/read")
async def mark_notification_read(nid: str, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    await db.notifications.update_one({"id": nid, "user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ============================================================
# Agency analytics
# ============================================================
@api_router.get("/agency/analytics")
async def agency_analytics(request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    props = await db.properties.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "id": 1, "title": 1, "status": 1, "views": 1, "contact_count": 1, "verified": 1, "property_type": 1, "created_at": 1}
    ).to_list(length=500)
    total = len(props)
    sold = sum(1 for p in props if p.get("status") == "sold")
    rented = sum(1 for p in props if p.get("status") == "rented")
    active = sum(1 for p in props if p.get("status") == "active")
    pending = sum(1 for p in props if p.get("status") == "pending")
    total_views = sum(p.get("views", 0) for p in props)
    total_contacts = sum(p.get("contact_count", 0) for p in props)
    verified = sum(1 for p in props if p.get("verified"))

    # Top listings
    by_views = sorted(props, key=lambda p: -p.get("views", 0))[:5]
    by_contacts = sorted(props, key=lambda p: -p.get("contact_count", 0))[:5]

    # Per-type breakdown
    by_type = {}
    for p in props:
        by_type[p["property_type"]] = by_type.get(p["property_type"], 0) + 1

    # Per-month listings (last 6 months)
    from collections import OrderedDict
    months = OrderedDict()
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        d = now.replace(day=1)
        for _ in range(i):
            d = (d - timedelta(days=1)).replace(day=1)
        months[d.strftime("%Y-%m")] = 0
    for p in props:
        try:
            d = datetime.fromisoformat(p["created_at"]).strftime("%Y-%m")
            if d in months:
                months[d] += 1
        except Exception:
            pass

    return {
        "total": total, "active": active, "pending": pending, "sold": sold, "rented": rented,
        "verified": verified, "total_views": total_views, "total_contacts": total_contacts,
        "by_type": [{"name": k, "value": v} for k, v in by_type.items()],
        "by_month": [{"month": k, "count": v} for k, v in months.items()],
        "top_views": [{"title": p["title"], "views": p.get("views", 0), "id": p["id"]} for p in by_views],
        "top_contacts": [{"title": p["title"], "contacts": p.get("contact_count", 0), "id": p["id"]} for p in by_contacts],
    }


# ============================================================
# AI Assistant (IMORA Agent) — Claude Sonnet via Emergent Universal Key
# ============================================================
# Simple in-memory sliding-window rate limiter (per IP/user) to prevent LLM cost abuse.
# For multi-worker prod, replace with Redis. Sufficient here since backend runs as a single
# uvicorn process behind Kubernetes ingress.
from collections import defaultdict, deque

_AI_RATE_HISTORY: dict = defaultdict(deque)
_AI_RATE_LIMIT_PER_MIN = 6
_AI_RATE_WINDOW_SEC = 60
_AI_MAX_MESSAGE_CHARS = 1500


def _client_ip(request: Request) -> str:
    """Return the real client IP, honouring X-Forwarded-For behind Cloudflare/K8s ingress.
    We take the FIRST entry (the original client) — subsequent entries are proxy hops.
    Falls back to request.client.host for direct connections."""
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        # First IP is the original client; strip whitespace and drop empty parts.
        first = xff.split(",")[0].strip()
        if first:
            return first
    cf = request.headers.get("cf-connecting-ip") or request.headers.get("CF-Connecting-IP")
    if cf:
        return cf.strip()
    return request.client.host if request.client else "unknown"


def _check_ai_rate_limit(key: str) -> bool:
    """Return True if the caller is within the rate limit, False if throttled."""
    now = datetime.now(timezone.utc).timestamp()
    q = _AI_RATE_HISTORY[key]
    # Prune old entries
    while q and (now - q[0]) > _AI_RATE_WINDOW_SEC:
        q.popleft()
    if len(q) >= _AI_RATE_LIMIT_PER_MIN:
        return False
    q.append(now)
    return True


@api_router.post("/ai/chat")
async def ai_chat(payload: ChatMessage, request: Request, authorization: Optional[str] = Header(None)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    user = await get_current_user(request, authorization)

    # Size cap — reject oversized prompts before hitting the LLM
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message vide")
    if len(payload.message) > _AI_MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=413, detail=f"Message trop long (max {_AI_MAX_MESSAGE_CHARS} caractères)")

    # Rate limit: authenticated users keyed by user_id, anonymous by client IP.
    rate_key = f"u:{user['user_id']}" if user else f"ip:{_client_ip(request)}"
    if not _check_ai_rate_limit(rate_key):
        raise HTTPException(status_code=429, detail="Trop de messages. Réessayez dans une minute.")

    session_id = payload.session_id or f"sess_{uuid.uuid4().hex[:10]}"

    # Build context: top 8 active properties summary for the model
    recent = await db.properties.find({"status": "active"}, {"_id": 0}).sort("created_at", -1).limit(15).to_list(length=15)
    context_lines = []
    for p in recent:
        context_lines.append(
            f"- [{p['id']}] {p['title']} | {p['property_type']} | {p['transaction_type']} | "
            f"{int(p['price']):,} XAF | {p['neighborhood']}, {p['city']} | "
            f"superficie: {p.get('land_area') or p.get('living_area', 0)} m² | "
            f"verifié: {'oui' if p.get('verified') else 'non'}"
        )
    context = "\n".join(context_lines) if context_lines else "Aucune annonce active pour le moment."

    system_msg = (
        "Tu es IMORA Assistant, un assistant immobilier intelligent pour IMORA Tchad, "
        "la plateforme immobilière de référence au Tchad. "
        "Tu aides les utilisateurs à : rechercher des biens (terrains, maisons, villas, "
        "appartements, locaux commerciaux), conseiller pour l'achat, la vente ou la location, "
        "expliquer les démarches administratives (titre foncier, arrêté d'attribution, "
        "autorisation d'occuper), et orienter sur les quartiers de N'Djamena. "
        "IMPORTANT — Tu réponds en français en TEXTE BRUT uniquement, sans aucune mise en forme Markdown : "
        "n'utilise PAS d'astérisques (**), PAS de dièses (#), PAS de tableaux, PAS de blocs de code. "
        "Ecris naturellement, comme un conseiller humain, en phrases simples et concises. "
        "Tu peux utiliser des retours à la ligne pour séparer les paragraphes. "
        "Si l'utilisateur cherche un bien, propose des correspondances depuis la liste ci-dessous "
        "en citant l'ID entre crochets ainsi : [id-de-l-annonce]. Si rien ne convient, suggère "
        "d'utiliser la recherche avancée.\n\n"
        f"ANNONCES DISPONIBLES (extrait):\n{context}\n\n"
        "Contacts IMORA : WhatsApp +235 64 92 73 80, Email imoratchad@gmail.com"
    )

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-6")

    try:
        response = await chat.send_message(UserMessage(text=payload.message))
        reply = str(response)
    except Exception as e:
        logging.exception("AI chat error")
        reply = f"Désolé, je rencontre un problème technique. Contactez IMORA directement au +235 64 92 73 80."

    # Persist
    await db.ai_messages.insert_one({
        "session_id": session_id,
        "user_id": user["user_id"] if user else None,
        "user_message": payload.message,
        "assistant_message": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"session_id": session_id, "reply": reply}


# ============================================================
# Health
# ============================================================
@api_router.get("/")
async def root():
    return {"app": "IMORA Tchad", "status": "ok"}


app.include_router(api_router)

# CORS: credentialed CORS must never trust arbitrary subdomains. The fallback regex
# was previously accepting the ENTIRE `*.preview.emergentagent.com` and `*.emergent.host`
# families, which meant any attacker page hosted on the shared platform could read a
# victim's private data (SEC-001). We now trust ONLY the production custom domain by
# default, and require operators to opt-in to additional origins via CORS_ORIGINS env var.
# For preview development, set CORS_ORIGINS in the preview .env explicitly.
_cors_env = os.environ.get('CORS_ORIGINS', '').strip()
_explicit_origins = [o.strip() for o in _cors_env.split(',') if o.strip() and o.strip() != '*']
_cors_kwargs = dict(allow_credentials=True, allow_methods=["*"], allow_headers=["*"], expose_headers=["set-cookie"])
if _explicit_origins:
    _cors_kwargs["allow_origins"] = _explicit_origins
else:
    # Strict fallback: production custom domain + localhost dev only. Preview URL must be
    # opted-in via CORS_ORIGINS in the preview environment .env.
    _cors_kwargs["allow_origin_regex"] = r"^https?://(localhost(:\d+)?|imoratchad\.com|www\.imoratchad\.com)$"

app.add_middleware(
    CORSMiddleware,
    **_cors_kwargs,
)

# GZip compression: compress responses > 500 bytes at compresslevel 6 (good balance for slow 3G/4G in Chad)
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds strict security headers on every response.
    - HSTS: forces HTTPS for 1 year (Play Store requirement, prevents downgrade attacks).
    - X-Content-Type-Options: prevents MIME sniffing.
    - X-Frame-Options: clickjacking defense.
    - Referrer-Policy: minimize referrer leakage.
    - Permissions-Policy: block unused browser APIs.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(self), microphone=(), geolocation=(self), payment=()")
        return response


app.add_middleware(SecurityHeadersMiddleware)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
