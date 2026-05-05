export type Locale = "en" | "fr";

export const DEFAULT_LOCALE: Locale = "en";
export const LANGUAGE_STORAGE_KEY = "lockstock.locale";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Francais"
};

const FR_TRANSLATIONS: Record<string, string> = {
  Language: "Langue",
  "Sign In": "Se connecter",
  "Sign Out": "Se deconnecter",
  "Get Started": "Commencer",
  Account: "Compte",
  Features: "Fonctionnalites",
  Benefits: "Avantages",
  Pricing: "Tarifs",
  Product: "Produit",
  Company: "Entreprise",
  Legal: "Mentions legales",
  App: "Application",
  About: "A propos",
  Blog: "Blog",
  Contact: "Contact",
  Security: "Securite",
  "Privacy Policy": "Politique de confidentialite",
  "Terms of Service": "Conditions d'utilisation",
  "Master Your Inventory with": "Maitrisez votre inventaire avec",
  "Streamline inventory management with real-time tracking, automated reordering, and practical analytics.":
    "Simplifiez la gestion des stocks avec le suivi en temps reel, le reapprovisionnement automatise et des analyses utiles.",
  "Start Free Trial": "Demarrer l'essai gratuit",
  "Watch Demo": "Voir la demo",
  "No credit card required": "Aucune carte bancaire requise",
  "14-day free trial": "Essai gratuit de 14 jours",
  "Cancel anytime": "Annulez a tout moment",
  "Everything You Need to Manage Inventory": "Tout ce dont vous avez besoin pour gerer vos stocks",
  "Powerful features designed to streamline operations and boost efficiency.":
    "Des fonctionnalites puissantes pour simplifier les operations et ameliorer l'efficacite.",
  "Real-Time Tracking": "Suivi en temps reel",
  "Monitor your inventory levels in real-time across all locations with instant updates.":
    "Surveillez vos niveaux de stock en temps reel sur tous les emplacements avec des mises a jour instantanees.",
  "Automated Reordering": "Reapprovisionnement automatise",
  "Set reorder points and let the system automatically generate purchase orders.":
    "Definissez des seuils de reapprovisionnement et laissez le systeme generer automatiquement les commandes d'achat.",
  "Advanced Analytics": "Analyses avancees",
  "Gain insights with reports and forecasting tools to optimize stock levels.":
    "Obtenez des insights avec des rapports et des previsions pour optimiser les niveaux de stock.",
  "Smart Alerts": "Alertes intelligentes",
  "Receive notifications for low stock, expiring items, and inventory discrepancies.":
    "Recevez des notifications pour les stocks faibles, les articles proches de l'expiration et les ecarts d'inventaire.",
  "Secure and Compliant": "Securise et conforme",
  "Enterprise-grade security with role-based access control and audit trails.":
    "Securite de niveau entreprise avec controle d'acces par role et traces d'audit.",
  "Mobile Ready": "Compatible mobile",
  "Manage inventory on-the-go with responsive workflows and real-time updates.":
    "Gerez les stocks en deplacement avec des workflows adaptatifs et des mises a jour en temps reel.",
  "Reduce Costs, Increase Efficiency": "Reduire les couts, augmenter l'efficacite",
  "LockStock helps teams reduce inventory carrying costs while improving fill rate through practical workflow controls.":
    "LockStock aide les equipes a reduire les couts de stockage tout en ameliorant le taux de service grace a des controles de workflow pratiques.",
  "30% Cost Reduction": "30% de reduction des couts",
  "Optimize stock levels and reduce waste with clearer ordering decisions.":
    "Optimisez les niveaux de stock et reduisez le gaspillage avec des decisions d'achat plus claires.",
  "10x Faster Processing": "Traitement 10x plus rapide",
  "Automate repetitive updates and speed up daily purchasing operations.":
    "Automatisez les mises a jour repetitives et accelerez les operations d'achat quotidiennes.",
  "Better Collaboration": "Meilleure collaboration",
  "Keep teams aligned with shared data, role-based actions, and visible activity history.":
    "Gardez les equipes alignees avec des donnees partagees, des actions par role et un historique d'activite visible.",
  "Trusted by Leading Businesses": "Adopte par des entreprises de reference",
  "See what teams say about running inventory operations on LockStock.":
    "Decouvrez ce que disent les equipes qui gerent leurs operations d'inventaire avec LockStock.",
  "Operations Manager": "Responsable des operations",
  CEO: "PDG",
  "Warehouse Director": "Directeur d'entrepot",
  "LockStock transformed our inventory management. We reduced stockouts dramatically and purchasing is now structured.":
    "LockStock a transforme notre gestion des stocks. Nous avons fortement reduit les ruptures et les achats sont maintenant structures.",
  "The live analytics gave us visibility we never had before. We make better decisions and turnover improved.":
    "Les analyses en direct nous ont donne une visibilite que nous n'avions jamais eue. Nous prenons de meilleures decisions et la rotation s'est amelioree.",
  "Easy to use and powerful. The team can manage stock from anywhere without losing control.":
    "Simple a utiliser et puissant. L'equipe peut gerer le stock de n'importe ou sans perdre le controle.",
  "Ready to Transform Your Inventory Management?": "Pret a transformer votre gestion des stocks ?",
  "Join teams that rely on LockStock to run purchasing and stock operations with confidence.":
    "Rejoignez les equipes qui font confiance a LockStock pour piloter les achats et les stocks en toute confiance.",
  "Schedule Demo": "Planifier une demo",
  "Modern inventory management for modern businesses. Track, manage, and optimize your stock with ease.":
    "Gestion des stocks moderne pour les entreprises modernes. Suivez, gerez et optimisez votre stock simplement.",
  "(c) 2026 LockStock. All rights reserved.": "(c) 2026 LockStock. Tous droits reserves.",
  "Welcome back": "Bon retour",
  "Create your account": "Creer votre compte",
  Close: "Fermer",
  "Full Name": "Nom complet",
  "Company Name": "Nom de l'entreprise",
  Email: "E-mail",
  Password: "Mot de passe",
  "Please wait...": "Veuillez patienter...",
  "Create Account": "Creer un compte",
  or: "ou",
  "Continue with Google": "Continuer avec Google",
  "Already have an account?": "Vous avez deja un compte ?",
  "Don't have an account?": "Vous n'avez pas de compte ?",
  "Sign up": "S'inscrire",
  "Sign in": "Se connecter",
  "Account created. Check your email to confirm, then sign in.":
    "Compte cree. Verifiez votre email pour confirmer, puis connectez-vous.",
  Inventory: "Inventaire",
  Members: "Membres",
  "Materials & Stock": "Materiaux et stock",
  Materials: "Materiaux",
  "Stock Movements": "Mouvements de stock",
  Locations: "Emplacements",
  Vendors: "Fournisseurs",
  "Purchase Orders": "Commandes d'achat",
  "Inventory Management": "Gestion des stocks",
  "Manage your stock and track inventory levels.": "Gerez votre stock et suivez les niveaux d'inventaire.",
  "Manage materials and stock movements.": "Gerez les materiaux et les mouvements de stock.",
  "Create materials and manage the material catalog.": "Creez des materiaux et gerez le catalogue des materiaux.",
  "Add stock and review material movement history.": "Ajoutez du stock et consultez l'historique des mouvements de materiaux.",
  "Configure storage and fulfillment locations.": "Configurez les emplacements de stockage et de preparation.",
  "Maintain supplier records and lead times.": "Maintenez les fiches fournisseurs et les delais.",
  "Create, receive, and track purchase orders.": "Creez, receptionnez et suivez les commandes d'achat.",
  "Manage organization members and invitations.": "Gerez les membres de l'organisation et les invitations.",
  "Manage group members and invitations.": "Gerez les membres du groupe et les invitations.",
  "Organization Members": "Membres de l'organisation",
  "Organizations & Members": "Organisations et membres",
  "Groups & Members": "Groupes et membres",
  "Pending Invitations": "Invitations en attente",
  Invitations: "Invitations",
  "Refresh Invitations": "Actualiser les invitations",
  Direction: "Direction",
  Person: "Personne",
  Expires: "Expire",
  "No pending invitations.": "Aucune invitation en attente.",
  "My Organization Memberships": "Mes appartenances aux organisations",
  "Refresh Organizations": "Actualiser les organisations",
  "Refresh Groups": "Actualiser les groupes",
  Organization: "Organisation",
  Group: "Groupe",
  Member: "Membre",
  Owner: "Proprietaire",
  "Your Role": "Votre role",
  "Your Access": "Votre acces",
  Active: "Actif",
  Current: "Actuelle",
  "No organizations in workspace yet.": "Aucune organisation dans l'espace de travail pour le moment.",
  "No groups in workspace yet.": "Aucun groupe dans l'espace de travail pour le moment.",
  "Create group": "Creer un groupe",
  "Create Group": "Creer un groupe",
  "Rename group": "Renommer le groupe",
  "Rename Group": "Renommer le groupe",
  "Delete Group": "Supprimer le groupe",
  "Save Group Name": "Enregistrer le nom du groupe",
  "Invite to group": "Inviter dans le groupe",
  "Invite by email": "Inviter par email",
  "Send Invite Link": "Envoyer le lien d'invitation",
  "Send Invitation": "Envoyer l'invitation",
  "Refresh Members": "Actualiser les membres",
  "User ID": "ID utilisateur",
  Joined: "Inscrit",
  "Name or email unavailable": "Nom ou email indisponible",
  "No active organization membership found.": "Aucune appartenance active a l'organisation n'a ete trouvee.",
  "No active group membership found.": "Aucune appartenance active au groupe n'a ete trouvee.",
  "Only organization owner can manage members in this MVP.":
    "Seul le proprietaire de l'organisation peut gerer les membres dans ce MVP.",
  "Only group owner can manage members in this MVP.":
    "Seul le proprietaire du groupe peut gerer les membres dans ce MVP.",
  "Only group owner can invite and manage members in this MVP.":
    "Seul le proprietaire du groupe peut inviter et gerer les membres dans ce MVP.",
  "No organization members found.": "Aucun membre de l'organisation trouve.",
  "owner protected": "proprietaire protege",
  "Invitation email sent.": "Email d'invitation envoye.",
  "Email delivery skipped.": "Envoi d'email ignore.",
  "Email delivery failed.": "Echec de l'envoi de l'email.",
  "Email delivery skipped: email provider is not configured.":
    "Envoi d'email ignore : le fournisseur d'email n'est pas configure.",
  "Add location": "Ajouter un emplacement",
  "Add Location": "Ajouter un emplacement",
  "Add New Location": "Ajouter un nouvel emplacement",
  "Location Name": "Nom de l'emplacement",
  Code: "Code",
  Address: "Adresse",
  "Create Location": "Creer l'emplacement",
  "Create Material": "Creer un materiau",
  "Add to Stock": "Ajouter au stock",
  "Basic Info": "Informations de base",
  SKU: "SKU",
  Name: "Nom",
  Description: "Description",
  Unit: "Unite",
  "Unit of Measure": "Unite de mesure",
  UoM: "UdM",
  Subcategory: "Sous-categorie",
  "Minimum Stock": "Stock minimum",
  "pcs, kg, m, box": "pcs, kg, m, boite",
  "Create materials and add stock to specific locations.": "Creez des materiaux et ajoutez du stock a des emplacements specifiques.",
  "Material Search": "Recherche de materiaux",
  "Filter by SKU or name": "Filtrer par SKU ou nom",
  "No materials on this page.": "Aucun materiau sur cette page.",
  "No materials yet.": "Aucun materiau pour le moment.",
  "No locations created yet.": "Aucun emplacement cree pour le moment.",
  "Stock by Location": "Stock par emplacement",
  Unassigned: "Non assigne",
  "Location Management": "Gestion des emplacements",
  Warehouses: "Entrepots",
  Warehouse: "Entrepot",
  Zone: "Zone",
  "Locations Used": "Emplacements utilises",
  "Locations In Use": "Emplacements en service",
  "Total Locations": "Total des emplacements",
  "Vendor Management": "Gestion des fournisseurs",
  "Manage your material suppliers and vendors.": "Gerez vos fournisseurs de materiaux.",
  "Add vendor": "Ajouter un fournisseur",
  "Add Vendor": "Ajouter un fournisseur",
  "Edit vendor": "Modifier le fournisseur",
  "Edit Vendor": "Modifier le fournisseur",
  "Vendor Name": "Nom du fournisseur",
  "Vendor ID": "ID fournisseur",
  Supplier: "Fournisseur",
  "Lead Time (days)": "Delai (jours)",
  "Create Supplier": "Creer le fournisseur",
  "Update Vendor": "Mettre a jour le fournisseur",
  Edit: "Modifier",
  "Filter by vendor name": "Filtrer par nom de fournisseur",
  "Filter by vendor name, ID, phone, or address": "Filtrer par nom, ID, telephone ou adresse",
  "Search Vendor": "Rechercher un fournisseur",
  "No suppliers created yet.": "Aucun fournisseur cree pour le moment.",
  "Assigned automatically and cannot be changed.": "Assigne automatiquement et non modifiable.",
  "Phone must include a country code.": "Le numero de telephone doit inclure l'indicatif pays.",
  "Supplier not found.": "Fournisseur introuvable.",
  "Purchase Order": "Commande d'achat",
  "Create purchase order": "Creer une commande d'achat",
  "Create Purchase Order": "Creer une commande d'achat",
  "Receive purchase order": "Receptionner une commande d'achat",
  "Receive Purchase Order": "Receptionner une commande d'achat",
  "Create and manage purchase orders for materials.": "Creez et gerez les commandes d'achat de materiaux.",
  Currency: "Devise",
  "Expected Date": "Date prevue",
  "Notes (optional)": "Notes (optionnel)",
  "Additional instructions": "Instructions additionnelles",
  "+ Add Item": "+ Ajouter un article",
  "Add Item": "Ajouter un article",
  "Add Items": "Ajouter des articles",
  Material: "Materiau",
  Quantity: "Quantite",
  "Unit Price": "Prix unitaire",
  Total: "Total",
  Action: "Action",
  "No items added yet.": "Aucun article ajoute pour le moment.",
  Remove: "Supprimer",
  Cancel: "Annuler",
  "Receipt Details": "Details de reception",
  Line: "Ligne",
  "Select purchase order": "Selectionner une commande d'achat",
  "Select line": "Selectionner une ligne",
  "Select location": "Selectionner un emplacement",
  "Select material": "Selectionner un materiau",
  "Select supplier": "Selectionner un fournisseur",
  "Mark Sent": "Marquer comme envoyee",
  "Min Stock": "Stock min",
  "Quantity Delta": "Variation de quantite",
  Comments: "Commentaires",
  Reason: "Raison",
  Adjustment: "Ajustement",
  Transfer: "Transfert",
  "Transfer in": "Transfert entrant",
  "Transfer out": "Transfert sortant",
  Correction: "Correction",
  "Transfer In": "Transfert entrant",
  "Transfer Out": "Transfert sortant",
  "Purchase Receive": "Reception achat",
  "Date & Time": "Date et heure",
  "Material movements": "Mouvements de materiaux",
  "Material Movements": "Mouvements de materiaux",
  "Date and time of creation": "Date et heure de creation",
  "Search by SKU or name...": "Rechercher par SKU ou nom...",
  "All Subcategories": "Toutes les sous-categories",
  "No materials match these filters.": "Aucun materiau ne correspond a ces filtres.",
  "No material movements yet.": "Aucun mouvement de materiau pour le moment.",
  "All UoM": "Toutes les unites",
  Receive: "Receptionner",
  "Quantity Received": "Quantite recue",
  "Selected Line": "Ligne selectionnee",
  Ordered: "Commande",
  "Already Received": "Deja recu",
  Remaining: "Restant",
  "No lines on this purchase order yet.": "Aucune ligne sur cette commande d'achat pour le moment.",
  "No purchase orders match these filters.": "Aucune commande d'achat ne correspond a ces filtres.",
  "No active organization. Sign in again or sync workspace.":
    "Aucune organisation active. Reconnectez-vous ou synchronisez l'espace de travail.",
  "No active Supabase session. Cleared saved token.":
    "Aucune session Supabase active. Le jeton enregistre a ete supprime.",
  "No organization available after bootstrap.": "Aucune organisation disponible apres initialisation.",
  "Supabase browser auth is not configured.": "L'authentification navigateur Supabase n'est pas configuree.",
  "Add item failed: select a material and positive quantity.":
    "Echec de l'ajout d'article : selectionnez un materiau et une quantite positive.",
  "Create purchase order failed: supplier and at least one line are required.":
    "Echec de creation de commande d'achat : un fournisseur et au moins une ligne sont requis.",
  "Location created.": "Emplacement cree.",
  "Material created.": "Materiau cree.",
  "Supplier created.": "Fournisseur cree.",
  "Supplier updated.": "Fournisseur mis a jour.",
  "Purchase order created.": "Commande d'achat creee.",
  "Purchase order receipt recorded.": "Reception de commande d'achat enregistree.",
  "Stock movement recorded.": "Mouvement de stock enregistre.",
  "Organization member added.": "Membre de l'organisation ajoute.",
  "Group member removed.": "Membre du groupe supprime.",
  "Stock health refreshed.": "Etat du stock actualise.",
  "Signed out.": "Deconnecte.",
  "Sync Workspace": "Synchroniser l'espace de travail",
  "Refresh Data": "Actualiser les donnees",
  "Refresh Health": "Actualiser l'etat",
  "Create Org": "Creer une organisation",
  "Create Organization": "Creer une organisation",
  "Organization Picker": "Selection d'organisation",
  "Group Picker": "Selection de groupe",
  "Signed in as:": "Connecte en tant que :",
  "Not signed in.": "Non connecte.",
  "Sign in and the workspace will auto-bootstrap organization context.":
    "Connectez-vous et l'espace de travail initialisera automatiquement le contexte d'organisation.",
  "Sign in and the workspace will auto-bootstrap group context.":
    "Connectez-vous et l'espace de travail initialisera automatiquement le contexte de groupe.",
  "Access & Environment": "Acces et environnement",
  "Base URL": "URL de base",
  "Access Token (Supabase JWT)": "Jeton d'acces (Supabase JWT)",
  "Active Organization ID": "ID d'organisation active",
  "Active Group ID": "ID du groupe actif",
  "Create PO": "Creer une commande",
  "Create and manage warehouse locations.": "Creez et gerez les emplacements d'entrepot.",
  "Materials & Stock Management": "Gestion des materiaux et du stock",
  "Materials Overview": "Vue d'ensemble des materiaux",
  "Average Lead Time": "Delai moyen",
  "Open POs": "Commandes ouvertes",
  "Received POs": "Commandes recues",
  "No inventory items match these filters.": "Aucun article d'inventaire ne correspond a ces filtres.",
  "Item Name": "Nom de l'article",
  Category: "Categorie",
  Price: "Prix",
  "Price per unit": "Prix par unite",
  Status: "Statut",
  Actions: "Actions",
  Previous: "Precedent",
  Next: "Suivant",
  "Search by name or SKU...": "Rechercher par nom ou SKU...",
  "All Categories": "Toutes les categories",
  "Structural & Building Materials": "Materiaux de construction",
  "Concrete & cement": "Beton et ciment",
  "Masonry (blocks, bricks)": "Maconnerie (parpaings, briques)",
  "Wood & panels": "Bois et panneaux",
  "Metal & profiles": "Metaux et profiles",
  Insulation: "Isolation",
  "Finishing Materials": "Revetement sol, mur et peinture",
  "Flooring (tiles, parquet, vinyl)": "Revetements de sol (carrelage, parquet, vinyle)",
  "Wall coverings (paint, wallpaper)": "Revetements muraux (papier peint, lambris)",
  "Ceilings & panels": "Peinture et enduits",
  "Facade & exterior finishing": "Revetements exterieurs / facade",
  Plumbing: "Plomberie",
  "Pipes & tubes": "Tuyaux et tubes",
  "Fittings & connectors": "Raccords et connexions",
  "Valves & controls": "Robinetterie et vannes",
  "Sanitary equipment": "Equipements sanitaires",
  Electrical: "Electricite et domotique",
  "Cables & wiring": "Cables et fils electriques",
  "Switches & sockets": "Interrupteurs et prises",
  "Electrical panels & protection": "Tableaux electriques et protections",
  "Smart home / domotics": "Domotique et objets connectes",
  "HVAC (Heating / Cooling / Ventilation)": "Chauffage, climatisation et ventilation",
  "Heating systems": "Chauffage (radiateurs, chaudieres)",
  Ventilation: "Ventilation",
  "Air conditioning": "Climatisation",
  "Radiators & accessories": "Accessoires chauffage",
  "Tools & Equipment": "Outillage",
  "Power tools": "Outillage electroportatif",
  "Hand tools": "Outillage a main",
  "Construction equipment": "Equipement de chantier",
  "Measuring tools": "Outils de mesure",
  "Hardware & Fixings": "Quincaillerie",
  "Screws, bolts, anchors": "Visserie, boulonnerie, chevilles",
  "Hinges & brackets": "Charnieres et fixations",
  "Locks & security": "Serrurerie et securite",
  "Small metal parts": "Petites pieces metalliques",
  "Woodwork & Openings": "Menuiserie",
  Doors: "Portes",
  Windows: "Fenetres",
  Frames: "Cadres et huisseries",
  Shutters: "Volets",
  "Kitchen & Bath": "Cuisine & Salle de bains",
  "Kitchen units": "Meubles de cuisine",
  Worktops: "Plans de travail",
  "Bathroom furniture": "Meubles de salle de bains",
  "Fixtures (sinks, showers)": "Eviers et robinetterie",
  "Showers and bathtubs": "Douches et baignoires",
  "Sinks and basins": "Lavabos et vasques",
  "Sanitary accessories": "Accessoires sanitaires",
  "Storage & Interior Fittings": "Meuble et rangement",
  "Shelving systems": "Etageres",
  Cabinets: "Armoires et placards",
  "Closet systems": "Dressings",
  Lighting: "Luminaire",
  "Indoor lighting": "Eclairage interieur",
  "Outdoor lighting": "Eclairage exterieur",
  "Bulbs & accessories": "Ampoules et accessoires",
  "Outdoor & Site": "Terrasse et jardin",
  "Garden materials": "Materiaux exterieurs",
  "Fencing & gates": "Clotures et portails",
  "Landscaping materials": "Amenagement paysager",
  "Outdoor structures": "Structures exterieures",
  Consumables: "Droguerie",
  "Adhesives & sealants": "Colles et mastics",
  Chemicals: "Produits chimiques",
  "Cleaning products": "Produits de nettoyage",
  "Protective materials": "Consommables de protection",
  "Out of Stock": "Rupture de stock",
  "Low Stock": "Stock faible",
  "In Stock": "En stock",
  "Total Items": "Total des articles",
  "Low Stock Alerts": "Alertes stock faible",
  "Total Value": "Valeur totale",
  "Total Vendors": "Total fournisseurs",
  Activity: "Activite",
  "No activity yet.": "Aucune activite pour le moment.",
  "Search by PO number...": "Rechercher par numero de commande...",
  "All statuses": "Tous les statuts",
  "All suppliers": "Tous les fournisseurs",
  Draft: "Brouillon",
  Sent: "Envoyee",
  Partial: "Partielle",
  Received: "Recue",
  Cancelled: "Annulee",
  "Unknown supplier": "Fournisseur inconnu",
  "Unknown material": "Materiau inconnu",
  Unknown: "Inconnu",
  "Open Orders": "Commandes ouvertes",
  "Total POs": "Total des commandes",
  "Total Amount": "Montant total",
  "Received Progress": "Progression recue",
  "Received:": "Recu :",
  "Open:": "Ouvert :",
  "Total:": "Total :",
  "material lines": "lignes de materiaux",
  "No lines": "Aucune ligne",
  "Select a purchase order line to review receipt details.":
    "Selectionnez une ligne de commande d'achat pour consulter les details de reception.",
  "Manage your email, password, and private profile details.":
    "Gerez votre email, mot de passe et vos informations de profil privees.",
  "Private Info": "Informations privees",
  "Stored as private profile metadata on your user account.":
    "Stocke comme metadonnees de profil prive sur votre compte utilisateur.",
  Phone: "Telephone",
  "Job Title": "Poste",
  "Save Private Info": "Enregistrer les infos privees",
  "Changing email requires inbox confirmation from Supabase Auth.":
    "Le changement d'email requiert une confirmation par email via Supabase Auth.",
  "Current Email": "Email actuel",
  "New Email": "Nouvel email",
  "Update Email": "Mettre a jour l'email",
  "New Password": "Nouveau mot de passe",
  "Confirm New Password": "Confirmer le nouveau mot de passe",
  "Update Password": "Mettre a jour le mot de passe",
  "Use a strong password with at least 8 characters.":
    "Utilisez un mot de passe fort d'au moins 8 caracteres.",
  "Sign in to manage your account details.": "Connectez-vous pour gerer les details de votre compte.",
  "Private profile information updated.": "Les informations de profil privees ont ete mises a jour.",
  "Email update requested. Check your inbox to confirm the new address.":
    "Mise a jour d'email demandee. Verifiez votre boite mail pour confirmer la nouvelle adresse.",
  "Update email failed: enter a valid email.": "Echec de la mise a jour de l'email : saisissez un email valide.",
  "Password updated.": "Mot de passe mis a jour.",
  "All Purchase Orders": "Toutes les commandes d'achat",
  "Total Materials": "Total des materiaux",
  "Material Page": "Page des materiaux",
  "Previous Materials": "Materiaux precedents",
  "Next Materials": "Materiaux suivants",
  "Warehouse inventory management": "Gestion des stocks d'entrepot",
  "Inventory analytics dashboard": "Tableau de bord d'analyse des stocks",
  "Lead Time:": "Delai :",
  "US Dollar ($)": "Dollar americain ($)"
};

