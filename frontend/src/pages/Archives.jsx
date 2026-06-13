import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Trophy, Filter } from "lucide-react";
import { api } from "../lib/api";
import { TRANSACTION_TYPES, findLabelByValue } from "../lib/constants";
import PropertyCard from "../components/PropertyCard";

const Archives = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = filter ? `?transaction_type=${filter}` : "";
    api.get(`/properties/archives${params}`).then(({ data }) => {
      setItems(data);
    }).finally(() => setLoading(false));
  }, [filter]);

  const sold = items.filter(p => p.status === "sold");
  const rented = items.filter(p => p.status === "rented");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-[#0A0A0A] text-white rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 opacity-10"><Trophy className="h-48 w-48" /></div>
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#00B4FF] mb-2">Transactions réussies</div>
          <h1 className="font-heading font-black text-3xl sm:text-5xl tracking-tighter">Biens vendus & loués</h1>
          <p className="text-white/70 mt-2 max-w-2xl">Découvrez les biens immobiliers déjà vendus ou loués via IMORA Tchad. La preuve sociale de notre plateforme et l'historique de nos transactions réussies.</p>
          <div className="flex flex-wrap items-center gap-4 mt-5">
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/60">Vendus</div>
              <div className="font-heading font-black text-2xl text-[#FF6B1A]">{sold.length}</div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/60">Loués</div>
              <div className="font-heading font-black text-2xl text-[#00B4FF]">{rented.length}</div>
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-lg">
              <div className="text-[10px] uppercase tracking-widest text-white/60">Total transactions</div>
              <div className="font-heading font-black text-2xl">{items.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar">
        <button onClick={() => setFilter("")} data-testid="archives-filter-all" className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${filter === "" ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>
          <Filter className="h-3 w-3 inline mr-1" /> Tous
        </button>
        {TRANSACTION_TYPES.map(tr => (
          <button key={tr.value} onClick={() => setFilter(tr.value)} data-testid={`archives-filter-${tr.value}`} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${filter === tr.value ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>
            {tr.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-neutral-500">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-600">Aucun bien archivé pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {items.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  );
};

export default Archives;
