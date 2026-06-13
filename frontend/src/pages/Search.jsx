import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { CITIES, ARRONDISSEMENTS, ALL_NEIGHBORHOODS, PROPERTY_TYPES, TRANSACTION_TYPES } from "../lib/constants";
import PropertyCard from "../components/PropertyCard";

const SearchPage = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filters = {
    q: params.get("q") || "",
    city: params.get("city") || "",
    arrondissement: params.get("arrondissement") || "",
    neighborhood: params.get("neighborhood") || "",
    property_type: params.get("property_type") || "",
    transaction_type: params.get("transaction_type") || "",
    min_price: params.get("min_price") || "",
    max_price: params.get("max_price") || "",
    min_area: params.get("min_area") || "",
    verified: params.get("verified") || "",
  };

  const fetchData = async () => {
    setLoading(true);
    const q = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) q[k] = v; });
    try {
      const { data } = await api.get("/properties", { params: q });
      setItems(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [params.toString()]);

  const update = (k, v) => {
    const np = new URLSearchParams(params);
    if (v) np.set(k, v); else np.delete(k);
    setParams(np);
  };
  const reset = () => setParams(new URLSearchParams());

  const neighborhoods = filters.arrondissement ? ARRONDISSEMENTS[filters.arrondissement] || [] : ALL_NEIGHBORHOODS;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{t("search.title")}</h1>
          <p className="text-sm text-neutral-500 mt-1">{items.length} {t("search.results")}</p>
        </div>
        <button onClick={() => setShowFilters(true)} data-testid="show-filters-btn" className="lg:hidden imora-btn-outline !h-10 !px-4">
          <SlidersHorizontal className="h-4 w-4" /> {t("search.filters")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Filters - desktop */}
        <aside className="hidden lg:block sticky top-24 self-start bg-white rounded-xl border border-neutral-200 p-4">
          <FilterPanel filters={filters} update={update} reset={reset} neighborhoods={neighborhoods} />
        </aside>

        {/* Mobile filter sheet */}
        {showFilters && (
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowFilters(false)}>
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-xl">{t("search.filters")}</h3>
                <button onClick={() => setShowFilters(false)} data-testid="close-filters-btn"><X className="h-5 w-5" /></button>
              </div>
              <FilterPanel filters={filters} update={update} reset={reset} neighborhoods={neighborhoods} />
              <button onClick={() => setShowFilters(false)} className="imora-btn-primary w-full mt-4">{t("search.apply")}</button>
            </div>
          </div>
        )}

        {/* Results */}
        <div>
          {loading ? (
            <div className="text-center py-20 text-neutral-500">{t("common.loading")}</div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
              <Filter className="h-10 w-10 mx-auto text-neutral-400 mb-3" />
              <p className="text-neutral-600">{t("search.noResults")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {items.map((p) => <PropertyCard key={p.id} property={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({ filters, update, reset, neighborhoods }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div>
        <label className="imora-label">{t("search.placeholder")}</label>
        <input data-testid="filter-q" value={filters.q} onChange={(e) => update("q", e.target.value)} className="imora-input" />
      </div>
      <div>
        <label className="imora-label">{t("search.city")}</label>
        <select data-testid="filter-city" value={filters.city} onChange={(e) => update("city", e.target.value)} className="imora-input">
          <option value="">{t("common.all")}</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="imora-label">{t("search.arrondissement")}</label>
        <select data-testid="filter-arr" value={filters.arrondissement} onChange={(e) => { update("arrondissement", e.target.value); update("neighborhood", ""); }} className="imora-input">
          <option value="">{t("common.all")}</option>
          {Object.keys(ARRONDISSEMENTS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div>
        <label className="imora-label">{t("search.neighborhood")}</label>
        <select data-testid="filter-neigh" value={filters.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} className="imora-input">
          <option value="">{t("common.all")}</option>
          {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div>
        <label className="imora-label">{t("search.propertyType")}</label>
        <select data-testid="filter-type" value={filters.property_type} onChange={(e) => update("property_type", e.target.value)} className="imora-input">
          <option value="">{t("common.all")}</option>
          {Object.values(PROPERTY_TYPES).map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="imora-label">{t("search.transactionType")}</label>
        <select data-testid="filter-transaction" value={filters.transaction_type} onChange={(e) => update("transaction_type", e.target.value)} className="imora-input">
          <option value="">{t("common.all")}</option>
          {TRANSACTION_TYPES.map(tr => <option key={tr.value} value={tr.value}>{tr.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="imora-label">{t("search.minPrice")}</label>
          <input data-testid="filter-min-price" type="number" value={filters.min_price} onChange={(e) => update("min_price", e.target.value)} className="imora-input" />
        </div>
        <div>
          <label className="imora-label">{t("search.maxPrice")}</label>
          <input data-testid="filter-max-price" type="number" value={filters.max_price} onChange={(e) => update("max_price", e.target.value)} className="imora-input" />
        </div>
      </div>
      <div>
        <label className="imora-label">{t("search.minArea")}</label>
        <input data-testid="filter-min-area" type="number" value={filters.min_area} onChange={(e) => update("min_area", e.target.value)} className="imora-input" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input data-testid="filter-verified" type="checkbox" checked={filters.verified === "true"} onChange={(e) => update("verified", e.target.checked ? "true" : "")} className="h-4 w-4 accent-[#00B4FF]" />
        <span className="text-sm font-semibold">{t("search.verifiedOnly")}</span>
      </label>
      <button onClick={reset} data-testid="filter-reset" className="imora-btn-outline w-full">{t("search.reset")}</button>
    </div>
  );
};

export default SearchPage;