const FR_PREFIX_TRANSLATIONS: Array<[string, string]> = [
  ["Logout failed: ", "Echec de deconnexion : "],
  ["Update profile failed: ", "Echec de mise a jour du profil : "],
  ["Update email failed: ", "Echec de mise a jour de l'email : "],
  ["Update password failed: ", "Echec de mise a jour du mot de passe : "],
  ["Loading materials failed: ", "Echec du chargement des materiaux : "],
  ["Update supplier failed: ", "Echec de la mise a jour du fournisseur : "],
  ["Loading purchase orders failed: ", "Echec du chargement des commandes d'achat : "],
  ["Invite failed: ", "Echec de l'invitation : "],
  ["Add member failed: ", "Echec de l'ajout du membre : "],
  ["Remove member failed: ", "Echec de la suppression du membre : "],
  ["Create group failed: ", "Echec de creation du groupe : "],
  ["Rename group failed: ", "Echec du renommage du groupe : "],
  ["Delete group failed: ", "Echec de suppression du groupe : "],
  ["Group created: ", "Groupe cree : "],
  ["Group renamed: ", "Groupe renomme : "],
  ["Group deleted: ", "Groupe supprime : "],
  ["Invitation created for ", "Invitation creee pour "],
  ["Invitation created: ", "Invitation creee : "],
  ["Invitation accepted: joined group ", "Invitation acceptee : groupe rejoint "],
  ["Organization member removed: ", "Membre de l'organisation supprime : "],
  ["Accept invitation failed: ", "Echec de l'acceptation de l'invitation : "],
  ["Invitation accepted: ", "Invitation acceptee : "],
  ["Reject invitation failed: ", "Echec du refus de l'invitation : "],
  ["Invitation rejected: ", "Invitation refusee : "],
  ["Accept invitation to org ", "Accepter l'invitation vers l'organisation "],
  ["Reject invitation to org ", "Refuser l'invitation vers l'organisation "]
];

