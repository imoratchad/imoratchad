import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Phone, MessageCircle, Mail, Heart, ShieldCheck, MapPin, BedDouble, Bath, Maximize2, ChevronLeft, ChevronRight, Sofa, FileText } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPrice, findLabelByValue, NDJAMENA_CENTER } from "../lib/constants";

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PropertyDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    api.get(`/properties/${id}`).then(({ data }) => setProperty(data));
    if (user) {
      api.get("/favorites").then(({ data }) => setIsFav(data.some(p => p.id === id)));
    }
  }, [id, user]);

  const toggleFav = async () => {
    if (!user) return;
    if (isFav) { await api.delete(`/favorites/${id}`); setIsFav(false); }
    else { await api.post(`/favorites/${id}`); setIsFav(true); }
  };

  const onContact = () => {
    api.post(`/properties/${id}/contact`).catch(() => {});
  };

  if (!property) return <div className="max-w-7xl mx-auto p-8 text-center text-neutral-500">{t("common.loading")}</div>;

  const photos = property.photos?.length ? property.photos : ["https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=1200&q=70"];
  const hasLoc = property.lat && property.lng;
  const mapCenter = hasLoc ? { lat: property.lat, lng: property.lng } : NDJAMENA_CENTER;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/search" className="text-sm font-bold text-neutral-500 hover:text-neutral-900 mb-4 inline-flex items-center gap-1"><ChevronLeft className="h-4 w-4" /> {t("nav.search")}</Link>

      {/* Gallery */}
      <div className="relative bg-neutral-100 rounded-xl overflow-hidden mb-6">
        <div className="aspect-[16/9] w-full">
          <img src={photos[photoIdx]} alt={property.title} className="w-full h-full object-cover" />
        </div>
        {photos.length > 1 && (
          <>
            <button onClick={() => setPhotoIdx((photoIdx - 1 + photos.length) % photos.length)} data-testid="prev-photo" className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => setPhotoIdx((photoIdx + 1) % photos.length)} data-testid="next-photo" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded">{photoIdx + 1} / {photos.length}</div>
          </>
        )}
        {property.verified && (
          <span className="absolute top-4 left-4 imora-badge-verified text-sm" data-testid="detail-verified-badge">
            <ShieldCheck className="h-4 w-4" /> {t("detail.verified")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{property.title}</h1>
            <button onClick={toggleFav} data-testid="fav-btn" className={`p-3 rounded-full ${isFav ? "bg-[#FF6B1A] text-white" : "bg-white border border-neutral-200"}`}><Heart className={`h-5 w-5 ${isFav ? "fill-current" : ""}`} /></button>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-3">
            <MapPin className="h-4 w-4" />
            <span>{property.neighborhood}{property.address ? ", " + property.address : ""}, {property.city}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="bg-neutral-100 border border-neutral-200 text-xs font-bold uppercase px-3 py-1.5 rounded-full">{findLabelByValue(property.property_type)}</span>
            <span className="bg-[#FF6B1A]/10 text-[#FF6B1A] text-xs font-bold uppercase px-3 py-1.5 rounded-full">{findLabelByValue(property.transaction_type)}</span>
            {property.negotiable && <span className="bg-neutral-100 border border-neutral-200 text-xs font-bold uppercase px-3 py-1.5 rounded-full">{t("card.negotiable")}</span>}
          </div>
          <div className="text-[#FF6B1A] font-heading font-black text-3xl mb-6" data-testid="detail-price">{formatPrice(property.price)}</div>

          <h2 className="font-heading font-bold text-xl mb-2">{t("detail.description")}</h2>
          <p className="text-neutral-700 whitespace-pre-wrap mb-6">{property.description}</p>

          <h2 className="font-heading font-bold text-xl mb-2">{t("detail.details")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {property.rooms > 0 && <DetailItem icon={BedDouble} label={t("detail.rooms")} value={property.rooms} />}
            {property.bathrooms > 0 && <DetailItem icon={Bath} label={t("detail.bathrooms")} value={property.bathrooms} />}
            {property.living_rooms > 0 && <DetailItem icon={Sofa} label={t("detail.livingRooms")} value={property.living_rooms} />}
            {property.land_area > 0 && <DetailItem icon={Maximize2} label={t("detail.landArea")} value={property.land_area + " m²"} />}
            {property.living_area > 0 && <DetailItem icon={Maximize2} label={t("detail.livingArea")} value={property.living_area + " m²"} />}
          </div>

          {property.documents?.length > 0 && (
            <>
              <h2 className="font-heading font-bold text-xl mb-2">{t("detail.documents")}</h2>
              <div className="space-y-2 mb-6">
                {property.documents.map((d, i) => (
                  <div key={i} className="bg-white border border-neutral-200 rounded-lg p-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#00B4FF]" />
                    <span className="text-sm font-semibold">{d.type || d.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {property.testimonial && (property.status === "sold" || property.status === "rented") && (
            <div className="bg-gradient-to-br from-[#0A0A0A] to-neutral-800 text-white rounded-xl p-5 mb-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#00B4FF] mb-2">Témoignage client · Transaction réussie</div>
              <p className="text-lg italic font-heading">"{property.testimonial}"</p>
              {property.testimonial_author && <p className="mt-2 text-sm font-bold text-[#FF6B1A]">— {property.testimonial_author}</p>}
            </div>
          )}

          {property.virtual_tour_url && (
            <>
              <h2 className="font-heading font-bold text-xl mb-2">Visite virtuelle</h2>
              <div className="rounded-xl overflow-hidden border border-neutral-200 mb-6 bg-black" data-testid="virtual-tour-embed">
                {(() => {
                  const u = property.virtual_tour_url;
                  // YouTube embed
                  const yt = u.match(/(?:youtube\.com\/(?:.*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                  if (yt) return <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${yt[1]}`} title="Visite virtuelle" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
                  // Vimeo
                  const vm = u.match(/vimeo\.com\/(\d+)/);
                  if (vm) return <iframe className="w-full aspect-video" src={`https://player.vimeo.com/video/${vm[1]}`} title="Visite virtuelle" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
                  // Fallback link
                  return <div className="p-6 text-center"><a href={u} target="_blank" rel="noopener noreferrer" className="text-[#00B4FF] underline font-bold">Ouvrir la visite virtuelle →</a></div>;
                })()}
              </div>
            </>
          )}

          <h2 className="font-heading font-bold text-xl mb-2">{t("detail.location")}</h2>
          <div className="rounded-xl overflow-hidden border border-neutral-200 mb-6" style={{ height: 320 }}>
            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={hasLoc ? 14 : 12} style={{ height: "100%", width: "100%" }} data-testid="property-map">
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {hasLoc && <Marker position={[property.lat, property.lng]}><Popup>{property.title}</Popup></Marker>}
            </MapContainer>
          </div>
        </div>

        {/* Contact panel */}
        <aside className="lg:sticky lg:top-24 self-start bg-white border border-neutral-200 rounded-xl p-5">
          <h3 className="font-heading font-bold text-lg mb-3">{t("detail.contact")}</h3>
          <div className="mb-4">
            <div className="font-semibold text-neutral-900">{property.contact_name}</div>
            <div className="text-sm text-neutral-500">{property.contact_phone}</div>
          </div>
          <div className="space-y-2">
            <a href={`tel:${property.contact_phone}`} onClick={onContact} data-testid="contact-call-btn" className="imora-btn-primary w-full"><Phone className="h-4 w-4" /> {t("detail.call")}</a>
            {property.contact_whatsapp && (
              <a href={`https://wa.me/${property.contact_whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={onContact} data-testid="contact-whatsapp-btn" className="imora-btn-secondary w-full"><MessageCircle className="h-4 w-4" /> {t("detail.whatsapp")}</a>
            )}
            {property.contact_email && (
              <a href={`mailto:${property.contact_email}`} onClick={onContact} data-testid="contact-email-btn" className="imora-btn-outline w-full"><Mail className="h-4 w-4" /> {t("detail.email")}</a>
            )}
          </div>
          {property.verified && (
            <div className="mt-5 bg-[#00B4FF]/10 border border-[#00B4FF]/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[#00B4FF] font-bold text-sm"><ShieldCheck className="h-4 w-4" /> {t("detail.verified")}</div>
              <p className="text-xs text-neutral-700 mt-1">{t("detail.verifiedDesc")}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="bg-white border border-neutral-200 rounded-lg p-3">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500 font-bold mb-1"><Icon className="h-3.5 w-3.5" />{label}</div>
    <div className="font-heading font-bold text-lg">{value}</div>
  </div>
);

export default PropertyDetail;
