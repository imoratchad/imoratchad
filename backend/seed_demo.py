"""Seed demo properties for IMORA Tchad."""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

# Ensure demo owner exists
demo_user = {
    "user_id": "demo-imora-agency",
    "email": "demo@imoratchad.com",
    "name": "IMORA Démo Agence",
    "picture": "",
    "role": "agence",
    "phone": "+235 64 92 73 80",
    "whatsapp": "+235 64 92 73 80",
    "agency_name": "IMORA Démo",
    "verified_agency": True,
    "suspended": False,
    "created_at": datetime.now(timezone.utc).isoformat(),
}
db.users.replace_one({"user_id": demo_user["user_id"]}, demo_user, upsert=True)

photos_map = {
    "villa": [
        "https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=1200&q=70",
        "https://images.unsplash.com/photo-1706808849780-7a04fbac83ef?w=1200&q=70",
        "https://images.unsplash.com/photo-1698994705178-d244d73ea573?w=1200&q=70",
    ],
    "appartement": [
        "https://images.unsplash.com/photo-1638454795595-0a0abf68614d?w=1200&q=70",
        "https://images.unsplash.com/photo-1738168246881-40f35f8aba0a?w=1200&q=70",
    ],
    "maison": [
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=70",
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=70",
    ],
    "terrain_residentiel": [
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=70",
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=70",
    ],
    "bureau": [
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=70",
    ],
    "boutique": [
        "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&q=70",
    ],
}