const PAGE_TOTAL_PATTERN = /^Page (\d+) \/ (\d+) \((\d+) total\)$/;
const ITEMS_PATTERN = /^(\d+)\sitem\(s\)\s-\s(.+)$/;
const STARS_PATTERN = /^(\d+)\sstars$/;
const TIMESTAMP_ACTIVITY_PATTERN = /^(\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?\s-\s)(.+)$/i;
const UNIT_PRICE_PATTERN = /^Unit Price \((.+)\)$/;

function translateCoreText(text: string, locale: Locale): string {
  if (locale === "en") {
    return text;
  }

  const direct = FR_TRANSLATIONS[text];
  if (direct) {
    return direct;
  }

  const pageMatch = PAGE_TOTAL_PATTERN.exec(text);
  if (pageMatch) {
    return `Page ${pageMatch[1]} / ${pageMatch[2]} (${pageMatch[3]} au total)`;
  }

  const itemsMatch = ITEMS_PATTERN.exec(text);
  if (itemsMatch) {
    return `${itemsMatch[1]} article(s) - ${itemsMatch[2]}`;
  }

  const starsMatch = STARS_PATTERN.exec(text);
  if (starsMatch) {
    return `${starsMatch[1]} etoiles`;
  }

  const unitPriceMatch = UNIT_PRICE_PATTERN.exec(text);
  if (unitPriceMatch) {
    return `Prix unitaire (${unitPriceMatch[1]})`;
  }

  for (const [prefix, translatedPrefix] of FR_PREFIX_TRANSLATIONS) {
    if (text.startsWith(prefix)) {
      return `${translatedPrefix}${text.slice(prefix.length)}`;
    }
  }

  const activityMatch = TIMESTAMP_ACTIVITY_PATTERN.exec(text);
  if (activityMatch) {
    const translatedTail = translateCoreText(activityMatch[2], locale);
    return `${activityMatch[1]}${translatedTail}`;
  }

  return text;
}

export function normalizeLocale(value: string | null | undefined): Locale {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized.startsWith("fr")) {
    return "fr";
  }
  return DEFAULT_LOCALE;
}

export function localeLabel(locale: Locale): string {
  return LOCALE_LABELS[locale];
}

export function translateText(text: string, locale: Locale): string {
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.trim();
  if (!core) {
    return text;
  }
  return `${leading}${translateCoreText(core, locale)}${trailing}`;
}
