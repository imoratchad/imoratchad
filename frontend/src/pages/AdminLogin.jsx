import React, { useState } from "react";
import { api, LOGO_URL } from "../lib/api";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/admin-login", { email, password });
      if (data.session_token) localStorage.setItem("imora_token", data.session_token);
      window.location.href = "/admin";
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === "string" && d ? d : "Connexion impossible. Réessayez.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-10">
      <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <img src={LOGO_URL} alt="IMORA" className="h-14 w-14 mx-auto rounded-xl mb-3" />
          <div className="inline-flex items-center gap-2 bg-neutral-900 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
            <ShieldCheck size={14} /> ESPACE ADMINISTRATEUR
          </div>
          <h1 className="font-heading font-black text-2xl tracking-tighter">Connexion sécurisée</h1>
          <p className="text-sm text-neutral-500 mt-1">Réservé à l'administration IMORA Tchad</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-neutral-600 uppercase">E-mail administrateur</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="admin-email-input"
              placeholder="votre@gmail.com"
              className="mt-1 w-full h-12 px-4 border-2 border-neutral-200 rounded-lg focus:border-[#FF6B1A] focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-neutral-600 uppercase">Mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="admin-password-input"
                placeholder="Lettres + chiffres (8 min.)"
                className="w-full h-12 px-4 pr-12 border-2 border-neutral-200 rounded-lg focus:border-[#FF6B1A] focus:outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                data-testid="admin-password-toggle"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p data-testid="admin-login-error" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit"
            className="w-full h-12 bg-neutral-900 hover:bg-black text-white font-bold rounded-lg transition disabled:opacity-60"
          >
            {loading ? "Vérification…" : "Se connecter"}
          </button>
        </form>

        <p className="text-xs text-neutral-400 mt-4 text-center">
          Protégé contre les tentatives répétées (blocage 15 min après 5 échecs).
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
