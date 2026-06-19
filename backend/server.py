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


async def notify_user(user_id: str, ntype: str, title: str, message: str, property_id: str = None, payment_id: str = None) -> dict:
    notif = Notification(user_id=user_id, type=ntype, title=title, message=message, property_id=property_id, payment_id=payment_id)
    await db.notifications.insert_one(notif.model_dump())
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    phone = (user or {}).get("whatsapp") or (user or {}).get("phone") or ""
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
        area_clause = [{"land_area": {"$gte": min_area}}, {"living_area": {"$gte": min_area}}]
        if "$or" in query:
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": area_clause}, query]}
        else:
            query["$or"] = area_clause
    if q:
        q_clause = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"neighborhood": {"$regex": q, "$options": "i"}},
        ]
        if "$or" in query:
            query = {"$and": [{"$or": query.pop("$or")}, {"$or": q_clause}, query]}
        elif "$and" in query:
            query["$and"].append({"$or": q_clause})
        else:
            query["$or"] = q_clause

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


@api_router.post("/properties")
async def create_property(payload: PropertyCreate, request: Request, authorization: Optional[str] = Header(None)):
    import hashlib
    user = await require_user(request, authorization)
    # Photo validation: max 10 photos, each ≤ 5 MB
    if len(payload.photos) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos par annonce")
    for ph in payload.photos:
        if len(ph) > 5 * 1024 * 1024 * 1.4:  # base64 inflates ~33%
            raise HTTPException(status_code=400, detail="Chaque photo doit faire moins de 5 MB")
    # Duplicate photo detection (SHA256)
    photo_hashes = []
    for ph in payload.photos:
        h = hashlib.sha256(ph.encode("utf-8")).hexdigest()
        photo_hashes.append(h)
        existing = await db.photo_hashes.find_one({"hash": h, "user_id": {"$ne": user["user_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Une photo identique existe déjà sur la plateforme")
    prop = Property(user_id=user["user_id"], **payload.model_dump())
    # MODERATION: All new ads go through admin approval, except admin's own and verified agencies
    if user.get("role") == "admin" or (user.get("role") == "agence" and user.get("verified_agency")):
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
