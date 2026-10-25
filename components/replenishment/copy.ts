export const replenishmentCopy = {
  en: {
    title: "Replenishment", plan: "Replenishment plan", scope: "Company-wide stock · all locations", date: "Plan through", refresh: "Refresh", state: "View", all: "All shortages",
    ready: "Ready", review: "Review incoming", setup: "Setup required", draft: "Draft in progress", covered: "Covered / nothing to order",
    loading: "Loading recommendations…", empty: "No materials match this view.", retry: "Retry", readOnly: "A manager with workspace write access can change settings and create drafts.",
    material: "Material", onHand: "On hand", minimum: "Minimum", target: "Target", incoming: "Timely incoming", planned: "In drafts", suggested: "Suggested", supplier: "Supplier", settings: "Settings",
    select: "Select", explain: "Calculation and orders", none: "Choose supplier", save: "Save settings", close: "Close", reviewOrders: "Review draft orders", create: "Create draft orders",
    quantity: "Order quantity", price: "Unit price", noPrice: "Price not set", currency: "Currency", expected: "Expected date (optional)", ack: "I reviewed uncertain or late incoming orders and the risk of buying twice.",
    warning: "Incoming orders need review. They are excluded from timely supply.", formula: "Target − on hand − timely incoming − existing drafts = suggestion (minimum zero). Drafts are planned purchases, not confirmed deliveries.",
    check: "Check result", pending: "A previous request has an unresolved result. Check it or retry the identical request.", retryRequest: "Retry same request", created: "Draft orders created", orders: "Open purchase orders", unknown: "Some prices are missing; totals are partial.", subtotal: "Known subtotal", next: "Next", previous: "Previous", error: "Could not complete this action. Try again.", storage: "Result recovery is unavailable. Enable local storage before creating orders.",
    changed: "Recommendations changed. Refresh and review your selection again.", scopeNote: "This view uses the total company stock. It does not calculate shortages for individual warehouses.", notice: "Nothing is sent to suppliers. Stock changes only when goods are received."
    ,draftWarning: "An existing draft has no date or falls outside this horizon. It prevents repeat planning but is not a confirmed delivery."
  },
  fr: {
    title: "Réapprovisionnement", plan: "Plan de réapprovisionnement", scope: "Stock de l’entreprise · tous les emplacements", date: "Planifier jusqu’au", refresh: "Actualiser", state: "Vue", all: "Tous les besoins",
    ready: "Prêt", review: "Livraisons à vérifier", setup: "Configuration requise", draft: "Brouillon en cours", covered: "Couvert / rien à commander",
    loading: "Calcul des recommandations…", empty: "Aucun article ne correspond à cette vue.", retry: "Réessayer", readOnly: "Un responsable disposant des droits d’écriture peut modifier les paramètres et créer des brouillons.",
    material: "Article", onHand: "En stock", minimum: "Minimum", target: "Cible", incoming: "Livraisons à temps", planned: "En brouillons", suggested: "À commander", supplier: "Fournisseur", settings: "Paramètres",
    select: "Sélectionner", explain: "Calcul et commandes", none: "Choisir un fournisseur", save: "Enregistrer", close: "Fermer", reviewOrders: "Vérifier les brouillons", create: "Créer les brouillons",
    quantity: "Quantité à commander", price: "Prix unitaire", noPrice: "Prix non renseigné", currency: "Devise", expected: "Date prévue (facultative)", ack: "J’ai vérifié les livraisons incertaines ou tardives et le risque de double achat.",
    warning: "Livraisons à vérifier : exclues des arrivages à temps.", formula: "Cible − stock − livraisons à temps − brouillons existants = suggestion (minimum zéro). Un brouillon n’est pas une livraison confirmée.",
    check: "Vérifier le résultat", pending: "Le résultat d’une demande précédente est incertain. Vérifiez-le ou réessayez la même demande.", retryRequest: "Réessayer la même demande", created: "Brouillons créés", orders: "Ouvrir les commandes", unknown: "Certains prix manquent ; les totaux sont partiels.", subtotal: "Sous-total connu", next: "Suivant", previous: "Précédent", error: "Impossible de terminer cette action. Réessayez.", storage: "La récupération du résultat est indisponible. Activez le stockage local avant de créer des commandes.",
    changed: "Les recommandations ont changé. Actualisez puis vérifiez la sélection.", scopeNote: "Cette vue utilise le stock total de l’entreprise, sans calcul des besoins par entrepôt.", notice: "Aucun envoi au fournisseur. Le stock change uniquement à la réception."
    ,draftWarning: "Un brouillon existant n’a pas de date ou se situe hors de l’horizon. Il évite un double achat planifié mais ne confirme pas une livraison."
  }
} as const;
