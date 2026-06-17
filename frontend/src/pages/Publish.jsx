import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Image as ImageIcon, X, Check, ChevronLeft, ChevronRight, Video, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CITIES, ARRONDISSEMENTS, ALL_NEIGHBORHOODS, PROPERTY_TYPES, TRANSACTION_TYPES, DOCUMENT_TYPES, NDJAMENA_CENTER } from "../lib/constants";

const Publish = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [optimizing, setOptimizing] = useState(false);
  const [form, setForm] = useState({
    property_type: "", transaction_type: "",
    title: "", description: "",
    city: "N'Djamena", arrondissement: "", neighborhood: "", address: "",
    lat: NDJAMENA_CENTER.lat, lng: NDJAMENA_CENTER.lng, location_visibility: "neighborhood",
    price: "", negotiable: false,
    rooms: 0, bathrooms: 0, living_rooms: 0, land_area: 0, living_area: 0,
    photos: [], videos: [], virtual_tour_url: "", documents: [],
    contact_name: user?.name || "", contact_phone: user?.phone || "", contact_whatsapp: user?.whatsapp || "", contact_email: user?.email || "",
  });

  if (!user) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="font-heading font-bold text-2xl mb-2">{t("publish.title")}</h1>
        <p className="text-neutral-500 mb-4">{t("publish.needLogin")}</p>
        <a href="/login" className="imora-btn-primary inline-flex">{t("nav.login")}</a>
      </div>
    );
  }

  const set = (k, v) => setForm({ ...form, [k]: v });

  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Aggressive optimization for slow 3G/4G connections in Chad
          const MAX_W = 1100;       // hard max width
          const TARGET_BYTES = 220 * 1024; // aim for <= 220 KB per photo
          let { width, height } = img;
          if (width > MAX_W) { height = (MAX_W / width) * height; width = MAX_W; }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);
          // Adaptive quality loop: start at 0.75, drop until file fits target
          let quality = 0.75;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);
          // base64 size ≈ raw * 1.37; estimate raw bytes from string length
          const estimateBytes = (s) => Math.ceil((s.length - "data:image/jpeg;base64,".length) * 0.75);
          while (estimateBytes(dataUrl) > TARGET_BYTES && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }
          resolve({ dataUrl, sizeKb: Math.round(estimateBytes(dataUrl) / 1024), originalKb: Math.round(file.size / 1024), quality: Math.round(quality * 100) });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

  const onPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setOptimizing(true);
    const results = await Promise.all(files.map(compressImage));
    const newPhotos = results.map(r => r.dataUrl);
    const totalSaved = results.reduce((s, r) => s + (r.originalKb - r.sizeKb), 0);
    const finalSize = results.reduce((s, r) => s + r.sizeKb, 0);
    setForm({ ...form, photos: [...form.photos, ...newPhotos] });
    setOptimizing(false);
    toast.success(`${results.length} photo(s) optimisée(s) — ${finalSize} KB total (économie : ${totalSaved} KB)`);
  };

  const onVideo = (e) => {
    const files = Array.from(e.target.files || []);
    Promise.all(files.map(f => new Promise((res) => {
      const r = new FileReader();
      r.onload = (ev) => res(ev.target.result);
      r.readAsDataURL(f);
    }))).then((datas) => setForm({ ...form, videos: [...form.videos, ...datas] }));
  };

  const onDocument = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setForm({ ...form, documents: [...form.documents, { type, name: file.name, data: ev.target.result }] });
    r.readAsDataURL(file);
  };

  const submit = async () => {
    try {
      const payload = { ...form, price: parseFloat(form.price), rooms: parseInt(form.rooms || 0), bathrooms: parseInt(form.bathrooms || 0), living_rooms: parseInt(form.living_rooms || 0), land_area: parseFloat(form.land_area || 0), living_area: parseFloat(form.living_area || 0) };
      const { data } = await api.post("/properties", payload);
      if (data.status === "pending") {
        toast.success("Annonce soumise ! Elle sera publiée après validation par l'administrateur (sous 24h).", { duration: 8000 });
      } else {
        toast.success(t("publish.success"));
      }
      navigate(`/property/${data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || t("common.error"));
    }
  };

  const useGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm({ ...form, lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success("Position GPS récupérée");
    }, () => toast.error("Impossible d'obtenir la position GPS"));
  };

  const neighborhoods = form.arrondissement ? ARRONDISSEMENTS[form.arrondissement] || [] : ALL_NEIGHBORHOODS;
  const steps = [t("publish.step1"), t("publish.step2"), t("publish.step3"), t("publish.step4"), t("publish.step5")];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter mb-1">{t("publish.title")}</h1>
      {/* Progress */}
      <div className="flex items-center gap-2 my-6 overflow-x-auto no-scrollbar">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-2 shrink-0 ${i + 1 <= step ? "text-[#FF6B1A]" : "text-neutral-400"}`}>
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 < step ? "bg-[#FF6B1A] text-white" : i + 1 === step ? "bg-[#FF6B1A]/20 border-2 border-[#FF6B1A]" : "bg-neutral-100"}`}>{i + 1 < step ? <Check className="h-3 w-3" /> : i + 1}</div>
            <span className="text-xs font-bold uppercase tracking-wide whitespace-nowrap">{s}</span>
            {i < steps.length - 1 && <div className="h-px w-4 bg-neutral-300" />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="imora-label">{t("search.propertyType")}</label>
              <select data-testid="publish-property-type" value={form.property_type} onChange={(e) => set("property_type", e.target.value)} className="imora-input">
                <option value="">—</option>
                {Object.values(PROPERTY_TYPES).map(g => (
                  <optgroup key={g.label} label={g.label}>{g.items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}</optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="imora-label">{t("search.transactionType")}</label>
              <select data-testid="publish-transaction-type" value={form.transaction_type} onChange={(e) => set("transaction_type", e.target.value)} className="imora-input">
                <option value="">—</option>
                {TRANSACTION_TYPES.map(tr => <option key={tr.value} value={tr.value}>{tr.label}</option>)}
              </select>
            </div>
            <div>
              <label className="imora-label">{t("publish.titleField")}</label>
              <input data-testid="publish-title" value={form.title} onChange={(e) => set("title", e.target.value)} className="imora-input" />
            </div>
            <div>
              <label className="imora-label">{t("publish.desc")}</label>
              <textarea data-testid="publish-description" value={form.description} onChange={(e) => set("description", e.target.value)} className="imora-input min-h-[120px] py-2" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="imora-label">{t("search.city")}</label>
              <select data-testid="publish-city" value={form.city} onChange={(e) => set("city", e.target.value)} className="imora-input">{CITIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div>
              <label className="imora-label">{t("search.arrondissement")}</label>
              <select data-testid="publish-arr" value={form.arrondissement} onChange={(e) => { set("arrondissement", e.target.value); set("neighborhood", ""); }} className="imora-input">
                <option value="">—</option>
                {Object.keys(ARRONDISSEMENTS).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="imora-label">{t("search.neighborhood")}</label>
              <select data-testid="publish-neigh" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} className="imora-input">
                <option value="">—</option>
                {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="imora-label">Adresse</label>
              <input data-testid="publish-address" value={form.address} onChange={(e) => set("address", e.target.value)} className="imora-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="imora-label">Latitude</label>
                <input data-testid="publish-lat" type="number" step="any" value={form.lat} onChange={(e) => set("lat", parseFloat(e.target.value))} className="imora-input" />
              </div>
              <div>
                <label className="imora-label">Longitude</label>
                <input data-testid="publish-lng" type="number" step="any" value={form.lng} onChange={(e) => set("lng", parseFloat(e.target.value))} className="imora-input" />
              </div>
            </div>
            <button onClick={useGPS} data-testid="publish-gps-btn" className="imora-btn-secondary w-full"><MapPin className="h-4 w-4" /> Utiliser ma position GPS</button>
            <div>
              <label className="imora-label">{t("publish.visibility")}</label>
              <div className="grid grid-cols-1 gap-2">
                {[{ v: "exact", l: t("publish.visExact") }, { v: "neighborhood", l: t("publish.visNeigh") }, { v: "approximate", l: t("publish.visApprox") }].map(o => (
                  <label key={o.v} className={`border rounded-lg p-3 flex items-center gap-2 cursor-pointer ${form.location_visibility === o.v ? "border-[#FF6B1A] bg-[#FF6B1A]/5" : "border-neutral-200"}`}>
                    <input type="radio" name="vis" checked={form.location_visibility === o.v} onChange={() => set("location_visibility", o.v)} className="accent-[#FF6B1A]" />
                    <span className="text-sm font-semibold">{o.l}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="imora-label">{t("publish.price")}</label>
                <input data-testid="publish-price" type="number" value={form.price} onChange={(e) => set("price", e.target.value)} className="imora-input" />
              </div>
              <label className="flex items-end gap-2 cursor-pointer pb-3">
                <input type="checkbox" checked={form.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="h-4 w-4 accent-[#FF6B1A]" data-testid="publish-negotiable" />
                <span className="text-sm font-semibold">{t("publish.negotiable")}</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="imora-label">{t("detail.rooms")}</label><input data-testid="publish-rooms" type="number" value={form.rooms} onChange={(e) => set("rooms", e.target.value)} className="imora-input" /></div>
              <div><label className="imora-label">{t("detail.bathrooms")}</label><input data-testid="publish-bathrooms" type="number" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} className="imora-input" /></div>
              <div><label className="imora-label">{t("detail.livingRooms")}</label><input data-testid="publish-livingrooms" type="number" value={form.living_rooms} onChange={(e) => set("living_rooms", e.target.value)} className="imora-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="imora-label">{t("detail.landArea")} (m²)</label><input data-testid="publish-land-area" type="number" value={form.land_area} onChange={(e) => set("land_area", e.target.value)} className="imora-input" /></div>
              <div><label className="imora-label">{t("detail.livingArea")} (m²)</label><input data-testid="publish-living-area" type="number" value={form.living_area} onChange={(e) => set("living_area", e.target.value)} className="imora-input" /></div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="imora-label">{t("publish.uploadPhotos")}</label>
              <div className="bg-[#00B4FF]/5 border border-[#00B4FF]/30 rounded-lg p-3 mb-2 text-xs text-neutral-700 flex items-start gap-2">
                <span className="text-base">⚡</span>
                <span><b className="text-[#00B4FF]">Optimisation auto.</b> Vos photos sont compressées pour charger ultra-rapidement même en 3G/4G limitée. Jusqu'à 10 photos, ~200 KB chacune.</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="border-2 border-dashed border-neutral-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-[#FF6B1A]">
                  <ImageIcon className="h-6 w-6 text-neutral-400 mb-1" />
                  <span className="text-xs font-semibold">{optimizing ? "Optimisation…" : "Galerie"}</span>
                  <input data-testid="publish-photos-gallery" type="file" accept="image/*" multiple disabled={optimizing} className="hidden" onChange={onPhoto} />
                </label>
                <label className="border-2 border-dashed border-neutral-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-[#FF6B1A]">
                  <Camera className="h-6 w-6 text-neutral-400 mb-1" />
                  <span className="text-xs font-semibold">{optimizing ? "Optimisation…" : t("publish.takePhoto")}</span>
                  <input data-testid="publish-photos-camera" type="file" accept="image/*" capture="environment" disabled={optimizing} className="hidden" onChange={onPhoto} />
                </label>
              </div>
              {form.photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {form.photos.map((p, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={() => set("photos", form.photos.filter((_, j) => j !== i))} data-testid={`remove-photo-${i}`} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="imora-label">{t("publish.uploadVideo")}</label>
              <label className="border-2 border-dashed border-neutral-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-[#00B4FF]">
                <Video className="h-6 w-6 text-neutral-400 mb-1" />
                <span className="text-xs font-semibold">Importer une vidéo</span>
                <input data-testid="publish-video" type="file" accept="video/*" className="hidden" onChange={onVideo} />
              </label>
              <p className="text-xs text-neutral-500 mt-1">{form.videos.length} vidéo(s)</p>
            </div>
            <div>
              <label className="imora-label">Visite virtuelle (URL YouTube / Vimeo)</label>
              <input
                data-testid="publish-virtual-tour"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={form.virtual_tour_url || ""}
                onChange={(e) => set("virtual_tour_url", e.target.value)}
                className="imora-input"
              />
              <p className="text-xs text-neutral-500 mt-1">Optionnel — Lien direct vers une visite vidéo complète du bien.</p>
            </div>
            <div>
              <label className="imora-label">{t("detail.documents")}</label>
              <div className="grid grid-cols-1 gap-2">
                {DOCUMENT_TYPES.map((dt) => (
                  <label key={dt} className="border border-neutral-200 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:border-neutral-900">
                    <span className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-[#00B4FF]" />{dt}</span>
                    <input data-testid={`publish-doc-${dt}`} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onDocument(e, dt)} />
                    <span className="text-xs font-bold text-[#FF6B1A]">+</span>
                  </label>
                ))}
              </div>
              {form.documents.length > 0 && <p className="text-xs text-neutral-500 mt-2">{form.documents.length} document(s) ajouté(s)</p>}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div><label className="imora-label">{t("publish.contactName")}</label><input data-testid="publish-contact-name" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className="imora-input" /></div>
            <div><label className="imora-label">{t("publish.contactPhone")}</label><input data-testid="publish-contact-phone" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className="imora-input" /></div>
            <div><label className="imora-label">{t("publish.contactWhatsapp")}</label><input data-testid="publish-contact-whatsapp" value={form.contact_whatsapp} onChange={(e) => set("contact_whatsapp", e.target.value)} className="imora-input" /></div>
            <div><label className="imora-label">{t("publish.contactEmail")}</label><input data-testid="publish-contact-email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} className="imora-input" /></div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} data-testid="publish-back-btn" className="imora-btn-outline disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> {t("publish.back")}</button>
        {step < 5 ? (
          <button onClick={() => setStep(step + 1)} data-testid="publish-next-btn" className="imora-btn-primary">{t("publish.next")} <ChevronRight className="h-4 w-4" /></button>
        ) : (
          <button onClick={submit} data-testid="publish-submit-btn" className="imora-btn-primary">{t("publish.submit")}</button>
        )}
      </div>
    </div>
  );
};

export default Publish;
