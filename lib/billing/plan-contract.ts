export const BILLING_PLANS = ["starter", "operations", "business", "enterprise"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export const PAID_PLANS = ["starter", "operations", "business"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type PlanFeatures = {
  organizationAuditLog: boolean;
  auditCsvExport: boolean;
};

export type PlanLimits = {
  users: number | null;
  workspaces: number | null;
  teams: number | null;
  locations: number | null;
  materials: number | null;
  suppliers: number | null;
  purchaseOrdersPerMonth: number | null;
  stockMovementsPerMonth: number | null;
  csvImportRows: number | null;
  auditExportDays: number;
};

export type PlanPublicCopy = {
  title: string;
  description: string;
  recommended: boolean;
  priceLabel: string;
  annualLabel: string;
  ctaLabel: string;
  highlights: readonly string[];
  limitLabels: {
    users: string;
    workspaces: string;
    teams: string;
    locations: string;
    materials: string;
    suppliers: string;
    purchaseOrdersPerMonth: string;
    stockMovementsPerMonth: string;
    csvImportRows: string;
    lowStockAlerts: string;
    stockHealthReport: string;
    workflowGuides: string;
    auditLog: string;
    auditCsvExport: string;
    dataRetention: string;
    support: string;
  };
};

export type PlanContract = {
  pricing: {
    monthly: number | null;
    annual: number | null;
    annualMonthlyEquivalent: number | null;
  };
  features: PlanFeatures;
  limits: PlanLimits;
  public: PlanPublicCopy;
};

export const billingPlanContract = {
  starter: {
    pricing: { monthly: 49, annual: 468, annualMonthlyEquivalent: 39 },
    features: { organizationAuditLog: false, auditCsvExport: false },
    limits: {
      users: 3,
      workspaces: 1,
      teams: 1,
      locations: 3,
      materials: 500,
      suppliers: 50,
      purchaseOrdersPerMonth: 50,
      stockMovementsPerMonth: 500,
      csvImportRows: 100,
      auditExportDays: 0
    },
    public: {
      title: "Starter",
      description: "For small teams replacing spreadsheets.",
      recommended: false,
      priceLabel: "EUR 49",
      annualLabel: "EUR 39/mo, billed annually",
      ctaLabel: "Choose plan",
      highlights: ["3 users included", "3 stock locations", "500 materials/SKUs", "50 purchase orders per month"],
      limitLabels: {
        users: "3",
        workspaces: "1",
        teams: "1",
        locations: "3",
        materials: "500",
        suppliers: "50",
        purchaseOrdersPerMonth: "50",
        stockMovementsPerMonth: "500",
        csvImportRows: "100 rows/import",
        lowStockAlerts: "Included",
        stockHealthReport: "Included",
        workflowGuides: "Included",
        auditLog: "Own recent activity",
        auditCsvExport: "Not included",
        dataRetention: "12 months",
        support: "Email"
      }
    }
  },
  operations: {
    pricing: { monthly: 109, annual: 1068, annualMonthlyEquivalent: 89 },
    features: { organizationAuditLog: true, auditCsvExport: true },
    limits: {
      users: 8,
      workspaces: 1,
      teams: 5,
      locations: null,
      materials: 5000,
      suppliers: 500,
      purchaseOrdersPerMonth: 500,
      stockMovementsPerMonth: 10000,
      csvImportRows: 1000,
      auditExportDays: 90
    },
    public: {
      title: "Operations",
      description: "For teams running daily stock and purchasing workflows.",
      recommended: true,
      priceLabel: "EUR 109",
      annualLabel: "EUR 89/mo, billed annually",
      ctaLabel: "Choose plan",
      highlights: ["8 users included", "Unlimited locations", "5,000 materials/SKUs", "Audit CSV export"],
      limitLabels: {
        users: "8",
        workspaces: "1",
        teams: "5",
        locations: "Unlimited",
        materials: "5,000",
        suppliers: "500",
        purchaseOrdersPerMonth: "500",
        stockMovementsPerMonth: "10,000",
        csvImportRows: "1,000 rows/import",
        lowStockAlerts: "Included",
        stockHealthReport: "Included",
        workflowGuides: "Included",
        auditLog: "Latest 20 organization events",
        auditCsvExport: "90 days/export",
        dataRetention: "36 months",
        support: "Priority email"
      }
    }
  },
  business: {
    pricing: { monthly: 219, annual: 2148, annualMonthlyEquivalent: 179 },
    features: { organizationAuditLog: true, auditCsvExport: true },
    limits: {
      users: 20,
      workspaces: 1,
      teams: 20,
      locations: null,
      materials: 25000,
      suppliers: 2500,
      purchaseOrdersPerMonth: 2500,
      stockMovementsPerMonth: 50000,
      csvImportRows: 10000,
      auditExportDays: 366
    },
    public: {
      title: "Business",
      description: "For multi-site operations with deeper controls.",
      recommended: false,
      priceLabel: "EUR 219",
      annualLabel: "EUR 179/mo, billed annually",
      ctaLabel: "Choose plan",
      highlights: ["20 users included", "1 workspace per subscription", "25,000 materials/SKUs", "Onboarding session"],
      limitLabels: {
        users: "20",
        workspaces: "1 per subscription",
        teams: "20",
        locations: "Unlimited",
        materials: "25,000",
        suppliers: "2,500",
        purchaseOrdersPerMonth: "2,500",
        stockMovementsPerMonth: "50,000",
        csvImportRows: "10,000 rows/import",
        lowStockAlerts: "Included",
        stockHealthReport: "Included",
        workflowGuides: "Included",
        auditLog: "Latest 20 organization events",
        auditCsvExport: "366 days/export",
        dataRetention: "7 years",
        support: "Priority + onboarding"
      }
    }
  },
  enterprise: {
    pricing: { monthly: null, annual: null, annualMonthlyEquivalent: null },
    features: { organizationAuditLog: true, auditCsvExport: true },
    limits: {
      users: null,
      workspaces: null,
      teams: null,
      locations: null,
      materials: null,
      suppliers: null,
      purchaseOrdersPerMonth: null,
      stockMovementsPerMonth: null,
      csvImportRows: null,
      auditExportDays: 366
    },
    public: {
      title: "Enterprise",
      description: "For larger organizations with custom security and support needs.",
      recommended: false,
      priceLabel: "Custom",
      annualLabel: "Annual contract",
      ctaLabel: "Contact sales",
      highlights: ["Custom users", "1 workspace per subscription", "Custom retention", "SLA options"],
      limitLabels: {
        users: "Custom",
        workspaces: "1 per subscription",
        teams: "Custom",
        locations: "Unlimited",
        materials: "Custom",
        suppliers: "Custom",
        purchaseOrdersPerMonth: "Custom",
        stockMovementsPerMonth: "Custom",
        csvImportRows: "Custom",
        lowStockAlerts: "Included",
        stockHealthReport: "Included",
        workflowGuides: "Included",
        auditLog: "Custom",
        auditCsvExport: "Custom",
        dataRetention: "Custom",
        support: "SLA / dedicated"
      }
    }
  }
} as const satisfies Record<BillingPlan, PlanContract>;

export type PlanContractMap = typeof billingPlanContract;

export function buildPricingCards() {
  return BILLING_PLANS.map((plan) => ({
    id: plan,
    ...billingPlanContract[plan].public
  }));
}

export function buildPaymentCards() {
  return PAID_PLANS.map((plan) => ({
    id: plan,
    ...billingPlanContract[plan].public
  }));
}

export function buildPricingLimitRows() {
  return [
    ["Monthly price", billingPlanContract.starter.public.priceLabel, billingPlanContract.operations.public.priceLabel, billingPlanContract.business.public.priceLabel, billingPlanContract.enterprise.public.priceLabel],
    ["Annual equivalent", billingPlanContract.starter.public.annualLabel, billingPlanContract.operations.public.annualLabel, billingPlanContract.business.public.annualLabel, billingPlanContract.enterprise.public.annualLabel],
    ["Included users", billingPlanContract.starter.public.limitLabels.users, billingPlanContract.operations.public.limitLabels.users, billingPlanContract.business.public.limitLabels.users, billingPlanContract.enterprise.public.limitLabels.users],
    ["Extra users", "EUR 9/user/mo", "EUR 9/user/mo", "EUR 7/user/mo", "Custom"],
    ["Organizations / workspaces", billingPlanContract.starter.public.limitLabels.workspaces, billingPlanContract.operations.public.limitLabels.workspaces, billingPlanContract.business.public.limitLabels.workspaces, billingPlanContract.enterprise.public.limitLabels.workspaces],
    ["Teams / groups", billingPlanContract.starter.public.limitLabels.teams, billingPlanContract.operations.public.limitLabels.teams, billingPlanContract.business.public.limitLabels.teams, billingPlanContract.enterprise.public.limitLabels.teams],
    ["Locations", billingPlanContract.starter.public.limitLabels.locations, billingPlanContract.operations.public.limitLabels.locations, billingPlanContract.business.public.limitLabels.locations, billingPlanContract.enterprise.public.limitLabels.locations],
    ["Materials / SKUs", billingPlanContract.starter.public.limitLabels.materials, billingPlanContract.operations.public.limitLabels.materials, billingPlanContract.business.public.limitLabels.materials, billingPlanContract.enterprise.public.limitLabels.materials],
    ["Suppliers / vendors", billingPlanContract.starter.public.limitLabels.suppliers, billingPlanContract.operations.public.limitLabels.suppliers, billingPlanContract.business.public.limitLabels.suppliers, billingPlanContract.enterprise.public.limitLabels.suppliers],
    ["Purchase orders / month", billingPlanContract.starter.public.limitLabels.purchaseOrdersPerMonth, billingPlanContract.operations.public.limitLabels.purchaseOrdersPerMonth, billingPlanContract.business.public.limitLabels.purchaseOrdersPerMonth, billingPlanContract.enterprise.public.limitLabels.purchaseOrdersPerMonth],
    ["Stock movements / month", billingPlanContract.starter.public.limitLabels.stockMovementsPerMonth, billingPlanContract.operations.public.limitLabels.stockMovementsPerMonth, billingPlanContract.business.public.limitLabels.stockMovementsPerMonth, billingPlanContract.enterprise.public.limitLabels.stockMovementsPerMonth],
    ["CSV material import", billingPlanContract.starter.public.limitLabels.csvImportRows, billingPlanContract.operations.public.limitLabels.csvImportRows, billingPlanContract.business.public.limitLabels.csvImportRows, billingPlanContract.enterprise.public.limitLabels.csvImportRows],
    ["Low-stock alerts", billingPlanContract.starter.public.limitLabels.lowStockAlerts, billingPlanContract.operations.public.limitLabels.lowStockAlerts, billingPlanContract.business.public.limitLabels.lowStockAlerts, billingPlanContract.enterprise.public.limitLabels.lowStockAlerts],
    ["Stock-health report", billingPlanContract.starter.public.limitLabels.stockHealthReport, billingPlanContract.operations.public.limitLabels.stockHealthReport, billingPlanContract.business.public.limitLabels.stockHealthReport, billingPlanContract.enterprise.public.limitLabels.stockHealthReport],
    ["Workflow guides", billingPlanContract.starter.public.limitLabels.workflowGuides, billingPlanContract.operations.public.limitLabels.workflowGuides, billingPlanContract.business.public.limitLabels.workflowGuides, billingPlanContract.enterprise.public.limitLabels.workflowGuides],
    ["Audit log in app", billingPlanContract.starter.public.limitLabels.auditLog, billingPlanContract.operations.public.limitLabels.auditLog, billingPlanContract.business.public.limitLabels.auditLog, billingPlanContract.enterprise.public.limitLabels.auditLog],
    ["Audit CSV export", billingPlanContract.starter.public.limitLabels.auditCsvExport, billingPlanContract.operations.public.limitLabels.auditCsvExport, billingPlanContract.business.public.limitLabels.auditCsvExport, billingPlanContract.enterprise.public.limitLabels.auditCsvExport],
    ["Data retention", billingPlanContract.starter.public.limitLabels.dataRetention, billingPlanContract.operations.public.limitLabels.dataRetention, billingPlanContract.business.public.limitLabels.dataRetention, billingPlanContract.enterprise.public.limitLabels.dataRetention],
    ["Support", billingPlanContract.starter.public.limitLabels.support, billingPlanContract.operations.public.limitLabels.support, billingPlanContract.business.public.limitLabels.support, billingPlanContract.enterprise.public.limitLabels.support]
  ] as const;
}
