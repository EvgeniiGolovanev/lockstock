export type FranceCampaignSegment = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  painPoints: string[];
  outcomes: string[];
  cta: string;
  searchTerms: string[];
};

export type FranceSeoUseCase = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
};

export type FranceCampaignChannel = {
  name: string;
  purpose: string;
  plays: string[];
};

export type FranceCampaignSequence = {
  slug: string;
  title: string;
  audience: string;
  steps: Array<{
    subject: string;
    body: string;
  }>;
};

export type FranceCampaignCaseStudySection = {
  label: string;
  prompt: string;
};

export const franceCampaignPromise =
  "Remplacez vos fichiers Excel par un suivi fiable des stocks, achats et fournisseurs.";

export const franceCampaignSegments: FranceCampaignSegment[] = [
  {
    slug: "construction-materiaux",
    title: "Construction et materiaux",
    eyebrow: "Chantiers, depots, fournisseurs",
    description:
      "Pour les PME du batiment qui doivent suivre les materiaux par chantier, depot ou zone sans perdre le controle des commandes fournisseurs.",
    painPoints: [
      "Fichiers Excel differents entre le bureau, le depot et les chefs de chantier",
      "Ruptures detectees trop tard sur les materiaux critiques",
      "Commandes fournisseurs difficiles a relier aux receptions et consommations"
    ],
    outcomes: [
      "Voir les stocks par emplacement avant de recommander",
      "Centraliser fournisseurs, seuils minimums et bons de commande",
      "Garder une trace des mouvements, receptions et ajustements"
    ],
    cta: "Voir LockStock pour le batiment",
    searchTerms: ["suivi stock chantier", "gestion stock materiaux", "logiciel stock batiment"]
  },
  {
    slug: "industrie-atelier",
    title: "Industrie legere et ateliers",
    eyebrow: "Pieces, consommables, achats",
    description:
      "Pour les ateliers et petites usines qui veulent connaitre leurs niveaux de stock, eviter les ruptures et structurer les achats sans deployer un ERP lourd.",
    painPoints: [
      "Pieces et consommables suivis dans des tableurs difficiles a maintenir",
      "Pas de vision claire des seuils bas et commandes ouvertes",
      "Historique de mouvements insuffisant pour comprendre les ecarts"
    ],
    outcomes: [
      "Suivre les SKU, unites, categories et seuils minimums",
      "Piloter les commandes fournisseurs jusqu'a reception",
      "Exporter l'audit des operations sensibles"
    ],
    cta: "Voir LockStock pour l'atelier",
    searchTerms: ["logiciel gestion stock PME", "logiciel inventaire atelier", "gestion consommables industrie"]
  },
  {
    slug: "maintenance-terrain",
    title: "Maintenance et interventions terrain",
    eyebrow: "Pieces, vehicules, sites",
    description:
      "Pour les equipes de maintenance qui doivent savoir quelles pieces sont disponibles, ou elles se trouvent et quand les recommander.",
    painPoints: [
      "Stock reparti entre sites, vehicules, locaux techniques ou zones de stockage",
      "Consommations terrain notees tard ou jamais dans le fichier principal",
      "Achats urgents parce que les seuils et commandes ouvertes ne sont pas visibles"
    ],
    outcomes: [
      "Localiser les pieces par site, zone ou emplacement",
      "Enregistrer consommations, transferts et ajustements",
      "Relier les achats aux fournisseurs, delais et receptions"
    ],
    cta: "Voir LockStock pour la maintenance",
    searchTerms: ["gestion stock maintenance", "suivi pieces detachees", "logiciel stock multi sites"]
  }
];

