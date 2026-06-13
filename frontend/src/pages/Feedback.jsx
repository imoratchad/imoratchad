import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const Feedback = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", phone: "", rating: 5, type: "suggestion", message: "" });

  const submit = async () => {
    try {
      await api.post("/feedback", form);
      toast.success(t("feedback.thanks"));
      setForm({ ...form, message: "" });
    } catch (e) { toast.error(t("common.error")); }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{t("feedback.title")}</h1>
      <p className="text-sm text-neutral-500 mb-6">{t("feedback.subtitle")}</p>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="imora-label">{t("feedback.rating")}</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setForm({ ...form, rating: n })} data-testid={`fb-star-${n}`}>
                <Star className={`h-7 w-7 ${n <= form.rating ? "fill-[#FF6B1A] text-[#FF6B1A]" : "text-neutral-300"}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="imora-label">{t("feedback.type")}</label>
          <select data-testid="fb-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="imora-input">
            <option value="suggestion">{t("feedback.suggestion")}</option>
            <option value="issue">{t("feedback.issue")}</option>
            <option value="feature">{t("feedback.feature")}</option>
            <option value="report">{t("feedback.report")}</option>
          </select>
        </div>
        <div><label className="imora-label">{t("feedback.name")}</label><input data-testid="fb-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="imora-input" /></div>
        <div><label className="imora-label">{t("feedback.email")}</label><input data-testid="fb-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="imora-input" /></div>
        <div><label className="imora-label">{t("feedback.phone")}</label><input data-testid="fb-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="imora-input" /></div>
        <div>
          <label className="imora-label">{t("feedback.message")}</label>
          <textarea data-testid="fb-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="imora-input py-2 min-h-[120px]" />
        </div>
        <button onClick={submit} data-testid="fb-submit" className="imora-btn-primary w-full">{t("feedback.submit")}</button>
      </div>
    </div>
  );
};

export default Feedback;
