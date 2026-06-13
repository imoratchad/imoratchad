import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  fr: {
    translation: {
      brand: { slogan: "La plateforme immobilière du futur", trust: "IMORA, trouvez votre bien en toute confiance." },
      nav: { home: "Accueil", search: "Recherche", map: "Carte", publish: "Publier", dashboard: "Tableau de bord", admin: "Admin", login: "Se connecter", logout: "Déconnexion", contact: "Contact", payments: "Paiements", feedback: "Avis", assistant: "Assistant IA", profile: "Profil", favorites: "Favoris" },
      home: { heroTitle: "Trouvez votre bien immobilier au Tchad", heroSub: "Achetez, vendez ou louez en toute confiance. Terrains, maisons, villas, locaux commerciaux.", searchCta: "Rechercher un bien", publishCta: "Publier une annonce", featured: "Annonces en vedette", verified: "Biens vérifiés", recent: "Récemment publiées", popularNeigh: "Quartiers populaires", whyImora: "Pourquoi IMORA ?", trust1: "Annonces vérifiées", trust1d: "Badges officiels après vérification documents", trust2: "Carte GPS", trust2d: "Localisation précise sur OpenStreetMap", trust3: "Assistant IA", trust3d: "Trouvez le bien idéal en discutant", trust4: "Paiement local", trust4d: "Airtel Money et Moov Money supportés" },
      search: { title: "Recherche avancée", placeholder: "Que cherchez-vous ?", filters: "Filtres", city: "Ville", arrondissement: "Arrondissement", neighborhood: "Quartier", propertyType: "Type de bien", transactionType: "Transaction", minPrice: "Prix min (XAF)", maxPrice: "Prix max (XAF)", minArea: "Superficie min (m²)", verifiedOnly: "Biens vérifiés uniquement", apply: "Appliquer", reset: "Réinitialiser", results: "résultats", noResults: "Aucun bien trouvé. Essayez d'autres filtres." },
      card: { verified: "Vérifié", negotiable: "Négociable", views: "vues", contacts: "contacts" },
      detail: { description: "Description", details: "Caractéristiques", rooms: "Chambres", bathrooms: "Salles de bain", livingRooms: "Salons", landArea: "Superficie terrain", livingArea: "Superficie habitable", location: "Localisation", contact: "Contacter le propriétaire", call: "Appeler", whatsapp: "WhatsApp", email: "Email", message: "Envoyer un message", favorite: "Ajouter aux favoris", unfavorite: "Retirer", documents: "Documents", verified: "Bien vérifié par IMORA", verifiedDesc: "Documents et identité du propriétaire vérifiés." },
      publish: { title: "Publier une annonce", step1: "Type & Transaction", step2: "Localisation", step3: "Détails & Prix", step4: "Photos & Documents", step5: "Contact", submit: "Publier l'annonce", titleField: "Titre de l'annonce", desc: "Description", price: "Prix (XAF)", negotiable: "Prix négociable", uploadPhotos: "Ajouter des photos", takePhoto: "Prendre une photo", uploadVideo: "Ajouter une vidéo", visibility: "Visibilité de la localisation", visExact: "Adresse exacte", visNeigh: "Quartier uniquement", visApprox: "Localisation approximative", next: "Suivant", back: "Précédent", contactName: "Votre nom", contactPhone: "Téléphone", contactWhatsapp: "WhatsApp", contactEmail: "Email", success: "Annonce publiée avec succès !", needLogin: "Connectez-vous pour publier" },
      dashboard: { mine: "Mes annonces", favorites: "Mes favoris", messages: "Mes messages", stats: "Statistiques", role: "Rôle", noMine: "Aucune annonce pour l'instant.", views: "Vues", contacts: "Contacts", revenue: "Revenus", profile: "Profil", saveProfile: "Enregistrer" },
      admin: { dashboard: "Tableau de bord admin", users: "Utilisateurs", agencies: "Agences", properties: "Annonces", verifications: "Vérifications", payments: "Paiements", stats: "Statistiques", totalUsers: "Utilisateurs", totalAgencies: "Agences", totalProperties: "Annonces", verifiedProperties: "Vérifiées", revenue: "Revenus", activeSessions: "Sessions actives", pending: "En attente", verify: "Vérifier", unverify: "Retirer vérification", suspend: "Suspendre", unsuspend: "Réactiver", confirm: "Confirmer", reject: "Rejeter", feedback: "Retours utilisateurs", makeFeatured: "Mettre en avant" },
      login: { title: "Se connecter à IMORA", subtitle: "Accédez à votre tableau de bord, publiez et gérez vos annonces.", continueGoogle: "Continuer avec Google", terms: "En continuant, vous acceptez nos conditions d'utilisation." },
      ai: { title: "IMORA Assistant", subtitle: "Votre conseiller immobilier intelligent", placeholder: "Posez votre question…", send: "Envoyer", thinking: "Je réfléchis…", greeting: "Bonjour ! Je suis IMORA Assistant. Comment puis-je vous aider à trouver votre bien idéal ?" },
      contact: { title: "Contactez IMORA", subtitle: "Notre équipe est à votre écoute" },
      payments: { title: "Paiements IMORA", subtitle: "Réglez vos services avec Airtel Money ou Moov Money", howto: "Comment payer", step1: "Envoyez le montant via Airtel Money ou Moov Money au numéro ci-dessous", step2: "Notez l'ID de transaction reçu par SMS", step3: "Soumettez le formulaire avec votre ID de transaction", step4: "Notre équipe valide sous 24h ouvrées", airtelNum: "Numéro Airtel Money", moovNum: "Numéro Moov Money", type: "Type de service", amount: "Montant (XAF)", method: "Méthode", transactionId: "ID de transaction", payerPhone: "Votre numéro payeur", note: "Note (facultatif)", submit: "Soumettre le paiement", history: "Mes paiements" },
      feedback: { title: "Avis & Retours", subtitle: "Aidez-nous à améliorer IMORA", name: "Nom", email: "Email (facultatif)", phone: "Téléphone (facultatif)", type: "Type de retour", rating: "Note (1-5 étoiles)", message: "Votre message", submit: "Envoyer", suggestion: "Suggestion", issue: "Signaler un problème", feature: "Demande de fonctionnalité", report: "Signaler une annonce", thanks: "Merci pour votre retour !" },
      common: { loading: "Chargement…", error: "Une erreur est survenue", save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", edit: "Modifier", confirm: "Confirmer", yes: "Oui", no: "Non", all: "Tous", filter: "Filtrer", close: "Fermer", language: "Langue", from: "à partir de" },
    },
  },
  en: {
    translation: {
      brand: { slogan: "The future real estate platform", trust: "IMORA, find your property with confidence." },
      nav: { home: "Home", search: "Search", map: "Map", publish: "Publish", dashboard: "Dashboard", admin: "Admin", login: "Sign in", logout: "Sign out", contact: "Contact", payments: "Payments", feedback: "Feedback", assistant: "AI Assistant", profile: "Profile", favorites: "Favorites" },
      home: { heroTitle: "Find your property in Chad", heroSub: "Buy, sell or rent with confidence. Land, houses, villas, commercial spaces.", searchCta: "Search properties", publishCta: "Publish a listing", featured: "Featured listings", verified: "Verified properties", recent: "Recently published", popularNeigh: "Popular neighborhoods", whyImora: "Why IMORA?", trust1: "Verified listings", trust1d: "Official badges after document checks", trust2: "GPS map", trust2d: "Precise location on OpenStreetMap", trust3: "AI Assistant", trust3d: "Find the perfect property by chatting", trust4: "Local payments", trust4d: "Airtel Money & Moov Money supported" },
      search: { title: "Advanced search", placeholder: "What are you looking for?", filters: "Filters", city: "City", arrondissement: "District", neighborhood: "Neighborhood", propertyType: "Property type", transactionType: "Transaction", minPrice: "Min price (XAF)", maxPrice: "Max price (XAF)", minArea: "Min area (m²)", verifiedOnly: "Verified only", apply: "Apply", reset: "Reset", results: "results", noResults: "No properties found. Try different filters." },
      card: { verified: "Verified", negotiable: "Negotiable", views: "views", contacts: "contacts" },
      detail: { description: "Description", details: "Specs", rooms: "Bedrooms", bathrooms: "Bathrooms", livingRooms: "Living rooms", landArea: "Land area", livingArea: "Living area", location: "Location", contact: "Contact owner", call: "Call", whatsapp: "WhatsApp", email: "Email", message: "Send message", favorite: "Add to favorites", unfavorite: "Remove", documents: "Documents", verified: "Property verified by IMORA", verifiedDesc: "Documents and owner identity verified." },
      publish: { title: "Publish a listing", step1: "Type & Transaction", step2: "Location", step3: "Details & Price", step4: "Photos & Documents", step5: "Contact", submit: "Publish listing", titleField: "Listing title", desc: "Description", price: "Price (XAF)", negotiable: "Negotiable price", uploadPhotos: "Upload photos", takePhoto: "Take a photo", uploadVideo: "Upload video", visibility: "Location visibility", visExact: "Exact address", visNeigh: "Neighborhood only", visApprox: "Approximate location", next: "Next", back: "Back", contactName: "Your name", contactPhone: "Phone", contactWhatsapp: "WhatsApp", contactEmail: "Email", success: "Listing published successfully!", needLogin: "Sign in to publish" },
      dashboard: { mine: "My listings", favorites: "My favorites", messages: "My messages", stats: "Stats", role: "Role", noMine: "No listings yet.", views: "Views", contacts: "Contacts", revenue: "Revenue", profile: "Profile", saveProfile: "Save" },
      admin: { dashboard: "Admin dashboard", users: "Users", agencies: "Agencies", properties: "Listings", verifications: "Verifications", payments: "Payments", stats: "Statistics", totalUsers: "Users", totalAgencies: "Agencies", totalProperties: "Listings", verifiedProperties: "Verified", revenue: "Revenue", activeSessions: "Active sessions", pending: "Pending", verify: "Verify", unverify: "Unverify", suspend: "Suspend", unsuspend: "Reactivate", confirm: "Confirm", reject: "Reject", feedback: "User feedback", makeFeatured: "Feature" },
      login: { title: "Sign in to IMORA", subtitle: "Access your dashboard, publish and manage listings.", continueGoogle: "Continue with Google", terms: "By continuing you accept our terms of use." },
      ai: { title: "IMORA Assistant", subtitle: "Your smart real estate advisor", placeholder: "Ask anything…", send: "Send", thinking: "Thinking…", greeting: "Hello! I'm IMORA Assistant. How can I help you find the perfect property?" },
      contact: { title: "Contact IMORA", subtitle: "Our team is here to help" },
      payments: { title: "IMORA Payments", subtitle: "Pay with Airtel Money or Moov Money", howto: "How to pay", step1: "Send the amount via Airtel or Moov Money to the number below", step2: "Save the transaction ID from your SMS", step3: "Submit the form with your transaction ID", step4: "Our team validates within 24h", airtelNum: "Airtel Money number", moovNum: "Moov Money number", type: "Service type", amount: "Amount (XAF)", method: "Method", transactionId: "Transaction ID", payerPhone: "Your phone", note: "Note (optional)", submit: "Submit payment", history: "My payments" },
      feedback: { title: "Feedback", subtitle: "Help us improve IMORA", name: "Name", email: "Email (optional)", phone: "Phone (optional)", type: "Feedback type", rating: "Rating (1-5)", message: "Your message", submit: "Send", suggestion: "Suggestion", issue: "Report issue", feature: "Feature request", report: "Report listing", thanks: "Thank you!" },
      common: { loading: "Loading…", error: "An error occurred", save: "Save", cancel: "Cancel", delete: "Delete", edit: "Edit", confirm: "Confirm", yes: "Yes", no: "No", all: "All", filter: "Filter", close: "Close", language: "Language", from: "from" },
    },
  },
  ar: {
    translation: {
      brand: { slogan: "منصة العقارات للمستقبل", trust: "إيمورا، اعثر على عقارك بثقة." },
      nav: { home: "الرئيسية", search: "بحث", map: "خريطة", publish: "نشر", dashboard: "لوحة التحكم", admin: "المشرف", login: "تسجيل الدخول", logout: "خروج", contact: "اتصل بنا", payments: "المدفوعات", feedback: "آراء", assistant: "مساعد ذكي", profile: "الملف الشخصي", favorites: "المفضلة" },
      home: { heroTitle: "ابحث عن عقارك في تشاد", heroSub: "اشترِ، بِع أو استأجر بكل ثقة.", searchCta: "بحث عن عقار", publishCta: "نشر إعلان", featured: "إعلانات مميزة", verified: "عقارات موثقة", recent: "نُشر مؤخرًا", popularNeigh: "الأحياء الشعبية", whyImora: "لماذا إيمورا؟", trust1: "إعلانات موثقة", trust1d: "شارات رسمية بعد التحقق", trust2: "خريطة GPS", trust2d: "موقع دقيق", trust3: "مساعد ذكي", trust3d: "تحدث للعثور على عقارك", trust4: "دفع محلي", trust4d: "Airtel Money و Moov Money" },
      search: { title: "بحث متقدم", placeholder: "ماذا تبحث؟", filters: "تصفية", city: "المدينة", arrondissement: "المنطقة", neighborhood: "الحي", propertyType: "نوع العقار", transactionType: "المعاملة", minPrice: "الحد الأدنى", maxPrice: "الحد الأقصى", minArea: "مساحة دنيا", verifiedOnly: "موثقة فقط", apply: "تطبيق", reset: "إعادة", results: "نتائج", noResults: "لا توجد نتائج." },
      card: { verified: "موثق", negotiable: "قابل للتفاوض", views: "مشاهدات", contacts: "تواصلات" },
      detail: { description: "الوصف", details: "المواصفات", rooms: "غرف", bathrooms: "حمامات", livingRooms: "صالات", landArea: "مساحة الأرض", livingArea: "مساحة سكنية", location: "الموقع", contact: "اتصل بالمالك", call: "اتصال", whatsapp: "واتساب", email: "بريد", message: "رسالة", favorite: "أضف للمفضلة", unfavorite: "إزالة", documents: "وثائق", verified: "عقار موثق", verifiedDesc: "تم التحقق من الوثائق والهوية." },
      publish: { title: "نشر إعلان", step1: "النوع والمعاملة", step2: "الموقع", step3: "التفاصيل والسعر", step4: "الصور والوثائق", step5: "الاتصال", submit: "نشر", titleField: "عنوان الإعلان", desc: "وصف", price: "السعر", negotiable: "قابل للتفاوض", uploadPhotos: "إضافة صور", takePhoto: "التقاط صورة", uploadVideo: "إضافة فيديو", visibility: "رؤية الموقع", visExact: "العنوان الدقيق", visNeigh: "الحي فقط", visApprox: "تقريبي", next: "التالي", back: "السابق", contactName: "اسمك", contactPhone: "الهاتف", contactWhatsapp: "واتساب", contactEmail: "بريد", success: "تم النشر!", needLogin: "سجل الدخول" },
      dashboard: { mine: "إعلاناتي", favorites: "مفضلتي", messages: "رسائلي", stats: "إحصاءات", role: "الدور", noMine: "لا إعلانات.", views: "مشاهدات", contacts: "تواصلات", revenue: "إيرادات", profile: "الملف", saveProfile: "حفظ" },
      admin: { dashboard: "لوحة المشرف", users: "المستخدمون", agencies: "الوكالات", properties: "الإعلانات", verifications: "التحقق", payments: "المدفوعات", stats: "الإحصاءات", totalUsers: "المستخدمون", totalAgencies: "الوكالات", totalProperties: "الإعلانات", verifiedProperties: "موثقة", revenue: "إيرادات", activeSessions: "جلسات نشطة", pending: "قيد الانتظار", verify: "توثيق", unverify: "إلغاء التوثيق", suspend: "تعليق", unsuspend: "إعادة تفعيل", confirm: "تأكيد", reject: "رفض", feedback: "ملاحظات", makeFeatured: "إبراز" },
      login: { title: "تسجيل الدخول إلى إيمورا", subtitle: "ادخل إلى لوحتك.", continueGoogle: "المتابعة بـ Google", terms: "بالمتابعة فإنك توافق على الشروط." },
      ai: { title: "مساعد إيمورا", subtitle: "مستشارك العقاري الذكي", placeholder: "اطرح سؤالك…", send: "إرسال", thinking: "أفكر…", greeting: "أهلاً! أنا مساعد إيمورا. كيف أساعدك؟" },
      contact: { title: "اتصل بإيمورا", subtitle: "فريقنا في خدمتك" },
      payments: { title: "مدفوعات إيمورا", subtitle: "ادفع عبر Airtel أو Moov Money", howto: "كيفية الدفع", step1: "أرسل المبلغ عبر Airtel أو Moov", step2: "احفظ معرف المعاملة", step3: "أرسل النموذج", step4: "نراجع خلال 24 ساعة", airtelNum: "رقم Airtel Money", moovNum: "رقم Moov Money", type: "نوع الخدمة", amount: "المبلغ", method: "الطريقة", transactionId: "معرف المعاملة", payerPhone: "هاتفك", note: "ملاحظة", submit: "إرسال الدفع", history: "مدفوعاتي" },
      feedback: { title: "ملاحظات", subtitle: "ساعدنا في تحسين إيمورا", name: "الاسم", email: "البريد", phone: "الهاتف", type: "النوع", rating: "التقييم", message: "رسالتك", submit: "إرسال", suggestion: "اقتراح", issue: "مشكلة", feature: "ميزة جديدة", report: "بلاغ", thanks: "شكرًا!" },
      common: { loading: "جارٍ التحميل…", error: "حدث خطأ", save: "حفظ", cancel: "إلغاء", delete: "حذف", edit: "تعديل", confirm: "تأكيد", yes: "نعم", no: "لا", all: "الكل", filter: "تصفية", close: "إغلاق", language: "اللغة", from: "من" },
    },
  },
};

const saved = typeof window !== "undefined" ? localStorage.getItem("imora_lang") : null;

i18n.use(initReactI18next).init({
  resources,
  lng: saved || "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

export const setLanguage = (lng) => {
  localStorage.setItem("imora_lang", lng);
  i18n.changeLanguage(lng);
  document.documentElement.dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lng;
};

if (typeof window !== "undefined") {
  document.documentElement.dir = (saved || "fr") === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = saved || "fr";
}

export default i18n;