export const franceSeoUseCases: FranceSeoUseCase[] = [
  {
    slug: "gestion-stock-pme",
    title: "Gestion de stock pour PME",
    description: "Une page pilier pour les dirigeants et responsables operations qui cherchent une alternative simple a l'ERP.",
    keywords: ["logiciel gestion stock PME", "gestion stock entreprise", "outil suivi stock PME"]
  },
  {
    slug: "remplacer-excel-stock",
    title: "Remplacer Excel pour la gestion de stock",
    description: "Comparer les limites des tableurs avec une base stock structuree, partagee et auditable.",
    keywords: ["gestion stock Excel", "remplacer Excel stock", "inventaire Excel PME"]
  },
  {
    slug: "gestion-commandes-fournisseurs",
    title: "Gestion des commandes fournisseurs",
    description: "Capter les recherches autour des bons de commande, receptions partielles et fournisseurs.",
    keywords: ["gestion commandes fournisseurs", "bon de commande fournisseur", "suivi achats fournisseurs"]
  },
  {
    slug: "inventaire-multi-sites",
    title: "Inventaire multi-sites",
    description: "Expliquer le suivi par entrepot, chantier, zone, vehicule ou local technique.",
    keywords: ["inventaire multi sites", "stock par emplacement", "gestion stock entrepots"]
  }
];

export const franceCampaignChannels: FranceCampaignChannel[] = [
  {
    name: "Google Search Ads",
    purpose: "Capturer la demande existante sur les recherches stock, inventaire, Excel et fournisseurs.",
    plays: [
      "Groupes d'annonces par intention: Excel, chantier, inventaire, commandes fournisseurs",
      "Pages d'atterrissage dediees par vertical",
      "Mots-cles negatifs pour emploi, formation, gratuit hors essai et definitions scolaires"
    ]
  },
  {
    name: "SEO francais",
    purpose: "Construire une base durable de trafic qualifie sur les cas d'usage stock et achats.",
    plays: [
      "Pages piliers pour PME, Excel, commandes fournisseurs et multi-sites",
      "Articles courts bases sur les questions operationnelles",
      "Maillage interne vers l'essai gratuit, la demo et la checklist"
    ]
  },
  {
    name: "LinkedIn organique et payant",
    purpose: "Toucher responsables operations, achats, supply chain, dirigeants PME et consultants.",
    plays: [
      "Posts fondateur avec captures produit, workflows et erreurs Excel",
      "Retargeting des visiteurs de pages demo, tarifs et checklist",
      "Campagnes lead-gen limitees aux fonctions operations, achats et direction"
    ]
  },
  {
    name: "Prospection B2B",
    purpose: "Tester rapidement les verticals avec des listes ciblees et des messages utiles.",
    plays: [
      "Listes par region, secteur et role professionnel",
      "Email court avec probleme metier, preuve produit et lien de desinscription",
      "Relance LinkedIn manuelle apres ouverture ou visite de page"
    ]
  },
  {
    name: "Partenariats et evenements",
    purpose: "Obtenir des introductions qualifiees via consultants, integrateurs et reseaux PME.",
    plays: [
      "Webinaires avec consultants operations, Odoo/Sage-adjacents, CCI et experts supply chain",
      "Rendez-vous autour de salons industrie/logistique avant tout achat de stand",
      "Commission referral pour partenaires qui apportent des comptes qualifies"
    ]
  },
  {
    name: "Directories et avis",
    purpose: "Renforcer la preuve sociale sur les recherches comparatives de logiciels.",
    plays: [
      "Fiches Appvizer, Capterra et GetApp avec captures et video demo",
      "Demander un avis aux utilisateurs actives apres leur premier workflow complet",
      "Reprendre les avis dans les pages verticales et emails de nurture"
    ]
  }
];

