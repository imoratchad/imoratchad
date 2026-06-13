import React, { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Calendar, Trophy, Users, Home, ShieldCheck, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api, LOGO_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPrice } from "../lib/constants";

const MonthlyReport = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.get(`/admin/monthly-report?year=${year}&month=${month}`).then(({ data }) => setReport(data));
  }, [user, year, month]);

  if (!user || user.role !== "admin") {
    return <div className="max-w-md mx-auto p-8 text-center text-neutral-500">Accès admin requis.</div>;
  }
  if (!report) return <div className="max-w-md mx-auto p-8 text-center">Chargement…</div>;

  const downloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#0A0A0A" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `IMORA-Rapport-${report.year}-${String(report.month).padStart(2, "0")}.png`;
      a.click();
      toast.success("Image téléchargée !");
    } catch (e) { toast.error("Erreur de génération"); }
  };

  const monthOpts = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading font-black text-3xl tracking-tighter">Rapport mensuel</h1>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} data-testid="report-month" className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold">
            {monthOpts.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} data-testid="report-year" className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm font-bold">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={downloadImage} data-testid="report-download" className="imora-btn-primary !h-10 !px-4"><Download className="h-4 w-4" /> Télécharger PNG</button>
        </div>
      </div>
      <p className="text-sm text-neutral-500 mb-4">Téléchargez l'infographie pour la publier sur Facebook, Instagram ou TikTok.</p>

      {/* Card to capture */}
      <div ref={cardRef} className="bg-[#0A0A0A] text-white p-8 rounded-2xl relative overflow-hidden" style={{ aspectRatio: "1080/1080", maxWidth: 1080 }}>
        {/* Chad flag stripe */}
        <div className="absolute top-0 left-0 right-0 h-2 flex">
          <div className="flex-1 bg-chad-blue" />
          <div className="flex-1 bg-chad-yellow" />
          <div className="flex-1 bg-chad-red" />
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-5"><Trophy style={{ height: 400, width: 400 }} /></div>

        <div className="relative h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="IMORA" className="h-14 w-14 rounded-lg" crossOrigin="anonymous" />
              <div>
                <div className="font-heading font-extrabold text-2xl tracking-tight">IMORA Tchad</div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/60">La plateforme immobilière du futur</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-[#00B4FF]">Rapport mensuel</div>
              <div className="font-heading font-black text-2xl">{report.month_label} {report.year}</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#FF6B1A] to-[#E65A10] rounded-xl p-6 mb-4 text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-white/80 mb-1">Transactions du mois</div>
            <div className="font-heading font-black text-7xl leading-none">{report.sold_count + report.rented_count}</div>
            <div className="text-sm font-bold mt-2 opacity-90">{report.sold_count} vendus · {report.rented_count} loués</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Stat icon={Home} color="#00B4FF" label="Nouvelles annonces" value={report.new_listings} />
            <Stat icon={ShieldCheck} color="#FECB00" label="Annonces vérifiées" value={report.verified_count} />
            <Stat icon={Users} color="#FF6B1A" label="Nouveaux utilisateurs" value={report.new_users} />
            <Stat icon={Trophy} color="#FFFFFF" label="Nouvelles agences" value={report.new_agencies} />
          </div>

          {(report.sold_total_value > 0 || report.rented_total_value > 0) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/60 mb-2">Valeur transactée</div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[#FF6B1A]">Vendu</div>
                  <div className="font-heading font-black text-xl">{formatPrice(report.sold_total_value)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-[#00B4FF]">Loué</div>
                  <div className="font-heading font-black text-xl">{formatPrice(report.rented_total_value)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-white/60">WhatsApp +235 64 92 73 80</span>
            <span className="text-white/60">imoratchad.com</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon: Icon, color, label, value }) => (
  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
    <div className="flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-widest text-white/60">{label}</div>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <div className="font-heading font-black text-3xl mt-1" style={{ color }}>{value}</div>
  </div>
);

export default MonthlyReport;
