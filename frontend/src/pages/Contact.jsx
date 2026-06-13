import React from "react";
import { useTranslation } from "react-i18next";
import { Phone, Mail, MessageCircle, Instagram, Facebook, Music } from "lucide-react";
import { LOGO_URL } from "../lib/api";
import { CONTACTS } from "../lib/constants";

const Contact = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="text-center mb-8">
        <img src={LOGO_URL} alt="IMORA" className="h-20 w-20 mx-auto rounded-xl mb-4" />
        <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">{t("contact.title")}</h1>
        <p className="text-sm text-neutral-500 mt-1">{t("contact.subtitle")}</p>
      </div>

      <div className="space-y-3">
        <ContactItem icon={MessageCircle} color="#25D366" title="WhatsApp" value={CONTACTS.whatsapp1} href={`https://wa.me/${CONTACTS.whatsapp1.replace(/[^0-9]/g, "")}`} />
        <ContactItem icon={MessageCircle} color="#25D366" title="WhatsApp" value={CONTACTS.whatsapp2} href={`https://wa.me/${CONTACTS.whatsapp2.replace(/[^0-9]/g, "")}`} />
        <ContactItem icon={Phone} color="#FF6B1A" title="Téléphone" value={CONTACTS.whatsapp1} href={`tel:${CONTACTS.whatsapp1}`} />
        <ContactItem icon={Mail} color="#00B4FF" title="Email" value={CONTACTS.email} href={`mailto:${CONTACTS.email}`} />
        <ContactItem icon={Music} color="#000000" title="TikTok" value={"@" + CONTACTS.tiktok} href={`https://tiktok.com/@${CONTACTS.tiktok}`} />
        <ContactItem icon={Instagram} color="#E1306C" title="Instagram" value={CONTACTS.instagram} href={`https://instagram.com/${CONTACTS.instagram.toLowerCase()}`} />
        <ContactItem icon={Facebook} color="#1877F2" title="Facebook" value={CONTACTS.facebook} href={`https://facebook.com/${CONTACTS.facebook.toLowerCase()}`} />
      </div>
    </div>
  );
};

const ContactItem = ({ icon: Icon, color, title, value, href }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`contact-${title.toLowerCase()}`} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-center gap-4 hover:border-neutral-900 transition">
    <div className="p-3 rounded-lg" style={{ background: color + "1A" }}><Icon className="h-5 w-5" style={{ color }} /></div>
    <div className="flex-1">
      <div className="text-xs uppercase tracking-widest font-bold text-neutral-500">{title}</div>
      <div className="font-heading font-bold">{value}</div>
    </div>
  </a>
);

export default Contact;
