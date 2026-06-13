import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, MapPin, Eye, Phone, BedDouble, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatPrice, findLabelByValue } from "../lib/constants";

const PropertyCard = ({ property, featured = false }) => {
  const { t } = useTranslation();
  const photo = property.photos?.[0] || "https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=800&q=70";
  return (
    <Link
      to={`/property/${property.id}`}
      data-testid={`property-card-${property.id}`}
      className={`imora-card block group ${featured ? "md:col-span-2" : ""}`}
    >
      <div className={`aspect-[4/3] w-full overflow-hidden relative bg-neutral-100 ${featured ? "md:aspect-[2/1]" : ""}`}>
        <img
          src={photo}
          alt={property.title}
          loading="lazy"
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${property.status === "sold" || property.status === "rented" ? "grayscale" : ""}`}
        />
        {/* Sold / Rented overlay */}
        {(property.status === "sold" || property.status === "rented") && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`-rotate-12 px-6 py-2 border-4 font-heading font-black text-3xl tracking-tighter ${property.status === "sold" ? "border-[#FF6B1A] text-[#FF6B1A] bg-white/85" : "border-[#00B4FF] text-[#00B4FF] bg-white/85"}`}>
              {property.status === "sold" ? "VENDU" : "LOUÉ"}
            </div>
          </div>
        )}
        {property.verified && (
          <span className="absolute top-3 start-3 imora-badge-verified" data-testid={`verified-badge-${property.id}`}>
            <ShieldCheck className="h-3 w-3" /> {t("card.verified")}
          </span>
        )}
        <span className="absolute top-3 end-3 bg-black/80 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">
          {findLabelByValue(property.transaction_type)}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="text-[#FF6B1A] font-heading font-extrabold text-xl">{formatPrice(property.price)}</div>
          {property.negotiable && <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{t("card.negotiable")}</span>}
        </div>
        <h3 className="font-heading font-bold text-base text-neutral-900 line-clamp-1">{property.title}</h3>
        <div className="flex items-center gap-1 text-xs text-neutral-500 mt-1">
          <MapPin className="h-3 w-3" />
          <span className="line-clamp-1">{property.neighborhood}, {property.city}</span>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600 font-semibold">
          {property.rooms > 0 && (<span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{property.rooms}</span>)}
          {(property.land_area > 0 || property.living_area > 0) && (
            <span className="flex items-center gap-1"><Maximize2 className="h-3.5 w-3.5" />{property.land_area || property.living_area} m²</span>
          )}
          <span className="flex items-center gap-1 ms-auto"><Eye className="h-3.5 w-3.5" />{property.views || 0}</span>
        </div>
      </div>
    </Link>
  );
};

export default PropertyCard;
