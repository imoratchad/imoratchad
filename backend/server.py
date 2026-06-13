"""
IMORA Tchad - Backend FastAPI
Plateforme immobilière du Tchad
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, Header, Query
from fastapi.responses import JSONResponse
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

app = FastAPI(title="IMORA Tchad API")
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
    verified_agency: bool = False
    suspended: bool = False
    last_login: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RoleUpdate(BaseModel):
    role: UserRole
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    agency_name: Optional[str] = ""


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
    documents: List[dict] = []  # {type, name, data}
    contact_name: str
    contact_phone: str
    contact_whatsapp: Optional[str] = ""
    contact_email: Optional[str] = ""
    status: PropertyStatus = "active"
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
@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
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
    update = {"role": payload.role}
    if payload.phone is not None:
        update["phone"] = payload.phone
    if payload.whatsapp is not None:
        update["whatsapp"] = payload.whatsapp
    if payload.agency_name is not None:
        update["agency_name"] = payload.agency_name
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
    else:
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
        query["$or"] = [{"land_area": {"$gte": min_area}}, {"living_area": {"$gte": min_area}}]
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"neighborhood": {"$regex": q, "$options": "i"}},
        ]

    cursor = db.properties.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return items


@api_router.get("/properties/featured")
async def featured_properties():
    items = await db.properties.find(
        {"status": "active", "$or": [{"featured": True}, {"verified": True}]},
        {"_id": 0}
    ).sort("created_at", -1).limit(8).to_list(length=8)
    return items


@api_router.post("/properties")
async def create_property(payload: PropertyCreate, request: Request, authorization: Optional[str] = Header(None)):
    user = await require_user(request, authorization)
    prop = Property(user_id=user["user_id"], **payload.model_dump())
    await db.properties.insert_one(prop.model_dump())
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
    confirmed_payments = await db.payments.find({"status": "confirmed"}, {"_id": 0, "amount": 1}).to_list(length=10000)
    revenue = sum(p.get("amount", 0) for p in confirmed_payments)
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
    set_fields = {"verified": bool(body.get("verified", True))}
    if "featured" in body:
        set_fields["featured"] = bool(body["featured"])
    if "status" in body:
        set_fields["status"] = body["status"]
    await db.properties.update_one({"id": prop_id}, {"$set": set_fields})
    return await db.properties.find_one({"id": prop_id}, {"_id": 0})


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
    await db.payments.update_one({"id": payment_id}, {"$set": {"status": status}})
    return await db.payments.find_one({"id": payment_id}, {"_id": 0})


@api_router.get("/admin/feedback")
async def admin_feedback(request: Request, authorization: Optional[str] = Header(None)):
    await require_admin(request, authorization)
    items = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
    return items


# ============================================================
# AI Assistant (IMORA Agent) — Claude Sonnet via Emergent Universal Key
# ============================================================
@api_router.post("/ai/chat")
async def ai_chat(payload: ChatMessage, request: Request, authorization: Optional[str] = Header(None)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    user = await get_current_user(request, authorization)
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
        "Tu réponds en français de manière concise, professionnelle et chaleureuse. "
        "Si l'utilisateur cherche un bien, propose des correspondances depuis la liste ci-dessous "
        "en citant l'ID entre crochets, ou suggère qu'il utilise la recherche avancée si rien ne convient.\n\n"
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["set-cookie"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
