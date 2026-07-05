import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  User as UserIcon,
  Camera,
  Save,
  Phone,
  MessageCircle,
  Building2,
  Badge as BadgeIcon,
  ShieldCheck,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ROLES, findLabelByValue } from "../lib/constants";

// Compress avatar image to ≤ 300 KB WebP (or JPEG fallback) at 512×512
const compressAvatar = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        // Square-crop from center
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
        const mime = supportsWebp ? "image/webp" : "image/jpeg";
        const prefix = supportsWebp ? "data:image/webp;base64," : "data:image/jpeg;base64,";
        const estBytes = (s) => Math.ceil((s.length - prefix.length) * 0.75);
        let q = 0.82;
        let url = canvas.toDataURL(mime, q);
        while (estBytes(url) > 300 * 1024 && q > 0.4) {
          q -= 0.08;
          url = canvas.toDataURL(mime, q);
        }
        resolve(url);
      };
      img.onerror = () => reject(new Error("Image invalide"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Lecture échouée"));
    reader.readAsDataURL(file);
  });

const phoneOk = (v) => !v || /^[+]?[\d\s-]{7,}$/.test(v.trim());
const emailBadge = (role) => ROLES.find((r) => r.value === role)?.label || role;

const ProfileEditor = () => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    picture: "",
    role: "particulier",
    phone: "",
    whatsapp: "",
    agency_name: "",
    bio: "",
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      picture: user.picture || "",
      role: user.role === "admin" ? user.role : user.role || "particulier",
      phone: user.phone || "",
      whatsapp: user.whatsapp || "",
      agency_name: user.agency_name || "",
      bio: user.bio || "",
    });
    setDirty(false);
  }, [user]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Nom requis";
    else if (form.name.trim().length < 2) e.name = "Nom trop court";
    if (!phoneOk(form.phone)) e.phone = "Numéro invalide (ex. +235 64 92 73 80)";
    if (!phoneOk(form.whatsapp)) e.whatsapp = "Numéro invalide";
    if ((form.role === "agence" || form.role === "promoteur") && !form.agency_name?.trim()) {
      e.agency_name = "Le nom de l'agence / structure est requis pour ce rôle";
    }
    if (form.bio && form.bio.length > 500) e.bio = "Bio limitée à 500 caractères";
    setErrors(e);
    return e;
  };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Format non supporté (utilisez JPG ou PNG)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo trop lourde (max 8 MB)");
      return;
    }
    try {
      const dataUrl = await compressAvatar(file);
      set("picture", dataUrl);
      toast.success(`Photo optimisée (${Math.round((dataUrl.length * 0.75) / 1024)} KB)`);
    } catch (err) {
      toast.error("Impossible de traiter l'image");
    }
  };

  const save = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      toast.error("Vérifiez les champs en rouge");
      return;
    }
    setSaving(true);
    try {
      // Admin role must not be sent (backend rejects) — send a safe non-admin default when needed
      const payload = { ...form };
      if (user?.role === "admin") payload.role = "particulier"; // ignored by backend, avoids 422
      await api.put("/auth/profile", payload);
      await refresh();
      setDirty(false);
      toast.success("Profil enregistré ✓", { description: "Vos infos sont visibles par les acheteurs / locataires." });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const initial = (form.name || user.email || "U")[0].toUpperCase();
  const isPro = form.role === "agence" || form.role === "promoteur" || form.role === "demarcheur";
  const errCls = (k) => (errors[k] ? "imora-input !border-red-500 !border-2" : "imora-input");
  const lblCls = (k) => (errors[k] ? "imora-label !text-red-600" : "imora-label");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" data-testid="profile-editor">
      {/* Editor — 3 cols */}
      <div className="lg:col-span-3 space-y-4">
        {/* Avatar */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-5">
          <h3 className="font-heading font-black text-lg tracking-tight mb-3 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-[#FF6B1A]" /> Photo de profil
          </h3>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {form.picture ? (
                <img
                  src={form.picture}
                  alt="avatar"
                  data-testid="profile-avatar-preview"
                  className="h-20 w-20 rounded-full object-cover border-2 border-neutral-200"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-[#FF6B1A] text-white flex items-center justify-center font-heading font-black text-3xl">
                  {initial}
                </div>
              )}
              {form.picture && (
                <button
                  onClick={() => set("picture", "")}
                  data-testid="profile-avatar-remove"
                  className="absolute -top-1 -right-1 bg-white border-2 border-neutral-200 rounded-full p-1 hover:bg-red-50 hover:border-red-300"
                  aria-label="Retirer la photo"
                >
                  <X className="h-3 w-3 text-red-500" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFile}
                className="hidden"
                data-testid="profile-avatar-input"
              />
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="profile-avatar-btn"
                className="imora-btn-outline text-sm"
              >
                <Camera className="h-4 w-4" /> {form.picture ? "Changer" : "Uploader une photo"}
              </button>
              <p className="text-xs text-neutral-500 mt-2">
                Automatiquement recadrée en carré et compressée en WebP ≤ 300 KB.
              </p>
            </div>
          </div>
        </section>

        {/* Identity */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-heading font-black text-lg tracking-tight flex items-center gap-2">
            <BadgeIcon className="h-4 w-4 text-[#00B4FF]" /> Identité
          </h3>
          <div>
            <label className={lblCls("name")}>Nom complet *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              data-testid="profile-name"
              className={errCls("name")}
              maxLength={80}
              placeholder="Prénom Nom"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="imora-label flex items-center gap-1">
              <Mail className="h-3 w-3" /> Email (non modifiable)
            </label>
            <input value={user.email} disabled className="imora-input bg-neutral-50 text-neutral-500" />
          </div>
          <div>
            <label className="imora-label">Type de compte</label>
            {user.role === "admin" ? (
              <div className="imora-input bg-neutral-50 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#FF6B1A]" />
                <span className="font-bold">Administrateur</span>
                <span className="text-xs text-neutral-500 ml-auto">Rôle non modifiable</span>
              </div>
            ) : (
              <select
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                data-testid="profile-role"
                className="imora-input"
              >
                {ROLES.filter((r) => r.value !== "admin").map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-heading font-black text-lg tracking-tight flex items-center gap-2">
            <Phone className="h-4 w-4 text-[#FF6B1A]" /> Contact
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lblCls("phone")}>Téléphone</label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                data-testid="profile-phone"
                className={errCls("phone")}
                placeholder="+235 64 92 73 80"
              />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className={lblCls("whatsapp")}>
                <MessageCircle className="h-3 w-3 inline mr-1" />
                WhatsApp
              </label>
              <input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                data-testid="profile-whatsapp"
                className={errCls("whatsapp")}
                placeholder="+235 64 92 73 80"
              />
              {errors.whatsapp && <p className="text-xs text-red-600 mt-1">{errors.whatsapp}</p>}
            </div>
          </div>
        </section>

        {/* Pro-only fields */}
        {isPro && (
          <section className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-heading font-black text-lg tracking-tight flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#00B4FF]" /> Informations professionnelles
            </h3>
            <div>
              <label className={lblCls("agency_name")}>
                {form.role === "agence"
                  ? "Nom de l'agence"
                  : form.role === "promoteur"
                  ? "Société / Promotion immobilière"
                  : "Nom commercial (démarcheur)"}
                {(form.role === "agence" || form.role === "promoteur") && " *"}
              </label>
              <input
                value={form.agency_name}
                onChange={(e) => set("agency_name", e.target.value)}
                data-testid="profile-agency-name"
                className={errCls("agency_name")}
                placeholder="Ex. Immobilière Sahel SARL"
                maxLength={120}
              />
              {errors.agency_name && <p className="text-xs text-red-600 mt-1">{errors.agency_name}</p>}
            </div>
            <div>
              <label className={lblCls("bio")}>
                Bio / présentation ({form.bio?.length || 0}/500)
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                data-testid="profile-bio"
                className={`${errCls("bio")} min-h-[100px] py-2`}
                maxLength={500}
                placeholder="Ex. Agence spécialisée en immobilier résidentiel à N'Djamena depuis 2019. Portefeuille de plus de 200 biens vérifiés…"
              />
              {errors.bio && <p className="text-xs text-red-600 mt-1">{errors.bio}</p>}
              <p className="text-xs text-neutral-500 mt-1">
                Cette bio s&apos;affichera sur vos annonces pour rassurer les acheteurs.
              </p>
            </div>
          </section>
        )}

        {/* Save */}
        <div className="sticky bottom-4 z-10 bg-white border-2 border-[#0A0A0A] rounded-2xl p-3 flex items-center gap-3 shadow-lg">
          <div className="flex-1 text-sm">
            {dirty ? (
              <span className="font-bold text-[#FF6B1A]">Modifications non enregistrées</span>
            ) : (
              <span className="text-neutral-500">Aucune modification en cours</span>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving || !dirty}
            data-testid="save-profile-btn"
            className="bg-[#0A0A0A] hover:bg-neutral-800 disabled:opacity-40 text-white font-bold h-11 px-6 rounded-lg flex items-center gap-2"
          >
            <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Live preview — 2 cols */}
      <aside className="lg:col-span-2">
        <div className="lg:sticky lg:top-24 space-y-3">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 flex items-center gap-2">
            <Sparkles className="h-3 w-3 text-[#FF6B1A]" /> Aperçu public
          </div>
          <div
            className="bg-gradient-to-br from-[#0A0A0A] to-[#1a1a1a] rounded-2xl p-6 text-white shadow-xl"
            data-testid="profile-preview-card"
          >
            <div className="flex items-center gap-4 mb-4">
              {form.picture ? (
                <img
                  src={form.picture}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover border-2 border-white/20"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[#FF6B1A] text-white flex items-center justify-center font-heading font-black text-2xl">
                  {initial}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-heading font-black text-xl tracking-tight truncate">
                  {form.name || "Votre nom"}
                </div>
                <div className="text-xs mt-0.5">
                  <span className="inline-block px-2 py-0.5 bg-[#FF6B1A]/20 text-[#FF6B1A] rounded-full font-bold uppercase tracking-wider text-[10px]">
                    {emailBadge(form.role)}
                  </span>
                  {user.verified_agency && (
                    <span className="ml-1 inline-block px-2 py-0.5 bg-[#00B4FF]/20 text-[#00B4FF] rounded-full font-bold uppercase tracking-wider text-[10px]">
                      ✓ Vérifié
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isPro && form.agency_name && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Structure</div>
                <div className="font-heading font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#00B4FF]" /> {form.agency_name}
                </div>
              </div>
            )}
            {isPro && form.bio && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">À propos</div>
                <p className="text-sm text-white/90 leading-relaxed line-clamp-6">{form.bio}</p>
              </div>
            )}
            <div className="space-y-1.5 mt-3">
              {form.phone && (
                <div className="text-sm flex items-center gap-2">
                  <Phone className="h-3 w-3 text-[#FF6B1A]" /> {form.phone}
                </div>
              )}
              {form.whatsapp && (
                <div className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-3 w-3 text-[#00B4FF]" /> {form.whatsapp}
                </div>
              )}
              <div className="text-xs flex items-center gap-2 text-white/60">
                <Mail className="h-3 w-3" /> {user.email}
              </div>
            </div>
          </div>
          <p className="text-xs text-neutral-500 text-center">
            Cet aperçu montre ce que voient les acheteurs / locataires sur vos annonces.
          </p>
        </div>
      </aside>
    </div>
  );
};

export default ProfileEditor;
