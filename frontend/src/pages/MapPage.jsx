import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Locate } from "lucide-react";
import { api } from "../lib/api";
import { NDJAMENA_CENTER, formatPrice } from "../lib/constants";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const orangeIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='40' viewBox='0 0 28 40'><path fill='#FF6B1A' stroke='white' stroke-width='2' d='M14 1c7 0 13 5.5 13 12.5C27 23 14 39 14 39S1 23 1 13.5C1 6.5 7 1 14 1z'/><circle cx='14' cy='14' r='5' fill='white'/></svg>`),
  iconSize: [28, 40],
  iconAnchor: [14, 40],
});

const RecenterButton = ({ center }) => {
  const map = useMap();
  return (
    <button onClick={() => map.setView([center.lat, center.lng], 14)} data-testid="map-recenter-btn" className="absolute top-3 right-3 z-[400] bg-white p-3 rounded-full shadow-lg">
      <Locate className="h-4 w-4" />
    </button>
  );
};

const MapPage = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [userPos, setUserPos] = useState(null);

  useEffect(() => {
    api.get("/properties?limit=200").then(({ data }) => setItems(data.filter(p => p.lat && p.lng)));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => {}, { timeout: 5000 });
    }
  }, []);

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{t("nav.map")}</h1>
        <p className="text-sm text-neutral-500 mb-4">{items.length} biens géolocalisés</p>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="relative rounded-xl overflow-hidden border border-neutral-200" style={{ height: "70vh" }} data-testid="main-map">
          <MapContainer center={[NDJAMENA_CENTER.lat, NDJAMENA_CENTER.lng]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {userPos && (
              <Marker position={[userPos.lat, userPos.lng]}>
                <Popup>Vous êtes ici</Popup>
              </Marker>
            )}
            {items.map(p => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={orangeIcon}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-bold">{p.title}</div>
                    <div className="text-[#FF6B1A] font-bold">{formatPrice(p.price)}</div>
                    <Link to={`/property/${p.id}`} className="text-[#00B4FF] font-bold text-xs">Voir →</Link>
                  </div>
                </Popup>
              </Marker>
            ))}
            <RecenterButton center={userPos || NDJAMENA_CENTER} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
