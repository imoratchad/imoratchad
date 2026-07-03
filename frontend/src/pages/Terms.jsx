import React from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, ScrollText } from "lucide-react";

const Terms = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-[#FF6B1A]/10 text-[#FF6B1A] rounded-full p-3">
          <ScrollText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tighter">
            {t("terms.title")}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">{t("terms.lastUpdated")}</p>
        </div>
      </div>

      <div
        className="prose prose-sm sm:prose-base max-w-none mt-6 text-neutral-800 leading-relaxed"
        data-testid="terms-content"
      >
        <h2 className="font-heading font-black text-xl mt-6 mb-2">1. Objet</h2>
        <p>
          Les présentes Conditions Générales d&apos;Utilisation (ci-après « CGU ») régissent l&apos;accès
          et l&apos;utilisation de la plateforme <strong>IMORA Tchad</strong>, accessible sur le site
          web <code>imoratchad.com</code> et via l&apos;application mobile (Play Store / Web).
          En accédant à la plateforme, l&apos;utilisateur accepte sans réserve les présentes CGU.
        </p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">2. Nature du service</h2>
        <p>
          <strong>IMORA Tchad est une plateforme de mise en relation</strong> entre des particuliers,
          agences immobilières, démarcheurs, promoteurs et des personnes intéressées par l&apos;achat,
          la vente ou la location de biens immobiliers au Tchad. IMORA n&apos;est pas partie aux
          transactions conclues entre utilisateurs, ne perçoit aucune commission sur les
          transactions, et n&apos;a pas la qualité d&apos;agent immobilier au sens légal.
        </p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">3. Aucune garantie de transaction</h2>
        <div className="bg-red-50 border-l-4 border-red-600 p-3 my-3">
          <p className="font-semibold text-red-900 m-0">
            IMORA <strong>ne garantit pas</strong> l&apos;authenticité, la qualité, la disponibilité ni
            le prix des biens présentés. Les utilisateurs sont invités à vérifier eux-mêmes les
            informations, visiter les biens en personne et ne jamais verser d&apos;argent
            (acompte, frais de visite, réservation) par Mobile Money avant d&apos;avoir rencontré
            l&apos;annonceur.
          </p>
        </div>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">4. Comptes et vérification</h2>
        <p>L&apos;inscription se fait via Google (OAuth). Chaque compte doit correspondre à une personne
          physique ou morale réellement existante. L&apos;utilisateur s&apos;engage à fournir des
          informations exactes (nom, téléphone, agence…) et à maintenir ses coordonnées à jour.</p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">5. Publication d&apos;annonces</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Les annonces publiées par des <em>particuliers</em> sont soumises à modération avant publication.</li>
          <li>Les <em>agences</em>, <em>promoteurs</em> et <em>démarcheurs</em> vérifiés peuvent publier directement.</li>
          <li>Les photos doivent être réelles, non retouchées de manière trompeuse et libres de droits.</li>
          <li>Le prix, la localisation et les caractéristiques doivent être exacts.</li>
        </ul>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">6. Modération et suppression</h2>
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 my-3">
          <p className="font-semibold text-amber-900 m-0">
            L&apos;administration IMORA <strong>se réserve le droit</strong>, à sa seule discrétion et
            sans préavis, de refuser, modifier ou supprimer toute annonce et de suspendre ou
            supprimer tout compte suspect, frauduleux, en infraction avec les présentes CGU ou avec
            la législation en vigueur au Tchad.
          </p>
        </div>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">7. Signalement</h2>
        <p>Tout utilisateur peut signaler une annonce ou un comportement suspect via le bouton
          « Signaler cette annonce » présent sur chaque fiche de bien. Les signalements sont
          examinés par l&apos;équipe IMORA sous 24 à 72 heures.</p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">8. Données personnelles</h2>
        <p>IMORA collecte uniquement les données nécessaires au fonctionnement du service
          (identité, téléphone, e-mail, éventuellement position GPS approximative). Les données
          ne sont ni vendues, ni cédées à des tiers commerciaux. Elles sont conservées tant que
          l&apos;utilisateur maintient son compte actif. Toute demande de suppression peut être
          envoyée à <a className="text-[#FF6B1A] font-bold" href="mailto:imoratchad@gmail.com">imoratchad@gmail.com</a>.</p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">9. Propriété intellectuelle</h2>
        <p>Le logo, le nom « IMORA », le design, les icônes et le code de la plateforme sont la
          propriété exclusive d&apos;IMORA Tchad. Les contenus publiés par les utilisateurs restent
          leur propriété mais font l&apos;objet d&apos;une licence non exclusive à IMORA aux fins
          d&apos;affichage sur la plateforme.</p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">10. Responsabilité</h2>
        <p>IMORA ne saurait être tenue responsable des dommages directs ou indirects résultant
          d&apos;une transaction conclue entre utilisateurs, d&apos;une annonce erronée, d&apos;une
          interruption de service ou d&apos;une utilisation abusive de la plateforme par un tiers.</p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">11. Modification des CGU</h2>
        <p>IMORA peut modifier les présentes CGU à tout moment. La date de dernière mise à jour
          est indiquée en tête de la présente page. L&apos;utilisation continue de la plateforme après
          modification vaut acceptation des nouvelles CGU.</p>

        <h2 className="font-heading font-black text-xl mt-6 mb-2">12. Contact</h2>
        <p>Pour toute question relative aux présentes CGU :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>E-mail : <a className="text-[#FF6B1A] font-bold" href="mailto:imoratchad@gmail.com">imoratchad@gmail.com</a></li>
          <li>WhatsApp : +235 64 92 73 80</li>
        </ul>

        <div className="mt-8 bg-[#0A0A0A] text-white rounded-xl p-5 flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-[#00B4FF] shrink-0" />
          <p className="text-sm m-0">
            IMORA Tchad — Plateforme de mise en relation immobilière. Toute utilisation frauduleuse
            fera l&apos;objet d&apos;une suppression immédiate et pourra être signalée aux autorités.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
