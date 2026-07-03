import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

const REPORT_REASONS = ["scam", "fake", "price", "soldRented", "duplicate", "inappropriate", "other"];

const ReportModal = ({ propertyId, propertyTitle, onClose }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) {
      toast.error(t("report.errorReason"));
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/properties/${propertyId}/report`, {
        reason: t(`report.reason.${reason}`),
        details,
        reporter_name: name,
        reporter_phone: phone,
        reporter_email: email,
      });
      toast.success(t("report.success"), { duration: 6000 });
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="report-modal"
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="bg-red-100 text-red-600 rounded-full p-2">
            <Flag className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-black text-xl tracking-tight">{t("report.title")}</h3>
            <p className="text-sm text-neutral-500 mt-1 line-clamp-1">{propertyTitle}</p>
          </div>
          <button
            onClick={onClose}
            data-testid="report-close"
            className="text-neutral-400 hover:text-neutral-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-neutral-700 mb-4">{t("report.subtitle")}</p>

        <label className="imora-label mt-2">{t("report.reasonLabel")} *</label>
        <div className="grid grid-cols-1 gap-2 mb-3">
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={`border rounded-lg p-3 flex items-center gap-2 cursor-pointer text-sm ${
                reason === r ? "border-red-500 bg-red-50" : "border-neutral-200 hover:border-neutral-900"
              }`}
            >
              <input
                type="radio"
                name="reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                data-testid={`report-reason-${r}`}
                className="accent-red-500"
              />
              <span className="font-semibold">{t(`report.reason.${r}`)}</span>
            </label>
          ))}
        </div>

        <label className="imora-label">{t("report.detailsLabel")}</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          data-testid="report-details"
          rows={3}
          placeholder={t("report.detailsPlaceholder")}
          className="imora-input py-2"
        />

        <div className="mt-3 text-xs font-bold uppercase tracking-widest text-neutral-500">
          {t("report.contactLabel")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="report-name"
            placeholder={t("report.namePlaceholder")}
            className="imora-input"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="report-phone"
            placeholder={t("report.phonePlaceholder")}
            className="imora-input"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="report-email"
            placeholder={t("report.emailPlaceholder")}
            className="imora-input"
          />
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} data-testid="report-cancel" className="imora-btn-outline flex-1">
            {t("common.cancel")}
          </button>
          <button
            onClick={submit}
            disabled={submitting || !reason}
            data-testid="report-submit"
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold h-12 px-6 rounded-lg flex-1 flex items-center justify-center gap-2"
          >
            <Flag className="h-4 w-4" />
            {submitting ? t("report.submitting") : t("report.submit")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
