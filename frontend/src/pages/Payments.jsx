import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Smartphone, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CONTACTS, formatPrice } from "../lib/constants";

const PACKS = [
  { id: "boost_48h", title: "Boost Express 48h", subtitle: "Mise en avant immédiate", price: 5000, type: "boost", color: "#FF6B1A", features: ["Annonce affichée en vedette pendant 48h", "Position privilégiée dans les recherches", "Notification IA aux utilisateurs intéressés", "Activation sous 24h après paiement"], badge: "Particuliers" },
  { id: "verif_express", title: "Vérification Accélérée", subtitle: "Badge bleu en 24h", price: 10000, type: "verification", color: "#00B4FF", features: ["Vérification documents en 24h", "Badge ✓ Vérifié visible sur l'annonce", "Augmentation du taux de contact +60%", "Validité illimitée"], badge: "Recommandé" },
  { id: "agence_pro", title: "Pack Agence Vérifiée", subtitle: "Mensuel — 10 annonces boostées", price: 30000, type: "agency_subscription", color: "#0A0A0A", features: ["10 annonces en vedette / mois", "Badge agence vérifiée", "Statistiques avancées", "Support prioritaire WhatsApp", "Logo agence affiché"], badge: "Pro" },
];

const Payments = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedPack, setSelectedPack] = useState(null);
  const [form, setForm] = useState({ type: "boost", amount: 5000, method: "airtel", transaction_id: "", payer_phone: "", note: "" });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (user) api.get("/payments/mine").then(({ data }) => setHistory(data));
  }, [user]);

  const choosePack = (pack) => {
    setSelectedPack(pack.id);
    setForm({ ...form, type: pack.type, amount: pack.price, note: pack.title });
    setTimeout(() => document.getElementById("pay-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const submit = async () => {
    if (!user) { toast.error("Connectez-vous pour soumettre un paiement"); return; }
    try {
      await api.post("/payments", { ...form, amount: parseFloat(form.amount) });
      toast.success("Paiement soumis. Validation sous 24h.");
      const { data } = await api.get("/payments/mine");
      setHistory(data);
      setForm({ ...form, transaction_id: "", note: "" });
    } catch (e) { toast.error(t("common.error")); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{t("payments.title")}</h1>
      <p className="text-sm text-neutral-500 mb-6">{t("payments.subtitle")}</p>

      {/* PACKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {PACKS.map((p) => (
          <div key={p.id} data-testid={`pack-${p.id}`} className={`relative bg-white border-2 rounded-xl p-5 transition cursor-pointer ${selectedPack === p.id ? "border-[#FF6B1A] shadow-lg" : "border-neutral-200 hover:border-neutral-400"}`} onClick={() => choosePack(p)}>
            <span className="absolute -top-2 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded text-white" style={{ background: p.color }}>{p.badge}</span>
            <h3 className="font-heading font-extrabold text-xl tracking-tight">{p.title}</h3>
            <p className="text-xs text-neutral-500 mb-3">{p.subtitle}</p>
            <div className="font-heading font-black text-3xl mb-3" style={{ color: p.color }}>{formatPrice(p.price)}</div>
            <ul className="space-y-1.5 text-sm">
              {p.features.map((f, i) => (
                <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span>{f}</span></li>
              ))}
            </ul>
            <button data-testid={`select-pack-${p.id}`} className={`w-full mt-4 font-bold h-10 rounded-lg ${selectedPack === p.id ? "bg-[#FF6B1A] text-white" : "bg-neutral-100 hover:bg-neutral-200"}`}>{selectedPack === p.id ? "Sélectionné ✓" : "Choisir ce pack"}</button>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-6">
        <h2 className="font-heading font-bold text-lg mb-4 flex items-center gap-2"><Smartphone className="h-5 w-5 text-[#00B4FF]" /> {t("payments.howto")}</h2>
        <ol className="space-y-3 text-sm">
          {[t("payments.step1"), t("payments.step2"), t("payments.step3"), t("payments.step4")].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="h-6 w-6 rounded-full bg-[#FF6B1A] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-[#FF6B1A]/5 border border-[#FF6B1A]/30 rounded-lg p-3">
            <div className="text-xs uppercase tracking-widest font-bold text-[#FF6B1A]">{t("payments.airtelNum")}</div>
            <div className="font-heading font-bold text-lg">{CONTACTS.airtel}</div>
          </div>
          <div className="bg-[#00B4FF]/5 border border-[#00B4FF]/30 rounded-lg p-3">
            <div className="text-xs uppercase tracking-widest font-bold text-[#00B4FF]">{t("payments.moovNum")}</div>
            <div className="font-heading font-bold text-lg">{CONTACTS.moov}</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div id="pay-form" className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="imora-label">{t("payments.type")}</label>
            <select data-testid="pay-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="imora-input">
              <option value="premium">Publication Premium</option>
              <option value="verification">Vérification accélérée</option>
              <option value="agency_subscription">Abonnement agence</option>
              <option value="boost">Mise en avant</option>
            </select>
          </div>
          <div>
            <label className="imora-label">{t("payments.amount")}</label>
            <input data-testid="pay-amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="imora-input" />
          </div>
        </div>
        <div>
          <label className="imora-label">{t("payments.method")}</label>
          <div className="grid grid-cols-2 gap-2">
            {["airtel", "moov"].map(m => (
              <button key={m} type="button" onClick={() => setForm({ ...form, method: m })} data-testid={`pay-method-${m}`} className={`border rounded-lg p-3 flex items-center justify-center gap-2 font-bold ${form.method === m ? "border-[#FF6B1A] bg-[#FF6B1A]/5 text-[#FF6B1A]" : "border-neutral-200"}`}>
                <CreditCard className="h-4 w-4" /> {m === "airtel" ? "Airtel Money" : "Moov Money"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="imora-label">{t("payments.transactionId")}</label>
          <input data-testid="pay-txn" value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} className="imora-input" placeholder="ID reçu par SMS" />
        </div>
        <div>
          <label className="imora-label">{t("payments.payerPhone")}</label>
          <input data-testid="pay-phone" value={form.payer_phone} onChange={(e) => setForm({ ...form, payer_phone: e.target.value })} className="imora-input" />
        </div>
        <div>
          <label className="imora-label">{t("payments.note")}</label>
          <textarea data-testid="pay-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="imora-input py-2 min-h-[60px]" />
        </div>
        <button onClick={submit} data-testid="pay-submit" className="imora-btn-primary w-full">{t("payments.submit")}</button>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading font-bold text-xl mb-3">{t("payments.history")}</h2>
          <div className="space-y-2">
            {history.map(p => (
              <div key={p.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-bold">{p.type} · {formatPrice(p.amount)}</div>
                  <div className="text-xs text-neutral-500">{p.method} · {p.transaction_id}</div>
                </div>
                <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${p.status === "confirmed" ? "bg-green-100 text-green-700" : p.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
