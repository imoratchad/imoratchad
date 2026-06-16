// IMORA Constants — quartiers, types, transactions, langues

export const ARRONDISSEMENTS = {
  "1er Arrondissement": ["Farcha", "Cité du 1er Décembre", "Klémat", "Diguel"],
  "2e Arrondissement": ["Chagoua", "Paris-Congo", "Moursal", "Moursal Extension", "Sabangali"],
  "3e Arrondissement": ["Ardep-Djoumal", "Ridina", "Gardolé", "Habéna"],
  "4e Arrondissement": ["Atrone", "Walia", "Toukra", "Gassi"],
  "5e Arrondissement": ["Karkandjeri", "Amtoukoui", "Ambatta", "Dembé"],
  "6e Arrondissement": ["Nguéli", "Djambal Bahr", "Digangali", "Goudji"],
  "7e Arrondissement": ["Dino", "Boudalbagara", "Bakara", "Etena"],
  "8e Arrondissement": ["Abatssana", "Béguinage", "Digo"],
  "9e Arrondissement": ["Lamadji", "Koundoul", "Loumia"],
  "10e Arrondissement": ["Mandjafa Extension", "Dourbali", "Kournarie", "Kourmanadi"],
  "Autres secteurs et extensions": [
    "Djari", "Djari Extension", "Klessoum", "Mandjafa", "Abena",
    "Chari Logone", "Ndjari", "Tiné", "Walia Extension", "Farcha Extension",
    "Gassi Extension", "Toukra Extension", "Diguel Ryad", "Diguel Est",
    "Diguel Centre", "Diguel Nord", "Bololo", "CEG de Diguel",
    "Quartier des Ambassades", "Avenue Boulevard 40M (Rue de 40M)"
  ],
};

export const ALL_NEIGHBORHOODS = Object.values(ARRONDISSEMENTS).flat();

export const CITIES = ["N'Djamena", "Moundou", "Sarh", "Abéché", "Kelo", "Pala", "Doba", "Am Timan", "Bongor", "Mongo", "Faya-Largeau"];

export const PROPERTY_TYPES = {
  terrain: {
    label: "Terrains",
    items: [
      { value: "terrain_residentiel", label: "Terrain résidentiel" },
      { value: "terrain_commercial", label: "Terrain commercial" },
      { value: "terrain_agricole", label: "Terrain agricole" },
      { value: "terrain_industriel", label: "Terrain industriel" },
    ],
  },
  logement: {
    label: "Logements",
    items: [
      { value: "chambre", label: "Chambre" },
      { value: "studio", label: "Studio" },
      { value: "appartement", label: "Appartement" },
      { value: "maison", label: "Maison" },
      { value: "villa", label: "Villa" },
      { value: "duplex", label: "Duplex" },
      { value: "immeuble", label: "Immeuble" },
    ],
  },
  professionnel: {
    label: "Locaux professionnels",
    items: [
      { value: "bureau", label: "Bureau" },
      { value: "boutique", label: "Boutique" },
      { value: "magasin", label: "Magasin" },
      { value: "entrepot", label: "Entrepôt" },
    ],
  },
};

export const ALL_PROPERTY_TYPES = Object.values(PROPERTY_TYPES).flatMap(g => g.items);

export const TRANSACTION_TYPES = [
  { value: "vente", label: "Vente" },
  { value: "achat", label: "Achat" },
  { value: "location_journaliere", label: "Location journalière" },
  { value: "location_hebdomadaire", label: "Location hebdomadaire" },
  { value: "location_mensuelle", label: "Location mensuelle" },
  { value: "location_annuelle", label: "Location annuelle" },
];

export const DOCUMENT_TYPES = [
  "Titre foncier", "Arrêté d'attribution", "Autorisation d'occuper", "Contrat de vente", "Autres"
];

export const ROLES = [
  { value: "particulier", label: "Particulier" },
  { value: "agence", label: "Agence immobilière" },
  { value: "promoteur", label: "Promoteur immobilier" },
];

export const CONTACTS = {
  whatsapp1: "+235 64 92 73 80",
  whatsapp2: "+235 92 26 84 75",
  email: "imoratchad@gmail.com",
  tiktok: "imoratchad",
  instagram: "IMORA",
  facebook: "IMORA",
  airtel: "+235 64 92 73 80",
  moov: "+235 92 26 84 75",
};

export const NDJAMENA_CENTER = { lat: 12.1348, lng: 15.0557 };

export function formatPrice(n, currency = "XAF") {
  if (!n && n !== 0) return "";
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " " + currency;
}

export function findLabelByValue(value) {
  const t = ALL_PROPERTY_TYPES.find(t => t.value === value);
  if (t) return t.label;
  const tr = TRANSACTION_TYPES.find(t => t.value === value);
  if (tr) return tr.label;
  return value;
}
