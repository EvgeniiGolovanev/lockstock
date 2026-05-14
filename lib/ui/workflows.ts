import type { Locale } from "@/lib/i18n";

export type WorkflowId = "overview" | "stock-movement" | "purchase-orders" | "members";

export type WorkflowDefinition = {
  id: WorkflowId;
  pages: string[];
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  image: Record<Locale, string>;
};

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "overview",
    pages: ["/inventory", "/materials", "/locations", "/vendors"],
    title: {
      en: "Stock management overview",
      fr: "Vue d'ensemble de la gestion du stock"
    },
    summary: {
      en: "Master data, stock, purchasing, and group prerequisites in one map.",
      fr: "Donnees de base, stock, achats et groupes dans une carte unique."
    },
    image: {
      en: "/workflows/stock-management-overview-context.svg",
      fr: "/workflows/stock-management-overview-context-fr.svg"
    }
  },
  {
    id: "stock-movement",
    pages: ["/stock-movements"],
    title: {
      en: "Stock movement workflow",
      fr: "Workflow des mouvements de stock"
    },
    summary: {
      en: "How to choose Adjustment, Consumption, Transfer, or Receive PO.",
      fr: "Comment choisir Ajustement, Consommation, Transfert ou Reception PO."
    },
    image: {
      en: "/workflows/stock-movement-workflow.svg",
      fr: "/workflows/stock-movement-workflow-fr.svg"
    }
  },
  {
    id: "purchase-orders",
    pages: ["/purchase-orders"],
    title: {
      en: "Purchase order lifecycle",
      fr: "Cycle de vie d'une PO"
    },
    summary: {
      en: "Draft, Sent, Partial, Received, and Cancelled status rules.",
      fr: "Regles des statuts Brouillon, Envoyee, Partielle, Recue et Annulee."
    },
    image: {
      en: "/workflows/purchase-order-lifecycle.svg",
      fr: "/workflows/purchase-order-lifecycle-fr.svg"
    }
  },
  {
    id: "members",
    pages: ["/members"],
    title: {
      en: "Members and groups workflow",
      fr: "Workflow membres et groupes"
    },
    summary: {
      en: "Invitations, roles, group switching, and member removal.",
      fr: "Invitations, roles, changement de groupe et retrait de membre."
    },
    image: {
      en: "/workflows/member-group-workflow.svg",
      fr: "/workflows/member-group-workflow-fr.svg"
    }
  }
];

export function workflowImageForLocale(workflow: WorkflowDefinition, locale: Locale): string {
  return workflow.image[locale] ?? workflow.image.en;
}

export function workflowsForPathname(pathname: string): WorkflowDefinition[] {
  return WORKFLOWS.filter((workflow) => workflow.pages.includes(pathname));
}

export function workflowById(id: WorkflowId): WorkflowDefinition | undefined {
  return WORKFLOWS.find((workflow) => workflow.id === id);
}
