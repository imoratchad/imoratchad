import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Building2, Home as HomeIcon, ShieldCheck, CreditCard, Activity, BadgeCheck, Star, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPrice, findLabelByValue } from "../lib/constants";

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState("stats");
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [pending, setPending] = useState([]);
  const [payments, setPayments] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [rejectModal, setRejectModal] = useState(null); // property being rejected
  const [rejectReason, setRejectReason] = useState("");
  const [exporting, setExporting] = useState(null);

  const REJECT_TEMPLATES = [
    "Photos floues ou de mauvaise qualité — Veuillez télécharger des photos plus nettes.",
    "Prix incohérent avec le marché du quartier — Merci de vérifier votre tarif.",
    "Documents manquants ou illisibles — Joignez le titre foncier ou l'arrêté d'attribution.",
    "Description trop courte ou imprécise — Détaillez les caractéristiques du bien.",
    "Localisation incorrecte ou manquante — Précisez le quartier et l'adresse.",
    "Contenu inapproprié ou suspect — Annonce non conforme à notre charte.",
  ];

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    refresh();
  }, [user]);

  const refresh = async () => {
    try {
      const [s, u, p, pen, pay, fb] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/properties?status=&limit=200"),
        api.get("/admin/properties/pending"),
        api.get("/admin/payments"),
        api.get("/admin/feedback"),
      ]);
      setStats(s.data); setUsers(u.data); setProperties(p.data); setPending(pen.data); setPayments(pay.data); setFeedback(fb.data);
    } catch (e) { toast.error("Erreur de chargement"); }
  };

  if (!user || user.role !== "admin") {
    return <div className="max-w-md mx-auto p-8 text-center"><p className="text-neutral-500">Accès admin requis.</p></div>;
  }

  const approvePending = async (id, verified = false) => {
    const prop = pending.find(p => p.id === id);
    const { data } = await api.put(`/admin/properties/${id}/verify`, { verified, status: "active" });
    toast.success(`✓ "${prop?.title}" approuvée et publiée`, {
      action: data.whatsapp_url ? { label: "Notifier WhatsApp", onClick: () => openWhatsApp(data.whatsapp_url) } : undefined,
      duration: 8000,
    });
    refresh();
  };
  const rejectPending = (id) => {
    const prop = pending.find(p => p.id === id);
    setRejectModal(prop);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    const reason = rejectReason.trim();
    if (!reason) { toast.error("Veuillez indiquer une raison"); return; }
    const { data } = await api.put(`/admin/properties/${rejectModal.id}/verify`, { verified: false, status: "rejected", rejection_reason: reason });
    toast.success(`Annonce rejetée — raison communiquée`, {
      action: data.whatsapp_url ? { label: "Notifier WhatsApp", onClick: () => openWhatsApp(data.whatsapp_url) } : undefined,
      duration: 10000,
    });
    setRejectModal(null);
    setRejectReason("");
    refresh();
  };
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
  const editTags = async (id) => {
    const prop = properties.find(p => p.id === id);
    const current = (prop?.tags || []).join(", ");
    const input = window.prompt(
      `Tags pour "${prop?.title}" (séparés par des virgules, max 5) :\n\nSuggestions : Premium, Coup de cœur, Vendu en 1 semaine, Nouveau, Prix réduit, Exclusivité, À ne pas manquer`,
      current
    );
    if (input === null) return;
    const tags = input.split(",").map(t => t.trim()).filter(Boolean).slice(0, 5);
    await api.put(`/admin/properties/${id}/verify`, { verified: prop?.verified || false, tags });
    toast.success(`${tags.length} tag(s) enregistré(s)`);
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

  const downloadExport = async (resource, format) => {
    const key = `${resource}-${format}`;
    try {
      setExporting(key);
      const response = await api.get(`/admin/export/${resource}`, {
        params: { format },
        responseType: "blob",
      });
      const cd = response.headers["content-disposition"] || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      const ts = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const fallback = `imora_${resource}_${ts}.${format}`;
      const filename = match ? match[1] : fallback;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`✓ Export ${format.toUpperCase()} téléchargé — ${filename}`);
    } catch (e) {
      toast.error("Échec de l'export. Réessayez.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{t("admin.dashboard")}</h1>
          <p className="text-sm text-neutral-500">IMORA Tchad — Contrôle complet</p>
        </div>
        <Link to="/admin/monthly-report" data-testid="link-monthly-report" className="imora-btn-secondary !h-10 !px-4 text-sm">📊 Rapport mensuel</Link>
      </div>

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
          { v: "moderation", l: `🔥 Modération${pending.length ? ` (${pending.length})` : ""}` },
          { v: "properties", l: t("admin.properties") },
          { v: "users", l: t("admin.users") },
          { v: "payments", l: t("admin.payments") },
          { v: "feedback", l: t("admin.feedback") },
          { v: "export", l: "📥 Export" },
        ].map(tt => (
          <button key={tt.v} onClick={() => setTab(tt.v)} data-testid={`admin-tab-${tt.v}`} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${tab === tt.v ? "bg-[#0A0A0A] text-white" : tt.v === "moderation" && pending.length ? "bg-[#FF6B1A]/10 border border-[#FF6B1A] text-[#FF6B1A]" : "bg-white border border-neutral-200"}`}>{tt.l}</button>
        ))}
      </div>

      {tab === "stats" && (
        <div className="space-y-4">
          {pending.length > 0 && (
            <button onClick={() => setTab("moderation")} data-testid="moderation-alert" className="w-full bg-gradient-to-r from-[#FF6B1A] to-[#E65A10] text-white rounded-xl p-4 flex items-center justify-between hover:shadow-lg transition">
              <div className="flex items-center gap-3 text-left">
                <div className="bg-white/20 rounded-full p-2 text-2xl">🔥</div>
                <div>
                  <div className="font-heading font-black text-xl">{pending.length} annonce{pending.length > 1 ? "s" : ""} à modérer</div>
                  <div className="text-sm text-white/80">Validez ou rejetez en un clic — protégez la plateforme du spam</div>
                </div>
              </div>
              <span className="font-bold">→</span>
            </button>
          )}
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Info label="Annonces en attente" value={pending.length} />
              <Info label="Paiements en attente" value={stats.pending_payments || 0} />
              <Info label="Revenus confirmés" value={formatPrice(stats.revenue || 0)} />
            </div>
          </div>
        </div>
      )}

      {tab === "moderation" && (
        <div className="space-y-3" data-testid="moderation-panel">
          {pending.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
              <div className="text-5xl mb-2">✅</div>
              <p className="font-heading font-bold text-lg">Aucune annonce en attente</p>
              <p className="text-sm text-neutral-500">Tout est à jour — bon travail !</p>
            </div>
          ) : (
            <>
              <div className="bg-[#FF6B1A]/5 border border-[#FF6B1A]/30 rounded-lg p-3 text-sm">
                💡 <b>{pending.length}</b> annonce{pending.length > 1 ? "s" : ""} à modérer. Vérifiez photos, prix, localisation et documents avant approbation.
              </div>
              {pending.map(p => (
                <div key={p.id} data-testid={`moderation-${p.id}`} className="bg-white border-2 border-amber-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-4 p-4">
                    {/* Photos preview */}
                    <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                      {(p.photos || []).slice(0, 3).map((ph, i) => (
                        <img key={i} src={ph} alt="" className="h-20 w-20 md:w-full md:h-20 rounded-lg object-cover shrink-0" />
                      ))}
                      {(!p.photos || p.photos.length === 0) && <div className="h-20 w-full bg-neutral-100 rounded-lg flex items-center justify-center text-xs text-neutral-400">Pas de photo</div>}
                    </div>
                    {/* Info */}
                    <div className="min-w-0">
                      <Link to={`/property/${p.id}`} target="_blank" className="font-heading font-bold text-lg hover:text-[#FF6B1A]">{p.title}</Link>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {findLabelByValue(p.property_type)} · {findLabelByValue(p.transaction_type)} · {p.neighborhood}, {p.city}
                      </div>
                      <div className="text-[#FF6B1A] font-heading font-black text-xl mt-1">{formatPrice(p.price)} {p.negotiable && <span className="text-xs text-neutral-500 font-bold uppercase">négociable</span>}</div>
                      <p className="text-sm text-neutral-700 mt-2 line-clamp-2">{p.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 mt-2">
                        <span>👤 {p.owner?.name || p.contact_name}</span>
                        <span>📞 {p.contact_phone}</span>
                        <span>📅 Soumise il y a {Math.max(0, Math.round((Date.now() - new Date(p.created_at).getTime()) / 3600000))}h</span>
                        {p.documents?.length > 0 && <span>📎 {p.documents.length} doc(s)</span>}
                        {p.photos?.length > 0 && <span>📷 {p.photos.length} photo(s)</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex md:flex-col gap-2">
                      <button onClick={() => approvePending(p.id, true)} data-testid={`approve-verified-${p.id}`} className="bg-[#00B4FF] hover:bg-[#0099D9] text-white font-bold h-11 px-4 rounded-lg whitespace-nowrap text-sm flex items-center justify-center gap-1" title="Approuver et marquer Vérifié">
                        <BadgeCheck className="h-4 w-4" /> Approuver + Vérifier
                      </button>
                      <button onClick={() => approvePending(p.id, false)} data-testid={`approve-${p.id}`} className="bg-green-600 hover:bg-green-700 text-white font-bold h-11 px-4 rounded-lg whitespace-nowrap text-sm flex items-center justify-center gap-1">
                        ✓ Approuver
                      </button>
                      <button onClick={() => rejectPending(p.id)} data-testid={`reject-${p.id}`} className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-4 rounded-lg whitespace-nowrap text-sm flex items-center justify-center gap-1">
                        ✕ Rejeter
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "stats_old_block_remove" && false && (
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
              <button onClick={() => editTags(p.id)} data-testid={`tag-${p.id}`} className={`text-xs font-bold px-3 py-1.5 rounded-full ${p.tags?.length ? "bg-[#FF6B1A] text-white" : "bg-neutral-100"}`} title={p.tags?.join(", ")}>🏷️ {p.tags?.length || 0}</button>
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
        <div className="space-y-6" data-testid="users-panel">
          {[
            { key: "agence", label: "Agences immobilières", color: "#00B4FF", icon: "🏢" },
            { key: "demarcheur", label: "Démarcheurs", color: "#FF6B1A", icon: "🤝" },
            { key: "promoteur", label: "Promoteurs immobiliers", color: "#FECB00", icon: "🏗️" },
            { key: "particulier", label: "Propriétaires (particuliers)", color: "#22C55E", icon: "👤" },
            { key: "admin", label: "Administrateurs", color: "#0A0A0A", icon: "🛡️" },
          ].map(group => {
            const list = users.filter(u => (u.role || "particulier") === group.key);
            if (list.length === 0) return null;
            return (
              <div key={group.key} data-testid={`user-group-${group.key}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-2xl">{group.icon}</div>
                  <h3 className="font-heading font-black text-xl tracking-tight" style={{ color: group.color }}>{group.label}</h3>
                  <span className="text-xs font-bold uppercase tracking-widest text-white px-2 py-0.5 rounded-full" style={{ background: group.color }}>{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map(u => (
                    <div key={u.user_id} className="bg-white border border-neutral-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        {u.picture ? (
                          <img src={u.picture} alt={u.name} className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-12 w-12 rounded-full text-white flex items-center justify-center font-bold text-lg" style={{ background: group.color }}>{u.name?.[0] || "?"}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <div className="font-heading font-bold text-base">{u.name || "(Sans nom)"}</div>
                            {u.suspended && <span className="text-[10px] uppercase font-bold tracking-widest bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspendu</span>}
                            {u.verified_agency && <span className="text-[10px] uppercase font-bold tracking-widest bg-[#00B4FF] text-white px-2 py-0.5 rounded-full">✓ Vérifiée</span>}
                          </div>
                          <div className="text-sm text-neutral-700 mt-0.5 break-all">📧 {u.email}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-neutral-600 mt-1">
                            {u.phone && <div>📞 {u.phone}</div>}
                            {u.whatsapp && <div>💬 WhatsApp : {u.whatsapp}</div>}
                            {u.agency_name && <div>🏢 {u.agency_name}</div>}
                            {u.created_at && <div>📅 Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</div>}
                            {u.last_login && <div>🕐 Dernière connexion : {new Date(u.last_login).toLocaleDateString("fr-FR")}</div>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <select value={u.role || "particulier"} onChange={(e) => updateUser(u.user_id, { role: e.target.value })} data-testid={`role-${u.user_id}`} className="text-xs border border-neutral-200 rounded px-2 py-1 bg-white">
                            <option value="particulier">Propriétaire</option>
                            <option value="agence">Agence</option>
                            <option value="demarcheur">Démarcheur</option>
                            <option value="promoteur">Promoteur</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={() => updateUser(u.user_id, { suspended: !u.suspended })} data-testid={`suspend-${u.user_id}`} className={`text-xs font-bold px-3 py-1 rounded-full ${u.suspended ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{u.suspended ? t("admin.unsuspend") : t("admin.suspend")}</button>
                          {u.role === "agence" && (
                            <button onClick={() => updateUser(u.user_id, { verified_agency: !u.verified_agency })} data-testid={`verify-agency-${u.user_id}`} className={`text-xs font-bold px-3 py-1 rounded-full ${u.verified_agency ? "bg-[#00B4FF] text-white" : "bg-neutral-100"}`}>✓ Vérifier</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500">Aucun utilisateur inscrit.</div>
          )}
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

      {tab === "export" && (
        <div className="space-y-4" data-testid="export-panel">
          <div className="bg-gradient-to-br from-[#0A0A0A] to-[#1a1a1a] text-white rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="bg-[#FF6B1A]/20 rounded-full p-3">
                <Download className="h-6 w-6 text-[#FF6B1A]" />
              </div>
              <div>
                <h2 className="font-heading font-black text-2xl tracking-tight">Exporter les données</h2>
                <p className="text-sm text-neutral-400 mt-1">
                  Téléchargez toutes les annonces immobilières et les utilisateurs au format <b>CSV</b> (compatible Excel, Google Sheets) ou <b>Excel (.xlsx)</b> natif pour analyse hors ligne, sauvegarde ou reporting.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Properties export */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5" data-testid="export-properties-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-[#FF6B1A]/10 text-[#FF6B1A] rounded-full p-2"><HomeIcon className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-heading font-black text-lg tracking-tight">Annonces immobilières</h3>
                  <p className="text-xs text-neutral-500">{properties.length} annonce(s) au total · titre, prix, statut, propriétaire, contact…</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => downloadExport("properties", "csv")}
                  disabled={exporting === "properties-csv"}
                  data-testid="export-properties-csv"
                  className="flex-1 bg-[#0A0A0A] hover:bg-neutral-800 disabled:opacity-50 text-white font-bold h-11 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {exporting === "properties-csv" ? "Export…" : "Télécharger CSV"}
                </button>
                <button
                  onClick={() => downloadExport("properties", "xlsx")}
                  disabled={exporting === "properties-xlsx"}
                  data-testid="export-properties-xlsx"
                  className="flex-1 bg-[#00B4FF] hover:bg-[#0099D9] disabled:opacity-50 text-white font-bold h-11 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting === "properties-xlsx" ? "Export…" : "Télécharger Excel"}
                </button>
              </div>
            </div>

            {/* Users export */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5" data-testid="export-users-card">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-[#00B4FF]/10 text-[#00B4FF] rounded-full p-2"><Users className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-heading font-black text-lg tracking-tight">Utilisateurs</h3>
                  <p className="text-xs text-neutral-500">{users.length} utilisateur(s) · nom, email, téléphone, rôle, agence, nb d&apos;annonces…</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => downloadExport("users", "csv")}
                  disabled={exporting === "users-csv"}
                  data-testid="export-users-csv"
                  className="flex-1 bg-[#0A0A0A] hover:bg-neutral-800 disabled:opacity-50 text-white font-bold h-11 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {exporting === "users-csv" ? "Export…" : "Télécharger CSV"}
                </button>
                <button
                  onClick={() => downloadExport("users", "xlsx")}
                  disabled={exporting === "users-xlsx"}
                  data-testid="export-users-xlsx"
                  className="flex-1 bg-[#FF6B1A] hover:bg-[#E65A10] disabled:opacity-50 text-white font-bold h-11 rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting === "users-xlsx" ? "Export…" : "Télécharger Excel"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <b>💡 Astuce :</b> Le format <b>CSV</b> utilise le point-virgule (<code>;</code>) comme séparateur et un BOM UTF-8 pour préserver les accents. Ouvrez-le directement dans Excel, LibreOffice Calc ou Google Sheets.
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRejectModal(null)} data-testid="reject-modal">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-red-100 text-red-600 rounded-full p-2 text-xl">✕</div>
              <div className="flex-1">
                <h3 className="font-heading font-black text-xl tracking-tight">Rejeter cette annonce</h3>
                <p className="text-sm text-neutral-500 mt-1 line-clamp-1">{rejectModal.title}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-700 mb-2 font-semibold">Choisissez un motif (cliquez pour pré-remplir) :</p>
            <div className="space-y-1.5 mb-3">
              {REJECT_TEMPLATES.map((tpl, i) => (
                <button key={i} onClick={() => setRejectReason(tpl)} data-testid={`reject-template-${i}`} className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition ${rejectReason === tpl ? "border-[#FF6B1A] bg-[#FF6B1A]/5" : "border-neutral-200 hover:border-neutral-900"}`}>
                  {tpl}
                </button>
              ))}
            </div>
            <label className="imora-label">Raison personnalisée (modifiable) :</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid="reject-reason-input"
              rows={3}
              className="imora-input py-2"
              placeholder="Expliquez clairement pourquoi cette annonce est rejetée…"
            />
            <p className="text-xs text-neutral-500 mt-2">Le motif sera envoyé au propriétaire via notification + bouton WhatsApp.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRejectModal(null)} data-testid="reject-cancel" className="imora-btn-outline flex-1">Annuler</button>
              <button onClick={confirmReject} data-testid="reject-confirm" disabled={!rejectReason.trim()} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold h-12 px-6 rounded-lg flex-1 flex items-center justify-center">
                ✕ Confirmer le rejet
              </button>
            </div>
          </div>
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
