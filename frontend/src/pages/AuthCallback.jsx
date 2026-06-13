import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

// Handles redirect from Emergent Auth: /#session_id=...
const AuthCallback = () => {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { navigate("/login"); return; }
    const session_id = decodeURIComponent(m[1]);

    api.post("/auth/session", { session_id })
      .then(({ data }) => {
        if (data.session_token) localStorage.setItem("imora_token", data.session_token);
        const dest = data.user?.role === "admin" ? "/admin" : "/dashboard";
        // Clear hash and navigate
        window.history.replaceState(null, "", "/");
        navigate(dest, { state: { user: data.user } });
        // hard refresh to ensure auth context reads new cookie
        window.location.href = dest;
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="h-10 w-10 border-4 border-[#FF6B1A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-neutral-500">Connexion en cours…</p>
      </div>
    </div>
  );
};

export default AuthCallback;
