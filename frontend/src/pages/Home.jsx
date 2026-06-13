import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, ShieldCheck, MapPin, Sparkles, CreditCard, Star, ArrowRight, Trophy } from "lucide-react";
import { api, LOGO_URL } from "../lib/api";
import { ARRONDISSEMENTS, ALL_PROPERTY_TYPES, TRANSACTION_TYPES } from "../lib/constants";
import PropertyCard from "../components/PropertyCard";

const ChadFlagBadge = () => (
  <div className="inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-3 py-1.5">
    <div className="flex h-4 w-6 overflow-hidden rounded-sm">
      <div className="flex-1 bg-chad-blue" />
      <div className="flex-1 bg-chad-yellow" />
      <div className="flex-1 bg-chad-red" />
    </div>
    <span className="text-xs font-bold uppercase tracking-widest text-neutral-900">Tchad</span>
  </div>
);

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [recent, setRecent] = useState([]);
  const [archives, setArchives] = useState([]);
  const [q, setQ] = useState("");
  const [transaction, setTransaction] = useState("");

  useEffect(() => {
    api.get("/properties/featured").then(({ data }) => setFeatured(data)).catch(() => {});
    api.get("/properties?limit=8").then(({ data }) => setRecent(data)).catch(() => {});
    api.get("/properties/archives?limit=6").then(({ data }) => setArchives(data)).catch(() => {});
  }, []);

  const doSearch = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (transaction) params.set("transaction_type", transaction);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div>
      {/* HERO */}
      <section className="relative bg-[#0A0A0A] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img src="https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=1600&q=70" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="flex items-center gap-3 mb-6">
            <ChadFlagBadge />
            <img src={LOGO_URL} alt="IMORA" className="h-12 w-12 rounded-md object-cover" />
          </div>
          <h1 data-testid="home-hero-title" className="font-heading font-black tracking-tighter text-4xl sm:text-5xl lg:text-6xl max-w-3xl leading-[0.95]">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/70 max-w-2xl">{t("home.heroSub")}</p>

          {/* Quick search */}
          <div className="mt-8 bg-white rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-2 items-stretch shadow-xl max-w-3xl">
            <div className="flex items-center gap-2 flex-1 px-3 bg-neutral-50 rounded-lg">
              <Search className="h-5 w-5 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                data-testid="home-search-input"
                placeholder={t("search.placeholder")}
                className="flex-1 bg-transparent h-12 outline-none text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
            <select value={transaction} onChange={(e) => setTransaction(e.target.value)} data-testid="home-transaction-select" className="bg-neutral-50 rounded-lg h-12 px-3 text-neutral-900 outline-none border-0">
              <option value="">{t("search.transactionType")}</option>
              {TRANSACTION_TYPES.map(tr => <option key={tr.value} value={tr.value}>{tr.label}</option>)}
            </select>
            <button onClick={doSearch} data-testid="home-search-btn" className="imora-btn-primary">
              {t("home.searchCta")}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/publish" data-testid="home-publish-cta" className="imora-btn-secondary"><span>{t("home.publishCta")}</span></Link>
            <Link to="/map" data-testid="home-map-cta" className="bg-white/10 hover:bg-white/20 text-white h-12 px-6 rounded-lg font-semibold flex items-center gap-2 transition">
              <MapPin className="h-4 w-4" /> {t("nav.map")}
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#00B4FF]">{t("home.verified")}</div>
            <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight">{t("home.featured")}</h2>
          </div>
          <Link to="/search?verified=true" data-testid="see-all-verified" className="text-sm font-bold text-[#FF6B1A] hover:underline">{t("common.from")} →</Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {featured.map((p, i) => <PropertyCard key={p.id} property={p} featured={i === 0} />)}
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
            <ShieldCheck className="h-10 w-10 mx-auto text-[#00B4FF] mb-3" />
            <p className="text-neutral-600">{t("search.noResults")}</p>
            <Link to="/publish" className="imora-btn-primary mt-4 inline-flex">{t("home.publishCta")}</Link>
          </div>
        )}
      </section>

      {/* Recent */}
      {recent.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight">{t("home.recent")}</h2>
            <Link to="/search" data-testid="see-all-recent" className="text-sm font-bold text-[#FF6B1A] hover:underline">→</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {recent.slice(0, 8).map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>
        </section>
      )}

      {/* Recently sold / rented — social proof */}
      {archives.length > 0 && (
        <section className="bg-[#0A0A0A] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#00B4FF] flex items-center gap-2"><Trophy className="h-3 w-3" /> Transactions réussies</div>
                <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight">Récemment vendus & loués</h2>
              </div>
              <Link to="/archives" data-testid="see-all-archives" className="text-sm font-bold text-[#FF6B1A] hover:underline">Voir tout →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {archives.slice(0, 6).map((p) => <PropertyCard key={p.id} property={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* Popular neighborhoods */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-6">{t("home.popularNeigh")}</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ARRONDISSEMENTS).slice(0, 6).map(([arr, list]) =>
            list.slice(0, 4).map((n) => (
              <Link key={n} to={`/search?neighborhood=${encodeURIComponent(n)}`} data-testid={`neighborhood-chip-${n}`} className="px-4 py-2 bg-white border border-neutral-200 rounded-full text-sm font-semibold hover:border-neutral-900 transition">
                {n}
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Trust */}
      <section className="bg-white border-y border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-8">{t("home.whyImora")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, color: "#00B4FF", title: t("home.trust1"), desc: t("home.trust1d") },
              { icon: MapPin, color: "#FF6B1A", title: t("home.trust2"), desc: t("home.trust2d") },
              { icon: Sparkles, color: "#00B4FF", title: t("home.trust3"), desc: t("home.trust3d") },
              { icon: CreditCard, color: "#FF6B1A", title: t("home.trust4"), desc: t("home.trust4d") },
            ].map((f, i) => (
              <div key={i} className="bg-neutral-50 border border-neutral-200 rounded-xl p-6">
                <div className="inline-flex p-3 rounded-lg mb-3" style={{ background: f.color + "1A" }}>
                  <f.icon className="h-6 w-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-heading font-bold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-neutral-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
