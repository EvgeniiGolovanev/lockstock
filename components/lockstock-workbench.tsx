"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavItemIcon, type NavIcon } from "@/components/nav-item-icon";
import { WorkbenchCatalogForms } from "@/components/workbench/catalog-forms";
import { WorkbenchLocationsSection } from "@/components/workbench/locations-section";
import { WorkbenchMaterialsSection } from "@/components/workbench/materials-section";
import { WorkbenchMembersSection } from "@/components/workbench/members-section";
import { WorkbenchPurchaseOrderForms } from "@/components/workbench/purchase-order-forms";
import { WorkbenchPurchaseOrdersSection } from "@/components/workbench/purchase-orders-section";
import { WorkbenchStockMovementsSection } from "@/components/workbench/stock-movements-section";
import { WorkbenchSnapshotSection } from "@/components/workbench/snapshot-section";
import { WorkbenchSuppliersSection } from "@/components/workbench/suppliers-section";
import { WorkflowGallery, WorkflowGuideButton } from "@/components/workflow-guide";
import { getSignedOutRedirectPath, shouldShowSignedOutPanels } from "@/lib/auth/route-guards";
import { browserApiRequest } from "@/lib/api/browser-request";
import { MATERIAL_CATEGORIES, getMaterialSubcategories, type MaterialCategory } from "@/lib/material-categories";
import { formatMaterialUnitLabel } from "@/lib/material-units";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  formatDateLabel as formatUiDateLabel,
  formatDateTimeLabel,
  formatNumberLabel
} from "@/lib/ui/formatters";
import { sortRowsByKey, tableRowsToCsv, totalPagesForRows, type CsvCell, type SortDirection, type SortState } from "@/lib/ui/table-tools";
import { useActivityLog } from "@/lib/ui/use-activity-log";
import { workflowsForPathname } from "@/lib/ui/workflows";
import { formatVendorNumber } from "@/lib/ui/vendor-fields";
import {
  buildLocationSkuAlertCounts,
  expandInventoryRows,
  filterInventoryRows,
  formatCurrencyAmount,
  formatCurrencyTotals,
  inventoryMetrics,
  normalizePurchaseOrderCurrency,
  normalizeStatus,
  type PurchaseOrderCurrency,
  purchaseOrderOverview,
  purchaseOrderTableSummary,
  supplierOrderStats
} from "@/lib/ui/parity-models";

type Material = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  uom: string;
  category?: string | null;
  subcategory?: string | null;
  created_at?: string;
  min_stock: number;
  is_active: boolean;
  total_quantity?: number;
  primary_location?: string | null;
  stock_status?: "in-stock" | "low-stock" | "out-of-stock";
  balances?: Array<{
    quantity: number | string | null;
    location?: {
      code?: string | null;
      name: string;
    } | null;
  }>;
};

type Location = {
  id: string;
  name: string;
  code: string | null;
  address?: string | null;
  is_active: boolean;
};

type StockHealth = {
  total_materials: number;
  total_quantity: number;
  out_of_stock: number;
  low_stock: number;
};

type Supplier = {
  id: string;
  vendor_number: number | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
};

type PurchaseOrderLine = {
  id: string;
  material_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number | null;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: "draft" | "sent" | "partial" | "received" | "cancelled";
  currency: PurchaseOrderCurrency;
  expected_at?: string | null;
  sent_at?: string | null;
  received_at?: string | null;
  created_at?: string;
  supplier: { id: string; name: string } | null;
  lines: PurchaseOrderLine[];
};

type PurchaseOrderFilterStatus = "all" | PurchaseOrder["status"];
type ManualMovementReason = "adjustment" | "consumption" | "transfer";
type MovementReason = ManualMovementReason | "purchase_receive" | "transfer_in" | "transfer_out" | "correction";

type MaterialMovement = {
  id: string;
  quantity_delta: number;
  reason: MovementReason;
  note?: string | null;
  created_at: string;
  material: {
    sku: string;
    name: string;
    uom: string;
    category?: string | null;
  } | null;
  location: {
    code: string | null;
    name: string;
  } | null;
};

type OrganizationMembership = {
  role: "owner" | "manager" | "member" | "viewer";
  organization: {
    id: string;
    name: string;
    created_at: string;
  };
};

type OrganizationMember = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: "owner" | "manager" | "member" | "viewer";
  created_at: string;
};

type PendingInvitation = {
  id: string;
  org_id: string;
  direction: "sent" | "received";
  email: string;
  role: "owner" | "manager" | "member" | "viewer";
  status: string;
  expires_at: string;
  created_at: string;
  organization_name: string;
};

type PlatformMe = {
  isPlatformAdmin: boolean;
  role: "support" | "operator" | "admin" | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

type TableId =
  | "organization-members"
  | "memberships"
  | "invitations"
  | "locations"
  | "materials"
  | "movements"
  | "suppliers"
  | "purchase-orders"
  | "inventory";

const DEFAULT_TABLE_PAGE_SIZE = 20;
const MATERIALS_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
const MOVEMENTS_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
const PURCHASE_ORDERS_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

const STORAGE_KEYS = {
  baseUrl: "lockstock.baseUrl",
  orgId: "lockstock.orgId"
} as const;

const ROLE_AUTHORIZATIONS = [
  ["View inventory/materials/stock moves/locations/suppliers/POs", "Yes", "Yes", "Yes", "Yes"],
  ["View audit log", "Own actions only", "Own actions only", "Yes", "Yes"],
  ["Create stock movement", "No", "Yes", "Yes", "Yes"],
  ["Receive purchase order", "No", "Yes", "Yes", "Yes"],
  ["Export CSV", "No", "Yes", "Yes", "Yes"],
  ["Create/edit materials", "No", "No", "Yes", "Yes"],
  ["Create/edit suppliers", "No", "No", "Yes", "Yes"],
  ["Create/edit locations", "No", "No", "Yes", "Yes"],
  ["Create/update purchase orders", "No", "No", "Yes", "Yes"],
  ["View members", "No", "No", "Yes", "Yes"],
  ["Invite members", "No", "No", "No", "Yes"],
  ["Change member roles", "No", "No", "No", "Yes"],
  ["Remove members", "No", "No", "No", "Yes"],
  ["Rename group", "No", "No", "No", "Yes"]
] as const;

type NavHref =
  | "/inventory"
  | "/materials"
  | "/stock-movements"
  | "/locations"
  | "/vendors"
  | "/purchase-orders"
  | "/members"
  | "/workflows";

const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_NOW = "2026-05-14T09:00:00.000Z";
const DEMO_LOCATIONS: Location[] = [
  { id: "loc-main", name: "Main Warehouse", code: "MAIN", address: "12 Quai de Lyon, Paris", is_active: true },
  { id: "loc-north", name: "North Yard", code: "NORTH", address: "Zone B, north loading yard", is_active: true },
  { id: "loc-rack", name: "Rack B4", code: "B4", address: "Main warehouse aisle B", is_active: true },
  { id: "loc-overflow", name: "Overflow Storage", code: "OVER", address: "Temporary storage bay", is_active: false }
];
const DEMO_MATERIALS: Material[] = [
  {
    id: "mat-cement",
    sku: "MAT-001",
    name: "Portland Cement",
    description: "General construction cement.",
    uom: "BAG",
    category: "Concrete",
    subcategory: "Cement",
    min_stock: 40,
    is_active: true,
    total_quantity: 180,
    primary_location: "MAIN",
    stock_status: "in-stock",
    created_at: DEMO_NOW,
    balances: [{ quantity: 180, location: { code: "MAIN", name: "Main Warehouse" } }]
  },
  {
    id: "mat-rebar",
    sku: "MAT-024",
    name: "Rebar 12mm",
    description: "Steel reinforcement bar.",
    uom: "EA",
    category: "Metals",
    subcategory: "Rebar",
    min_stock: 25,
    is_active: true,
    total_quantity: 9,
    primary_location: "NORTH",
    stock_status: "low-stock",
    created_at: DEMO_NOW,
    balances: [{ quantity: 9, location: { code: "NORTH", name: "North Yard" } }]
  },
  {
    id: "mat-membrane",
    sku: "MAT-112",
    name: "Waterproof Membrane",
    description: "Roofing and foundation membrane.",
    uom: "ROLL",
    category: "Insulation",
    subcategory: "Membrane",
    min_stock: 12,
    is_active: true,
    total_quantity: 47,
    primary_location: "B4",
    stock_status: "in-stock",
    created_at: DEMO_NOW,
    balances: [{ quantity: 47, location: { code: "B4", name: "Rack B4" } }]
  },
  {
    id: "mat-anchor",
    sku: "MAT-230",
    name: "Anchor Bolt M16",
    description: "Structural anchor bolt.",
    uom: "EA",
    category: "Fasteners",
    subcategory: "Anchors",
    min_stock: 30,
    is_active: true,
    total_quantity: 0,
    primary_location: "OVER",
    stock_status: "out-of-stock",
    created_at: DEMO_NOW,
    balances: [{ quantity: 0, location: { code: "OVER", name: "Overflow Storage" } }]
  }
];
const DEMO_SUPPLIERS: Supplier[] = [
  { id: "sup-acme", vendor_number: 10042, name: "Acme Supply", phone: "+33155400000", address: "8 Rue de Rivoli, Paris", lead_time_days: 5, is_active: true, created_at: DEMO_NOW },
  { id: "sup-nord", vendor_number: 10057, name: "Nord Steel", phone: "+33155400001", address: "Dock 14, Le Havre", lead_time_days: 9, is_active: true, created_at: DEMO_NOW },
  { id: "sup-buildchem", vendor_number: 10063, name: "BuildChem", phone: "+33155400002", address: "Chemical park, Lyon", lead_time_days: 3, is_active: true, created_at: DEMO_NOW }
];
const DEMO_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po-1048",
    po_number: "PO-1048",
    status: "partial",
    currency: "EUR",
    expected_at: "2026-05-17",
    sent_at: "2026-05-10T10:00:00.000Z",
    created_at: "2026-05-09T10:00:00.000Z",
    supplier: { id: "sup-acme", name: "Acme Supply" },
    lines: [{ id: "line-1048-1", material_id: "mat-rebar", quantity_ordered: 120, quantity_received: 60, unit_price: 68.67 }]
  },
  {
    id: "po-1049",
    po_number: "PO-1049",
    status: "sent",
    currency: "EUR",
    expected_at: "2026-05-21",
    sent_at: "2026-05-12T08:00:00.000Z",
    created_at: "2026-05-11T12:00:00.000Z",
    supplier: { id: "sup-nord", name: "Nord Steel" },
    lines: [{ id: "line-1049-1", material_id: "mat-anchor", quantity_ordered: 300, quantity_received: 0, unit_price: 43 }]
  },
  {
    id: "po-1050",
    po_number: "PO-1050",
    status: "draft",
    currency: "USD",
    expected_at: "2026-05-24",
    created_at: "2026-05-13T13:00:00.000Z",
    supplier: { id: "sup-buildchem", name: "BuildChem" },
    lines: [{ id: "line-1050-1", material_id: "mat-membrane", quantity_ordered: 40, quantity_received: 0, unit_price: 86 }]
  }
];
const DEMO_MOVEMENTS: MaterialMovement[] = [
  {
    id: "move-1",
    quantity_delta: 60,
    reason: "purchase_receive",
    note: "Received against PO-1048",
    created_at: "2026-05-14T08:20:00.000Z",
    material: { sku: "MAT-024", name: "Rebar 12mm", uom: "EA", category: "Metals" },
    location: { code: "MAIN", name: "Main Warehouse" }
  },
  {
    id: "move-2",
    quantity_delta: -24,
    reason: "transfer_out",
    note: "Transfer to north yard",
    created_at: "2026-05-13T16:10:00.000Z",
    material: { sku: "MAT-024", name: "Rebar 12mm", uom: "EA", category: "Metals" },
    location: { code: "MAIN", name: "Main Warehouse" }
  },
  {
    id: "move-3",
    quantity_delta: 24,
    reason: "transfer_in",
    note: "Transfer from main warehouse",
    created_at: "2026-05-13T16:10:00.000Z",
    material: { sku: "MAT-024", name: "Rebar 12mm", uom: "EA", category: "Metals" },
    location: { code: "NORTH", name: "North Yard" }
  },
  {
    id: "move-4",
    quantity_delta: -8,
    reason: "consumption",
    note: "Issued to site crew",
    created_at: "2026-05-12T11:00:00.000Z",
    material: { sku: "MAT-112", name: "Waterproof Membrane", uom: "ROLL", category: "Insulation" },
    location: { code: "B4", name: "Rack B4" }
  }
];
const DEMO_ORGANIZATIONS: OrganizationMembership[] = [
  { role: "owner", organization: { id: DEMO_ORG_ID, name: "Northstar Materials", created_at: "2026-05-01T09:00:00.000Z" } }
];
const DEMO_MEMBERS: OrganizationMember[] = [
  { user_id: "user-ava", email: "ava@northstar.build", full_name: "Ava Laurent", role: "owner", created_at: "2026-05-01T09:00:00.000Z" },
  { user_id: "user-noah", email: "noah@northstar.build", full_name: "Noah Martin", role: "manager", created_at: "2026-05-03T09:00:00.000Z" },
  { user_id: "user-mia", email: "mia@northstar.build", full_name: "Mia Bernard", role: "member", created_at: "2026-05-06T09:00:00.000Z" }
];
const DEMO_INVITATIONS: PendingInvitation[] = [
  {
    id: "invite-1",
    org_id: DEMO_ORG_ID,
    direction: "sent",
    email: "leo@northstar.build",
    role: "viewer",
    status: "pending",
    expires_at: "2026-05-21T09:00:00.000Z",
    created_at: DEMO_NOW,
    organization_name: "Northstar Materials"
  }
];