export const franceCampaignSequences: FranceCampaignSequence[] = [
  {
    slug: "prospection-b2b",
    title: "Prospection B2B froide",
    audience: "Responsables operations, achats, stock, chantier, maintenance et dirigeants PME.",
    steps: [
      {
        subject: "Vos stocks sont encore suivis dans Excel ?",
        body:
          "Bonjour, je contacte les equipes qui gerent stocks, achats et fournisseurs avec plusieurs fichiers Excel. LockStock aide a centraliser articles, emplacements, commandes fournisseurs et mouvements. Si ce sujet n'est pas pertinent pour votre role, repondez desinscription et je ne vous recontacterai pas."
      },
      {
        subject: "Exemple concret: stock bas + commande fournisseur",
        body:
          "Un cas frequent: l'equipe voit trop tard qu'un article critique passe sous seuil minimum, puis ne sait pas si une commande fournisseur est deja ouverte. LockStock relie seuils, emplacements, fournisseurs, bons de commande et receptions dans le meme espace."
      },
      {
        subject: "Audit stock PME en 15 minutes",
        body:
          "Je peux vous envoyer une checklist courte pour identifier les points faibles de votre suivi stock actuel: fichiers multiples, seuils, mouvements, receptions, droits d'acces et audit."
      }
    ]
  },
  {
    slug: "nurture-essai",
    title: "Nurture essai gratuit",
    audience: "Contacts ayant cree un compte ou telecharge la checklist.",
    steps: [
      {
        subject: "Commencez par 10 articles critiques",
        body:
          "Pour evaluer LockStock, importez d'abord les articles qui provoquent le plus de ruptures ou d'achats urgents. Ajoutez un emplacement, un fournisseur et un seuil minimum."
      },
      {
        subject: "Reliez achats et receptions",
        body:
          "Creez un bon de commande fournisseur, marquez-le envoye, puis receptionnez partiellement ou totalement les lignes. Vous obtenez un historique clair entre achat et stock."
      },
      {
        subject: "Controlez les roles et l'audit",
        body:
          "Invitez une personne de l'equipe et verifiez les droits. Les operations importantes restent visibles dans le journal d'activite et l'export d'audit selon le plan."
      }
    ]
  },
  {
    slug: "relance-demo",
    title: "Relance apres demande demo",
    audience: "Prospects ayant demande une demo ou visite la page tarifs.",
    steps: [
      {
        subject: "Preparer la demo LockStock",
        body:
          "Pour rendre la demo utile, envoyez simplement votre contexte: nombre d'articles, emplacements, fournisseurs, utilisateurs et principal probleme actuel."
      },
      {
        subject: "Ce que nous couvrirons en 20 minutes",
        body:
          "La demo suit un scenario simple: catalogue articles, stock par emplacement, commande fournisseur, reception, mouvement de stock, roles et audit."
      }
    ]
  },
  {
    slug: "reactivation-essai",
    title: "Reactivation essai inactif",
    audience: "Comptes d'essai sans activite complete apres quelques jours.",
    steps: [
      {
        subject: "Besoin d'aide pour importer vos articles ?",
        body:
          "Si l'essai est bloque par la preparation du fichier, commencez avec 10 lignes seulement: SKU, nom, unite et stock minimum. Vous pourrez enrichir ensuite."
      },
      {
        subject: "Votre premier workflow stock en 5 minutes",
        body:
          "Creez un emplacement, ajoutez un article, enregistrez un mouvement et consultez l'etat du stock. Ce parcours suffit pour verifier si LockStock correspond a votre equipe."
      }
    ]
  }
];

export const franceCampaignMetrics = [
  "visites",
  "essais",
  "demandes_demo",
  "leads_qualifies",
  "activation",
  "conversion_payante",
  "cac_estime"
];

export const franceCampaignCaseStudyTemplate: FranceCampaignCaseStudySection[] = [
  {
    label: "Probleme",
    prompt: "Decrire le risque operationnel principal: rupture, achat urgent, stock introuvable ou tableur non fiable."
  },
  {
    label: "Ancien workflow",
    prompt: "Montrer comment l'equipe travaillait avant: fichiers Excel, messages, appels, corrections manuelles."
  },
  {
    label: "Workflow LockStock",
    prompt: "Presenter le nouveau scenario: article, emplacement, fournisseur, commande, reception, mouvement et audit."
  },
  {
    label: "Resultat mesurable",
    prompt: "Indiquer un indicateur concret: temps gagne, ruptures evitees, commandes clarifiees, utilisateurs actifs."
  }
];

export const franceComplianceRules = [
  "Obtenir le consentement avant les traceurs de publicite personnalisee et retargeting.",
  "Garder chaque prospection B2B pertinente pour le role professionnel contacte.",
  "Inclure une option de desinscription simple dans chaque sequence outbound.",
  "Maintenir une liste de suppression CRM pour ne pas recontacter les personnes opposees.",
  "Documenter la source des contacts, le segment cible et la finalite de traitement."
];

export function getFranceCampaignSegment(slug: string) {
  return franceCampaignSegments.find((segment) => segment.slug === slug);
}