demo_props = [
    {"title": "Villa moderne 5 chambres à Klémat", "description": "Magnifique villa de 5 chambres avec jardin tropical, piscine et garage 2 places. Quartier résidentiel calme et sécurisé à proximité de l'aéroport.", "property_type": "villa", "transaction_type": "vente", "price": 185000000, "negotiable": True, "city": "N'Djamena", "neighborhood": "Klémat", "arrondissement": "1er Arrondissement", "rooms": 5, "bathrooms": 3, "living_rooms": 2, "land_area": 800, "living_area": 420, "lat": 12.116, "lng": 15.053, "verified": True, "featured": True},
    {"title": "Appartement meublé 3 chambres à Moursal", "description": "Bel appartement entièrement meublé, climatisation, internet fibre, parking. Idéal pour expatriés ou jeunes professionnels.", "property_type": "appartement", "transaction_type": "location_mensuelle", "price": 450000, "negotiable": False, "city": "N'Djamena", "neighborhood": "Moursal", "arrondissement": "2e Arrondissement", "rooms": 3, "bathrooms": 2, "living_rooms": 1, "land_area": 0, "living_area": 130, "lat": 12.108, "lng": 15.073, "verified": True, "featured": True},
    {"title": "Terrain résidentiel 600 m² à Diguel", "description": "Terrain bien situé avec titre foncier en règle, prêt à construire. Accès facile, eau et électricité disponibles à proximité.", "property_type": "terrain_residentiel", "transaction_type": "vente", "price": 8500000, "negotiable": True, "city": "N'Djamena", "neighborhood": "Diguel", "arrondissement": "1er Arrondissement", "rooms": 0, "bathrooms": 0, "land_area": 600, "living_area": 0, "lat": 12.155, "lng": 15.045, "verified": True, "featured": False},
    {"title": "Maison familiale 4 chambres à Chagoua", "description": "Maison en très bon état, cour spacieuse avec puits, mur de clôture haut, idéale pour grande famille.", "property_type": "maison", "transaction_type": "vente", "price": 55000000, "negotiable": True, "city": "N'Djamena", "neighborhood": "Chagoua", "arrondissement": "2e Arrondissement", "rooms": 4, "bathrooms": 2, "living_rooms": 1, "land_area": 500, "living_area": 220, "lat": 12.098, "lng": 15.082, "verified": True, "featured": False},
    {"title": "Studio meublé location journalière - Quartier Ambassades", "description": "Studio cosy entièrement équipé, WiFi haut débit, climatisation, parfait pour court séjour à N'Djamena.", "property_type": "studio", "transaction_type": "location_journaliere", "price": 25000, "negotiable": False, "city": "N'Djamena", "neighborhood": "Quartier des Ambassades", "arrondissement": "Autres secteurs et extensions", "rooms": 1, "bathrooms": 1, "land_area": 0, "living_area": 45, "lat": 12.122, "lng": 15.061, "verified": True, "featured": False},
    {"title": "Duplex haut standing 6 pièces à Paris-Congo", "description": "Duplex neuf, finitions de luxe, vue panoramique, salle de sport, terrasse 80 m². Sécurité 24/7.", "property_type": "duplex", "transaction_type": "vente", "price": 220000000, "negotiable": False, "city": "N'Djamena", "neighborhood": "Paris-Congo", "arrondissement": "2e Arrondissement", "rooms": 4, "bathrooms": 3, "living_rooms": 2, "land_area": 350, "living_area": 380, "lat": 12.114, "lng": 15.078, "verified": True, "featured": True},
    {"title": "Bureau 120 m² à louer Centre-ville", "description": "Plateau de bureau ouvert, climatisé, fibre optique, salle de réunion. Adresse prestigieuse au cœur de N'Djamena.", "property_type": "bureau", "transaction_type": "location_mensuelle", "price": 380000, "negotiable": True, "city": "N'Djamena", "neighborhood": "Sabangali", "arrondissement": "2e Arrondissement", "rooms": 0, "bathrooms": 1, "land_area": 0, "living_area": 120, "lat": 12.103, "lng": 15.062, "verified": False, "featured": False},
    {"title": "Boutique 60 m² Marché central", "description": "Local commercial avec vitrine sur rue très passante. Idéal pour commerce de détail ou prêt-à-porter.", "property_type": "boutique", "transaction_type": "location_annuelle", "price": 2400000, "negotiable": True, "city": "N'Djamena", "neighborhood": "Sabangali", "arrondissement": "2e Arrondissement", "rooms": 0, "bathrooms": 1, "land_area": 0, "living_area": 60, "lat": 12.106, "lng": 15.064, "verified": False, "featured": False},
    {"title": "Terrain 1500 m² à Toukra", "description": "Grand terrain en zone résidentielle en plein essor. Idéal pour villa avec grand jardin ou petit immeuble.", "property_type": "terrain_residentiel", "transaction_type": "vente", "price": 18000000, "negotiable": True, "city": "N'Djamena", "neighborhood": "Toukra", "arrondissement": "4e Arrondissement", "rooms": 0, "bathrooms": 0, "land_area": 1500, "living_area": 0, "lat": 12.063, "lng": 15.115, "verified": True, "featured": False},
    {"title": "Villa avec piscine à louer pour la semaine - Diguel Ryad", "description": "Villa luxueuse, 6 chambres, piscine chauffée, personnel de maison inclus. Idéal séjour famille ou tournage.", "property_type": "villa", "transaction_type": "location_hebdomadaire", "price": 850000, "negotiable": False, "city": "N'Djamena", "neighborhood": "Diguel Ryad", "arrondissement": "Autres secteurs et extensions", "rooms": 6, "bathrooms": 4, "living_rooms": 2, "land_area": 1200, "living_area": 480, "lat": 12.144, "lng": 15.052, "verified": True, "featured": True},
]

for d in demo_props:
    prop = {
        "id": str(uuid.uuid4()),
        "user_id": demo_user["user_id"],
        "currency": "XAF",
        "address": "",
        "location_visibility": "neighborhood",
        "photos": photos_map.get(d["property_type"], photos_map["villa"]),
        "videos": [],
        "virtual_tour_url": "",
        "documents": [],
        "contact_name": "IMORA Démo Agence",
        "contact_phone": "+235 64 92 73 80",
        "contact_whatsapp": "+235 64 92 73 80",
        "contact_email": "imoratchad@gmail.com",
        "status": "active",
        "views": (hash(d["title"]) % 200) + 50,
        "contact_count": (hash(d["title"]) % 30) + 5,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **d,
    }
    # Replace by title to make it idempotent
    db.properties.replace_one({"title": prop["title"], "user_id": demo_user["user_id"]}, prop, upsert=True)

print(f"Seeded {len(demo_props)} demo properties for {demo_user['agency_name']}")
print(f"Total properties: {db.properties.count_documents({})}")