const NAV_ITEMS: Array<{ href: NavHref; label: string; icon: NavIcon }> = [
  { href: "/inventory", label: "Inventory", icon: "inventory" },
  { href: "/materials", label: "Materials", icon: "materials" },
  { href: "/stock-movements", label: "Stock Movements", icon: "stock-movements" },
  { href: "/locations", label: "Locations", icon: "locations" },
  { href: "/vendors", label: "Vendors", icon: "vendors" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "purchase-orders" },
  { href: "/members", label: "Members", icon: "members" },
  { href: "/workflows", label: "Workflows", icon: "workflows" }
] as const;

function SearchFieldIcon() {
  return (
    <span className="search-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
      </svg>
    </span>
  );
}

function SelectFieldIcon() {
  return (
    <span className="filter-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

export function LockstockWorkbench() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLanguage();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const { addActivity } = useActivityLog(signedInAs || email);
  const [signedInFullName, setSignedInFullName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "operations" | "business" | "enterprise">("starter");
  const [renamingOrgId, setRenamingOrgId] = useState("");
  const [renameOrgName, setRenameOrgName] = useState("");

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [showMaterialCreateForm, setShowMaterialCreateForm] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState("all");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showPoCreateForm, setShowPoCreateForm] = useState(false);
  const [showPoReceiveForm, setShowPoReceiveForm] = useState(false);
  const [selectedPoDetailsId, setSelectedPoDetailsId] = useState<string | null>(null);
  const [receivePoId, setReceivePoId] = useState("");
  const [receivePoLineId, setReceivePoLineId] = useState("");
  const [materialFilterQuery, setMaterialFilterQuery] = useState("");
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState("all");
  const [materialSubcategoryFilter, setMaterialSubcategoryFilter] = useState("all");
  const [inventoryStatus, setInventoryStatus] = useState("all");
  const [inventoryLocation, setInventoryLocation] = useState("all");
  const [locationFilterQuery, setLocationFilterQuery] = useState("");
  const [locationStatusFilter, setLocationStatusFilter] = useState("all");
  const [movementFilterQuery, setMovementFilterQuery] = useState("");
  const [movementLocationFilter, setMovementLocationFilter] = useState("all");
  const [movementReasonFilter, setMovementReasonFilter] = useState("all");
  const [locationPage, setLocationPage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [supplierPage, setSupplierPage] = useState(1);
  const [poFilterStatus, setPoFilterStatus] = useState<PurchaseOrderFilterStatus>("all");
  const [poFilterSupplierId, setPoFilterSupplierId] = useState("all");
  const [poFilterQuery, setPoFilterQuery] = useState("");
  const [poPage, setPoPage] = useState(1);
  const [poTotal, setPoTotal] = useState(0);
  const [tableSorts, setTableSorts] = useState<Partial<Record<TableId, SortState>>>({});

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialMovements, setMaterialMovements] = useState<MaterialMovement[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [stockHealth, setStockHealth] = useState<StockHealth | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [pendingMaterialUsageChange, setPendingMaterialUsageChange] = useState<Material | null>(null);
  const [pendingLocationUsageChange, setPendingLocationUsageChange] = useState<Location | null>(null);
  const [pendingSupplierUsageChange, setPendingSupplierUsageChange] = useState<Supplier | null>(null);
  const [pendingCancelPo, setPendingCancelPo] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [memberInviteEmail, setMemberInviteEmail] = useState("");
  const [memberInviteRole, setMemberInviteRole] = useState<OrganizationMember["role"] | "">("");

  const isProduction = process.env.NODE_ENV === "production";
  const normalizedBaseUrl = useMemo(() => {
    if (typeof window !== "undefined" && isProduction) {
      return window.location.origin;
    }

    return baseUrl.replace(/\/+$/, "");
  }, [baseUrl, isProduction]);
  const isOrgScopedReady = Boolean(accessToken && orgId);
  const activeMembership = useMemo(
    () => organizations.find((item) => item.organization.id === orgId) ?? null,
    [organizations, orgId]
  );
  const activeRoleRank = activeMembership
    ? ({ viewer: 0, member: 1, manager: 2, owner: 3 } as const)[activeMembership.role]
    : -1;
  const canExportCsv = activeRoleRank >= 1;
  const canCreateStockMovement = activeRoleRank >= 1;
  const canReceivePurchaseOrders = activeRoleRank >= 1;
  const canManageCatalog = activeRoleRank >= 2;
  const ownedGroups = useMemo(() => organizations.filter((item) => item.role === "owner"), [organizations]);
  const ownedGroup = ownedGroups[0] ?? null;
  const editingSupplier = useMemo(
    () => (editingSupplierId ? suppliers.find((supplier) => supplier.id === editingSupplierId) ?? null : null),
    [editingSupplierId, suppliers]
  );
  const editingMaterial = useMemo(
    () => (editingMaterialId ? materials.find((material) => material.id === editingMaterialId) ?? null : null),
    [editingMaterialId, materials]
  );
  const editingLocation = useMemo(
    () => (editingLocationId ? locations.find((location) => location.id === editingLocationId) ?? null : null),
    [editingLocationId, locations]
  );
  const activeMaterials = useMemo(() => materials.filter((material) => material.is_active !== false), [materials]);
  const activeLocations = useMemo(() => locations.filter((location) => location.is_active !== false), [locations]);
  const activeSuppliers = useMemo(() => suppliers.filter((supplier) => supplier.is_active !== false), [suppliers]);
  const inventoryLocations = useMemo(() => {
    const locationLabels = expandInventoryRows(materials).map((material) => material.location_label);
    return ["all", ...Array.from(new Set(locationLabels)).sort((a, b) => a.localeCompare(b))];
  }, [materials]);
  const materialFilterSubcategories = useMemo(() => {
    if (materialCategoryFilter === "all") {
      return [];
    }
    return getMaterialSubcategories(materialCategoryFilter as MaterialCategory);
  }, [materialCategoryFilter]);
  const inventoryRows = useMemo(() => {
    const expandedRows = expandInventoryRows(materials);
    return filterInventoryRows(expandedRows, materialFilterQuery, inventoryStatus, inventoryLocation);
  }, [inventoryLocation, inventoryStatus, materialFilterQuery, materials]);
  const metrics = useMemo(() => inventoryMetrics(materials, purchaseOrders), [materials, purchaseOrders]);
  const locationSkuAlertCounts = useMemo(() => buildLocationSkuAlertCounts(locations, materials), [locations, materials]);
  const priceByMaterial = useMemo(() => {
    const next = new Map<string, { unitPrice: number; currency: PurchaseOrderCurrency }>();
    for (const po of purchaseOrders) {
      const poCurrency = normalizePurchaseOrderCurrency(po.currency);
      for (const line of po.lines) {
        if (line.unit_price != null && !next.has(line.material_id)) {
          next.set(line.material_id, {
            unitPrice: Number(line.unit_price),
            currency: poCurrency
          });
        }
      }
    }
    return next;
  }, [purchaseOrders]);
  const poOverview = useMemo(() => purchaseOrderOverview(purchaseOrders), [purchaseOrders]);
  const poSkuByMaterialId = useMemo(() => {
    return new Map(materials.map((material) => [material.id, material.sku]));
  }, [materials]);
  const poTableRows = useMemo(() => {
    return purchaseOrders.map((po) => ({
      po,
      summary: purchaseOrderTableSummary(po, poSkuByMaterialId)
    }));
  }, [purchaseOrders, poSkuByMaterialId]);
  const selectedPoDetails = useMemo(
    () => purchaseOrders.find((po) => po.id === selectedPoDetailsId) ?? null,
    [purchaseOrders, selectedPoDetailsId]
  );
  const inventoryValueLabel = useMemo(() => formatCurrencyTotals(metrics.totalValueByCurrency), [metrics.totalValueByCurrency]);
  const inventoryValueBadge = useMemo(() => {
    const { EUR, USD } = metrics.totalValueByCurrency;
    if (EUR > 0 && USD > 0) {
      return "€/$";
    }
    return USD > 0 ? "$" : "€";
  }, [metrics.totalValueByCurrency]);
  const supplierRows = useMemo(() => supplierOrderStats(suppliers, purchaseOrders), [suppliers, purchaseOrders]);
  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
  const filteredSupplierRows = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();
    return supplierRows.filter((row) => {
      const matchesQuery =
        !query ||
        [row.name, row.phone, row.address, formatVendorNumber(row.vendorNumber)]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      const status = row.isActive ? "active" : "blocked";
      const matchesStatus = supplierStatusFilter === "all" || status === supplierStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [supplierRows, supplierSearch, supplierStatusFilter]);
  const materialTotalPages = Math.max(1, Math.ceil(materialTotal / MATERIALS_PAGE_SIZE));
  const movementTotalPages = Math.max(1, Math.ceil(movementTotal / MOVEMENTS_PAGE_SIZE));
  const poTotalPages = Math.max(1, Math.ceil(poTotal / PURCHASE_ORDERS_PAGE_SIZE));
  const currentScreen = useMemo(() => {
    if (pathname === "/materials") {
      return { title: "Materials", subtitle: "Create materials and manage the material catalog." };
    }
    if (pathname === "/stock-movements") {
      return { title: "Stock Movements", subtitle: "Add stock and review material movement history." };
    }
    if (pathname === "/locations") {
      return { title: "Locations", subtitle: "Configure storage and fulfillment locations." };
    }
    if (pathname === "/vendors") {
      return { title: "Vendors", subtitle: "Maintain supplier records and lead times." };
    }
    if (pathname === "/purchase-orders") {
      return { title: "Purchase Orders", subtitle: "Create, receive, and track purchase orders." };
    }
    if (pathname === "/members") {
      return { title: "Members", subtitle: "Manage group members and invitations." };
    }
    if (pathname === "/workflows") {
      return { title: "Workflows", subtitle: "Review the end-to-end operating guides for stock, purchasing, and members." };
    }
    return { title: "Inventory Management", subtitle: "Manage your stock and track inventory levels." };
  }, [pathname]);

  const showLocationSection = pathname === "/locations";
  const showMaterialSection = pathname === "/materials";
  const showStockMovementsSection = pathname === "/stock-movements";
  const showSupplierSection = pathname === "/vendors";
  const showPurchaseOrderSection = pathname === "/purchase-orders";
  const showMembersSection = pathname === "/members";
  const showWorkflowsSection = pathname === "/workflows";
  const showSnapshotSection = pathname === "/inventory";
  const contextualWorkflows = useMemo(() => workflowsForPathname(pathname), [pathname]);
  const showSignedOutPanels = shouldShowSignedOutPanels({
    isAuthenticated: isDemoMode || Boolean(signedInAs),
    authResolved
  });
  const showAuthPanel = !isDemoMode && showSignedOutPanels;
  const canUseMembersScreen = isDemoMode || Boolean(accessToken);

  useEffect(() => {
    setIsDemoMode(new URLSearchParams(window.location.search).get("demo") === "1");
  }, []);

  function applySessionState(session: {
    access_token: string;
    user: { email?: string | null; user_metadata?: Record<string, unknown> | null };
  }) {
    const fullName =
      typeof session.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name.trim() : "";
    const metadataPlan = session.user.user_metadata?.selected_plan;
    setAccessToken(session.access_token || "");
    setSignedInAs(session.user.email ?? "");
    setSignedInFullName(fullName);
    if (["starter", "operations", "business", "enterprise"].includes(String(metadataPlan))) {
      setSelectedPlan(metadataPlan as "starter" | "operations" | "business" | "enterprise");
    }
    setEmail(session.user.email ?? "");
  }

  function isAuthTokenError(message: string) {
    const normalized = message.toLowerCase();
    return normalized.includes("invalid or expired access token") || normalized.includes("jwt") || normalized.includes("token");
  }

  function setActiveOrgId(nextOrgId: string) {
    setOrgId(nextOrgId);
    window.localStorage.setItem(STORAGE_KEYS.orgId, nextOrgId);
  }

  const syncPublicProfile = useCallback(async (tokenOverride?: string) => {
    void tokenOverride;
    await browserApiRequest("/api/account/profile", {
      method: "POST",
      baseUrl: normalizedBaseUrl
    });
  }, [normalizedBaseUrl]);

  useEffect(() => {
    if (isDemoMode) {
      setBaseUrl(window.location.origin);
      setAccessToken("demo-token");
      setOrgId(DEMO_ORG_ID);
      setSignedInAs("ava@northstar.build");
      setSignedInFullName("Ava Laurent");
      setEmail("ava@northstar.build");
      setOrganizations(DEMO_ORGANIZATIONS);
      setOrganizationMembers(DEMO_MEMBERS);
      setPendingInvitations(DEMO_INVITATIONS);
      setMaterials(DEMO_MATERIALS);
      setMaterialMovements(DEMO_MOVEMENTS);
      setLocations(DEMO_LOCATIONS);
      setSuppliers(DEMO_SUPPLIERS);
      setPurchaseOrders(DEMO_PURCHASE_ORDERS);
      setMaterialTotal(DEMO_MATERIALS.length);
      setMovementTotal(DEMO_MOVEMENTS.length);
      setPoTotal(DEMO_PURCHASE_ORDERS.length);
      setStockHealth({ total_materials: DEMO_MATERIALS.length, total_quantity: 236, out_of_stock: 1, low_stock: 1 });
      setLowStockCount(2);
      setAuthResolved(true);
      setStorageHydrated(true);
      setMemberInviteRole("viewer");
      return;
    }
    const storedBaseUrl = window.localStorage.getItem(STORAGE_KEYS.baseUrl);
    setBaseUrl(isProduction ? window.location.origin : storedBaseUrl ?? window.location.origin);
    setOrgId(window.localStorage.getItem(STORAGE_KEYS.orgId) ?? "");
    setStorageHydrated(true);
  }, [isDemoMode, isProduction]);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }
    let unmounted = false;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseBrowserClient();

      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (unmounted || error) {
            return;
          }
          if (!data.session) {
            setAccessToken("");
            setSignedInAs("");
            setSignedInFullName("");
            clearWorkspaceData();
            setAuthResolved(true);
            return;
          }
          applySessionState({
            access_token: data.session.access_token,
            user: {
              email: data.session.user.email,
              user_metadata: data.session.user.user_metadata
            }
          });
          void syncPublicProfile(data.session.access_token);
          setAuthResolved(true);
        })
        .catch(() => {
          if (unmounted) {
            return;
          }
          setAccessToken("");
          setSignedInAs("");
          setSignedInFullName("");
          setAuthResolved(true);
        });

      const authListener = supabase.auth.onAuthStateChange((event, session) => {
        if (unmounted) {
          return;
        }

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
          applySessionState({
            access_token: session.access_token,
            user: {
              email: session.user.email,
              user_metadata: session.user.user_metadata
            }
          });
          void syncPublicProfile(session.access_token);
          setAuthResolved(true);
        }

        if (event === "SIGNED_OUT") {
          setAccessToken("");
          setSignedInAs("");
          setSignedInFullName("");
          setIsPlatformAdmin(false);
          clearWorkspaceData();
          setAuthResolved(true);
        }
      });

      unsubscribe = () => authListener.data.subscription.unsubscribe();
    } catch {
      addActivity("Supabase browser auth is not configured.");
      setAuthResolved(true);
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, [addActivity, isDemoMode, syncPublicProfile]);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }
    const redirectPath = getSignedOutRedirectPath({
      pathname,
      isAuthenticated: Boolean(signedInAs),
      authResolved
    });

    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [authResolved, isDemoMode, pathname, router, signedInAs]);

  useEffect(() => {
    if (isDemoMode || !authResolved || !accessToken || !signedInAs || !normalizedBaseUrl) {
      setIsPlatformAdmin(false);
      return;
    }

    let unmounted = false;

    async function loadPlatformAccess() {
      try {
        const payload = await browserApiRequest<PlatformMe>("/api/platform/me", { baseUrl: normalizedBaseUrl });

        if (!unmounted) {
          setIsPlatformAdmin(payload.isPlatformAdmin);
        }
      } catch {
        if (!unmounted) {
          setIsPlatformAdmin(false);
        }
      }
    }

    void loadPlatformAccess();

    return () => {
      unmounted = true;
    };
  }, [accessToken, authResolved, isDemoMode, normalizedBaseUrl, signedInAs]);

  useEffect(() => {
    if (isDemoMode || isProduction) {
      return;
    }
    if (baseUrl) {
      window.localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
    }
  }, [baseUrl, isDemoMode, isProduction]);

  useEffect(() => {
    if (isDemoMode) {
      return;
    }
    if (storageHydrated) {
      window.localStorage.setItem(STORAGE_KEYS.orgId, orgId);
    }
  }, [isDemoMode, orgId, storageHydrated]);
  useEffect(() => {
    if (materialCategoryFilter === "all" || !materialFilterSubcategories.includes(materialSubcategoryFilter)) {
      setMaterialSubcategoryFilter("all");
    }
  }, [materialCategoryFilter, materialFilterSubcategories, materialSubcategoryFilter]);

  function clearWorkspaceData() {
    setOrgId("");
    setOrganizations([]);
    setOrganizationMembers([]);
    setPendingInvitations([]);
    setMemberInviteRole("");
    setMaterials([]);
    setMaterialMovements([]);
    setLocations([]);
    setSuppliers([]);
    setPurchaseOrders([]);
    setMaterialTotal(0);
    setMovementTotal(0);
    setPoTotal(0);
    setMaterialPage(1);
    setMovementPage(1);
    setPoPage(1);
    setStockHealth(null);
    setLowStockCount(null);
  }

  const getDefaultGroupName = useCallback(() => {
    if (signedInFullName.trim()) {
      return `${signedInFullName.trim()}'s Group`;
    }

    const source = signedInAs || email;
    if (source.includes("@")) {
      return `${source.split("@")[0]}'s Group`;
    }
    return "My Group";
  }, [email, signedInAs, signedInFullName]);

  function formatMovementReason(reason: MovementReason) {
    if (reason === "purchase_receive") {
      return "Purchase Receive";
    }
    if (reason === "transfer" || reason === "transfer_in" || reason === "transfer_out") {
      return "Transfer";
    }
    if (reason === "correction") {
      return "Correction";
    }
    if (reason === "consumption") {
      return "Consumption";
    }
    return "Adjustment";
  }

  function formatMovementLocation(location: MaterialMovement["location"]) {
    if (!location) {
      return "-";
    }
    return location.code ? `${location.code} - ${location.name}` : location.name;
  }

  function formatDateLabel(value?: string | null) {
    return formatUiDateLabel(value);
  }

  function handleTableSort(tableId: TableId, key: string) {
    setTableSorts((current) => {
      const previous = current[tableId];
      const direction: SortDirection = previous?.key === key && previous.direction === "asc" ? "desc" : "asc";
      return {
        ...current,
        [tableId]: { key, direction }
      };
    });
  }

  function exportTableCsv(filename: string, headers: readonly string[], rows: readonly (readonly CsvCell[])[]) {
    if (!canExportCsv) {
      addActivity("Export CSV requires member role or higher.");
      return;
    }

    const csv = tableRowsToCsv(headers, rows);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function formatCurrencyExport(amount: number, currency: PurchaseOrderCurrency) {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }

  function resetSupplierForm() {
    setEditingSupplierId(null);
  }

  function openCreateLocationForm() {
    setEditingLocationId(null);
    setShowLocationForm(true);
  }

  function openEditLocationForm(location: Location) {
    setEditingLocationId(location.id);
    setShowLocationForm(true);
  }

  function closeLocationForm() {
    setShowLocationForm(false);
    setEditingLocationId(null);
  }

  function openCreateSupplierForm() {
    resetSupplierForm();
    setShowSupplierForm(true);
  }

  function openEditSupplierForm(supplier: Supplier) {
    setEditingSupplierId(supplier.id);
    setShowSupplierForm(true);
  }

  function closeSupplierForm() {
    setShowSupplierForm(false);
    resetSupplierForm();
  }

  function openEditMaterialForm(material: Material) {
    setEditingMaterialId(material.id);
  }

  function closeEditMaterialForm() {
    setEditingMaterialId(null);
  }

  const apiRequest = useCallback(async <T,>(
    path: string,
    options?: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: Record<string, unknown>;
      orgOverride?: string;
      requireOrg?: boolean;
      signal?: AbortSignal;
      tokenOverride?: string;
    }
  ): Promise<T> => {
    const requireOrg = options?.requireOrg ?? true;
    const effectiveOrgId = options?.orgOverride ?? orgId;
    if (requireOrg && !effectiveOrgId) {
      throw new Error("Group ID is required.");
    }
    return browserApiRequest<T>(path, {
      method: options?.method,
      body: options?.body ?? null,
      baseUrl: normalizedBaseUrl,
      orgId: requireOrg ? effectiveOrgId : null,
      signal: options?.signal
    });
  }, [normalizedBaseUrl, orgId]);

  const loadOrganizationMembers = useCallback(async (targetOrgId?: string, tokenOverride?: string) => {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      setOrganizationMembers([]);
      return;
    }

    const response = await apiRequest<{ data: OrganizationMember[] }>(`/api/organizations/${orgValue}/members`, {
      orgOverride: orgValue,
      tokenOverride
    });
    setOrganizationMembers(response.data);
  }, [apiRequest, orgId]);

  const loadOwnedGroupMembers = useCallback(async (targetGroup?: OrganizationMembership | null, tokenOverride?: string) => {
    const group = targetGroup ?? ownedGroup;
    if (!group) {
      setOrganizationMembers([]);
      return;
    }

    await loadOrganizationMembers(group.organization.id, tokenOverride);
  }, [loadOrganizationMembers, ownedGroup]);

  const loadPendingInvitations = useCallback(async (tokenOverride?: string) => {
    const response = await apiRequest<{ data: PendingInvitation[] }>("/api/invitations/pending", {
      requireOrg: false,
      tokenOverride
    });
    setPendingInvitations(response.data);
  }, [apiRequest]);

  async function handleLogin() {
    try {
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }
      if (!data.session?.access_token) {
        throw new Error("No access token returned from Supabase.");
      }

      applySessionState({
        access_token: data.session.access_token,
        user: {
          email: data.session.user.email,
          user_metadata: data.session.user.user_metadata
        }
      });
      await syncPublicProfile(data.session.access_token);
      setAuthResolved(true);
      setPassword("");
      addActivity(`Signed in as ${data.user?.email ?? email}.`);
    } catch (error) {
      setAccessToken("");
      setSignedInAs("");
      setSignedInFullName("");
      clearWorkspaceData();
      addActivity(`Login failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      setAccessToken("");
      setSignedInAs("");
      setSignedInFullName("");
      setIsPlatformAdmin(false);
      clearWorkspaceData();
      setAuthResolved(true);
      addActivity("Signed out.");
      router.replace("/");
    } catch (error) {
      addActivity(`Logout failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const loadMaterials = useCallback(async (targetOrgId?: string, tokenOverride?: string) => {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      return { count: 0 };
    }

    const params = new URLSearchParams({
      page: String(materialPage),
      limit: String(MATERIALS_PAGE_SIZE)
    });
    if (materialFilterQuery.trim() && (showMaterialSection || showSnapshotSection)) {
      params.set("q", materialFilterQuery.trim());
    }
    if (showMaterialSection && materialCategoryFilter !== "all") {
      params.set("category", materialCategoryFilter);
    }
    if (showMaterialSection && materialSubcategoryFilter !== "all") {
      params.set("subcategory", materialSubcategoryFilter);
    }

    const response = await apiRequest<{ data: Material[]; meta?: PaginationMeta }>(`/api/materials?${params.toString()}`, {
      orgOverride: orgValue,
      tokenOverride
    });

    setMaterials(response.data);
    setMaterialTotal(response.meta?.total ?? response.data.length);
    return { count: response.data.length };
  }, [apiRequest, materialCategoryFilter, materialFilterQuery, materialPage, materialSubcategoryFilter, orgId, showMaterialSection, showSnapshotSection]);

  const loadMaterialMovements = useCallback(async (targetOrgId?: string, tokenOverride?: string) => {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      return { count: 0 };
    }

    const params = new URLSearchParams({
      page: String(movementPage),
      limit: String(MOVEMENTS_PAGE_SIZE)
    });

    const response = await apiRequest<{ data: MaterialMovement[]; meta?: PaginationMeta }>(
      `/api/stock/movements?${params.toString()}`,
      {
        orgOverride: orgValue,
        tokenOverride
      }
    );

    setMaterialMovements(response.data);
    setMovementTotal(response.meta?.total ?? response.data.length);
    return { count: response.data.length };
  }, [apiRequest, movementPage, orgId]);

  const loadPurchaseOrders = useCallback(async (targetOrgId?: string, tokenOverride?: string) => {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      return { count: 0 };
    }

    const params = new URLSearchParams({
      page: String(poPage),
      limit: String(PURCHASE_ORDERS_PAGE_SIZE)
    });
    if (poFilterStatus !== "all") {
      params.set("status", poFilterStatus);
    }
    if (poFilterSupplierId !== "all") {
      params.set("supplier_id", poFilterSupplierId);
    }
    if (poFilterQuery.trim()) {
      params.set("q", poFilterQuery.trim());
    }

    const response = await apiRequest<{ data: PurchaseOrder[]; meta?: PaginationMeta }>(
      `/api/purchase-orders?${params.toString()}`,
      {
        orgOverride: orgValue,
        tokenOverride
      }
    );

    setPurchaseOrders(response.data);
    setPoTotal(response.meta?.total ?? response.data.length);
    return { count: response.data.length };
  }, [apiRequest, orgId, poFilterQuery, poFilterStatus, poFilterSupplierId, poPage]);

  const refreshCoreData = useCallback(async (
    targetOrgId?: string,
    tokenOverride?: string
  ) => {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      addActivity("No active group. Sign in again or sync workspace.");
      return;
    }

    const [materialsResult, movementsResult, locationsResult, suppliersResult, purchaseOrdersResult] = await Promise.all([
      loadMaterials(orgValue, tokenOverride),
      loadMaterialMovements(orgValue, tokenOverride),
      apiRequest<{ data: Location[] }>("/api/locations", { orgOverride: orgValue, tokenOverride }),
      apiRequest<{ data: Supplier[] }>("/api/suppliers", { orgOverride: orgValue, tokenOverride }),
      loadPurchaseOrders(orgValue, tokenOverride)
    ]);

    setLocations(locationsResult.data);
    setSuppliers(suppliersResult.data);

    await loadOrganizationMembers(orgValue, tokenOverride);

    await loadPendingInvitations(tokenOverride);

    addActivity(
      `Loaded ${materialsResult.count} materials, ${movementsResult.count} movements, ${locationsResult.data.length} locations, ${suppliersResult.data.length} suppliers, ${purchaseOrdersResult.count} purchase orders.`
    );
  }, [addActivity, apiRequest, loadMaterialMovements, loadMaterials, loadOrganizationMembers, loadPendingInvitations, loadPurchaseOrders, orgId]);

  const bootstrapOrganizationContext = useCallback(async (options?: { tokenOverride?: string; announce?: boolean; preferredOrgId?: string }) => {
    const effectiveToken = options?.tokenOverride ?? accessToken;
    if (!effectiveToken) {
      return;
    }

    try {
      setBusy(true);
      let organizationsResult = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
        requireOrg: false,
        tokenOverride: effectiveToken
      });

      let ownedMembership = organizationsResult.data.find((item) => item.role === "owner") ?? null;

      if (!ownedMembership) {
        const defaultOrgName = getDefaultGroupName();
        await apiRequest("/api/organizations", {
          method: "POST",
          requireOrg: false,
          tokenOverride: effectiveToken,
          body: { name: defaultOrgName, plan: selectedPlan }
        });
        addActivity(`Created default group "${defaultOrgName}".`);
        organizationsResult = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
          requireOrg: false,
          tokenOverride: effectiveToken
        });
        ownedMembership = organizationsResult.data.find((item) => item.role === "owner") ?? null;
      }

      if (organizationsResult.data.length === 0) {
        throw new Error("No group available after bootstrap.");
      }

      setOrganizations(organizationsResult.data);

      const preferredOrgId = options?.preferredOrgId ?? orgId;
      const existingSelection = organizationsResult.data.find((item) => item.organization.id === preferredOrgId);
      const selectedMembership = existingSelection ?? ownedMembership ?? organizationsResult.data[0];
      if (selectedMembership.organization.id !== preferredOrgId) {
        setActiveOrgId(selectedMembership.organization.id);
      }

      if (options?.announce ?? true) {
        addActivity(`Workspace ready: ${selectedMembership.organization.name} (${selectedMembership.role}).`);
      }

      await refreshCoreData(selectedMembership.organization.id, effectiveToken);
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthTokenError(message)) {
        setAccessToken("");
        setSignedInAs("");
        setSignedInFullName("");
        clearWorkspaceData();
      }
      addActivity(`Workspace bootstrap failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }, [accessToken, addActivity, apiRequest, getDefaultGroupName, orgId, refreshCoreData, selectedPlan]);

  const handleLoadOrganizations = useCallback(async () => {
    await bootstrapOrganizationContext({ announce: true });
  }, [bootstrapOrganizationContext]);

  useEffect(() => {
    if (isDemoMode || !storageHydrated || !accessToken || !signedInAs || !normalizedBaseUrl) {
      return;
    }
    void bootstrapOrganizationContext({ tokenOverride: accessToken, announce: false, preferredOrgId: orgId });
  }, [accessToken, bootstrapOrganizationContext, isDemoMode, normalizedBaseUrl, orgId, signedInAs, storageHydrated]);

  useEffect(() => {
    if (isDemoMode || !isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadMaterials().catch((error) => {
      addActivity(`Loading materials failed: ${(error as Error).message}`);
    });
  }, [addActivity, isDemoMode, isOrgScopedReady, loadMaterials, normalizedBaseUrl]);

  useEffect(() => {
    if (isDemoMode || !showStockMovementsSection || !isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadMaterialMovements().catch((error) => {
      addActivity(`Loading material movements failed: ${(error as Error).message}`);
    });
  }, [addActivity, isDemoMode, isOrgScopedReady, loadMaterialMovements, normalizedBaseUrl, showStockMovementsSection]);

  useEffect(() => {
    if (isDemoMode || !isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadPurchaseOrders().catch((error) => {
      addActivity(`Loading purchase orders failed: ${(error as Error).message}`);
    });
  }, [addActivity, isDemoMode, isOrgScopedReady, loadPurchaseOrders, normalizedBaseUrl]);

  function startRenameGroup(membership: OrganizationMembership) {
    setRenamingOrgId(membership.organization.id);
    setRenameOrgName(membership.organization.name);
  }

  async function handleRenameGroup() {
    if (!renamingOrgId) {
      return;
    }

    try {
      setBusy(true);
      const nextName = renameOrgName.trim();
      const response = await apiRequest<{ data: { id: string; name: string; created_at: string } }>(
        `/api/organizations/${renamingOrgId}`,
        {
          method: "PATCH",
          orgOverride: renamingOrgId,
          body: { name: nextName }
        }
      );

      setOrganizations((prev) =>
        prev.map((membership) =>
          membership.organization.id === response.data.id
            ? { ...membership, organization: { ...membership.organization, name: response.data.name } }
            : membership
        )
      );
      setRenamingOrgId("");
      setRenameOrgName("");
      addActivity(`Group renamed: ${response.data.name}.`);
    } catch (error) {
      addActivity(`Rename group failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteMemberByEmail() {
    const targetGroup = ownedGroup;
    if (!targetGroup) {
      addActivity("Invite failed: default group is not available.");
      return;
    }
    if (!memberInviteRole) {
      addActivity("Invite failed: select a role.");
      return;
    }

    try {
      setBusy(true);
      const email = memberInviteEmail.trim().toLowerCase();
      const inviteOrgId = targetGroup.organization.id;
      const response = await apiRequest<{
        data: {
          email: string;
          role: OrganizationMember["role"];
          expires_in_days: number;
          email_delivery: "sent" | "skipped" | "failed";
          email_delivery_message: string | null;
        };
      }>(`/api/organizations/${inviteOrgId}/members`, {
        method: "POST",
        orgOverride: inviteOrgId,
        body: { email, role: memberInviteRole }
      });
      setMemberInviteEmail("");
      await loadOwnedGroupMembers(targetGroup);
      await loadPendingInvitations();
      const deliveryMessage =
        response.data.email_delivery === "sent"
          ? "Invitation email sent."
          : response.data.email_delivery === "skipped"
            ? response.data.email_delivery_message ?? "Email delivery skipped."
            : response.data.email_delivery_message ?? "Email delivery failed.";
      addActivity(`Invitation created for ${targetGroup.organization.name}: ${response.data.email} (${response.data.role})`);
      addActivity(deliveryMessage);
    } catch (error) {
      addActivity(`Invite failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvitation(invitation: PendingInvitation) {
    try {
      setBusy(true);
      const response = await apiRequest<{ data: { org_id: string; organization_name: string; membership_role: string } }>(
        `/api/invitations/${invitation.id}/accept`,
        {
          method: "POST",
          requireOrg: false
        }
      );
      addActivity(`Invitation accepted: joined group ${response.data.organization_name} as ${response.data.membership_role}.`);
      const organizationsResponse = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
        requireOrg: false
      });
      setOrganizations(organizationsResponse.data);
      setActiveOrgId(response.data.org_id);
      await syncPublicProfile();
      await refreshCoreData(response.data.org_id);
    } catch (error) {
      addActivity(`Accept invitation failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectInvitation(invitation: PendingInvitation) {
    try {
      setBusy(true);
      const response = await apiRequest<{ data: { organization_name: string } }>(`/api/invitations/${invitation.id}/reject`, {
        method: "POST",
        requireOrg: false
      });
      addActivity(`Invitation rejected: group ${response.data.organization_name}.`);
      await loadPendingInvitations();
    } catch (error) {
      addActivity(`Reject invitation failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveOrganizationMember(userId: string) {
    const targetGroup = ownedGroup;
    if (!targetGroup) {
      addActivity("Remove member failed: owned group is not available.");
      return;
    }

    try {
      setBusy(true);
      const targetOrgId = targetGroup.organization.id;
      await apiRequest(`/api/organizations/${targetOrgId}/members/${userId}`, {
        method: "DELETE",
        orgOverride: targetOrgId
      });
      await loadOwnedGroupMembers(targetGroup);
      addActivity("Group member removed.");
    } catch (error) {
      addActivity(`Remove member failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshHealth() {
    try {
      setBusy(true);
      const [health, lowStock] = await Promise.all([
        apiRequest<{ data: StockHealth }>("/api/reports/stock-health"),
        apiRequest<{ data: Array<unknown> }>("/api/alerts/low-stock")
      ]);
      setStockHealth(health.data);
      setLowStockCount(lowStock.data.length);
      addActivity("Stock health refreshed.");
    } catch (error) {
      addActivity(`Health refresh failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const ownedGroupName = ownedGroup?.organization.name ?? "my group";
  const ownedGroupMemberRows =
    ownedGroup && organizationMembers.length > 0
      ? organizationMembers.filter((member) => member.role !== "owner").map((member) => ({
          key: `${ownedGroup.organization.id}-${member.user_id}`,
          member: member.full_name?.trim() || "-",
          email: member.email?.trim() || "-",
          role: member.role,
          joined: formatDateLabel(member.created_at),
          actionLabel: "Remove",
          action: (
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => handleRemoveOrganizationMember(member.user_id)}>
              Remove
            </button>
          )
        }))
      : [];
  const organizationMemberTableRows = sortRowsByKey(
    ownedGroupMemberRows,
    tableSorts["organization-members"],
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const membershipTableRows = sortRowsByKey(
    organizations.map((item) => {
      const isActiveOrganization = item.organization.id === orgId;
      return {
        key: item.organization.id,
        group: item.organization.name,
        role: item.role,
        joined: formatDateLabel(item.organization.created_at),
        actionLabel: isActiveOrganization ? "Current" : "Open Group",
        action: !isActiveOrganization ? (
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={() => {
              setActiveOrgId(item.organization.id);
              addActivity(`Switched group to ${item.organization.name}.`);
              void refreshCoreData(item.organization.id);
            }}
          >
            Open Group
          </button>
        ) : (
          <span className="subtle-line">Current</span>
        )
      };
    }),
    tableSorts.memberships,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const invitationTableRows = sortRowsByKey(
    pendingInvitations.map((invitation) => ({
      id: invitation.id,
      direction: invitation.direction === "sent" ? "Sent" : "Received",
      group: invitation.organization_name,
      person: invitation.email,
      role: invitation.role,
      expires: formatDateLabel(invitation.expires_at),
      actionLabel: invitation.direction === "received" ? "Accept Reject" : invitation.status,
      invitation
    })),
    tableSorts.invitations,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const locationRows = locations.map((location) => ({
    id: location.id,
    code: location.code ?? "-",
    name: location.name,
    address: location.address?.trim() ? location.address : "-",
    status: location.is_active === false ? "Blocked" : "Active",
    lowStock: locationSkuAlertCounts[location.id]?.lowStock ?? 0,
    outOfStock: locationSkuAlertCounts[location.id]?.outOfStock ?? 0,
    actionLabel: "Edit Block",
    location
  }));
  const filteredLocationRows = locationRows.filter((row) => {
    const normalizedQuery = locationFilterQuery.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [row.code, row.name, row.address].some((value) => String(value).toLowerCase().includes(normalizedQuery));
    const matchesStatus = locationStatusFilter === "all" || row.status.toLowerCase() === locationStatusFilter;

    return matchesQuery && matchesStatus;
  });
  const locationTableRows = sortRowsByKey(
    filteredLocationRows,
    tableSorts.locations,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const materialTableRows = sortRowsByKey(
    materials.map((material) => ({
      id: material.id,
      sku: material.sku,
      name: material.name,
      category: material.category || "-",
      subcategory: material.subcategory || "-",
      description: material.description || "-",
      uom: formatMaterialUnitLabel(material.uom, locale),
      minStock: formatNumberLabel(material.min_stock),
      status: material.is_active === false ? "Blocked" : "Active",
      createdAt: material.created_at ? formatDateTimeLabel(material.created_at) : "-",
      actionLabel: canManageCatalog ? "Edit Block" : "No actions",
      material
    })),
    tableSorts.materials,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const movementRows = materialMovements.map((movement) => ({
    id: movement.id,
    createdAt: formatDateTimeLabel(movement.created_at),
    materialSku: movement.material?.sku ?? "",
    materialName: movement.material?.name ?? "",
    materialLabel: movement.material ? `${movement.material.sku} - ${movement.material.name}` : "-",
    locationLabel: formatMovementLocation(movement.location),
    quantity: formatNumberLabel(Number(movement.quantity_delta)),
    uom: movement.material ? formatMaterialUnitLabel(movement.material.uom, locale) : "-",
    category: movement.material?.category ?? "-",
    reason: formatMovementReason(movement.reason),
    comments: movement.note?.trim() ? movement.note : "-"
  }));
  const movementLocations = ["all", ...Array.from(new Set(movementRows.map((row) => row.locationLabel))).sort((a, b) => a.localeCompare(b))];
  const movementReasons = ["all", ...Array.from(new Set(movementRows.map((row) => row.reason))).sort((a, b) => a.localeCompare(b))];
  const filteredMovementRows = movementRows.filter((row) => {
    const normalizedQuery = movementFilterQuery.trim().toLowerCase();
    if (movementLocationFilter !== "all" && row.locationLabel !== movementLocationFilter) {
      return false;
    }
    if (movementReasonFilter !== "all" && row.reason !== movementReasonFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return row.materialSku.toLowerCase().includes(normalizedQuery) || row.materialName.toLowerCase().includes(normalizedQuery);
  });
  const movementTableRows = sortRowsByKey(
    filteredMovementRows,
    tableSorts.movements,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const supplierTableRows = sortRowsByKey(
    filteredSupplierRows.map((supplier) => ({
      supplierId: supplier.supplierId,
      vendorId: formatVendorNumber(supplier.vendorNumber) || "-",
      name: supplier.name,
      phone: supplier.phone || "-",
      address: supplier.address || "-",
      leadTimeDays: supplier.leadTimeDays,
      status: supplier.isActive ? "Active" : "Blocked",
      openOrders: supplier.openOrders,
      receivedOrders: supplier.receivedOrders,
      totalOrders: supplier.totalOrders,
      actionLabel: supplierById.has(supplier.supplierId) ? "Edit Block" : "-",
      editableSupplier: supplierById.get(supplier.supplierId)
    })),
    tableSorts.suppliers,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const purchaseOrderTableRows = sortRowsByKey(
    poTableRows.map(({ po, summary }) => ({
      id: po.id,
      poNumber: po.po_number,
      supplier: summary.supplierLabel,
      status: po.status.toUpperCase(),
      lines: `${summary.lineCount} ${summary.lineCount === 1 ? "line" : "lines"}`,
      progress: `${summary.totalReceived}/${summary.totalOrdered} (${summary.progressPercentage}%)`,
      total: formatCurrencyAmount(summary.totalAmount, summary.currency),
      totalExport: formatCurrencyExport(summary.totalAmount, summary.currency),
      expected: formatDateLabel(po.expected_at),
      actionLabel:
        po.status === "draft"
          ? "Mark Sent Cancel"
          : po.status === "sent" || po.status === "partial"
            ? "Receive Cancel"
            : "No actions",
      po,
      summary
    })),
    tableSorts["purchase-orders"],
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const inventoryTableRows = sortRowsByKey(
    inventoryRows.map((material) => {
      const quantity = Number(material.location_quantity ?? 0);
      const status = normalizeStatus(undefined, quantity, Number(material.min_stock));
      const materialPrice = priceByMaterial.get(material.id);
      return {
        id: material.inventory_row_id,
        sku: material.sku,
        name: material.name,
        category: material.category || "-",
        subcategory: material.subcategory || "-",
        quantity: formatNumberLabel(quantity),
        uom: material.uom,
        pricePerUnit: materialPrice == null ? "-" : formatCurrencyAmount(materialPrice.unitPrice, materialPrice.currency),
        total: materialPrice == null ? "-" : formatCurrencyAmount(quantity * materialPrice.unitPrice, materialPrice.currency),
        pricePerUnitExport: materialPrice == null ? "-" : formatCurrencyExport(materialPrice.unitPrice, materialPrice.currency),
        totalExport: materialPrice == null ? "-" : formatCurrencyExport(quantity * materialPrice.unitPrice, materialPrice.currency),
        location: material.location_label,
        statusLabel: status === "out-of-stock" ? "Out of Stock" : status === "low-stock" ? "Low Stock" : "In Stock",
        status
      };
    }),
    tableSorts.inventory,
    (row, key) => row[key as keyof typeof row] as CsvCell
  );
  const locationTotalPages = totalPagesForRows(locationTableRows.length, DEFAULT_TABLE_PAGE_SIZE);
  const supplierTotalPages = totalPagesForRows(supplierTableRows.length, DEFAULT_TABLE_PAGE_SIZE);
  useEffect(() => {
    setLocationPage((current) => Math.min(current, locationTotalPages));
  }, [locationTotalPages]);

  useEffect(() => {
    setSupplierPage((current) => Math.min(current, supplierTotalPages));
  }, [supplierTotalPages]);

  return (
    <>
      <section className="card shell-nav">
        <div className="shell-top">
          <div className="brand-wrap">
            <svg className="brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="60" height="8" />
              <rect className="brand-mark-accent" x="2" y="16" width="60" height="8" />
              <rect x="2" y="28" width="60" height="8" />
            </svg>
            <div>
              <h2>LockStock</h2>
            </div>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "nav-link-active" : ""}`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <NavItemIcon icon={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="shell-user-actions">
            {signedInAs ? (
              <>
                {isPlatformAdmin ? (
                  <Link href="/platform" className={`nav-link ${pathname === "/platform" ? "nav-link-active" : ""}`}>
                    Platform
                  </Link>
                ) : null}
                <LanguageSwitcher />
                <Link href="/account" className={`nav-link ${pathname === "/account" ? "nav-link-active" : ""}`}>
                  Account
                </Link>
                <button type="button" className="ghost-btn" disabled={busy} onClick={handleLogout}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/" className="nav-link">
                  Sign In
                </Link>
                <LanguageSwitcher />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="title-row">
          <div>
            <h1>{currentScreen.title}</h1>
            <p>{currentScreen.subtitle}</p>
            {activeMembership ? (
              <p className="subtle-line">
                Active group: <strong>{activeMembership.organization.name}</strong> ({activeMembership.role})
              </p>
            ) : null}
          </div>
          {!showWorkflowsSection ? <WorkflowGuideButton workflows={contextualWorkflows} /> : null}
        </div>
      </section>

      {showAuthPanel ? (
        <section className="card">
        <h2>Access & Environment</h2>
        <p>Sign in and the workspace will auto-bootstrap group context.</p>
        <div className="grid grid-2">
          {!isProduction ? (
            <label className="field">
              <span>Base URL</span>
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:3000" />
            </label>
          ) : null}
          <label className="field">
            <span>Active Group ID</span>
            <input value={orgId} readOnly placeholder="auto-selected" />
          </label>
        </div>
        <div className="grid grid-2">
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="password"
              type="password"
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !email || !password} onClick={handleLogin}>
            Sign In
          </button>
          <button type="button" disabled={busy || !signedInAs} onClick={handleLogout}>
            Sign Out
          </button>
          <button type="button" disabled={busy || !accessToken} onClick={handleLoadOrganizations}>
            Sync Workspace
          </button>
        </div>
        {signedInAs ? <p>Signed in as: <strong>{signedInAs}</strong></p> : <p>Not signed in.</p>}
        {organizations.length > 0 ? (
          <label className="field">
            <span>Group Picker</span>
            <select
              value={orgId}
              onChange={(event) => {
                const nextOrgId = event.target.value;
                setActiveOrgId(nextOrgId);
                const nextMembership = organizations.find((item) => item.organization.id === nextOrgId);
                addActivity(`Switched group to ${nextMembership?.organization.name ?? "selected group"}.`);
                void refreshCoreData(nextOrgId);
              }}
            >
              {organizations.map((item) => (
                <option key={item.organization.id} value={item.organization.id}>
                  {item.organization.name} ({item.role})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="actions">
          <button type="button" disabled={busy || !isOrgScopedReady} onClick={() => refreshCoreData()}>
            Refresh Data
          </button>
          <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleRefreshHealth}>
            Refresh Health
          </button>
        </div>
      </section>
      ) : null}

      {showWorkflowsSection ? <WorkflowGallery /> : null}

      {showMembersSection && canUseMembersScreen ? (
        <WorkbenchMembersSection
          busy={busy}
          canUseMembersScreen={canUseMembersScreen}
          ownedGroupName={ownedGroupName}
          ownedGroup={ownedGroup}
          ownedGroupsLength={ownedGroups.length}
          renamingOrgId={renamingOrgId}
          renameOrgName={renameOrgName}
          accessToken={accessToken}
          memberInviteEmail={memberInviteEmail}
          memberInviteRole={memberInviteRole}
          organizationMemberTableRows={organizationMemberTableRows}
          membershipTableRows={membershipTableRows}
          invitationTableRows={invitationTableRows}
          roleAuthorizations={ROLE_AUTHORIZATIONS}
          tableSortStateOrganizationMembers={tableSorts["organization-members"]}
          tableSortStateMemberships={tableSorts.memberships}
          tableSortStateInvitations={tableSorts.invitations}
          onRenameGroupClick={() => {
            if (ownedGroup) {
              startRenameGroup(ownedGroup);
            }
          }}
          onRefreshMembersClick={() => loadOwnedGroupMembers()}
          onRenameOrgNameChange={setRenameOrgName}
          onSaveGroupName={handleRenameGroup}
          onCancelRenameGroup={() => {
            setRenamingOrgId("");
            setRenameOrgName("");
          }}
          onMemberInviteEmailChange={setMemberInviteEmail}
          onMemberInviteRoleChange={(value) => setMemberInviteRole(value as OrganizationMember["role"] | "")}
          onSendInvitation={handleInviteMemberByEmail}
          onRefreshInvitations={() => loadPendingInvitations()}
          onRefreshGroups={handleLoadOrganizations}
          onAcceptInvitation={(id) => {
            const invitation = pendingInvitations.find((item) => item.id === id);
            if (invitation) {
              void handleAcceptInvitation(invitation);
            }
          }}
          onRejectInvitation={(id) => {
            const invitation = pendingInvitations.find((item) => item.id === id);
            if (invitation) {
              void handleRejectInvitation(invitation);
            }
          }}
          onSort={handleTableSort}
        />
      ) : null}
      {showLocationSection ? (
        <>
          <WorkbenchLocationsSection
            busy={busy}
            canExportCsv={canExportCsv}
            canManageCatalog={canManageCatalog}
            hasLocations={locations.length > 0}
            locationPage={locationPage}
            locationTotalPages={locationTotalPages}
            locationTableRows={locationTableRows}
            locationSearchQuery={locationFilterQuery}
            locationStatusFilter={locationStatusFilter}
            locationSortState={tableSorts.locations}
            onCreateLocation={openCreateLocationForm}
            onEditLocation={openEditLocationForm}
            onToggleLocationUsage={setPendingLocationUsageChange}
            onExportCsv={() =>
              exportTableCsv(
                "locations.csv",
                ["Code", "Name", "Address", "Status", "Low stock", "Out of stock"],
                locationTableRows.map((row) => [row.code, row.name, row.address, row.status, row.lowStock, row.outOfStock])
              )
            }
            onLocationSearchChange={(nextValue) => {
              setLocationFilterQuery(nextValue);
              setLocationPage(1);
            }}
            onLocationStatusFilterChange={(nextValue) => {
              setLocationStatusFilter(nextValue);
              setLocationPage(1);
            }}
            onLocationPageChange={setLocationPage}
            onSort={handleTableSort}
          />

        </>
      ) : null}

      {showMaterialSection ? (
        <>
          <WorkbenchMaterialsSection
            busy={busy}
            canExportCsv={canExportCsv}
            canManageCatalog={canManageCatalog}
            isOrgScopedReady={isOrgScopedReady}
            materialPage={materialPage}
            materialTotalPages={materialTotalPages}
            materialTableRows={materialTableRows}
            materialSearchQuery={materialFilterQuery}
            materialCategoryFilter={materialCategoryFilter}
            materialSubcategoryFilter={materialSubcategoryFilter}
            materialCategoryOptions={MATERIAL_CATEGORIES}
            materialFilterSubcategories={materialFilterSubcategories}
            materialSortState={tableSorts.materials}
            onCreateMaterial={() => setShowMaterialCreateForm(true)}
            onEditMaterial={openEditMaterialForm}
            onToggleMaterialUsage={setPendingMaterialUsageChange}
            onExportCsv={() =>
              exportTableCsv(
                "materials.csv",
                ["SKU", "Name", "Category", "Subcategory", "Description", "UoM", "Minimum stock", "Status", "Date and time of creation"],
                materialTableRows.map((row) => [
                  row.sku,
                  row.name,
                  row.category,
                  row.subcategory,
                  row.description,
                  row.uom,
                  row.minStock,
                  row.status,
                  row.createdAt
                ])
              )
            }
            onMaterialSearchChange={(nextValue) => {
              setMaterialFilterQuery(nextValue);
              setMaterialPage(1);
            }}
            onMaterialCategoryFilterChange={(nextValue) => {
              setMaterialCategoryFilter(nextValue);
              setMaterialSubcategoryFilter("all");
              setMaterialPage(1);
            }}
            onMaterialSubcategoryFilterChange={(nextValue) => {
              setMaterialSubcategoryFilter(nextValue);
              setMaterialPage(1);
            }}
            onMaterialPageChange={setMaterialPage}
            onSort={handleTableSort}
          />
          <WorkbenchCatalogForms
            busy={busy}
            canManageCatalog={canManageCatalog}
            isOrgScopedReady={isOrgScopedReady}
            locale={locale}
            apiRequest={apiRequest}
            onActivity={addActivity}
            onBusyChange={setBusy}
            onRefreshCoreData={refreshCoreData}
            showLocationForm={showLocationForm}
            editingLocation={editingLocation}
            pendingLocationUsageChange={pendingLocationUsageChange}
            onCloseLocationForm={closeLocationForm}
            onClosePendingLocationUsageChange={() => setPendingLocationUsageChange(null)}
            showMaterialCreateForm={showMaterialCreateForm}
            editingMaterial={editingMaterial}
            pendingMaterialUsageChange={pendingMaterialUsageChange}
            onCloseMaterialCreateForm={() => setShowMaterialCreateForm(false)}
            onCloseEditMaterialForm={closeEditMaterialForm}
            onClosePendingMaterialUsageChange={() => setPendingMaterialUsageChange(null)}
          />
        </>
      ) : null}

      {showStockMovementsSection ? (
        <WorkbenchStockMovementsSection
          busy={busy}
          canCreateStockMovement={canCreateStockMovement}
          canExportCsv={canExportCsv}
          apiRequest={apiRequest}
          onActivity={addActivity}
          onBusyChange={setBusy}
          onRefreshCoreData={refreshCoreData}
          movementPage={movementPage}
          movementTotalPages={movementTotalPages}
          movementFilterQuery={movementFilterQuery}
          movementLocationFilter={movementLocationFilter}
          movementReasonFilter={movementReasonFilter}
          movementLocations={movementLocations}
          movementReasons={movementReasons}
          movementTableRows={movementTableRows}
          movementSortState={tableSorts.movements}
          showMovementForm={showMovementForm}
          activeMaterials={activeMaterials}
          activeLocations={activeLocations}
          onShowMovementFormChange={setShowMovementForm}
          onMovementFilterQueryChange={(value) => {
            setMovementFilterQuery(value);
            setMovementPage(1);
          }}
          onMovementLocationFilterChange={(value) => {
            setMovementLocationFilter(value);
            setMovementPage(1);
          }}
          onMovementReasonFilterChange={(value) => {
            setMovementReasonFilter(value);
            setMovementPage(1);
          }}
          onMovementPageChange={setMovementPage}
          onExportCsv={() =>
            exportTableCsv(
              "material-movements.csv",
              ["Date & Time", "Material", "Location", "Quantity", "UoM", "Category", "Reason", "Comments"],
              movementTableRows.map((row) => [
                row.createdAt,
                row.materialLabel,
                row.locationLabel,
                row.quantity,
                row.uom,
                row.category,
                row.reason,
                row.comments
              ])
            )
          }
          onSort={handleTableSort}
        />
      ) : null}
      {showSupplierSection ? (
        <>
          <section className="card">
            <div className="inventory-toolbar location-toolbar">
              <div className="search-input-wrap">
                <SearchFieldIcon />
                <input
                  value={supplierSearch}
                  onChange={(event) => {
                    setSupplierSearch(event.target.value);
                    setSupplierPage(1);
                  }}
                  placeholder="Filter by vendor name, ID, phone, or address"
                />
              </div>
              <div className="category-wrap">
                <SelectFieldIcon />
                <select
                  value={supplierStatusFilter}
                  onChange={(event) => {
                    setSupplierStatusFilter(event.target.value);
                    setSupplierPage(1);
                  }}
                  aria-label="Status"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="table-section-head">
              <h2>Vendor Management</h2>
              <div className="actions table-head-actions inventory-table-actions">
                {canManageCatalog ? (
                  <button type="button" onClick={openCreateSupplierForm}>
                    Add Vendor
                  </button>
                ) : null}
                {canExportCsv ? (
                  <button
                    type="button"
                    className="ghost-btn export-csv-btn"
                    disabled={supplierTableRows.length === 0}
                    onClick={() =>
                      exportTableCsv(
                        "vendors.csv",
                        ["Vendor ID", "Vendor Name", "Phone", "Address", "Lead Time (days)", "Status", "Open POs", "Received POs", "Total POs"],
                        supplierTableRows.map((row) => [
                          row.vendorId,
                          row.name,
                          row.phone,
                          row.address,
                          row.leadTimeDays,
                          row.status,
                          row.openOrders,
                          row.receivedOrders,
                          row.totalOrders
                        ])
                      )
                    }
                  >
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>

            <WorkbenchSuppliersSection
              busy={busy}
              canExportCsv={canExportCsv}
              canManageCatalog={canManageCatalog}
              hasSuppliers={suppliers.length > 0}
              isOrgScopedReady={isOrgScopedReady}
              apiRequest={apiRequest}
              onActivity={addActivity}
              onBusyChange={setBusy}
              onRefreshCoreData={refreshCoreData}
              supplierPage={supplierPage}
              supplierTotalPages={supplierTotalPages}
              supplierTableRows={supplierTableRows}
              supplierSearchQuery={supplierSearch}
              supplierStatusFilter={supplierStatusFilter}
              supplierSortState={tableSorts.suppliers}
              showSupplierForm={showSupplierForm}
              editingSupplier={editingSupplier}
              pendingSupplierUsageChange={pendingSupplierUsageChange}
              onCreateSupplier={openCreateSupplierForm}
              onEditSupplier={openEditSupplierForm}
              onToggleSupplierUsage={setPendingSupplierUsageChange}
              onCloseSupplierForm={closeSupplierForm}
              onClosePendingSupplierUsageChange={() => setPendingSupplierUsageChange(null)}
              onExportCsv={() =>
                exportTableCsv(
                  "vendors.csv",
                  ["Vendor ID", "Vendor Name", "Phone", "Address", "Lead Time (days)", "Status", "Open POs", "Received POs", "Total POs"],
                  supplierTableRows.map((row) => [
                    row.vendorId,
                    row.name,
                    row.phone,
                    row.address,
                    row.leadTimeDays,
                    row.status,
                    row.openOrders,
                    row.receivedOrders,
                    row.totalOrders
                  ])
                )
              }
              onSupplierSearchChange={(nextValue: string) => {
                setSupplierSearch(nextValue);
                setSupplierPage(1);
              }}
              onSupplierStatusFilterChange={(nextValue: string) => {
                setSupplierStatusFilter(nextValue);
                setSupplierPage(1);
              }}
              onSupplierPageChange={setSupplierPage}
              onSort={handleTableSort}
            />
          </section>
        </>
      ) : null}
      {showPurchaseOrderSection ? (
        <>
          <WorkbenchPurchaseOrdersSection
            busy={busy}
            canManageCatalog={canManageCatalog}
            canReceivePurchaseOrders={canReceivePurchaseOrders}
            canExportCsv={canExportCsv}
            apiRequest={apiRequest}
            onActivity={addActivity}
            onBusyChange={setBusy}
            onRefreshCoreData={refreshCoreData}
            poTotal={poTotal}
            poPage={poPage}
            poTotalPages={poTotalPages}
            poOverview={poOverview}
            poFilterQuery={poFilterQuery}
            poFilterStatus={poFilterStatus}
            poFilterSupplierId={poFilterSupplierId}
            suppliers={suppliers}
            purchaseOrderTableRows={purchaseOrderTableRows}
            selectedPoDetails={selectedPoDetails}
            pendingCancelPo={pendingCancelPo}
            materials={materials}
            tableSortState={tableSorts["purchase-orders"]}
            onOpenCreatePurchaseOrderForm={() => setShowPoCreateForm(true)}
            onOpenReceivePurchaseOrderForm={() => setShowPoReceiveForm(true)}
            onPrepareReceivePurchaseOrder={(poId, lineId) => {
              setReceivePoId(poId);
              setReceivePoLineId(lineId);
              setShowPoReceiveForm(true);
            }}
            onSelectedPoDetailsIdChange={setSelectedPoDetailsId}
            onPendingCancelPoChange={setPendingCancelPo}
            onPoFilterQueryChange={(value) => {
              setPoFilterQuery(value);
              setPoPage(1);
            }}
            onPoFilterStatusChange={(value) => {
              setPoFilterStatus(value);
              setPoPage(1);
            }}
            onPoFilterSupplierIdChange={(value) => {
              setPoFilterSupplierId(value);
              setPoPage(1);
            }}
            onPoPageChange={setPoPage}
            onExportCsv={() =>
              exportTableCsv(
                "purchase-orders.csv",
                ["PO Number", "Supplier", "Status", "Lines", "Progress", "Total", "Expected"],
                purchaseOrderTableRows.map((row) => [
                  row.po.po_number,
                  row.summary.supplierLabel,
                  row.po.status,
                  row.summary.lineCount,
                  row.summary.progressPercentage,
                  row.summary.totalAmount,
                  row.po.expected_at
                ])
              )
            }
            onSort={handleTableSort}
          />
          <WorkbenchPurchaseOrderForms
            busy={busy}
            isOrgScopedReady={isOrgScopedReady}
            canManageCatalog={canManageCatalog}
            canReceivePurchaseOrders={canReceivePurchaseOrders}
            apiRequest={apiRequest}
            onActivity={addActivity}
            onBusyChange={setBusy}
            onRefreshCoreData={refreshCoreData}
            showPoCreateForm={showPoCreateForm}
            showPoReceiveForm={showPoReceiveForm}
            activeSuppliers={activeSuppliers}
            activeMaterials={activeMaterials}
            purchaseOrders={purchaseOrders}
            activeLocations={activeLocations}
            initialReceivePoId={receivePoId}
            initialReceivePoLineId={receivePoLineId}
            onClosePoCreateForm={() => setShowPoCreateForm(false)}
            onClosePoReceiveForm={() => setShowPoReceiveForm(false)}
          />
        </>
      ) : null}
      {showSnapshotSection ? (
        <WorkbenchSnapshotSection
          busy={busy}
          canManageCatalog={canManageCatalog}
          canCreateStockMovement={canCreateStockMovement}
          canExportCsv={canExportCsv}
          metrics={metrics}
          lowStockCount={lowStockCount}
          stockHealth={stockHealth}
          inventoryValueBadge={inventoryValueBadge}
          inventoryValueLabel={inventoryValueLabel}
          materialFilterQuery={materialFilterQuery}
          inventoryStatus={inventoryStatus}
          inventoryLocation={inventoryLocation}
          inventoryLocations={inventoryLocations}
          inventoryTableRows={inventoryTableRows}
          materialPage={materialPage}
          materialTotalPages={materialTotalPages}
          inventorySortState={tableSorts.inventory}
          onMaterialFilterQueryChange={(value) => {
            setMaterialFilterQuery(value);
            setMaterialPage(1);
          }}
          onInventoryStatusChange={(value) => {
            setInventoryStatus(value);
            setMaterialPage(1);
          }}
          onInventoryLocationChange={(value) => {
            setInventoryLocation(value);
            setMaterialPage(1);
          }}
          onMaterialPageChange={setMaterialPage}
          onExportCsv={() =>
            exportTableCsv(
              "inventory.csv",
              ["SKU", "Item Name", "Category", "Subcategory", "Quantity", "UoM", "Price per unit", "Total", "Location", "Status"],
              inventoryTableRows.map((row) => [
                row.sku,
                row.name,
                row.category,
                row.subcategory,
                row.quantity,
                row.uom,
                row.pricePerUnitExport,
                row.totalExport,
                row.location,
                row.statusLabel
              ])
            )
          }
          onSort={handleTableSort}
        />
      ) : null}
    </>
  );
}
