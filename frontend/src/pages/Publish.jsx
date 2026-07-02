import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Image as ImageIcon, X, Check, ChevronLeft, ChevronRight, Video, FileText, MapPin, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { CITIES, ARRONDISSEMENTS, ALL_NEIGHBORHOODS, PROPERTY_TYPES, TRANSACTION_TYPES, DOCUMENT_TYPES, NDJAMENA_CENTER } from "../lib/constants";

// Validation rules per step. Returns { fieldName: errorMessage } for invalid fields.
const validateStep = (step, form, t) => {
  const e = {};
  const msg = (k) => (t ? t(`publish.err.${k}`) : k);
  if (step === 1) {
    if (!form.property_type) e.property_type = msg("typeRequired");
    if (!form.transaction_type) e.transaction_type = msg("transactionRequired");
    if (!form.title?.trim()) e.title = msg("titleRequired");
    else if (form.title.trim().length < 8) e.title = msg("titleShort");
    else if (form.title.trim().length > 120) e.title = msg("titleLong");
    if (!form.description?.trim()) e.description = msg("descRequired");
    else if (form.description.trim().length < 30) e.description = msg("descShort");
  }
  if (step === 2) {
    if (!form.city) e.city = msg("cityRequired");
    if (!form.neighborhood) e.neighborhood = msg("neighRequired");
    if (form.lat == null || isNaN(parseFloat(form.lat))) e.lat = msg("latInvalid");
    if (form.lng == null || isNaN(parseFloat(form.lng))) e.lng = msg("lngInvalid");
  }
  if (step === 3) {
    const p = parseFloat(form.price);
    if (!p || p <= 0) e.price = msg("priceInvalid");
    else if (p > 10000000000) e.price = msg("priceTooHigh");
    const habitable = ["chambre", "studio", "appartement", "maison", "villa", "duplex", "immeuble"];
    if (habitable.includes(form.property_type) && parseInt(form.rooms || 0) <= 0) {
      e.rooms = msg("roomsRequired");
    }
    const land = parseFloat(form.land_area || 0);
    const living = parseFloat(form.living_area || 0);
    if (land <= 0 && living <= 0) e.land_area = msg("areaRequired");
  }
  if (step === 4) {
    if (!form.photos || form.photos.length === 0) e.photos = msg("photoRequired");
  }
  if (step === 5) {
    if (!form.contact_name?.trim()) e.contact_name = msg("nameRequired");
    if (!form.contact_phone?.trim()) e.contact_phone = msg("phoneRequired");
    else if (!/^[+]?[\d\s-]{7,}$/.test(form.contact_phone.trim())) e.contact_phone = msg("phoneInvalid");
    if (form.contact_whatsapp?.trim() && !/^[+]?[\d\s-]{7,}$/.test(form.contact_whatsapp.trim())) {
      e.contact_whatsapp = msg("whatsappInvalid");
    }
    if (form.contact_email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
      e.contact_email = msg("emailInvalid");
    }
  }
  return e;
};

const ErrorMsg = ({ msg, testid }) =>
  msg ? (
    <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-red-600" data-testid={testid}>
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{msg}</span>
    </div>
  ) : null;

