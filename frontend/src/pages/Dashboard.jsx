import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home as HomeIcon, Heart, Eye, Trash2, Phone, BarChart3, Bell } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPrice, findLabelByValue } from "../lib/constants";
import ProfileEditor from "../components/ProfileEditor";

const COLORS = ["#FF6B1A", "#00B4FF", "#0A0A0A", "#FECB00", "#22C55E", "#EF4444"];

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [favs, setFavs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get(`/properties?user_id=${user.user_id}&status=`).then(({ data }) => setMine(data));
    api.get("/favorites").then(({ data }) => setFavs(data));
    api.get("/notifications/mine").then(({ data }) => setNotifications(data));
    if (user.role === "agence" || user.role === "promoteur") {
      api.get("/agency/analytics").then(({ data }) => setAnalytics(data));
    }
  }, [user]);

  if (!user) return <div className="max-w-md mx-auto p-8 text-center"><Link to="/login" className="imora-btn-primary inline-flex">{t("nav.login")}</Link></div>;

  const totalViews = mine.reduce((s, p) => s + (p.views || 0), 0);
  const totalContacts = mine.reduce((s, p) => s + (p.contact_count || 0), 0);

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette annonce ?")) return;
    await api.delete(`/properties/${id}`);
    setMine(mine.filter(p => p.id !== id));
    toast.success("Annonce supprimée");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-14 w-14 rounded-full bg-[#FF6B1A] text-white flex items-center justify-center font-heading font-extrabold text-xl">{user.name?.[0] || "U"}</div>
        <div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tighter">{user.name}</h1>
          <p className="text-sm text-neutral-500">{user.email} · <span className="uppercase font-bold text-[#FF6B1A]">{user.role}</span></p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label={t("dashboard.mine")} value={mine.length} icon={HomeIcon} color="#FF6B1A" />
        <Stat label={t("dashboard.views")} value={totalViews} icon={Eye} color="#00B4FF" />
        <Stat label={t("dashboard.contacts")} value={totalContacts} icon={Phone} color="#FF6B1A" />
        <Stat label={t("dashboard.favorites")} value={favs.length} icon={Heart} color="#00B4FF" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {[
          { v: "mine", l: t("dashboard.mine") },
          ...(user.role === "agence" || user.role === "promoteur" ? [{ v: "analytics", l: "Analytics" }] : []),
          { v: "favs", l: t("dashboard.favorites") },
          { v: "notifs", l: "Notifications" + (notifications.filter(n => !n.read).length ? ` (${notifications.filter(n => !n.read).length})` : "") },
          { v: "profile", l: t("dashboard.profile") },
        ].map(tt => (
          <button key={tt.v} onClick={() => setTab(tt.v)} data-testid={`tab-${tt.v}`} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${tab === tt.v ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>{tt.l}</button>
        ))}
      </div>

      {tab === "mine" && (
        <div className="space-y-2">
          {mine.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500">{t("dashboard.noMine")}</div>
          ) : (
            <>
              {/* Banner if user has pending or rejected ads */}
              {mine.filter(p => p.status === "pending").length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⏳</div>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-amber-900">
                        {mine.filter(p => p.status === "pending").length} annonce(s) en cours de validation
                      </p>
                      <p className="text-sm text-amber-800">Notre équipe vérifie vos annonces (photos, prix, documents). Validation sous 24h en moyenne. Vous serez notifié dès qu'elles sont publiées.</p>
                    </div>
                  </div>
                </div>
              )}
              {mine.filter(p => p.status === "rejected").length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚠️</div>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-red-900">
                        {mine.filter(p => p.status === "rejected").length} annonce(s) rejetée(s)
                      </p>
                      <p className="text-sm text-red-800">Consultez la raison ci-dessous et modifiez l'annonce avant de la re-soumettre.</p>
                    </div>
                  </div>
                </div>
              )}
              {mine.map((p) => (
                <div key={p.id} className="bg-white border border-neutral-200 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <img src={p.photos?.[0] || "https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=200"} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/property/${p.id}`} className="font-heading font-bold line-clamp-1">{p.title}</Link>
                      <div className="text-xs text-neutral-500">{findLabelByValue(p.transaction_type)} · {formatPrice(p.price)}</div>
                      <div className="text-xs flex items-center gap-3 mt-0.5">
                        <span className="text-neutral-500"><Eye className="h-3 w-3 inline" /> {p.views || 0}</span>
                        <StatusBadge status={p.status} />
                        {p.verified && <span className="text-[#00B4FF] font-bold">✓ Vérifié</span>}
                      </div>
                    </div>
                    <button onClick={() => remove(p.id)} data-testid={`delete-${p.id}`} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {p.status === "rejected" && p.rejection_reason && (
                    <div className="mt-3 bg-red-50 border-l-4 border-red-400 p-3 rounded">
                      <div className="text-xs font-bold uppercase tracking-widest text-red-700 mb-1">Raison du rejet</div>
                      <p className="text-sm text-red-900">{p.rejection_reason}</p>
                      <p className="text-xs text-neutral-600 mt-2">💡 Modifiez votre annonce et soumettez à nouveau pour qu'elle soit re-validée.</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "favs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favs.length === 0 ? <div className="col-span-full bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500">—</div>
            : favs.map(p => (
              <Link key={p.id} to={`/property/${p.id}`} className="imora-card">
                <img src={p.photos?.[0]} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="p-3"><div className="font-heading font-bold">{p.title}</div><div className="text-sm text-[#FF6B1A] font-bold">{formatPrice(p.price)}</div></div>
              </Link>
            ))}
        </div>
      )}

      {tab === "analytics" && analytics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Annonces totales" value={analytics.total} icon={HomeIcon} color="#FF6B1A" />
            <Stat label="Vendues" value={analytics.sold} icon={HomeIcon} color="#22C55E" />
            <Stat label="Louées" value={analytics.rented} icon={HomeIcon} color="#00B4FF" />
            <Stat label="Vérifiées" value={analytics.verified} icon={HomeIcon} color="#FECB00" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Annonces publiées par mois">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={analytics.by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#FF6B1A" strokeWidth={3} dot={{ fill: "#FF6B1A", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Répartition par type">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analytics.by_type} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                    {analytics.by_type.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Top 5 — Vues">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.top_views} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#666" fontSize={11} />
                  <YAxis type="category" dataKey="title" stroke="#666" fontSize={10} width={120} tickFormatter={(v) => v.length > 16 ? v.substring(0, 16) + "…" : v} />
                  <Tooltip />
                  <Bar dataKey="views" fill="#00B4FF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Top 5 — Contacts">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.top_contacts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#666" fontSize={11} />
                  <YAxis type="category" dataKey="title" stroke="#666" fontSize={10} width={120} tickFormatter={(v) => v.length > 16 ? v.substring(0, 16) + "…" : v} />
                  <Tooltip />
                  <Bar dataKey="contacts" fill="#FF6B1A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}

      {tab === "notifs" && (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500">Aucune notification</div>
          ) : notifications.map((n) => (
            <div key={n.id} data-testid={`notif-${n.id}`} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${n.read ? "border-neutral-200" : "border-[#FF6B1A] bg-[#FF6B1A]/5"}`}>
              <div className="p-2 rounded-lg" style={{ background: n.read ? "#f5f5f5" : "#FF6B1A1A" }}><Bell className="h-4 w-4" style={{ color: n.read ? "#999" : "#FF6B1A" }} /></div>
              <div className="flex-1">
                <div className="font-heading font-bold">{n.title}</div>
                <p className="text-sm text-neutral-700">{n.message}</p>
                <div className="text-xs text-neutral-400 mt-1">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
              </div>
              {!n.read && (
                <button onClick={async () => { await api.post(`/notifications/${n.id}/read`); setNotifications(notifications.map(x => x.id === n.id ? { ...x, read: true } : x)); }} data-testid={`mark-read-${n.id}`} className="text-xs text-[#00B4FF] font-bold">Marquer lu</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "profile" && <ProfileEditor />}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    active: { l: "✓ En ligne", c: "bg-green-100 text-green-700" },
    pending: { l: "⏳ En attente de validation", c: "bg-amber-100 text-amber-700" },
    rejected: { l: "✕ Rejetée", c: "bg-red-100 text-red-700" },
    sold: { l: "🏠 Vendue", c: "bg-[#FF6B1A]/10 text-[#FF6B1A]" },
    rented: { l: "🔑 Louée", c: "bg-[#00B4FF]/10 text-[#00B4FF]" },
  };
  const m = map[status] || { l: status, c: "bg-neutral-100 text-neutral-700" };
  return <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${m.c}`}>{m.l}</span>;
};

const ChartCard = ({ title, children }) => (
  <div className="bg-white border border-neutral-200 rounded-xl p-4">
    <h3 className="font-heading font-bold text-sm uppercase tracking-widest text-neutral-500 mb-3">{title}</h3>
    {children}
  </div>
);

const Stat = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white border border-neutral-200 rounded-xl p-4">
    <div className="flex items-center justify-between">
      <div className="text-xs uppercase tracking-wider font-bold text-neutral-500">{label}</div>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <div className="font-heading font-black text-2xl mt-1" style={{ color }}>{value}</div>
  </div>
);

export default Dashboard;
