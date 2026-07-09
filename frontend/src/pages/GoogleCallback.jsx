import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

// Direct Google OAuth callback: /auth/google?code=...&state=...
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
const GoogleCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    if (err) {
      setError("Connexion Google annulée ou refusée.");
      setTimeout(() => navigate("/login"), 2500);
      return;
    }
    if (!code) {
      navigate("/login");
      return;
    }

    // CSRF protection: state must match the one we stored before redirect
    const expectedState = sessionStorage.getItem("imora_oauth_state");
    if (!expectedState || state !== expectedState) {
      setError("Erreur de sécurité (state mismatch). Réessayez.");
      setTimeout(() => navigate("/login"), 2500);
      return;
    }
    sessionStorage.removeItem("imora_oauth_state");

    const redirect_uri = window.location.origin + "/auth/google";
    api
      .post("/auth/google", { code, redirect_uri })
      .then(({ data }) => {
        if (data.session_token) localStorage.setItem("imora_token", data.session_token);
        const dest = data.user?.role === "admin" ? "/admin" : "/dashboard";
        window.history.replaceState(null, "", "/");
        window.location.href = dest;
      })
      .catch((e) => {
        const d = e.response?.data?.detail;
        const msg =
          typeof d === "string" && d
            ? d
            : e.response
            ? `Erreur serveur (${e.response.status}). Réessayez dans un instant.`
            : "Erreur réseau — impossible de joindre le serveur.";
        setError(msg);
        setTimeout(() => navigate("/login"), 8000);
      });
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        {!error ? (
          <>
            <div className="h-10 w-10 border-4 border-[#FF6B1A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-neutral-500">Connexion à IMORA Tchad en cours…</p>
          </>
        ) : (
          <>
            <div className="text-red-600 font-heading font-bold text-lg mb-2">Oups</div>
            <p className="text-sm text-neutral-600">{error}</p>
            <p className="text-xs text-neutral-400 mt-3">Redirection…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback;
