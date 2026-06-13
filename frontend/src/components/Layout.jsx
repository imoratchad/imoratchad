import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home as HomeIcon, Search, Map, PlusCircle, User, MessageCircle, Globe, LogOut, ShieldCheck, Phone, CreditCard, Star, Bell, Trophy } from "lucide-react";
import { LOGO_URL, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { setLanguage } from "../lib/i18n";
import AIAssistant from "./AIAssistant";

const ChadFlag = () => (
  <div className="imora-chad-stripe" data-testid="chad-flag-stripe" aria-hidden="true">
    <div className="bg-chad-blue" />
    <div className="bg-chad-yellow" />
    <div className="bg-chad-red" />
  </div>
);

const LangSwitcher = () => {
  const { i18n } = useTranslation();
  return (
    <div className="flex items-center gap-1 text-xs" data-testid="lang-switcher">
      {["fr", "en", "ar"].map((l) => (
        <button
          key={l}
          onClick={() => setLanguage(l)}
          data-testid={`lang-${l}`}
          className={`px-2 py-1 rounded font-bold uppercase tracking-widest transition ${i18n.language === l ? "bg-white text-black" : "text-white/70 hover:text-white"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
};

const NotifBell = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => {
      api.get("/notifications/mine").then(({ data }) => setCount(data.filter(n => !n.read).length)).catch(() => {});
    };
    fetchUnread();
    const i = setInterval(fetchUnread, 30000);
    return () => clearInterval(i);
  }, [user]);
  if (!user) return null;
  return (
    <Link to={user.role === "admin" ? "/admin" : "/dashboard"} data-testid="notif-bell" className="relative p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Notifications">
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#FF6B1A] text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center" data-testid="notif-bell-count">{count > 9 ? "9+" : count}</span>
      )}
    </Link>
  );
};

const Header = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0A] text-white">
      <ChadFlag />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" data-testid="logo-link" className="flex items-center gap-2">
          <img src={LOGO_URL} alt="IMORA" className="h-10 w-10 rounded-md object-cover" />
          <div className="hidden sm:block leading-tight">
            <div className="font-heading font-extrabold text-lg tracking-tight">IMORA</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">Tchad</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
          <NavLink to="/" data-testid="nav-home" className={({isActive}) => isActive ? "text-[#FF6B1A]" : "text-white/80 hover:text-white"}>{t("nav.home")}</NavLink>
          <NavLink to="/search" data-testid="nav-search" className={({isActive}) => isActive ? "text-[#FF6B1A]" : "text-white/80 hover:text-white"}>{t("nav.search")}</NavLink>
          <NavLink to="/map" data-testid="nav-map" className={({isActive}) => isActive ? "text-[#FF6B1A]" : "text-white/80 hover:text-white"}>{t("nav.map")}</NavLink>
          <NavLink to="/archives" data-testid="nav-archives" className={({isActive}) => isActive ? "text-[#FF6B1A]" : "text-white/80 hover:text-white"}>Vendus & Loués</NavLink>
          <NavLink to="/publish" data-testid="nav-publish" className={({isActive}) => isActive ? "text-[#FF6B1A]" : "text-white/80 hover:text-white"}>{t("nav.publish")}</NavLink>
          <NavLink to="/contact" data-testid="nav-contact" className={({isActive}) => isActive ? "text-[#FF6B1A]" : "text-white/80 hover:text-white"}>{t("nav.contact")}</NavLink>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitcher />
          <NotifBell />
          {user ? (
            <div className="flex items-center gap-2">
              <Link to={user.role === "admin" ? "/admin" : "/dashboard"} data-testid="nav-dashboard" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
                <User className="h-4 w-4" />
                <span>{user.name?.split(" ")[0] || "Compte"}</span>
              </Link>
              <button onClick={logout} data-testid="logout-btn" className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="logout">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" data-testid="nav-login" className="bg-[#FF6B1A] hover:bg-[#E65A10] active:scale-95 transition px-4 py-2 rounded-lg text-sm font-bold">
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

const BottomNav = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const items = [
    { to: "/", icon: HomeIcon, label: t("nav.home"), testid: "bottom-nav-home" },
    { to: "/search", icon: Search, label: t("nav.search"), testid: "bottom-nav-search" },
    { to: "/publish", icon: PlusCircle, label: t("nav.publish"), testid: "bottom-nav-publish", highlight: true },
    { to: "/archives", icon: Trophy, label: "Archives", testid: "bottom-nav-archives" },
    { to: user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/login", icon: User, label: user ? t("nav.profile") : t("nav.login"), testid: "bottom-nav-profile" },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200 pb-safe">
      <div className="flex items-stretch justify-around h-16">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} data-testid={it.testid} className={({isActive}) => `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${isActive ? "text-[#FF6B1A]" : "text-neutral-500"}`}>
            <div className={it.highlight ? "bg-[#FF6B1A] text-white rounded-full p-2 -mt-4 shadow-lg" : ""}>
              <it.icon className={it.highlight ? "h-5 w-5" : "h-5 w-5"} />
            </div>
            <span className="uppercase tracking-wide">{it.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-[#0A0A0A] text-white/70 mt-16">
      <ChadFlag />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src={LOGO_URL} alt="IMORA" className="h-10 w-10 rounded-md" />
            <div className="font-heading font-extrabold text-lg text-white">IMORA</div>
          </div>
          <p className="text-sm">{t("brand.trust")}</p>
        </div>
        <div>
          <h4 className="text-white font-heading font-bold mb-2 text-sm uppercase tracking-widest">{t("nav.contact")}</h4>
          <p className="text-sm">WhatsApp: +235 64 92 73 80</p>
          <p className="text-sm">WhatsApp: +235 92 26 84 75</p>
          <p className="text-sm">imoratchad@gmail.com</p>
        </div>
        <div>
          <h4 className="text-white font-heading font-bold mb-2 text-sm uppercase tracking-widest">Liens</h4>
          <ul className="text-sm space-y-1">
            <li><Link to="/search" className="hover:text-white">{t("nav.search")}</Link></li>
            <li><Link to="/archives" className="hover:text-white">Vendus & Loués</Link></li>
            <li><Link to="/publish" className="hover:text-white">{t("nav.publish")}</Link></li>
            <li><Link to="/payments" className="hover:text-white">{t("nav.payments")}</Link></li>
            <li><Link to="/feedback" className="hover:text-white">{t("nav.feedback")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-heading font-bold mb-2 text-sm uppercase tracking-widest">Réseaux</h4>
          <p className="text-sm">TikTok: imoratchad</p>
          <p className="text-sm">Instagram: IMORA</p>
          <p className="text-sm">Facebook: IMORA</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-xs text-center">© {new Date().getFullYear()} IMORA Tchad. {t("brand.slogan")}.</div>
    </footer>
  );
};

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
      <AIAssistant />
    </div>
  );
};

export default Layout;
