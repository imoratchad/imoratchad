import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Trophy, Filter, Calendar, MapPin, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { TRANSACTION_TYPES, findLabelByValue, formatPrice } from "../lib/constants";

const relativeTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  const months = Math.max(0, Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  if (months === 0) return "ce mois-ci";
  if (months === 1) return "il y a 1 mois";
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return years === 1 ? "il y a 1 an" : `il y a ${years} ans`;
};

const ArchiveCard = ({ p }) => {
  const photo = p.photos?.[0] || "https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=800&q=70";
  const when = p.sold_at || p.rented_at;
  return (
    <Link to={`/property/${p.id}`} data-testid={`archive-card-${p.id}`} className="bg-white border border-neutral-200 rounded-xl overflow-hidden group hover:border-neutral-900 transition">
      <div className="aspect-[4/3] w-full overflow-hidden relative bg-neutral-100">
        <img src={photo} alt={p.title} loading="lazy" className="w-full h-full object-cover grayscale" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`-rotate-12 px-6 py-2 border-4 font-heading font-black text-3xl tracking-tighter ${p.status === "sold" ? "border-[#FF6B1A] text-[#FF6B1A] bg-white/85" : "border-[#00B4FF] text-[#00B4FF] bg-white/85"}`}>
            {p.status === "sold" ? "VENDU" : "LOUÉ"}
          </div>
        </div>
        {when && (
          <span className="absolute bottom-3 left-3 bg-black/80 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {relativeTime(when)}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="text-neutral-900 font-heading font-extrabold text-xl line-through opacity-50">{formatPrice(p.price)}</div>
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{findLabelByValue(p.transaction_type)}</span>
        </div>
        <h3 className="font-heading font-bold text-base text-neutral-900 line-clamp-1">{p.title}</h3>
        <div className="flex items-center gap-1 text-xs text-neutral-500 mt-1">
          <MapPin className="h-3 w-3" />
          <span className="line-clamp-1">{p.neighborhood}, {p.city}</span>
        </div>
        {p.testimonial && (
          <div className="mt-3 bg-neutral-50 border-l-2 border-[#FF6B1A] p-2 rounded">
            <Quote className="h-3 w-3 text-[#FF6B1A] mb-1" />
            <p className="text-xs italic text-neutral-700 line-clamp-2">{p.testimonial}</p>
            {p.testimonial_author && <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1">— {p.testimonial_author}</p>}
          </div>
        )}
      </div>
    </Link>
  );
};

const Archives = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("");
  const [year, setYear] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/properties/archives/stats").then(({ data }) => setStats(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("transaction_type", filter);
    if (year) params.set("year", year);
    if (neighborhood) params.set("neighborhood", neighborhood);
    api.get(`/properties/archives?${params.toString()}`).then(({ data }) => {
      setItems(data);
    }).finally(() => setLoading(false));
  }, [filter, year, neighborhood]);

  const sold = items.filter(p => p.status === "sold");
  const rented = items.filter(p => p.status === "rented");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero */}
      <div className="bg-[#0A0A0A] text-white rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 opacity-10"><Trophy className="h-48 w-48" /></div>
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#00B4FF] mb-2">{t("archives.badge")}</div>
          <h1 className="font-heading font-black text-3xl sm:text-5xl tracking-tighter">{t("archives.title")}</h1>
          <p className="text-white/70 mt-2 max-w-2xl">{t("archives.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/60">{t("archives.sold")}</div>
              <div className="font-heading font-black text-2xl text-[#FF6B1A]">{stats?.sold ?? sold.length}</div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/60">{t("archives.rented")}</div>
              <div className="font-heading font-black text-2xl text-[#00B4FF]">{stats?.rented ?? rented.length}</div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/60">{t("archives.totalLabel")}</div>
              <div className="font-heading font-black text-2xl">{stats?.total ?? items.length}</div>
            </div>
            {stats?.current_year && (
              <div className="bg-[#FF6B1A]/20 border border-[#FF6B1A]/40 px-4 py-2 rounded-lg">
                <div className="text-[10px] uppercase tracking-widest text-[#FF6B1A]">{t("archives.inYear", { year: stats.current_year })}</div>
                <div className="font-heading font-black text-2xl text-[#FF6B1A]">{stats.this_year}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top neighborhoods (social proof) */}
      {stats?.top_neighborhoods?.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 mb-6">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2">{t("archives.topNeighborhoods")}</div>
          <div className="flex flex-wrap gap-2">
            {stats.top_neighborhoods.map(n => (
              <button key={n.name} onClick={() => setNeighborhood(neighborhood === n.name ? "" : n.name)} data-testid={`archives-neigh-${n.name}`} className={`px-3 py-1.5 rounded-full text-sm font-bold border ${neighborhood === n.name ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "bg-white border-neutral-200 hover:border-neutral-900"}`}>
                {n.name} <span className="opacity-60">({n.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={() => { setFilter(""); setYear(""); setNeighborhood(""); }} data-testid="archives-filter-all" className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${filter === "" && !year && !neighborhood ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>
          <Filter className="h-3 w-3 inline mr-1" /> {t("common.all")}
        </button>
        {TRANSACTION_TYPES.map(tr => (
          <button key={tr.value} onClick={() => setFilter(filter === tr.value ? "" : tr.value)} data-testid={`archives-filter-${tr.value}`} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${filter === tr.value ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>
            {tr.label}
          </button>
        ))}
        {stats?.by_year?.length > 0 && (
          <select value={year} onChange={(e) => setYear(e.target.value)} data-testid="archives-year-select" className="bg-white border border-neutral-200 rounded-full text-sm font-bold px-4 py-2">
            <option value="">{t("archives.allYears")}</option>
            {stats.by_year.map(y => <option key={y.year} value={y.year}>{y.year} ({y.count})</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-neutral-500">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-600">{t("archives.emptyFilter")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {items.map((p) => <ArchiveCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
};

export default Archives;
