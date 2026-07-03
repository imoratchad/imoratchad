import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

const ScamWarningBanner = () => {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-testid="scam-warning-banner"
      className="bg-red-600 text-white rounded-xl p-4 sm:p-5 mb-4 flex items-start gap-3 shadow-md border-2 border-red-700"
    >
      <div className="shrink-0 bg-white/20 rounded-full p-2">
        <AlertTriangle className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-black text-base sm:text-lg tracking-tight">{t("scam.title")}</p>
        <p className="text-sm text-white/95 mt-1 leading-snug">{t("scam.body")}</p>
      </div>
    </div>
  );
};

export default ScamWarningBanner;
