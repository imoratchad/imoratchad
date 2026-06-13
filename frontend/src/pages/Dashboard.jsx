import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home as HomeIcon, Heart, MessageCircle, Eye, Trash2, Edit, Phone, User, Save } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ROLES, formatPrice, findLabelByValue } from "../lib/constants";

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [favs, setFavs] = useState([]);
  const [profile, setProfile] = useState({ role: user?.role || "particulier", phone: user?.phone || "", whatsapp: user?.whatsapp || "", agency_name: user?.agency_name || "" });

  useEffect(() => {
    if (!user) return;
    api.get(`/properties?user_id=${user.user_id}&status=`).then(({ data }) => setMine(data));
    api.get("/favorites").then(({ data }) => setFavs(data));
  }, [user]);

  if (!user) return <div className="max-w-md mx-auto p-8 text-center"><Link to="/login" className="imora-btn-primary inline-flex">{t("nav.login")}</Link></div>;

  const totalViews = mine.reduce((s, p) => s + (p.views || 0), 0);
  const totalContacts = mine.reduce((s, p) => s + (p.contact_count || 0), 0);

  const saveProfile = async () => {
    try {
      await api.put("/auth/profile", profile);
      await refresh();
      toast.success("Profil mis à jour");
    } catch (e) { toast.error(t("common.error")); }
  };

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
          { v: "favs", l: t("dashboard.favorites") },
          { v: "profile", l: t("dashboard.profile") },
        ].map(tt => (
          <button key={tt.v} onClick={() => setTab(tt.v)} data-testid={`tab-${tt.v}`} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${tab === tt.v ? "bg-[#0A0A0A] text-white" : "bg-white border border-neutral-200"}`}>{tt.l}</button>
        ))}
      </div>

      {tab === "mine" && (
        <div className="space-y-2">
          {mine.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center text-neutral-500">{t("dashboard.noMine")}</div>
          ) : mine.map((p) => (
            <div key={p.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
              <img src={p.photos?.[0] || "https://images.unsplash.com/photo-1706164971302-e30c0640cc3b?w=200"} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <Link to={`/property/${p.id}`} className="font-heading font-bold line-clamp-1">{p.title}</Link>
                <div className="text-xs text-neutral-500">{findLabelByValue(p.transaction_type)} · {formatPrice(p.price)}</div>
                <div className="text-xs flex items-center gap-3 mt-0.5">
                  <span className="text-neutral-500"><Eye className="h-3 w-3 inline" /> {p.views || 0}</span>
                  <span className={`font-bold ${p.status === "active" ? "text-green-600" : p.status === "pending" ? "text-amber-600" : "text-neutral-500"}`}>{p.status}</span>
                  {p.verified && <span className="text-[#00B4FF] font-bold">✓ Vérifié</span>}
                </div>
              </div>
              <button onClick={() => remove(p.id)} data-testid={`delete-${p.id}`} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
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

      {tab === "profile" && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 max-w-xl space-y-4">
          <div>
            <label className="imora-label">{t("dashboard.role")}</label>
            <select data-testid="profile-role" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} className="imora-input">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div><label className="imora-label">Téléphone</label><input data-testid="profile-phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="imora-input" /></div>
          <div><label className="imora-label">WhatsApp</label><input data-testid="profile-whatsapp" value={profile.whatsapp} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} className="imora-input" /></div>
          {profile.role === "agence" && (
            <div><label className="imora-label">Nom de l'agence</label><input data-testid="profile-agency-name" value={profile.agency_name} onChange={(e) => setProfile({ ...profile, agency_name: e.target.value })} className="imora-input" /></div>
          )}
          <button onClick={saveProfile} data-testid="save-profile-btn" className="imora-btn-primary"><Save className="h-4 w-4" /> {t("dashboard.saveProfile")}</button>
        </div>
      )}
    </div>
  );
};

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