const Publish = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [optimizing, setOptimizing] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
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

  // Re-validate every time the form changes (only show errors if user clicked Next once)
  React.useEffect(() => {
    if (touched) setErrors(validateStep(step, form, t));
  }, [form, step, touched, t]);

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
    const stepErrors = validateStep(5, form, t);
    // Also validate previous steps to be safe
    const allErrors = { ...validateStep(1, form, t), ...validateStep(2, form, t), ...validateStep(3, form, t), ...validateStep(4, form, t), ...stepErrors };
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors); setTouched(true);
      // Jump back to first invalid step
      const stepOf = (k) => {
        if (["property_type","transaction_type","title","description"].includes(k)) return 1;
        if (["city","neighborhood","lat","lng"].includes(k)) return 2;
        if (["price","rooms","land_area"].includes(k)) return 3;
        if (["photos"].includes(k)) return 4;
        return 5;
      };
      const first = Math.min(...Object.keys(allErrors).map(stepOf));
      setStep(first);
      toast.error(t("publish.fixErrors"));
      return;
    }
    try {
      const payload = { ...form, price: parseFloat(form.price), rooms: parseInt(form.rooms || 0), bathrooms: parseInt(form.bathrooms || 0), living_rooms: parseInt(form.living_rooms || 0), land_area: parseFloat(form.land_area || 0), living_area: parseFloat(form.living_area || 0) };
      const { data } = await api.post("/properties", payload);
      if (data.status === "pending") {
        toast.success(t("publish.successPending"), { duration: 8000 });
      } else {
        toast.success(t("publish.success"));
      }
      navigate(`/property/${data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || t("common.error"));
    }
  };

  const goNext = () => {
    const stepErrors = validateStep(step, form, t);
    setTouched(true);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      toast.error(t("publish.fixErrorsStep"));
      return;
    }
    setStep(step + 1);
    setTouched(false);
    setErrors({});
  };

  const errCls = (k) => (errors[k] ? "imora-input !border-red-500 !border-2 focus:!ring-red-300 focus:!ring-2" : "imora-input");
  const lblCls = (k) => (errors[k] ? "imora-label !text-red-600" : "imora-label");

  const useGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm({ ...form, lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success(t("publish.gpsOk"));
    }, () => toast.error(t("publish.gpsFail")));
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
              <label className={lblCls("property_type")}>{t("search.propertyType")} *</label>
              <select data-testid="publish-property-type" value={form.property_type} onChange={(e) => set("property_type", e.target.value)} className={errCls("property_type")}>
                <option value="">{t("publish.chooseOption")}</option>
                {Object.values(PROPERTY_TYPES).map(g => (
                  <optgroup key={g.label} label={g.label}>{g.items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}</optgroup>
                ))}
              </select>
              <ErrorMsg msg={errors.property_type} testid="err-property-type" />
            </div>
            <div>
              <label className={lblCls("transaction_type")}>{t("search.transactionType")} *</label>
              <select data-testid="publish-transaction-type" value={form.transaction_type} onChange={(e) => set("transaction_type", e.target.value)} className={errCls("transaction_type")}>
                <option value="">{t("publish.chooseOption")}</option>
                {TRANSACTION_TYPES.map(tr => <option key={tr.value} value={tr.value}>{tr.label}</option>)}
              </select>
              <ErrorMsg msg={errors.transaction_type} testid="err-transaction-type" />
            </div>
            <div>
              <label className={lblCls("title")}>{t("publish.titleField")} *</label>
              <input data-testid="publish-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("publish.titlePlaceholder")} className={errCls("title")} />
              <ErrorMsg msg={errors.title} testid="err-title" />
            </div>
            <div>
              <label className={lblCls("description")}>{t("publish.desc")} *</label>
              <textarea data-testid="publish-description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("publish.descPlaceholder")} className={`${errCls("description")} min-h-[120px] py-2`} />
              <div className="flex items-center justify-between mt-1">
                <ErrorMsg msg={errors.description} testid="err-description" />
                <span className="text-[10px] text-neutral-400 ms-auto">{form.description?.length || 0} car.</span>
              </div>
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
              <label className="imora-label">{t("publish.address")}</label>
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
            <button onClick={useGPS} data-testid="publish-gps-btn" className="imora-btn-secondary w-full"><MapPin className="h-4 w-4" /> {t("publish.useGps")}</button>
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
                <label className={lblCls("price")}>{t("publish.price")} *</label>
                <input data-testid="publish-price" type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Ex. 15000000" className={errCls("price")} />
                <ErrorMsg msg={errors.price} testid="err-price" />
              </div>
              <label className="flex items-end gap-2 cursor-pointer pb-3">
                <input type="checkbox" checked={form.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="h-4 w-4 accent-[#FF6B1A]" data-testid="publish-negotiable" />
                <span className="text-sm font-semibold">{t("publish.negotiable")}</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lblCls("rooms")}>{t("detail.rooms")}</label><input data-testid="publish-rooms" type="number" min="0" value={form.rooms} onChange={(e) => set("rooms", e.target.value)} className={errCls("rooms")} /><ErrorMsg msg={errors.rooms} testid="err-rooms" /></div>
              <div><label className="imora-label">{t("detail.bathrooms")}</label><input data-testid="publish-bathrooms" type="number" min="0" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} className="imora-input" /></div>
              <div><label className="imora-label">{t("detail.livingRooms")}</label><input data-testid="publish-livingrooms" type="number" min="0" value={form.living_rooms} onChange={(e) => set("living_rooms", e.target.value)} className="imora-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lblCls("land_area")}>{t("detail.landArea")} (m²)</label><input data-testid="publish-land-area" type="number" min="0" value={form.land_area} onChange={(e) => set("land_area", e.target.value)} className={errCls("land_area")} /></div>
              <div><label className="imora-label">{t("detail.livingArea")} (m²)</label><input data-testid="publish-living-area" type="number" min="0" value={form.living_area} onChange={(e) => set("living_area", e.target.value)} className="imora-input" /></div>
            </div>
            <ErrorMsg msg={errors.land_area} testid="err-land-area" />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className={lblCls("photos")}>{t("publish.uploadPhotos")} *</label>
              <div className="bg-[#00B4FF]/5 border border-[#00B4FF]/30 rounded-lg p-3 mb-2 text-xs text-neutral-700 flex items-start gap-2">
                <span className="text-base">⚡</span>
                <span><b className="text-[#00B4FF]">Optimisation auto.</b> Vos photos sont compressées pour charger ultra-rapidement même en 3G/4G limitée. Jusqu'à 10 photos, ~200 KB chacune.</span>
              </div>
              <div className={`grid grid-cols-2 gap-2 ${errors.photos ? "ring-2 ring-red-500 rounded-lg p-1" : ""}`}>
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
              <ErrorMsg msg={errors.photos} testid="err-photos" />
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
            <div><label className={lblCls("contact_name")}>{t("publish.contactName")} *</label><input data-testid="publish-contact-name" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className={errCls("contact_name")} /><ErrorMsg msg={errors.contact_name} testid="err-contact-name" /></div>
            <div><label className={lblCls("contact_phone")}>{t("publish.contactPhone")} *</label><input data-testid="publish-contact-phone" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+235 64 92 73 80" className={errCls("contact_phone")} /><ErrorMsg msg={errors.contact_phone} testid="err-contact-phone" /></div>
            <div><label className={lblCls("contact_whatsapp")}>{t("publish.contactWhatsapp")}</label><input data-testid="publish-contact-whatsapp" value={form.contact_whatsapp} onChange={(e) => set("contact_whatsapp", e.target.value)} placeholder="+235 92 26 84 75" className={errCls("contact_whatsapp")} /><ErrorMsg msg={errors.contact_whatsapp} testid="err-contact-whatsapp" /></div>
            <div><label className={lblCls("contact_email")}>{t("publish.contactEmail")}</label><input data-testid="publish-contact-email" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} className={errCls("contact_email")} /><ErrorMsg msg={errors.contact_email} testid="err-contact-email" /></div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button onClick={() => { setStep(Math.max(1, step - 1)); setTouched(false); setErrors({}); }} disabled={step === 1} data-testid="publish-back-btn" className="imora-btn-outline disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> {t("publish.back")}</button>
        {step < 5 ? (
          <button onClick={goNext} data-testid="publish-next-btn" className="imora-btn-primary">{t("publish.next")} <ChevronRight className="h-4 w-4" /></button>
        ) : (
          <button onClick={submit} data-testid="publish-submit-btn" className="imora-btn-primary">{t("publish.submit")}</button>
        )}
      </div>
      {touched && Object.keys(errors).length > 0 && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2" data-testid="error-summary">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700"><b>{Object.keys(errors).length} champ(s) à corriger</b> sur cette étape. Les zones en rouge indiquent ce qui est manquant ou mal rempli.</p>
        </div>
      )}
    </div>
  );
};

export default Publish;
