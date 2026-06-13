import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Building2, Home as HomeIcon, ShieldCheck, CreditCard, Activity, BadgeCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPrice } from "../lib/constants";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState("stats");
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feedback, setFeedback] = useState([]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    refresh();
  }, [user]);

  const refresh = async () => {
    try {
      const [s, u, p, pay, fb] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/properties?status=&limit=200"),
        api.get("/admin/payments"),
        api.get("/admin/feedback"),
      ]);
      setStats(s.data); setUsers(u.data); setProperties(p.data); setPayments(pay.data); setFeedback(fb.data);
    } catch (e) { toast.error("Erreur de chargement"); }
  };

  if (!user || user.role !== "admin") {
    return <div className="max-w-md mx-auto p-8 text-center"><p className="text-neutral-500">Accès admin requis.</p></div>;
  }

  const openWhatsApp = (url) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const toggleVerified = async (id, verified) => {
    const { data } = await api.put(`/admin/properties/${id}/verify`, { verified });
    toast.success(verified ? "Bien vérifié ✓" : "Vérification retirée", {
      action: verified && data.whatsapp_url ? { label: "Notifier WhatsApp", onClick: () => openWhatsApp(data.whatsapp_url) } : undefined,
      duration: 8000,
    });
    refresh();
  };
  const toggleFeatured = async (id, featured) => {
    await api.put(`/admin/properties/${id}/verify`, { verified: properties.find(p => p.id === id)?.verified || false, featured });
    toast.success(featured ? "Mis en avant" : "Retiré");
    refresh();
  };
  const setStatus = async (id, status) => {
    const prop = properties.find(p => p.id === id);
    let payload = { verified: prop?.verified || false, status };
    // Prompt for testimonial when marking sold/rented
    if ((status === "sold" || status === "rented") && !prop?.testimonial) {
      const testimonial = window.prompt(`Témoignage client (optionnel) pour "${prop?.title}" :`);
      if (testimonial && testimonial.trim()) {
        const author = window.prompt("Nom du témoin (optionnel) :") || "";
        payload.testimonial = testimonial.trim();
        payload.testimonial_author = author.trim();
      }
    }
    const { data } = await api.put(`/admin/properties/${id}/verify`, payload);
    toast.success("Statut mis à jour", {
      action: data.whatsapp_url ? { label: "Notifier WhatsApp", onClick: () => openWhatsApp(data.whatsapp_url) } : undefined,
      duration: 8000,
    });
    refresh();
  };
  const updateUser = async (uid, patch) => {
    await api.put(`/admin/users/${uid}`, patch);
    toast.success("Utilisateur mis à jour"); refresh();
  };
  const updatePayment = async (pid, status) => {
    const { data } = await api.put(`/admin/payments/${pid}`, { status });
    toast.success(`Paiement ${status}`, {
      action: data.whatsapp_url ? { label: "Notifier WhatsApp", onClick: () => openWhatsApp(data.whatsapp_url) } : undefined,
      duration: 8000,
    });
    refresh();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter mb-1">{t("admin.dashboard")}</h1>
      <p className="text-sm text-neutral-500 mb-6">IMORA Tchad — Contrôle complet</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={Users} color="#FF6B1A" label={t("admin.totalUsers")} value={stats.total_users || 0} />
        <StatCard icon={Building2} color="#00B4FF" label={t("admin.totalAgencies")} value={stats.total_agencies || 0} />
        <StatCard icon={HomeIcon} color="#FF6B1A" label={t("admin.totalProperties")} value={stats.total_properties || 0} />
        <StatCard icon={ShieldCheck} color="#00B4FF" label={t("admin.verifiedProperties")} value={stats.verified_properties || 0} />
        <StatCard icon={Activity} color="#FF6B1A" label={t("admin.activeSessions")} value={stats.active_sessions || 0} />
        <StatCard icon={CreditCard} color="#00B4FF" label={t("admin.revenue")} value={formatPrice(stats.revenue || 0)} small />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {[
          { v: "stats", l: t("admin.stats") },
          { v: "properties", l: t("admin.properties") },
          { v: "users", l: t("admin.users") },
          { v: "payments", l: t("admin.payments") },
          { v: "feedback", l: t("admin.feedback") },
        ].map(tt => (
          <button key={tt.v} onClick={() => setTab(tt.v)} data-testid={`admin-tab-${tt.v}`} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${tab === tt.v ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>{tt.l}</button>
        ))}
      </div>

      {tab === "stats" && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Info label="Annonces en attente" value={stats.pending_properties || 0} />
            <Info label="Paiements en attente" value={stats.pending_payments || 0} />
            <Info label="Revenus confirmés" value={formatPrice(stats.revenue || 0)} />
          </div>
        </div>
      )}

      {tab === "properties" && (
        <div className="space-y-2">
          {properties.map(p => (
            <div key={p.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
              <img src={p.photos?.[0] || "https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=200"} alt="" className="h-14 w-14 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <Link to={`/property/${p.id}`} className="font-bold line-clamp-1">{p.title}</Link>
                <div className="text-xs text-neutral-500">{p.neighborhood}, {p.city} · {formatPrice(p.price)} · {p.status} {p.verified && "· ✓"}</div>
              </div>
              <button onClick={() => toggleVerified(p.id, !p.verified)} data-testid={`verify-${p.id}`} className={`text-xs font-bold px-3 py-1.5 rounded-full ${p.verified ? "bg-[#00B4FF] text-white" : "bg-neutral-100"}`}><BadgeCheck className="h-3 w-3 inline" /> {p.verified ? t("admin.unverify") : t("admin.verify")}</button>
              <button onClick={() => toggleFeatured(p.id, !p.featured)} data-testid={`feature-${p.id}`} className={`text-xs font-bold px-3 py-1.5 rounded-full ${p.featured ? "bg-[#FF6B1A] text-white" : "bg-neutral-100"}`}><Star className="h-3 w-3 inline" /></button>
              <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)} data-testid={`status-${p.id}`} className="text-xs border border-neutral-200 rounded px-2 py-1">
                <option value="active">active</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
                <option value="sold">sold</option>
                <option value="rented">rented</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.user_id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#FF6B1A] text-white flex items-center justify-center font-bold">{u.name?.[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold line-clamp-1">{u.name}</div>
                <div className="text-xs text-neutral-500">{u.email} · {u.role} {u.suspended && "· 🚫"}</div>
              </div>
              <select value={u.role} onChange={(e) => updateUser(u.user_id, { role: e.target.value })} data-testid={`role-${u.user_id}`} className="text-xs border border-neutral-200 rounded px-2 py-1">
                <option>particulier</option><option>agence</option><option>promoteur</option><option>admin</option>
              </select>
              <button onClick={() => updateUser(u.user_id, { suspended: !u.suspended })} data-testid={`suspend-${u.user_id}`} className={`text-xs font-bold px-3 py-1.5 rounded-full ${u.suspended ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.suspended ? t("admin.unsuspend") : t("admin.suspend")}</button>
              {u.role === "agence" && (
                <button onClick={() => updateUser(u.user_id, { verified_agency: !u.verified_agency })} data-testid={`verify-agency-${u.user_id}`} className={`text-xs font-bold px-3 py-1.5 rounded-full ${u.verified_agency ? "bg-[#00B4FF] text-white" : "bg-neutral-100"}`}><BadgeCheck className="h-3 w-3 inline" /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-2">
          {payments.map(p => (
            <div key={p.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-bold">{p.type} · {formatPrice(p.amount)}</div>
                <div className="text-xs text-neutral-500">{p.method} · TXN: {p.transaction_id} · {p.payer_phone || "—"}</div>
              </div>
              <span className={`text-xs font-bold uppercase px-2 py-1 rounded ${p.status === "confirmed" ? "bg-green-100 text-green-700" : p.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span>
              {p.status === "pending" && (
                <>
                  <button onClick={() => updatePayment(p.id, "confirmed")} data-testid={`confirm-pay-${p.id}`} className="text-xs font-bold bg-green-500 text-white px-3 py-1.5 rounded-full">{t("admin.confirm")}</button>
                  <button onClick={() => updatePayment(p.id, "rejected")} data-testid={`reject-pay-${p.id}`} className="text-xs font-bold bg-red-500 text-white px-3 py-1.5 rounded-full">{t("admin.reject")}</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-2">
          {feedback.map(f => (
            <div key={f.id} className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold">{f.name} <span className="text-xs text-neutral-500 ml-1">({f.type})</span></div>
                <div className="flex">{Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-[#FF6B1A] text-[#FF6B1A]" />)}</div>
              </div>
              <p className="text-sm text-neutral-700">{f.message}</p>
              <div className="text-xs text-neutral-400 mt-1">{f.email || ""} {f.phone ? "· " + f.phone : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, color, label, value, small }) => (
  <div className="bg-white border border-neutral-200 rounded-xl p-3">
    <div className="flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">{label}</div>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <div className={`font-heading font-black ${small ? "text-base" : "text-2xl"} mt-1`} style={{ color }}>{value}</div>
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">{label}</div>
    <div className="font-heading font-black text-2xl mt-1">{value}</div>
  </div>
);

export default AdminDashboard;
