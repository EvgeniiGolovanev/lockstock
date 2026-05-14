"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavItemIcon, type NavIcon } from "@/components/nav-item-icon";
import { WorkflowGallery, WorkflowGuideButton } from "@/components/workflow-guide";
import { getSignedOutRedirectPath, shouldShowSignedOutPanels } from "@/lib/auth/route-guards";
import { MATERIAL_CATEGORIES, getMaterialSubcategories, type MaterialCategory } from "@/lib/material-categories";
import { MATERIAL_DUPLICATE_SKU_ERROR } from "@/lib/material-errors";
import { MATERIAL_UNITS, formatMaterialUnitLabel } from "@/lib/material-units";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  materialDuplicateSkuMessage,
  validateMaterialDraftRequiredFields,
  type MaterialDraftRequiredField
} from "@/lib/ui/material-form";
import {
  formatDateLabel as formatUiDateLabel,
  formatDateTimeLabel,
  formatNumberLabel
} from "@/lib/ui/formatters";
import {
  paginateRows,
  sortRowsByKey,
  tableRowsToCsv,
  totalPagesForRows,
  type CsvCell,
  type SortDirection,
  type SortState
} from "@/lib/ui/table-tools";
import { useActivityLog } from "@/lib/ui/use-activity-log";
import { workflowsForPathname } from "@/lib/ui/workflows";
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  PHONE_COUNTRY_CODES,
  buildPhoneNumber,
  formatVendorNumber,
  splitPhoneNumber
} from "@/lib/ui/vendor-fields";
import {
  buildLocationSkuAlertCounts,
  currencySymbol,
  expandInventoryRows,
  filterInventoryRows,
  formatCurrencyAmount,
  formatCurrencyTotals,
  inventoryMetrics,
  normalizePurchaseOrderCurrency,
  normalizeStatus,
  purchaseOrderDraftSummary,
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

type PurchaseOrderDraftLine = {
  id: string;
  material_id: string;
  quantity_ordered: number;
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
  token: "lockstock.accessToken",
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

function SortableHeader({
  label,
  sortKey,
  tableId,
  sortState,
  onSort
}: {
  label: string;
  sortKey: string;
  tableId: TableId;
  sortState?: SortState;
  onSort: (tableId: TableId, key: string) => void;
}) {
  const active = sortState?.key === sortKey;
  const direction = active ? sortState.direction : undefined;

  return (
    <th aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`table-sort-btn ${active ? "table-sort-active" : ""}`}
        onClick={() => onSort(tableId, sortKey)}
      >
        <span>{label}</span>
        {direction ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

export function LockstockWorkbench() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLanguage();
  const [baseUrl, setBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const { addActivity } = useActivityLog(signedInAs || email);
  const [signedInFullName, setSignedInFullName] = useState("");
  const [renamingOrgId, setRenamingOrgId] = useState("");
  const [renameOrgName, setRenameOrgName] = useState("");

  const [locationName, setLocationName] = useState("Main Warehouse");
  const [locationCode, setLocationCode] = useState("MAIN");
  const [locationAddress, setLocationAddress] = useState("");
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [materialSku, setMaterialSku] = useState("MAT-001");
  const [materialName, setMaterialName] = useState("Cement");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialUom, setMaterialUom] = useState("BAG");
  const [materialCategory, setMaterialCategory] = useState<MaterialCategory>(MATERIAL_CATEGORIES[0]);
  const [materialSubcategory, setMaterialSubcategory] = useState(getMaterialSubcategories(MATERIAL_CATEGORIES[0])[0] ?? "");
  const [materialMinStock, setMaterialMinStock] = useState("10");
  const [materialRequiredErrors, setMaterialRequiredErrors] = useState<MaterialDraftRequiredField[]>([]);
  const [materialSkuDuplicate, setMaterialSkuDuplicate] = useState(false);
  const [showMaterialCreateForm, setShowMaterialCreateForm] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMaterialName, setEditMaterialName] = useState("");
  const [editMaterialCategory, setEditMaterialCategory] = useState<MaterialCategory>(MATERIAL_CATEGORIES[0]);
  const [editMaterialSubcategory, setEditMaterialSubcategory] = useState(getMaterialSubcategories(MATERIAL_CATEGORIES[0])[0] ?? "");
  const [editMaterialMinStock, setEditMaterialMinStock] = useState("");
  const [editMaterialDescription, setEditMaterialDescription] = useState("");
  const [editMaterialRequiredErrors, setEditMaterialRequiredErrors] = useState<Array<"name" | "minStock">>([]);
  const [supplierVendorNumber, setSupplierVendorNumber] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("Acme Supply");
  const [supplierPhoneCountryCode, setSupplierPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [supplierPhoneNumber, setSupplierPhoneNumber] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierLeadTime, setSupplierLeadTime] = useState(5);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState("all");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showPoCreateForm, setShowPoCreateForm] = useState(false);
  const [showPoReceiveForm, setShowPoReceiveForm] = useState(false);
  const [selectedPoDetailsId, setSelectedPoDetailsId] = useState<string | null>(null);

  const [movementMaterialId, setMovementMaterialId] = useState("");
  const [movementLocationId, setMovementLocationId] = useState("");
  const [movementFromLocationId, setMovementFromLocationId] = useState("");
  const [movementToLocationId, setMovementToLocationId] = useState("");
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [movementReason, setMovementReason] = useState<ManualMovementReason>("adjustment");
  const [movementComment, setMovementComment] = useState("");
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poMaterialId, setPoMaterialId] = useState("");
  const [poQuantityOrdered, setPoQuantityOrdered] = useState(1);
  const [poUnitPrice, setPoUnitPrice] = useState(0);
  const [poCurrency, setPoCurrency] = useState<PurchaseOrderCurrency>("EUR");
  const [poExpectedAt, setPoExpectedAt] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poDraftLines, setPoDraftLines] = useState<PurchaseOrderDraftLine[]>([]);
  const [receivePoId, setReceivePoId] = useState("");
  const [receivePoLineId, setReceivePoLineId] = useState("");
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState(1);
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
  const [memberInviteEmail, setMemberInviteEmail] = useState("");
  const [memberInviteRole, setMemberInviteRole] = useState<OrganizationMember["role"] | "">("");

  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/+$/, ""), [baseUrl]);
  const isOrgScopedReady = Boolean(accessToken && orgId);
  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((po) => po.id === receivePoId) ?? null,
    [purchaseOrders, receivePoId]
  );
  const selectedReceiveLine = useMemo(
    () => selectedPurchaseOrder?.lines.find((line) => line.id === receivePoLineId) ?? null,
    [selectedPurchaseOrder, receivePoLineId]
  );
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
  const selectedReceiveMaterial = useMemo(
    () => (selectedReceiveLine ? materials.find((material) => material.id === selectedReceiveLine.material_id) ?? null : null),
    [materials, selectedReceiveLine]
  );
  const editingMaterial = useMemo(
    () => (editingMaterialId ? materials.find((material) => material.id === editingMaterialId) ?? null : null),
    [editingMaterialId, materials]
  );
  const activeMaterials = useMemo(() => materials.filter((material) => material.is_active !== false), [materials]);
  const activeLocations = useMemo(() => locations.filter((location) => location.is_active !== false), [locations]);
  const activeSuppliers = useMemo(() => suppliers.filter((supplier) => supplier.is_active !== false), [suppliers]);
  const inventoryLocations = useMemo(() => {
    const locationLabels = expandInventoryRows(materials).map((material) => material.location_label);
    return ["all", ...Array.from(new Set(locationLabels)).sort((a, b) => a.localeCompare(b))];
  }, [materials]);
  const availableMaterialSubcategories = useMemo(
    () => getMaterialSubcategories(materialCategory),
    [materialCategory]
  );
  const availableEditMaterialSubcategories = useMemo(
    () => getMaterialSubcategories(editMaterialCategory),
    [editMaterialCategory]
  );
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
  const poDraftSummary = useMemo(
    () =>
      purchaseOrderDraftSummary(
        poDraftLines.map((line) => ({
          material_id: line.material_id,
          quantity_ordered: line.quantity_ordered,
          unit_price: line.unit_price
        }))
      ),
    [poDraftLines]
  );
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
  const poTotalValueLabel = useMemo(() => formatCurrencyTotals(poOverview.totalValueByCurrency), [poOverview.totalValueByCurrency]);
  const poTotalValueBadge = useMemo(() => {
    const { EUR, USD } = poOverview.totalValueByCurrency;
    if (EUR > 0 && USD > 0) {
      return "€/$";
    }
    return USD > 0 ? "$" : "€";
  }, [poOverview.totalValueByCurrency]);
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
    isAuthenticated: Boolean(signedInAs),
    authResolved
  });
  const showAuthPanel = showSignedOutPanels;
  const canUseMembersScreen = Boolean(accessToken);

  function applySessionState(session: {
    access_token: string;
    user: { email?: string | null; user_metadata?: Record<string, unknown> | null };
  }) {
    const fullName =
      typeof session.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name.trim() : "";
    setAccessToken(session.access_token || "");
    setSignedInAs(session.user.email ?? "");
    setSignedInFullName(fullName);
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
    const effectiveToken = tokenOverride ?? accessToken;
    if (!effectiveToken) {
      return;
    }

    const syncBaseUrl = (baseUrl || window.location.origin).replace(/\/+$/, "");
    await fetch(`${syncBaseUrl}/api/account/profile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveToken}`
      }
    });
  }, [accessToken, baseUrl]);

  useEffect(() => {
    setBaseUrl(window.localStorage.getItem(STORAGE_KEYS.baseUrl) ?? window.location.origin);
    setAccessToken(window.localStorage.getItem(STORAGE_KEYS.token) ?? "");
    setOrgId(window.localStorage.getItem(STORAGE_KEYS.orgId) ?? "");
    setStorageHydrated(true);
  }, []);

  useEffect(() => {
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
            if (window.localStorage.getItem(STORAGE_KEYS.token)) {
              setAccessToken("");
              setSignedInAs("");
              setSignedInFullName("");
              clearWorkspaceData();
              addActivity("No active Supabase session. Cleared saved token.");
            }
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
  }, [addActivity, syncPublicProfile]);

  useEffect(() => {
    const redirectPath = getSignedOutRedirectPath({
      pathname,
      isAuthenticated: Boolean(signedInAs),
      authResolved
    });

    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [authResolved, pathname, router, signedInAs]);

  useEffect(() => {
    if (baseUrl) {
      window.localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (storageHydrated) {
      window.localStorage.setItem(STORAGE_KEYS.token, accessToken);
    }
  }, [accessToken, storageHydrated]);

  useEffect(() => {
    if (storageHydrated) {
      window.localStorage.setItem(STORAGE_KEYS.orgId, orgId);
    }
  }, [orgId, storageHydrated]);

  // bootstrapOrganizationContext is intentionally excluded to avoid re-bootstrap loops from function identity changes.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!storageHydrated || !accessToken || !signedInAs || !normalizedBaseUrl) {
      return;
    }
    void bootstrapOrganizationContext({ tokenOverride: accessToken, announce: false, preferredOrgId: orgId });
  }, [storageHydrated, accessToken, signedInAs, normalizedBaseUrl, orgId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // loadMaterials is intentionally excluded to avoid dependency churn on function identity.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadMaterials().catch((error) => {
      addActivity(`Loading materials failed: ${(error as Error).message}`);
    });
  }, [isOrgScopedReady, normalizedBaseUrl, materialFilterQuery, materialCategoryFilter, materialSubcategoryFilter, materialPage]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // loadMaterialMovements is intentionally excluded to avoid dependency churn on function identity.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!showStockMovementsSection || !isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadMaterialMovements().catch((error) => {
      addActivity(`Loading material movements failed: ${(error as Error).message}`);
    });
  }, [showStockMovementsSection, isOrgScopedReady, normalizedBaseUrl, orgId, movementPage]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // loadPurchaseOrders is intentionally excluded to avoid dependency churn on function identity.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadPurchaseOrders().catch((error) => {
      addActivity(`Loading purchase orders failed: ${(error as Error).message}`);
    });
  }, [isOrgScopedReady, normalizedBaseUrl, poFilterStatus, poFilterSupplierId, poFilterQuery, poPage]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!movementMaterialId && activeMaterials[0]) {
      setMovementMaterialId(activeMaterials[0].id);
    } else if (movementMaterialId && !activeMaterials.some((material) => material.id === movementMaterialId)) {
      setMovementMaterialId(activeMaterials[0]?.id ?? "");
    }
  }, [activeMaterials, movementMaterialId]);

  useEffect(() => {
    if (!movementLocationId && activeLocations[0]) {
      setMovementLocationId(activeLocations[0].id);
    } else if (movementLocationId && !activeLocations.some((location) => location.id === movementLocationId)) {
      setMovementLocationId(activeLocations[0]?.id ?? "");
    }
  }, [activeLocations, movementLocationId]);

  useEffect(() => {
    if (!movementFromLocationId && activeLocations[0]) {
      setMovementFromLocationId(activeLocations[0].id);
    } else if (movementFromLocationId && !activeLocations.some((location) => location.id === movementFromLocationId)) {
      setMovementFromLocationId(activeLocations[0]?.id ?? "");
    }
  }, [activeLocations, movementFromLocationId]);

  useEffect(() => {
    if (movementToLocationId && activeLocations.some((location) => location.id === movementToLocationId)) {
      return;
    }
    const fallbackLocation = activeLocations.find((location) => location.id !== movementFromLocationId) ?? activeLocations[0];
    if (fallbackLocation) {
      setMovementToLocationId(fallbackLocation.id);
    } else if (movementToLocationId) {
      setMovementToLocationId("");
    }
  }, [activeLocations, movementFromLocationId, movementToLocationId]);

  useEffect(() => {
    if (movementReason !== "transfer" || movementFromLocationId !== movementToLocationId) {
      return;
    }
    const fallbackLocation = activeLocations.find((location) => location.id !== movementFromLocationId);
    if (fallbackLocation) {
      setMovementToLocationId(fallbackLocation.id);
    }
  }, [activeLocations, movementFromLocationId, movementReason, movementToLocationId]);

  useEffect(() => {
    if (!poSupplierId && suppliers[0]) {
      setPoSupplierId(suppliers[0].id);
    }
  }, [poSupplierId, suppliers]);

  useEffect(() => {
    if (!availableMaterialSubcategories.includes(materialSubcategory)) {
      setMaterialSubcategory(availableMaterialSubcategories[0] ?? "");
    }
  }, [availableMaterialSubcategories, materialSubcategory]);

  useEffect(() => {
    if (!availableEditMaterialSubcategories.includes(editMaterialSubcategory)) {
      setEditMaterialSubcategory(availableEditMaterialSubcategories[0] ?? "");
    }
  }, [availableEditMaterialSubcategories, editMaterialSubcategory]);

  useEffect(() => {
    if (materialCategoryFilter === "all" || !materialFilterSubcategories.includes(materialSubcategoryFilter)) {
      setMaterialSubcategoryFilter("all");
    }
  }, [materialCategoryFilter, materialFilterSubcategories, materialSubcategoryFilter]);

  useEffect(() => {
    if (!poMaterialId && activeMaterials[0]) {
      setPoMaterialId(activeMaterials[0].id);
    } else if (poMaterialId && !activeMaterials.some((material) => material.id === poMaterialId)) {
      setPoMaterialId(activeMaterials[0]?.id ?? "");
    }
  }, [activeMaterials, poMaterialId]);

  useEffect(() => {
    if (!receiveLocationId && activeLocations[0]) {
      setReceiveLocationId(activeLocations[0].id);
    } else if (receiveLocationId && !activeLocations.some((location) => location.id === receiveLocationId)) {
      setReceiveLocationId(activeLocations[0]?.id ?? "");
    }
  }, [activeLocations, receiveLocationId]);

  useEffect(() => {
    if (!receivePoId && purchaseOrders[0]) {
      setReceivePoId(purchaseOrders[0].id);
    }
  }, [purchaseOrders, receivePoId]);

  useEffect(() => {
    const lineId = selectedPurchaseOrder?.lines?.[0]?.id ?? "";
    if (!receivePoLineId || (selectedPurchaseOrder && !selectedPurchaseOrder.lines.some((line) => line.id === receivePoLineId))) {
      setReceivePoLineId(lineId);
    }
  }, [selectedPurchaseOrder, receivePoLineId]);

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

  function getDefaultGroupName() {
    if (signedInFullName.trim()) {
      return `${signedInFullName.trim()}'s Group`;
    }

    const source = signedInAs || email;
    if (source.includes("@")) {
      return `${source.split("@")[0]}'s Group`;
    }
    return "My Group";
  }

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

  function formatPoStatusDetail(po: PurchaseOrder) {
    if (po.received_at) {
      return `Received ${formatDateLabel(po.received_at)}`;
    }
    if (po.sent_at) {
      return `Sent ${formatDateLabel(po.sent_at)}`;
    }
    if (po.status === "sent") {
      return "Sent";
    }
    if (po.status === "partial") {
      return "Receiving started";
    }
    if (po.status === "received") {
      return "Received";
    }
    if (po.status === "cancelled") {
      return "Cancelled";
    }
    return "Not sent";
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

  function handleAddPoDraftLine() {
    if (!poMaterialId || poQuantityOrdered <= 0) {
      addActivity("Add item failed: select a material and positive quantity.");
      return;
    }

    const nextLine: PurchaseOrderDraftLine = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      material_id: poMaterialId,
      quantity_ordered: Number(poQuantityOrdered),
      unit_price: poUnitPrice > 0 ? Number(poUnitPrice) : null
    };
    setPoDraftLines((prev) => [...prev, nextLine]);
    setPoQuantityOrdered(1);
    setPoUnitPrice(0);
  }

  function handleRemovePoDraftLine(lineId: string) {
    setPoDraftLines((prev) => prev.filter((line) => line.id !== lineId));
  }

  function resetPoCreateForm() {
    setPoExpectedAt("");
    setPoNotes("");
    setPoCurrency("EUR");
    setPoDraftLines([]);
    setPoQuantityOrdered(1);
    setPoUnitPrice(0);
  }

  function resetSupplierForm() {
    setEditingSupplierId(null);
    setSupplierVendorNumber(null);
    setSupplierName("Acme Supply");
    setSupplierPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
    setSupplierPhoneNumber("");
    setSupplierAddress("");
    setSupplierLeadTime(5);
  }

  function resetLocationForm() {
    setEditingLocationId(null);
    setLocationName("Main Warehouse");
    setLocationCode("MAIN");
    setLocationAddress("");
  }

  function openCreateLocationForm() {
    resetLocationForm();
    setShowLocationForm(true);
  }

  function openEditLocationForm(location: Location) {
    setEditingLocationId(location.id);
    setLocationName(location.name);
    setLocationCode(location.code ?? "");
    setLocationAddress(location.address ?? "");
    setShowLocationForm(true);
  }

  function closeLocationForm() {
    setShowLocationForm(false);
    resetLocationForm();
  }

  function openCreateSupplierForm() {
    resetSupplierForm();
    setShowSupplierForm(true);
  }

  function openEditSupplierForm(supplier: Supplier) {
    const { countryCode, localNumber } = splitPhoneNumber(supplier.phone);
    setEditingSupplierId(supplier.id);
    setSupplierVendorNumber(supplier.vendor_number ?? null);
    setSupplierName(supplier.name);
    setSupplierPhoneCountryCode(countryCode);
    setSupplierPhoneNumber(localNumber);
    setSupplierAddress(supplier.address ?? "");
    setSupplierLeadTime(Number(supplier.lead_time_days || 0));
    setShowSupplierForm(true);
  }

  function closeSupplierForm() {
    setShowSupplierForm(false);
    resetSupplierForm();
  }

  function openEditMaterialForm(material: Material) {
    const category = MATERIAL_CATEGORIES.includes(material.category as MaterialCategory)
      ? (material.category as MaterialCategory)
      : MATERIAL_CATEGORIES[0];
    const subcategories = getMaterialSubcategories(category);

    setEditingMaterialId(material.id);
    setEditMaterialName(material.name);
    setEditMaterialCategory(category);
    setEditMaterialSubcategory(
      material.subcategory && subcategories.includes(material.subcategory) ? material.subcategory : subcategories[0] ?? ""
    );
    setEditMaterialMinStock(String(material.min_stock ?? 0));
    setEditMaterialDescription(material.description ?? "");
    setEditMaterialRequiredErrors([]);
  }

  function closeEditMaterialForm() {
    setEditingMaterialId(null);
    setEditMaterialName("");
    setEditMaterialMinStock("");
    setEditMaterialDescription("");
    setEditMaterialRequiredErrors([]);
  }

  async function apiRequest<T>(
    path: string,
    options?: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: Record<string, unknown>;
      orgOverride?: string;
      requireOrg?: boolean;
      tokenOverride?: string;
    }
  ): Promise<T> {
    const method = options?.method ?? "GET";
    const requireOrg = options?.requireOrg ?? true;
    const effectiveOrgId = options?.orgOverride ?? orgId;
    const effectiveToken = options?.tokenOverride ?? accessToken;

    if (!effectiveToken) {
      throw new Error("Access token is required.");
    }
    if (requireOrg && !effectiveOrgId) {
      throw new Error("Group ID is required.");
    }
    if (!normalizedBaseUrl) {
      throw new Error("Base URL is required.");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${effectiveToken}`
    };

    if (requireOrg) {
      headers["x-org-id"] = effectiveOrgId;
    }
    if (options?.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined
    });

    const raw = await response.text();
    const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

    if (!response.ok) {
      throw new Error(String(payload.error ?? `Request failed with status ${response.status}.`));
    }

    return payload as T;
  }

  async function loadOrganizationMembers(targetOrgId?: string, tokenOverride?: string) {
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
  }

  async function loadOwnedGroupMembers(targetGroup?: OrganizationMembership | null, tokenOverride?: string) {
    const group = targetGroup ?? ownedGroup;
    if (!group) {
      setOrganizationMembers([]);
      return;
    }

    await loadOrganizationMembers(group.organization.id, tokenOverride);
  }

  async function loadPendingInvitations(tokenOverride?: string) {
    const response = await apiRequest<{ data: PendingInvitation[] }>("/api/invitations/pending", {
      requireOrg: false,
      tokenOverride
    });
    setPendingInvitations(response.data);
  }

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

  async function loadMaterials(targetOrgId?: string, tokenOverride?: string) {
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
  }

  async function loadMaterialMovements(targetOrgId?: string, tokenOverride?: string) {
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
  }

  async function loadPurchaseOrders(targetOrgId?: string, tokenOverride?: string) {
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
  }

  async function refreshCoreData(
    targetOrgId?: string,
    tokenOverride?: string
  ) {
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

    const ownerMembership = organizations.find((membership) => membership.role === "owner") ?? null;
    if (ownerMembership) {
      await loadOwnedGroupMembers(ownerMembership, tokenOverride);
    } else {
      setOrganizationMembers([]);
    }

    await loadPendingInvitations(tokenOverride);

    addActivity(
      `Loaded ${materialsResult.count} materials, ${movementsResult.count} movements, ${locationsResult.data.length} locations, ${suppliersResult.data.length} suppliers, ${purchaseOrdersResult.count} purchase orders.`
    );
  }

  async function bootstrapOrganizationContext(options?: { tokenOverride?: string; announce?: boolean; preferredOrgId?: string }) {
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
          body: { name: defaultOrgName }
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
      await loadOwnedGroupMembers(ownedMembership, effectiveToken);
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
  }

  async function handleLoadOrganizations() {
    await bootstrapOrganizationContext({ announce: true });
  }

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

  async function handleSaveLocation() {
    try {
      setBusy(true);
      const payload = {
        name: locationName,
        code: locationCode,
        address: locationAddress
      };

      if (editingLocationId) {
        await apiRequest(`/api/locations/${editingLocationId}`, {
          method: "PATCH",
          body: payload
        });
        addActivity("Location updated.");
      } else {
        await apiRequest("/api/locations", {
          method: "POST",
          body: payload
        });
        addActivity("Location created.");
      }

      closeLocationForm();
      await refreshCoreData();
    } catch (error) {
      addActivity(
        editingLocationId
          ? `Update location failed: ${(error as Error).message}`
          : `Create location failed: ${(error as Error).message}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmLocationUsageChange() {
    if (!pendingLocationUsageChange) {
      return;
    }

    const nextIsActive = pendingLocationUsageChange.is_active === false;

    try {
      setBusy(true);
      await apiRequest(`/api/locations/${pendingLocationUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      addActivity(
        `${pendingLocationUsageChange.name} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`
      );
      setPendingLocationUsageChange(null);
      await refreshCoreData();
    } catch (error) {
      addActivity(`Update location usage failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSupplierUsageChange() {
    if (!pendingSupplierUsageChange) {
      return;
    }

    const nextIsActive = pendingSupplierUsageChange.is_active === false;

    try {
      setBusy(true);
      await apiRequest(`/api/suppliers/${pendingSupplierUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      addActivity(
        `${pendingSupplierUsageChange.name} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`
      );
      setPendingSupplierUsageChange(null);
      if (poSupplierId === pendingSupplierUsageChange.id && !nextIsActive) {
        setPoSupplierId("");
      }
      await refreshCoreData();
    } catch (error) {
      addActivity(`Update vendor usage failed: ${(error as Error).message}`);
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

  async function handleCreateMaterial() {
    const missingFields = validateMaterialDraftRequiredFields({
      sku: materialSku,
      name: materialName,
      minStock: materialMinStock
    });

    if (missingFields.length > 0) {
      setMaterialRequiredErrors(missingFields);
      setMaterialSkuDuplicate(false);
      addActivity("Create material failed: SKU, name, and minimum stock are required.");
      return;
    }

    try {
      setBusy(true);
      setMaterialRequiredErrors([]);
      setMaterialSkuDuplicate(false);
      await apiRequest("/api/materials", {
        method: "POST",
        body: {
          sku: materialSku.trim(),
          name: materialName.trim(),
          description: materialDescription.trim() || undefined,
          uom: materialUom,
          category: materialCategory,
          subcategory: materialSubcategory,
          min_stock: Number(materialMinStock)
        }
      });
      addActivity("Material created.");
      setMaterialSku("");
      setMaterialName("");
      setMaterialMinStock("");
      setMaterialDescription("");
      setShowMaterialCreateForm(false);
      await refreshCoreData();
    } catch (error) {
      if ((error as Error).message === MATERIAL_DUPLICATE_SKU_ERROR) {
        setMaterialRequiredErrors(["sku"]);
        setMaterialSkuDuplicate(true);
      }
      addActivity(`Create material failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateMaterial() {
    if (!editingMaterialId) {
      return;
    }

    const missingFields: Array<"name" | "minStock"> = [];
    if (!editMaterialName.trim()) {
      missingFields.push("name");
    }
    if (editMaterialMinStock.trim() === "") {
      missingFields.push("minStock");
    }

    if (missingFields.length > 0) {
      setEditMaterialRequiredErrors(missingFields);
      addActivity("Update material failed: name and minimum stock are required.");
      return;
    }

    try {
      setBusy(true);
      setEditMaterialRequiredErrors([]);
      await apiRequest(`/api/materials/${editingMaterialId}`, {
        method: "PATCH",
        body: {
          name: editMaterialName.trim(),
          category: editMaterialCategory,
          subcategory: editMaterialSubcategory,
          min_stock: Number(editMaterialMinStock),
          description: editMaterialDescription.trim() || null
        }
      });
      addActivity("Material updated.");
      closeEditMaterialForm();
      await refreshCoreData();
    } catch (error) {
      addActivity(`Update material failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirmMaterialUsageChange() {
    if (!pendingMaterialUsageChange) {
      return;
    }

    const nextIsActive = pendingMaterialUsageChange.is_active === false;

    try {
      setBusy(true);
      await apiRequest(`/api/materials/${pendingMaterialUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      addActivity(
        `${pendingMaterialUsageChange.sku} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`
      );
      setPendingMaterialUsageChange(null);
      if (!nextIsActive) {
        setPoDraftLines((prev) => prev.filter((line) => line.material_id !== pendingMaterialUsageChange.id));
      }
      await refreshCoreData();
    } catch (error) {
      addActivity(`Update material usage failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSupplier() {
    try {
      setBusy(true);
      const payload = {
        name: supplierName,
        phone: buildPhoneNumber(supplierPhoneCountryCode, supplierPhoneNumber),
        address: supplierAddress.trim() || undefined,
        lead_time_days: Number(supplierLeadTime)
      };

      if (editingSupplierId) {
        await apiRequest(`/api/suppliers/${editingSupplierId}`, {
          method: "PATCH",
          body: payload
        });
        addActivity("Supplier updated.");
      } else {
        await apiRequest("/api/suppliers", {
          method: "POST",
          body: payload
        });
        addActivity("Supplier created.");
      }

      closeSupplierForm();
      await refreshCoreData();
    } catch (error) {
      addActivity(
        editingSupplierId
          ? `Update supplier failed: ${(error as Error).message}`
          : `Create supplier failed: ${(error as Error).message}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePurchaseOrder() {
    try {
      setBusy(true);
      const lines =
        poDraftLines.length > 0
          ? poDraftLines.map((line) => ({
              material_id: line.material_id,
              quantity_ordered: Number(line.quantity_ordered),
              unit_price: line.unit_price ?? undefined
            }))
          : poMaterialId && poQuantityOrdered > 0
            ? [
                {
                  material_id: poMaterialId,
                  quantity_ordered: Number(poQuantityOrdered),
                  unit_price: poUnitPrice > 0 ? Number(poUnitPrice) : undefined
                }
              ]
            : [];

      if (!poSupplierId || lines.length === 0) {
        addActivity("Create purchase order failed: supplier and at least one line are required.");
        return false;
      }

      await apiRequest("/api/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: poSupplierId,
          currency: poCurrency,
          expected_at: poExpectedAt || undefined,
          notes: poNotes.trim() || undefined,
          lines
        }
      });
      addActivity("Purchase order created.");
      resetPoCreateForm();
      await refreshCoreData();
      return true;
    } catch (error) {
      addActivity(`Create purchase order failed: ${(error as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPurchaseOrderSent(poId: string, poNumber: string) {
    try {
      setBusy(true);
      await apiRequest(`/api/purchase-orders/${poId}/status`, {
        method: "PATCH",
        body: {
          status: "sent"
        }
      });
      addActivity(`${poNumber} marked as sent.`);
      await refreshCoreData();
      return true;
    } catch (error) {
      addActivity(`Mark as sent failed: ${(error as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelPurchaseOrder(po: PurchaseOrder) {
    try {
      setBusy(true);
      await apiRequest(`/api/purchase-orders/${po.id}/status`, {
        method: "PATCH",
        body: {
          status: "cancelled"
        }
      });
      addActivity(`${po.po_number} cancelled.`);
      setPendingCancelPo(null);
      if (selectedPoDetailsId === po.id) {
        setSelectedPoDetailsId(null);
      }
      await refreshCoreData();
      return true;
    } catch (error) {
      addActivity(`Cancel purchase order failed: ${(error as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleReceivePurchaseOrder() {
    try {
      setBusy(true);
      await apiRequest(`/api/purchase-orders/${receivePoId}/receive`, {
        method: "POST",
        body: {
          receipts: [
            {
              po_line_id: receivePoLineId,
              location_id: receiveLocationId,
              quantity_received: Number(receiveQuantity)
            }
          ]
        }
      });
      addActivity("Purchase order receipt recorded.");
      await refreshCoreData();
      return true;
    } catch (error) {
      addActivity(`Receive purchase order failed: ${(error as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMovement() {
    const trimmedComment = movementComment.trim();

    try {
      if (!movementMaterialId) {
        addActivity("Stock movement failed: select a material.");
        return false;
      }
      if (movementReason === "transfer") {
        if (!movementFromLocationId || !movementToLocationId) {
          addActivity("Stock movement failed: select both transfer locations.");
          return false;
        }
        if (movementFromLocationId === movementToLocationId) {
          addActivity("Stock movement failed: transfer locations must be different.");
          return false;
        }
        if (Number(movementQuantity) <= 0) {
          addActivity("Stock movement failed: transfer quantity must be greater than zero.");
          return false;
        }
      } else if (movementReason === "consumption") {
        if (!movementLocationId) {
          addActivity("Stock movement failed: select a location.");
          return false;
        }
        if (Number(movementQuantity) >= 0) {
          addActivity("Stock movement failed: consumption quantity must be less than zero.");
          return false;
        }
      } else if (!movementLocationId || Number(movementQuantity) === 0) {
        addActivity("Stock movement failed: select a location and non-zero quantity.");
        return false;
      }

      setBusy(true);
      await apiRequest("/api/stock/movements", {
        method: "POST",
        body:
          movementReason === "transfer"
            ? {
                material_id: movementMaterialId,
                from_location_id: movementFromLocationId,
                to_location_id: movementToLocationId,
                quantity: Math.abs(Number(movementQuantity)),
                reason: movementReason,
                note: trimmedComment || undefined
              }
            : {
                material_id: movementMaterialId,
                location_id: movementLocationId,
                quantity_delta: movementReason === "consumption" ? -Math.abs(Number(movementQuantity)) : Number(movementQuantity),
                reason: movementReason,
                note: trimmedComment || undefined
              }
      });
      addActivity("Stock movement recorded.");
      setMovementComment("");
      setMovementQuantity(1);
      await refreshCoreData();
      return true;
    } catch (error) {
      addActivity(`Stock movement failed: ${(error as Error).message}`);
      return false;
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
  const canViewOwnedGroupMembers = Boolean(ownedGroup);
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
  const paginatedLocationTableRows = paginateRows(locationTableRows, locationPage, DEFAULT_TABLE_PAGE_SIZE);
  const paginatedSupplierTableRows = paginateRows(supplierTableRows, supplierPage, DEFAULT_TABLE_PAGE_SIZE);

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
            <LanguageSwitcher />
            {signedInAs ? (
              <>
                <Link href="/account" className={`nav-link ${pathname === "/account" ? "nav-link-active" : ""}`}>
                  Account
                </Link>
                <button type="button" className="ghost-btn" disabled={busy} onClick={handleLogout}>
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/" className="nav-link">
                Sign In
              </Link>
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
          <label className="field">
            <span>Base URL</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:3000" />
          </label>
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
          <label className="field">
            <span>Access Token (Supabase JWT)</span>
            <input
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="eyJ..."
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              type="text"
            />
          </label>
        <div className="actions">
          <button type="button" disabled={busy || !accessToken} onClick={handleLoadOrganizations}>
            Sync Workspace
          </button>
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
        <section className="card">
          <div className="title-row">
            <div>
              <h3>Members of my group {ownedGroupName}</h3>
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={busy || !ownedGroup}
                onClick={() => {
                  if (ownedGroup) {
                    startRenameGroup(ownedGroup);
                  }
                }}
              >
                Rename Group
              </button>
              <button type="button" disabled={busy || !ownedGroup} onClick={() => loadOwnedGroupMembers()}>
                Refresh Members
              </button>
            </div>
          </div>

          {renamingOrgId ? (
            <div className="grid grid-2">
              <label className="field">
                <span>Rename group</span>
                <input value={renameOrgName} onChange={(event) => setRenameOrgName(event.target.value)} />
              </label>
              <div className="actions">
                <button type="button" disabled={busy || !renameOrgName.trim()} onClick={handleRenameGroup}>
                  Save Group Name
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={busy}
                  onClick={() => {
                    setRenamingOrgId("");
                    setRenameOrgName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {!ownedGroup ? <p className="subtle-line">No owned group found.</p> : null}

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <SortableHeader tableId="organization-members" sortKey="member" label="Member" sortState={tableSorts["organization-members"]} onSort={handleTableSort} />
                  <SortableHeader tableId="organization-members" sortKey="email" label="Member email" sortState={tableSorts["organization-members"]} onSort={handleTableSort} />
                  <SortableHeader tableId="organization-members" sortKey="role" label="Role" sortState={tableSorts["organization-members"]} onSort={handleTableSort} />
                  <SortableHeader tableId="organization-members" sortKey="joined" label="Joined" sortState={tableSorts["organization-members"]} onSort={handleTableSort} />
                  <th><span className="table-static-head">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {!canViewOwnedGroupMembers ? (
                  <tr>
                    <td colSpan={5}>No owned group found.</td>
                  </tr>
                ) : organizationMemberTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No invited members found for this group.</td>
                  </tr>
                ) : (
                  organizationMemberTableRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.member}</td>
                      <td>{row.email}</td>
                      <td>{row.role}</td>
                      <td>{row.joined}</td>
                      <td>
                        <div className="row-actions table-action-buttons">{row.action}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="members-section-divider" />

          <div className="title-row">
            <div>
              <h3>My memberships</h3>
            </div>
            <div className="actions">
              <button type="button" disabled={busy || !accessToken} onClick={handleLoadOrganizations}>
                Refresh Groups
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <SortableHeader tableId="memberships" sortKey="group" label="Group" sortState={tableSorts.memberships} onSort={handleTableSort} />
                  <SortableHeader tableId="memberships" sortKey="role" label="My role" sortState={tableSorts.memberships} onSort={handleTableSort} />
                  <SortableHeader tableId="memberships" sortKey="joined" label="Joined" sortState={tableSorts.memberships} onSort={handleTableSort} />
                  <th><span className="table-static-head">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {membershipTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No group memberships found.</td>
                  </tr>
                ) : (
                  membershipTableRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.group}</td>
                      <td>{row.role}</td>
                      <td>{row.joined}</td>
                      <td>
                        <div className="row-actions table-action-buttons">{row.action}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {ownedGroups.length === 0 ? (
            <p className="subtle-line">Your default group is being prepared. Invitations are available after it is ready.</p>
          ) : null}

          <div className="members-section-divider" />

          <h3>Invitations</h3>

          {ownedGroup ? (
            <>
              <p className="subtle-line">
                Invite people to your group <strong>{ownedGroup.organization.name}</strong>
              </p>
              <div className="members-invite-row">
                <label className="field">
                  <span>Invite by email</span>
                  <input
                    value={memberInviteEmail}
                    onChange={(event) => setMemberInviteEmail(event.target.value)}
                    placeholder="new.user@example.com"
                    type="email"
                  />
                </label>
                <label className="field">
                  <span>Assigned role</span>
                  <select
                    value={memberInviteRole}
                    onChange={(event) => setMemberInviteRole(event.target.value as OrganizationMember["role"] | "")}
                    required
                  >
                    <option value="">Select role</option>
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="members-inline-button"
                  disabled={busy || !memberInviteEmail.trim() || !memberInviteRole}
                  onClick={handleInviteMemberByEmail}
                >
                  Send Invitation
                </button>
                <button
                  type="button"
                  className="members-inline-button"
                  disabled={busy || !accessToken}
                  onClick={() => loadPendingInvitations()}
                >
                  Refresh Invitations
                </button>
              </div>

            </>
          ) : null}

          <h3 className="members-table-title">Invitations sent and received</h3>

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <SortableHeader tableId="invitations" sortKey="direction" label="Direction" sortState={tableSorts.invitations} onSort={handleTableSort} />
                  <SortableHeader tableId="invitations" sortKey="group" label="Group" sortState={tableSorts.invitations} onSort={handleTableSort} />
                  <SortableHeader tableId="invitations" sortKey="person" label="Person" sortState={tableSorts.invitations} onSort={handleTableSort} />
                  <SortableHeader tableId="invitations" sortKey="role" label="Role" sortState={tableSorts.invitations} onSort={handleTableSort} />
                  <SortableHeader tableId="invitations" sortKey="expires" label="Expires" sortState={tableSorts.invitations} onSort={handleTableSort} />
                  <th><span className="table-static-head">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invitationTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No pending invitations.</td>
                  </tr>
                ) : (
                  invitationTableRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.direction}</td>
                      <td>{row.group}</td>
                      <td>{row.person}</td>
                      <td>{row.role}</td>
                      <td>{row.expires}</td>
                      <td>
                        {row.invitation.direction === "received" ? (
                          <div className="row-actions table-action-buttons">
                            <button type="button" disabled={busy} onClick={() => handleAcceptInvitation(row.invitation)}>
                              Accept
                            </button>
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => handleRejectInvitation(row.invitation)}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="subtle-line">{row.invitation.status}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="members-section-divider members-role-divider" />

          <h3 className="members-table-title">Role Authorizations</h3>

          <div className="table-wrap">
            <table className="compact-table role-authorizations-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Viewer</th>
                  <th>Member</th>
                  <th>Manager</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_AUTHORIZATIONS.map(([capability, viewer, member, manager, owner]) => (
                  <tr key={capability}>
                    <td>{capability}</td>
                    <td>{viewer}</td>
                    <td>{member}</td>
                    <td>{manager}</td>
                    <td>{owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showLocationSection ? (
        <>
          <section className="card">
            <div className="inventory-toolbar location-toolbar">
              <div className="search-input-wrap">
                <SearchFieldIcon />
                <input
                  value={locationFilterQuery}
                  onChange={(event) => {
                    setLocationFilterQuery(event.target.value);
                    setLocationPage(1);
                  }}
                  placeholder="Search by code, name or address..."
                />
              </div>
              <div className="category-wrap">
                <SelectFieldIcon />
                <select
                  value={locationStatusFilter}
                  onChange={(event) => {
                    setLocationStatusFilter(event.target.value);
                    setLocationPage(1);
                  }}
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
              <h2>Location Management</h2>
              <div className="actions table-head-actions inventory-table-actions">
                {canManageCatalog ? (
                  <button type="button" className="ghost-btn" onClick={openCreateLocationForm}>
                    Add Location
                  </button>
                ) : null}
                {canExportCsv ? (
                  <button
                    type="button"
                    className="ghost-btn export-csv-btn"
                    disabled={locationTableRows.length === 0}
                    onClick={() =>
                      exportTableCsv(
                        "locations.csv",
                        ["Code", "Name", "Address", "Status", "Low stock", "Out of stock"],
                        locationTableRows.map((row) => [row.code, row.name, row.address, row.status, row.lowStock, row.outOfStock])
                      )
                    }
                  >
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>

          <div className="table-wrap">
            <table className="compact-table locations-table">
              <thead>
                <tr>
                  <SortableHeader tableId="locations" sortKey="code" label="Code" sortState={tableSorts.locations} onSort={handleTableSort} />
                  <SortableHeader tableId="locations" sortKey="name" label="Name" sortState={tableSorts.locations} onSort={handleTableSort} />
                  <SortableHeader tableId="locations" sortKey="address" label="Address" sortState={tableSorts.locations} onSort={handleTableSort} />
                  <SortableHeader tableId="locations" sortKey="status" label="Status" sortState={tableSorts.locations} onSort={handleTableSort} />
                  <SortableHeader tableId="locations" sortKey="lowStock" label="Low stock" sortState={tableSorts.locations} onSort={handleTableSort} />
                  <SortableHeader tableId="locations" sortKey="outOfStock" label="Out of stock" sortState={tableSorts.locations} onSort={handleTableSort} />
                  <th>
                    <span className="table-static-head">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {locationTableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>{locations.length === 0 ? "No locations created yet." : "No locations match these filters."}</td>
                  </tr>
                ) : (
                  paginatedLocationTableRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{row.address}</td>
                      <td>{row.status}</td>
                      <td>{row.lowStock}</td>
                      <td>{row.outOfStock}</td>
                      <td>
                        {canManageCatalog ? (
                          <div className="row-actions table-action-buttons">
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => openEditLocationForm(row.location)}>
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={busy}
                              onClick={() => setPendingLocationUsageChange(row.location)}
                            >
                              {row.location.is_active === false ? "Unblock" : "Block"}
                            </button>
                          </div>
                        ) : (
                          <span className="subtle-line">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="actions">
            <button type="button" disabled={busy || locationPage <= 1} onClick={() => setLocationPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </button>
            <button
              type="button"
              disabled={busy || locationPage >= locationTotalPages}
              onClick={() => setLocationPage((prev) => Math.min(locationTotalPages, prev + 1))}
            >
              Next
            </button>
            <p className="subtle-line">Page {locationPage}/{locationTotalPages}</p>
          </div>

          {showLocationForm && canManageCatalog ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingLocationId ? "Edit location" : "Add location"}>
              <div className="modal-card">
                <div className="title-row">
                  <h4>{editingLocationId ? "Edit Location" : "Add New Location"}</h4>
                  <button type="button" className="ghost-btn" onClick={closeLocationForm}>
                    Close
                  </button>
                </div>
                <div className="grid grid-2">
                  <label className="field">
                    <span>Name</span>
                    <input value={locationName} onChange={(event) => setLocationName(event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Code</span>
                    <input value={locationCode} onChange={(event) => setLocationCode(event.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span>Address</span>
                  <textarea
                    value={locationAddress}
                    maxLength={265}
                    rows={3}
                    onChange={(event) => setLocationAddress(event.target.value)}
                  />
                </label>
                <div className="actions">
                  <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleSaveLocation}>
                    {editingLocationId ? "Save Location" : "Create Location"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {pendingLocationUsageChange ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm location usage change">
              <div className="modal-card">
                <div className="title-row">
                  <h4>{pendingLocationUsageChange.is_active === false ? "Unblock location" : "Block location"}</h4>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setPendingLocationUsageChange(null)}
                  >
                    Close
                  </button>
                </div>
                <p>
                  {pendingLocationUsageChange.is_active === false
                    ? `Unblock ${pendingLocationUsageChange.name} for new usage?`
                    : `Block ${pendingLocationUsageChange.name} from new usage?`}
                </p>
                <div className="actions">
                  <button type="button" disabled={busy} onClick={confirmLocationUsageChange}>
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setPendingLocationUsageChange(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </section>
        </>
      ) : null}

      {showMaterialSection ? (
        <>
          <section className="card">
            <div className="inventory-toolbar materials-toolbar">
              <div className="search-input-wrap">
                <SearchFieldIcon />
                <input
                  value={materialFilterQuery}
                  onChange={(event) => {
                    setMaterialFilterQuery(event.target.value);
                    setMaterialPage(1);
                  }}
                  placeholder="Search by SKU or name..."
                />
              </div>
              <div className="category-wrap">
                <SelectFieldIcon />
                <select
                  value={materialCategoryFilter}
                  onChange={(event) => {
                    setMaterialCategoryFilter(event.target.value);
                    setMaterialSubcategoryFilter("all");
                    setMaterialPage(1);
                  }}
                >
                  <option value="all">All Categories</option>
                  {MATERIAL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="category-wrap">
                <SelectFieldIcon />
                <select
                  value={materialSubcategoryFilter}
                  disabled={materialCategoryFilter === "all"}
                  onChange={(event) => {
                    setMaterialSubcategoryFilter(event.target.value);
                    setMaterialPage(1);
                  }}
                >
                  <option value="all">All Subcategories</option>
                  {materialFilterSubcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="table-section-head">
              <h2>Materials</h2>
              <div className="actions table-head-actions inventory-table-actions">
                {canManageCatalog ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy || !isOrgScopedReady}
                    onClick={() => setShowMaterialCreateForm(true)}
                  >
                    Create Material
                  </button>
                ) : null}
                {canExportCsv ? (
                  <button
                    type="button"
                    className="ghost-btn export-csv-btn"
                    disabled={materialTableRows.length === 0}
                    onClick={() =>
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
                  >
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>

            {materialTableRows.length === 0 ? (
              <p>No materials match these filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="compact-table materials-table">
                  <thead>
                    <tr>
                      <SortableHeader tableId="materials" sortKey="sku" label="SKU" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="name" label="Name" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="category" label="Category" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="subcategory" label="Subcategory" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="description" label="Description" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="uom" label="UoM" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="minStock" label="Minimum stock" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="status" label="Status" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <SortableHeader tableId="materials" sortKey="createdAt" label="Date and time of creation" sortState={tableSorts.materials} onSort={handleTableSort} />
                      <th>
                        <span className="table-static-head">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialTableRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.sku}</td>
                        <td>{row.name}</td>
                        <td>{row.category}</td>
                        <td>{row.subcategory}</td>
                        <td className="table-description-cell">{row.description}</td>
                        <td>{row.uom}</td>
                        <td>{row.minStock}</td>
                        <td>{row.status}</td>
                        <td>{row.createdAt}</td>
                        <td>
                          {canManageCatalog ? (
                            <div className="row-actions table-action-buttons">
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={busy}
                                onClick={() => openEditMaterialForm(row.material)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={busy}
                                onClick={() => setPendingMaterialUsageChange(row.material)}
                              >
                                {row.material.is_active === false ? "Unblock" : "Block"}
                              </button>
                            </div>
                          ) : (
                            <span className="subtle-line">No actions</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="actions">
              <button type="button" disabled={busy || materialPage <= 1} onClick={() => setMaterialPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </button>
              <button
                type="button"
                disabled={busy || materialPage >= materialTotalPages}
                onClick={() => setMaterialPage((prev) => Math.min(materialTotalPages, prev + 1))}
              >
                Next
              </button>
              <p className="subtle-line">Page {materialPage}/{materialTotalPages}</p>
            </div>
          </section>
          {showMaterialCreateForm && canManageCatalog ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create material">
              <div className="modal-card">
                <div className="title-row">
                  <h4>Create material</h4>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setShowMaterialCreateForm(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="materials-form-wrap material-edit-form">
                  <div className="grid grid-2">
                    <label className={`field ${materialRequiredErrors.includes("sku") ? "field-invalid" : ""}`}>
                      <span>SKU</span>
                      <input
                        value={materialSku}
                        required
                        aria-invalid={materialRequiredErrors.includes("sku")}
                        onChange={(event) => {
                          setMaterialSku(event.target.value);
                          setMaterialSkuDuplicate(false);
                          setMaterialRequiredErrors((prev) => prev.filter((field) => field !== "sku"));
                        }}
                      />
                      {materialSkuDuplicate ? <small className="field-message">{materialDuplicateSkuMessage(locale)}</small> : null}
                    </label>
                    <label className={`field ${materialRequiredErrors.includes("name") ? "field-invalid" : ""}`}>
                      <span>Name</span>
                      <input
                        value={materialName}
                        required
                        aria-invalid={materialRequiredErrors.includes("name")}
                        onChange={(event) => {
                          setMaterialName(event.target.value);
                          setMaterialRequiredErrors((prev) => prev.filter((field) => field !== "name"));
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <select value={materialCategory} onChange={(event) => setMaterialCategory(event.target.value as MaterialCategory)}>
                        {MATERIAL_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Subcategory</span>
                      <select value={materialSubcategory} onChange={(event) => setMaterialSubcategory(event.target.value)}>
                        {availableMaterialSubcategories.map((subcategory) => (
                          <option key={subcategory} value={subcategory}>
                            {subcategory}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Unit</span>
                      <select value={materialUom} onChange={(event) => setMaterialUom(event.target.value)}>
                        {MATERIAL_UNITS.map((unit) => (
                          <option key={unit.code} value={unit.code}>
                            {formatMaterialUnitLabel(unit.code, locale)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={`field ${materialRequiredErrors.includes("minStock") ? "field-invalid" : ""}`}>
                      <span>Minimum Stock</span>
                      <input
                        type="number"
                        min={0}
                        required
                        aria-invalid={materialRequiredErrors.includes("minStock")}
                        value={materialMinStock}
                        onChange={(event) => {
                          setMaterialMinStock(event.target.value);
                          setMaterialRequiredErrors((prev) => prev.filter((field) => field !== "minStock"));
                        }}
                      />
                    </label>
                    <label className="field field-span-2">
                      <span>Description</span>
                      <textarea
                        value={materialDescription}
                        maxLength={256}
                        rows={3}
                        onChange={(event) => setMaterialDescription(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="actions">
                    <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleCreateMaterial}>
                      Create Material
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={busy}
                      onClick={() => setShowMaterialCreateForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {editingMaterialId ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit material">
              <div className="modal-card">
                <div className="title-row">
                  <h4>Edit material</h4>
                  <button type="button" className="ghost-btn" disabled={busy} onClick={closeEditMaterialForm}>
                    Close
                  </button>
                </div>
                <div className="materials-form-wrap material-edit-form">
                  <div className="grid grid-2">
                    <label className="field">
                      <span>Material number</span>
                      <input value={editingMaterial?.sku ?? ""} readOnly />
                    </label>
                    <label className="field">
                      <span>UoM</span>
                      <input value={editingMaterial ? formatMaterialUnitLabel(editingMaterial.uom, locale) : ""} readOnly />
                    </label>
                    <label className={`field ${editMaterialRequiredErrors.includes("name") ? "field-invalid" : ""}`}>
                      <span>Name</span>
                      <input
                        value={editMaterialName}
                        required
                        aria-invalid={editMaterialRequiredErrors.includes("name")}
                        onChange={(event) => {
                          setEditMaterialName(event.target.value);
                          setEditMaterialRequiredErrors((prev) => prev.filter((field) => field !== "name"));
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <select value={editMaterialCategory} onChange={(event) => setEditMaterialCategory(event.target.value as MaterialCategory)}>
                        {MATERIAL_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Subcategory</span>
                      <select value={editMaterialSubcategory} onChange={(event) => setEditMaterialSubcategory(event.target.value)}>
                        {availableEditMaterialSubcategories.map((subcategory) => (
                          <option key={subcategory} value={subcategory}>
                            {subcategory}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={`field ${editMaterialRequiredErrors.includes("minStock") ? "field-invalid" : ""}`}>
                      <span>Minimum Stock</span>
                      <input
                        type="number"
                        min={0}
                        required
                        aria-invalid={editMaterialRequiredErrors.includes("minStock")}
                        value={editMaterialMinStock}
                        onChange={(event) => {
                          setEditMaterialMinStock(event.target.value);
                          setEditMaterialRequiredErrors((prev) => prev.filter((field) => field !== "minStock"));
                        }}
                      />
                    </label>
                    <label className="field field-span-2">
                      <span>Description</span>
                      <textarea
                        value={editMaterialDescription}
                        maxLength={256}
                        rows={3}
                        onChange={(event) => setEditMaterialDescription(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="actions">
                    <button type="button" disabled={busy} onClick={handleUpdateMaterial}>
                      Save changes
                    </button>
                    <button type="button" className="ghost-btn" disabled={busy} onClick={closeEditMaterialForm}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {pendingMaterialUsageChange ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm material usage change">
              <div className="modal-card">
                <div className="title-row">
                  <h4>{pendingMaterialUsageChange.is_active === false ? "Unblock material" : "Block material"}</h4>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setPendingMaterialUsageChange(null)}
                  >
                    Close
                  </button>
                </div>
                <p>
                  {pendingMaterialUsageChange.is_active === false
                    ? `Unblock ${pendingMaterialUsageChange.sku} - ${pendingMaterialUsageChange.name} for new usage?`
                    : `Block ${pendingMaterialUsageChange.sku} - ${pendingMaterialUsageChange.name} from new usage?`}
                </p>
                <div className="actions">
                  <button type="button" disabled={busy} onClick={confirmMaterialUsageChange}>
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setPendingMaterialUsageChange(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showStockMovementsSection ? (
        <section className="card">
          <div className="inventory-toolbar materials-toolbar">
            <div className="search-input-wrap">
              <SearchFieldIcon />
              <input
                value={movementFilterQuery}
                onChange={(event) => {
                  setMovementFilterQuery(event.target.value);
                  setMovementPage(1);
                }}
                placeholder="Search by SKU or name..."
              />
            </div>
            <div className="category-wrap">
              <SelectFieldIcon />
              <select
                value={movementLocationFilter}
                onChange={(event) => {
                  setMovementLocationFilter(event.target.value);
                  setMovementPage(1);
                }}
              >
                {movementLocations.map((location) => (
                  <option key={location} value={location}>
                    {location === "all" ? "All Locations" : location}
                  </option>
                ))}
              </select>
            </div>
            <div className="category-wrap">
              <SelectFieldIcon />
              <select
                value={movementReasonFilter}
                onChange={(event) => {
                  setMovementReasonFilter(event.target.value);
                  setMovementPage(1);
                }}
              >
                {movementReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason === "all" ? "All Reasons" : reason}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-section-head stock-movements-table-head">
            <h2>Material movements</h2>
            <div className="actions table-head-actions inventory-table-actions">
              {canCreateStockMovement ? (
                <button type="button" className="ghost-btn" onClick={() => setShowMovementForm(true)}>
                  Move Material
                </button>
              ) : null}
              {canExportCsv ? (
                <button
                  type="button"
                  className="ghost-btn export-csv-btn"
                  disabled={movementTableRows.length === 0}
                  onClick={() =>
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
                >
                  Export CSV
                </button>
              ) : null}
            </div>
          </div>

          {showMovementForm && canCreateStockMovement ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Move material">
              <div className="modal-card">
                <div className="title-row">
                  <div>
                    <h4>Move Material</h4>
                    <p className="subtle-line">Add stock to a location, consume it for works, or transfer it between locations.</p>
                  </div>
                  <button type="button" className="ghost-btn" disabled={busy} onClick={() => setShowMovementForm(false)}>
                    Close
                  </button>
                </div>
                <div className="materials-form-wrap">
                  <div className="stock-movement-form-grid">
                    <div className="stock-movement-row stock-movement-row-top">
                      <label className="field">
                        <span>Material</span>
                        <select value={movementMaterialId} onChange={(event) => setMovementMaterialId(event.target.value)}>
                          <option value="">Select material</option>
                          {activeMaterials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.sku} - {material.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Reason</span>
                        <select
                          value={movementReason}
                          onChange={(event) => {
                            const nextReason = event.target.value as ManualMovementReason;
                            setMovementReason(nextReason);
                            if (nextReason === "consumption") {
                              setMovementQuantity(-1);
                            } else if (nextReason === "transfer" && Number(movementQuantity) <= 0) {
                              setMovementQuantity(1);
                            }
                          }}
                        >
                          <option value="adjustment">Adjustment</option>
                          <option value="consumption">Consumption</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </label>
                    </div>

                    {movementReason !== "transfer" ? (
                      <div className="stock-movement-row stock-movement-row-single">
                        <label className="field">
                          <span>Location</span>
                          <select value={movementLocationId} onChange={(event) => setMovementLocationId(event.target.value)}>
                            <option value="">Select location</option>
                            {activeLocations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.code ? `${location.code} - ` : ""}
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : (
                      <div className="stock-movement-row stock-movement-row-top">
                        <label className="field">
                          <span>Transfer out</span>
                          <select value={movementFromLocationId} onChange={(event) => setMovementFromLocationId(event.target.value)}>
                            <option value="">Select location</option>
                            {activeLocations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.code ? `${location.code} - ` : ""}
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Transfer to</span>
                          <select value={movementToLocationId} onChange={(event) => setMovementToLocationId(event.target.value)}>
                            <option value="">Select location</option>
                            {activeLocations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.code ? `${location.code} - ` : ""}
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <div className="stock-movement-row stock-movement-row-single">
                      <label className="field">
                        <span>{movementReason === "adjustment" ? "Quantity Delta" : "Quantity"}</span>
                        <input
                          type="number"
                          min={movementReason === "transfer" ? 1 : undefined}
                          max={movementReason === "consumption" ? -1 : undefined}
                          value={movementQuantity}
                          onChange={(event) => {
                            const nextQuantity = Number(event.target.value);
                            setMovementQuantity(movementReason === "consumption" ? Math.min(-1, nextQuantity) : nextQuantity);
                          }}
                        />
                      </label>
                    </div>

                    <div className="stock-movement-row stock-movement-row-single">
                      <label className="field">
                        <span>Comments</span>
                        <textarea value={movementComment} onChange={(event) => setMovementComment(event.target.value)} rows={3} />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !isOrgScopedReady ||
                      !movementMaterialId ||
                      (movementReason === "transfer"
                        ? !movementFromLocationId ||
                          !movementToLocationId ||
                          movementFromLocationId === movementToLocationId ||
                          Number(movementQuantity) <= 0
                        : !movementLocationId || (movementReason === "consumption" ? Number(movementQuantity) >= 0 : Number(movementQuantity) === 0))
                    }
                    onClick={async () => {
                      const success = await handleCreateMovement();
                      if (success) {
                        setShowMovementForm(false);
                      }
                    }}
                  >
                    {movementReason === "consumption" ? "Record Consumption" : "Add to Stock"}
                  </button>
                  <button type="button" className="ghost-btn" disabled={busy} onClick={() => setShowMovementForm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {movementTableRows.length === 0 ? (
            <p>No material movements yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <SortableHeader tableId="movements" sortKey="createdAt" label="Date & Time" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="materialLabel" label="Material" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="locationLabel" label="Location" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="quantity" label="Quantity" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="uom" label="UoM" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="category" label="Category" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="reason" label="Reason" sortState={tableSorts.movements} onSort={handleTableSort} />
                    <SortableHeader tableId="movements" sortKey="comments" label="Comments" sortState={tableSorts.movements} onSort={handleTableSort} />
                  </tr>
                </thead>
                <tbody>
                  {movementTableRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.createdAt}</td>
                      <td>{row.materialLabel}</td>
                      <td>{row.locationLabel}</td>
                      <td>{row.quantity}</td>
                      <td>{row.uom}</td>
                      <td>{row.category}</td>
                      <td>{row.reason}</td>
                      <td>{row.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="actions">
            <button type="button" disabled={busy || movementPage <= 1} onClick={() => setMovementPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </button>
            <button
              type="button"
              disabled={busy || movementPage >= movementTotalPages}
              onClick={() => setMovementPage((prev) => Math.min(movementTotalPages, prev + 1))}
            >
              Next
            </button>
            <p className="subtle-line">Page {movementPage}/{movementTotalPages}</p>
          </div>
        </section>
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

            <div className="table-wrap">
              <table className="compact-table vendors-table">
                <thead>
                  <tr>
                    <SortableHeader tableId="suppliers" sortKey="vendorId" label="Vendor ID" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="name" label="Vendor Name" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="phone" label="Phone" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="address" label="Address" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="leadTimeDays" label="Lead Time (days)" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="status" label="Status" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="openOrders" label="Open POs" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="receivedOrders" label="Received POs" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <SortableHeader tableId="suppliers" sortKey="totalOrders" label="Total POs" sortState={tableSorts.suppliers} onSort={handleTableSort} />
                    <th>
                      <span className="table-static-head">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {supplierTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={10}>No suppliers match these filters.</td>
                    </tr>
                  ) : (
                    paginatedSupplierTableRows.map((supplier) => {
                      const editableSupplier = supplier.editableSupplier;
                      return (
                        <tr key={supplier.supplierId}>
                          <td className="mono-line">{supplier.vendorId}</td>
                          <td>{supplier.name}</td>
                          <td>{supplier.phone}</td>
                          <td>{supplier.address}</td>
                          <td>{supplier.leadTimeDays}</td>
                          <td>
                            <span className={`status-pill ${supplier.status === "Active" ? "status-received" : "status-cancelled"}`}>
                              {supplier.status}
                            </span>
                          </td>
                          <td>{supplier.openOrders}</td>
                          <td>{supplier.receivedOrders}</td>
                          <td>{supplier.totalOrders}</td>
                          <td>
                            {editableSupplier && canManageCatalog ? (
                              <div className="row-actions table-action-buttons">
                                <button type="button" className="ghost-btn" disabled={busy} onClick={() => openEditSupplierForm(editableSupplier)}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  disabled={busy}
                                  onClick={() => setPendingSupplierUsageChange(editableSupplier)}
                                >
                                  {editableSupplier.is_active === false ? "Unblock" : "Block"}
                                </button>
                              </div>
                            ) : (
                              <span className="subtle-line">No actions</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="actions">
              <button type="button" disabled={busy || supplierPage <= 1} onClick={() => setSupplierPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </button>
              <button
                type="button"
                disabled={busy || supplierPage >= supplierTotalPages}
                onClick={() => setSupplierPage((prev) => Math.min(supplierTotalPages, prev + 1))}
              >
                Next
              </button>
              <p className="subtle-line">Page {supplierPage}/{supplierTotalPages}</p>
            </div>

          {showSupplierForm && canManageCatalog ? (
            <div
              className="modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={editingSupplierId ? "Edit vendor" : "Add vendor"}
            >
              <div className="modal-card">
                <div className="title-row">
                  <h4>{editingSupplierId ? "Edit Vendor" : "Add Vendor"}</h4>
                  <button type="button" className="ghost-btn" onClick={closeSupplierForm}>
                    Close
                  </button>
                </div>
                <div className="grid grid-2">
                  <label className="field">
                    <span>Vendor ID</span>
                    <input
                      readOnly
                      value={formatVendorNumber(supplierVendorNumber)}
                      placeholder="Assigned automatically"
                    />
                    <p className="subtle-line">Assigned automatically and cannot be changed.</p>
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
                  </label>
                  <label className="field field-span-2">
                    <span>Phone</span>
                    <div className="phone-input-row">
                      <select
                        value={supplierPhoneCountryCode}
                        onChange={(event) => setSupplierPhoneCountryCode(event.target.value)}
                      >
                        {PHONE_COUNTRY_CODES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={supplierPhoneNumber}
                        onChange={(event) => setSupplierPhoneNumber(event.target.value)}
                        placeholder="6 12 34 56 78"
                      />
                    </div>
                  </label>
                  <label className="field">
                    <span>Lead Time (days)</span>
                    <input
                      type="number"
                      min={0}
                      value={supplierLeadTime}
                      onChange={(event) => setSupplierLeadTime(Number(event.target.value))}
                    />
                  </label>
                  <label className="field field-span-2">
                    <span>Address</span>
                    <textarea
                      maxLength={256}
                      rows={3}
                      value={supplierAddress}
                      onChange={(event) => setSupplierAddress(event.target.value)}
                    />
                  </label>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy || !isOrgScopedReady || !supplierName.trim()}
                    onClick={handleSaveSupplier}
                  >
                    {editingSupplierId ? "Update Vendor" : "Create Supplier"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {pendingSupplierUsageChange ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm vendor usage change">
              <div className="modal-card">
                <div className="title-row">
                  <h4>{pendingSupplierUsageChange.is_active === false ? "Unblock vendor" : "Block vendor"}</h4>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setPendingSupplierUsageChange(null)}
                  >
                    Close
                  </button>
                </div>
                <p>
                  {pendingSupplierUsageChange.is_active === false
                    ? `Unblock ${pendingSupplierUsageChange.name} for new usage?`
                    : `Block ${pendingSupplierUsageChange.name} from new usage?`}
                </p>
                <div className="actions">
                  <button type="button" disabled={busy} onClick={confirmSupplierUsageChange}>
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => setPendingSupplierUsageChange(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </section>
        </>
      ) : null}

      {showPurchaseOrderSection ? (
        <>
          <section className="card">
            <div className="title-row">
              <div>
                <h3>Purchase Orders Status</h3>
              </div>
            </div>
            <div className="kpi-grid purchase-kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Total POs</p>
                  <span className="kpi-dot kpi-blue" aria-hidden="true">
                    PO
                  </span>
                </div>
                <strong>{poTotal}</strong>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Open Orders</p>
                  <span className="kpi-dot kpi-amber" aria-hidden="true">
                    OP
                  </span>
                </div>
                <strong>{poOverview.openOrders}</strong>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Received</p>
                  <span className="kpi-dot kpi-green" aria-hidden="true">
                    RC
                  </span>
                </div>
                <strong>{poOverview.receivedOrders}</strong>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Total Value</p>
                  <span className="kpi-dot kpi-green" aria-hidden="true">
                    {poTotalValueBadge}
                  </span>
                </div>
                <strong>{poTotalValueLabel}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="purchase-toolbar">
              <div className="search-input-wrap">
                <SearchFieldIcon />
                <input
                  value={poFilterQuery}
                  onChange={(event) => {
                    setPoFilterQuery(event.target.value);
                    setPoPage(1);
                  }}
                  placeholder="Search by PO number..."
                />
              </div>
              <label className="field">
                <select
                  aria-label="Status"
                  value={poFilterStatus}
                  onChange={(event) => {
                    setPoFilterStatus(event.target.value as PurchaseOrderFilterStatus);
                    setPoPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="partial">Partial</option>
                  <option value="received">Received</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="field">
                <select
                  aria-label="Supplier"
                  value={poFilterSupplierId}
                  onChange={(event) => {
                    setPoFilterSupplierId(event.target.value);
                    setPoPage(1);
                  }}
                >
                  <option value="all">All suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="card">
            <div className="title-row">
              <h3>All Purchase Orders</h3>
              <div className="actions table-head-actions purchase-actions">
                {canReceivePurchaseOrders ? (
                  <button type="button" className="ghost-btn" onClick={() => setShowPoReceiveForm(true)}>
                    Receive order
                  </button>
                ) : null}
                {canManageCatalog ? (
                  <button type="button" onClick={() => setShowPoCreateForm(true)}>
                    Create PO
                  </button>
                ) : null}
                {canExportCsv ? (
                  <button
                    type="button"
                    className="ghost-btn export-csv-btn"
                    disabled={purchaseOrderTableRows.length === 0}
                    onClick={() =>
                      exportTableCsv(
                        "purchase-orders.csv",
                        ["PO Number", "Supplier", "Status", "Lines", "Progress", "Total", "Expected"],
                        purchaseOrderTableRows.map((row) => [
                          row.poNumber,
                          row.supplier,
                          row.status,
                          row.lines,
                          row.progress,
                          row.totalExport,
                          row.expected
                        ])
                      )
                    }
                  >
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>
            {purchaseOrderTableRows.length === 0 ? (
              <div className="po-empty">
                <p>No purchase orders match these filters.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="compact-table purchase-orders-table">
                  <thead>
                    <tr>
                      <SortableHeader tableId="purchase-orders" sortKey="poNumber" label="PO Number" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <SortableHeader tableId="purchase-orders" sortKey="supplier" label="Supplier" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <SortableHeader tableId="purchase-orders" sortKey="status" label="Status" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <SortableHeader tableId="purchase-orders" sortKey="lines" label="Lines" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <SortableHeader tableId="purchase-orders" sortKey="progress" label="Progress" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <SortableHeader tableId="purchase-orders" sortKey="total" label="Total" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <SortableHeader tableId="purchase-orders" sortKey="expected" label="Expected" sortState={tableSorts["purchase-orders"]} onSort={handleTableSort} />
                      <th>
                        <span className="table-static-head">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
	                    {purchaseOrderTableRows.map(({ po, summary }) => {
	                      const canReceive = canReceivePurchaseOrders && (po.status === "sent" || po.status === "partial");
	                      const canMarkSent = canManageCatalog && po.status === "draft";
	                      const canCancel = canManageCatalog && (po.status === "draft" || po.status === "sent" || po.status === "partial");
	                      return (
	                        <tr
	                          key={po.id}
	                          className="po-row"
	                          title="Double-click to view all line items"
	                          onDoubleClick={() => setSelectedPoDetailsId(po.id)}
	                        >
                          <td>
                            <div className="po-cell-main">{po.po_number}</div>
                            <div className="po-cell-subtle">Created {formatDateLabel(po.created_at)}</div>
                          </td>
                          <td>
                            <div className="po-cell-main">{summary.supplierLabel}</div>
                            <div className="po-cell-subtle">{summary.linePreview}</div>
                          </td>
                          <td>
	                            <span className={`status-pill status-${po.status}`}>{po.status.toUpperCase()}</span>
	                            <div className="po-cell-subtle">{formatPoStatusDetail(po)}</div>
	                          </td>
                          <td>
                            <div className="po-cell-main">
                              {summary.lineCount} {summary.lineCount === 1 ? "line" : "lines"}
                            </div>
                            <div className="po-cell-subtle">
                              {summary.totalOrdered} ordered / {summary.totalReceived} received
                            </div>
                          </td>
                          <td>
                            <div className="po-cell-main">
                              {summary.totalReceived}/{summary.totalOrdered} ({summary.progressPercentage}%)
                            </div>
                            <div className="progress-track" aria-label={`received progress for ${po.po_number}`}>
                              <span className="progress-fill" style={{ width: `${summary.progressPercentage}%` }} />
                            </div>
                          </td>
                          <td>
                            <div className="po-cell-main">{formatCurrencyAmount(summary.totalAmount, summary.currency)}</div>
                          </td>
                          <td>
                            <div className="po-cell-main">{formatDateLabel(po.expected_at)}</div>
                            <div className="po-cell-subtle">
                              {po.expected_at ? "Expected arrival" : "No expected date"}
                            </div>
                          </td>
	                          <td onDoubleClick={(event) => event.stopPropagation()}>
	                            <div className="row-actions">
                              {canMarkSent ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="ghost-btn po-receive-btn"
                                  onClick={() => {
                                    void handleMarkPurchaseOrderSent(po.id, po.po_number);
                                  }}
                                >
                                  Mark Sent
                                </button>
                              ) : null}
                              {canReceive ? (
                                <button
                                  type="button"
                                  disabled={busy || summary.lineCount === 0}
                                  className="ghost-btn po-receive-btn"
                                  onClick={() => {
                                    setReceivePoId(po.id);
                                    setReceivePoLineId(po.lines[0]?.id ?? "");
                                    setShowPoReceiveForm(true);
                                  }}
                                >
	                                  Receive
	                                </button>
	                              ) : null}
	                              {canCancel ? (
	                                <button
	                                  type="button"
	                                  disabled={busy}
	                                  className="ghost-btn danger-btn po-receive-btn"
	                                  onClick={() => setPendingCancelPo(po)}
	                                >
	                                  Cancel
	                                </button>
	                              ) : null}
	                              {!canCancel && !canReceive ? <span className="po-cell-subtle">No actions</span> : null}
	                            </div>
	                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="actions">
              <button type="button" disabled={busy || poPage <= 1} onClick={() => setPoPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </button>
              <button
                type="button"
                disabled={busy || poPage >= poTotalPages}
                onClick={() => setPoPage((prev) => Math.min(poTotalPages, prev + 1))}
              >
                Next
              </button>
              <p className="subtle-line">Page {poPage}/{poTotalPages}</p>
            </div>
	          </section>

	          {selectedPoDetails ? (
	            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Purchase order ${selectedPoDetails.po_number}`}>
	              <div className="modal-card po-modal-card">
	                <div className="title-row po-modal-head">
	                  <div>
	                    <h4>{selectedPoDetails.po_number}</h4>
	                    <p className="po-modal-subtitle">
	                      {selectedPoDetails.supplier?.name ?? "Unknown supplier"} | {formatPoStatusDetail(selectedPoDetails)}
	                    </p>
	                  </div>
	                  <button type="button" className="ghost-btn po-modal-close" onClick={() => setSelectedPoDetailsId(null)}>
	                    x
	                  </button>
	                </div>
	                <div className="po-modal-body">
	                  {(() => {
	                    const summary = purchaseOrderTableSummary(selectedPoDetails, poSkuByMaterialId);
	                    return (
	                      <>
	                        <section className="po-modal-section">
	                          <div className="po-detail-summary">
	                            <div>
	                              <p className="po-meta-label">Status</p>
	                              <p className="po-meta-value">
	                                <span className={`status-pill status-${selectedPoDetails.status}`}>
	                                  {selectedPoDetails.status.toUpperCase()}
	                                </span>
	                              </p>
	                            </div>
		                            <div>
		                              <p className="po-meta-label">Created</p>
		                              <p className="po-meta-value">{formatDateLabel(selectedPoDetails.created_at)}</p>
		                            </div>
		                            <div>
		                              <p className="po-meta-label">Sent</p>
		                              <p className="po-meta-value">{formatDateLabel(selectedPoDetails.sent_at)}</p>
		                            </div>
		                            <div>
		                              <p className="po-meta-label">Expected</p>
		                              <p className="po-meta-value">{formatDateLabel(selectedPoDetails.expected_at)}</p>
	                            </div>
	                            <div>
	                              <p className="po-meta-label">Total</p>
	                              <p className="po-meta-value">
	                                {formatCurrencyAmount(summary.totalAmount, summary.currency)}
	                              </p>
	                            </div>
	                          </div>
	                        </section>

	                        <section className="po-modal-section">
	                          <h5>Line Items</h5>
	                          {selectedPoDetails.lines.length > 0 ? (
	                            <div className="po-draft-lines-wrap">
	                              <table className="po-lines-table">
	                                <thead>
		                                  <tr>
		                                    <th>Material</th>
		                                    <th>UoM</th>
		                                    <th>Ordered</th>
		                                    <th>Received</th>
	                                    <th>Remaining</th>
	                                    <th>Unit Price</th>
	                                    <th>Total</th>
	                                  </tr>
	                                </thead>
	                                <tbody>
	                                  {selectedPoDetails.lines.map((line) => {
	                                    const quantityOrdered = Number(line.quantity_ordered || 0);
	                                    const quantityReceived = Number(line.quantity_received || 0);
	                                    const unitPrice = Number(line.unit_price || 0);
	                                    return (
		                                      <tr key={line.id}>
		                                        {(() => {
		                                          const material = materials.find((item) => item.id === line.material_id);
		                                          return (
		                                            <>
		                                              <td>{material ? `${material.sku} - ${material.name}` : line.material_id}</td>
		                                              <td>{material?.uom ?? "-"}</td>
		                                            </>
		                                          );
		                                        })()}
		                                        <td>{quantityOrdered}</td>
	                                        <td>{quantityReceived}</td>
	                                        <td>{Math.max(0, quantityOrdered - quantityReceived)}</td>
	                                        <td>{formatCurrencyAmount(unitPrice, summary.currency)}</td>
	                                        <td>{formatCurrencyAmount(quantityOrdered * unitPrice, summary.currency)}</td>
	                                      </tr>
	                                    );
	                                  })}
	                                </tbody>
	                              </table>
	                            </div>
	                          ) : (
	                            <p className="po-line-empty">No line items found for this purchase order.</p>
	                          )}
	                        </section>
	                      </>
	                    );
	                  })()}
	                </div>
	                <div className="actions po-modal-footer">
	                  <button type="button" className="ghost-btn" disabled={busy} onClick={() => setSelectedPoDetailsId(null)}>
	                    Close
	                  </button>
	                </div>
	              </div>
	            </div>
	          ) : null}

	          {pendingCancelPo ? (
	            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm purchase order cancellation">
	              <div className="modal-card">
	                <div className="title-row">
	                  <h4>Cancel Purchase Order</h4>
	                  <button type="button" className="ghost-btn po-modal-close" onClick={() => setPendingCancelPo(null)}>
	                    x
	                  </button>
	                </div>
	                <p className="subtle-line">
	                  Cancel {pendingCancelPo.po_number}? This will stop receiving against this purchase order.
	                </p>
	                <div className="actions">
	                  <button type="button" className="ghost-btn" disabled={busy} onClick={() => setPendingCancelPo(null)}>
	                    Keep PO
	                  </button>
	                  <button
	                    type="button"
	                    className="danger-btn"
	                    disabled={busy}
	                    onClick={() => {
	                      void handleCancelPurchaseOrder(pendingCancelPo);
	                    }}
	                  >
	                    Cancel PO
	                  </button>
	                </div>
	              </div>
	            </div>
	          ) : null}

	          {showPoCreateForm && canManageCatalog ? (
	            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create purchase order">
              <div className="modal-card po-modal-card">
                <div className="title-row po-modal-head">
                  <h4>Create Purchase Order</h4>
                  <button
                    type="button"
                    className="ghost-btn po-modal-close"
                    onClick={() => {
                      resetPoCreateForm();
                      setShowPoCreateForm(false);
                    }}
                  >
                    x
                  </button>
                </div>
                <div className="po-modal-body">
                  <section className="po-modal-section">
                    <h5>Basic Info</h5>
                    <div className="grid grid-2">
                      <label className="field">
                        <span>Supplier</span>
                        <select value={poSupplierId} onChange={(event) => setPoSupplierId(event.target.value)}>
                          <option value="">Select supplier</option>
                          {activeSuppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Currency</span>
                        <select value={poCurrency} onChange={(event) => setPoCurrency(event.target.value as PurchaseOrderCurrency)}>
                          <option value="EUR">Euro (€)</option>
                          <option value="USD">US Dollar ($)</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Expected Date</span>
                        <input type="date" value={poExpectedAt} onChange={(event) => setPoExpectedAt(event.target.value)} />
                      </label>
                      <label className="field po-modal-span-2">
                        <span>Notes (optional)</span>
                        <textarea
                          rows={3}
                          value={poNotes}
                          onChange={(event) => setPoNotes(event.target.value)}
                          placeholder="Additional instructions"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="po-modal-section">
                    <h5>Add Items</h5>
                    <div className="po-item-grid">
	                      <label className="field">
	                        <span>Material</span>
	                        <select value={poMaterialId} onChange={(event) => setPoMaterialId(event.target.value)}>
	                          <option value="">Select material</option>
	                          {activeMaterials.map((material) => (
	                            <option key={material.id} value={material.id}>
	                              {material.sku} - {material.name} ({material.uom})
	                            </option>
	                          ))}
	                        </select>
	                      </label>
                      <label className="field">
                        <span>Quantity</span>
                        <input
                          type="number"
                          min={0.001}
                          step="0.001"
                          value={poQuantityOrdered}
                          onChange={(event) => setPoQuantityOrdered(Number(event.target.value))}
                        />
                      </label>
                      <label className="field">
                        <span>Unit Price ({currencySymbol(poCurrency)})</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={poUnitPrice}
                          onChange={(event) => setPoUnitPrice(Number(event.target.value))}
                        />
                      </label>
                      <div className="actions po-item-action">
                        <button
                          type="button"
                          disabled={busy || !poMaterialId || poQuantityOrdered <= 0}
                          onClick={handleAddPoDraftLine}
                        >
                          Add Item
                        </button>
                      </div>
                    </div>

                    {poDraftLines.length > 0 ? (
                      <div className="po-draft-lines-wrap">
                        <table className="po-lines-table">
                          <thead>
	                            <tr>
	                              <th>Material</th>
	                              <th>UoM</th>
	                              <th>Quantity</th>
	                              <th>Unit Price</th>
	                              <th>Total</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {poDraftLines.map((line) => {
                              const material = materials.find((item) => item.id === line.material_id);
                              const lineTotal = Number(line.quantity_ordered || 0) * Number(line.unit_price || 0);
                              return (
	                                <tr key={line.id}>
	                                  <td>{material ? `${material.sku} - ${material.name}` : "Unknown material"}</td>
	                                  <td>{material?.uom ?? "-"}</td>
	                                  <td>{line.quantity_ordered}</td>
                                  <td>{formatCurrencyAmount(Number(line.unit_price || 0), poCurrency)}</td>
                                  <td>{formatCurrencyAmount(lineTotal, poCurrency)}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className="ghost-btn po-line-remove"
                                      onClick={() => handleRemovePoDraftLine(line.id)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
	                    ) : (
	                      <p className="po-line-empty">No items added yet.</p>
	                    )}

	                    <p className="po-draft-summary">
	                      {poDraftSummary.lineCount} {poDraftSummary.lineCount === 1 ? "material" : "materials"} -{" "}
	                      {formatCurrencyAmount(poDraftSummary.totalAmount, poCurrency)}
	                    </p>
		                  </section>
                </div>
                <div className="actions po-modal-footer">
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={() => {
                      resetPoCreateForm();
                      setShowPoCreateForm(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || !isOrgScopedReady || !poSupplierId || poDraftLines.length === 0}
                    onClick={async () => {
                      const success = await handleCreatePurchaseOrder();
                      if (success) {
                        setShowPoCreateForm(false);
                      }
                    }}
                  >
                    Create Purchase Order
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showPoReceiveForm && canReceivePurchaseOrders ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Receive purchase order">
              <div className="modal-card po-modal-card">
                <div className="title-row po-modal-head">
                  <h4>Receive Purchase Order</h4>
                  <button type="button" className="ghost-btn po-modal-close" onClick={() => setShowPoReceiveForm(false)}>
                    x
                  </button>
                </div>
                <div className="po-modal-body">
                  <section className="po-modal-section">
                    <h5>Receipt Details</h5>
                    <div className="grid grid-2">
                      <label className="field">
                        <span>Purchase Order</span>
                        <select value={receivePoId} onChange={(event) => setReceivePoId(event.target.value)}>
                          <option value="">Select purchase order</option>
                          {purchaseOrders
                            .filter((po) => po.status !== "received" && po.status !== "cancelled")
                            .map((po) => (
                              <option key={po.id} value={po.id}>
                                {po.po_number} - {po.supplier?.name ?? "Unknown"} ({po.status})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Line</span>
                        <select value={receivePoLineId} onChange={(event) => setReceivePoLineId(event.target.value)}>
                          <option value="">Select line</option>
                          {(selectedPurchaseOrder?.lines ?? []).map((line) => {
                            const material = materials.find((item) => item.id === line.material_id);
                            return (
                              <option key={line.id} value={line.id}>
                                {(material?.sku ?? "Material")} | ordered {line.quantity_ordered} | received {line.quantity_received}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      <label className="field">
                        <span>Location</span>
                        <select value={receiveLocationId} onChange={(event) => setReceiveLocationId(event.target.value)}>
                          <option value="">Select location</option>
                          {activeLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.code ? `${location.code} - ` : ""}
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Quantity Received</span>
                        <input
                          type="number"
                          min={0.001}
                          step="0.001"
                          value={receiveQuantity}
                          onChange={(event) => setReceiveQuantity(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="po-modal-section">
                    <h5>Selected Line</h5>
                    {selectedReceiveLine ? (
                      <div className="po-receive-summary">
                        <div>
                          <p className="po-meta-label">Material</p>
                          <p className="po-meta-value">
                            {selectedReceiveMaterial
                              ? `${selectedReceiveMaterial.sku} - ${selectedReceiveMaterial.name}`
                              : selectedReceiveLine.material_id}
                          </p>
                        </div>
                        <div>
                          <p className="po-meta-label">Ordered</p>
                          <p className="po-meta-value">{selectedReceiveLine.quantity_ordered}</p>
                        </div>
                        <div>
                          <p className="po-meta-label">Already Received</p>
                          <p className="po-meta-value">{selectedReceiveLine.quantity_received}</p>
                        </div>
                        <div>
                          <p className="po-meta-label">Remaining</p>
                          <p className="po-meta-value">
                            {Math.max(
                              0,
                              Number(selectedReceiveLine.quantity_ordered || 0) - Number(selectedReceiveLine.quantity_received || 0)
                            )}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="po-line-empty">Select a purchase order line to review receipt details.</p>
                    )}
                  </section>
                </div>
                <div className="actions po-modal-footer">
                  <button type="button" className="ghost-btn" disabled={busy} onClick={() => setShowPoReceiveForm(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy || !isOrgScopedReady || !receivePoId || !receivePoLineId || !receiveLocationId || receiveQuantity <= 0}
                    onClick={async () => {
                      const success = await handleReceivePurchaseOrder();
                      if (success) {
                        setShowPoReceiveForm(false);
                      }
                    }}
                  >
                    Receive
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showSnapshotSection ? (
        <>
          <section className="card">
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Total Materials</p>
                  <span className="kpi-dot kpi-blue" aria-hidden="true">
                    ▣
                  </span>
                </div>
                <strong>{metrics.totalMaterials}</strong>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Low Stock Alerts</p>
                  <span className="kpi-dot kpi-amber" aria-hidden="true">
                    ↘
                  </span>
                </div>
                <strong>{lowStockCount ?? stockHealth?.low_stock ?? metrics.lowStock}</strong>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Out of Stock</p>
                  <span className="kpi-dot kpi-red" aria-hidden="true">
                    !
                  </span>
                </div>
                <strong>{stockHealth?.out_of_stock ?? metrics.outOfStock}</strong>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <p>Total Value</p>
                  <span className="kpi-dot kpi-green" aria-hidden="true">
                    {inventoryValueBadge}
                  </span>
                </div>
                <strong>{inventoryValueLabel}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="inventory-toolbar">
              <div className="search-input-wrap">
                <SearchFieldIcon />
                <input
                  value={materialFilterQuery}
                  onChange={(event) => {
                    setMaterialFilterQuery(event.target.value);
                    setMaterialPage(1);
                  }}
                  placeholder="Search by name or SKU..."
                />
              </div>
              <div className="category-wrap">
                <SelectFieldIcon />
                <select
                  value={inventoryStatus}
                  onChange={(event) => {
                    setInventoryStatus(event.target.value);
                    setMaterialPage(1);
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="in-stock">In Stock</option>
                  <option value="low-stock">Low Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                </select>
              </div>
              <div className="category-wrap">
                <SelectFieldIcon />
                <select
                  value={inventoryLocation}
                  onChange={(event) => {
                    setInventoryLocation(event.target.value);
                    setMaterialPage(1);
                  }}
                >
                  {inventoryLocations.map((location) => (
                    <option key={location} value={location}>
                      {location === "all" ? "All Locations" : location}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="table-section-head">
              <h2>Inventory status</h2>
              <div className="actions table-head-actions inventory-table-actions">
                {canManageCatalog ? (
                  <Link className="ghost-btn link-button" href="/materials">
                    Create Material
                  </Link>
                ) : null}
                {canCreateStockMovement ? (
                  <Link className="ghost-btn link-button" href="/stock-movements">
                    Move Material
                  </Link>
                ) : null}
                {canManageCatalog ? (
                  <Link className="ghost-btn link-button" href="/purchase-orders">
                    Order Material
                  </Link>
                ) : null}
                {canExportCsv ? (
                  <button
                    type="button"
                    className="ghost-btn export-csv-btn"
                    disabled={inventoryTableRows.length === 0}
                    onClick={() =>
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
                  >
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>
            {inventoryTableRows.length === 0 ? (
              <p>No inventory items match these filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <SortableHeader tableId="inventory" sortKey="sku" label="SKU" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="name" label="Item Name" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="category" label="Category" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="subcategory" label="Subcategory" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="quantity" label="Quantity" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="uom" label="UoM" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="pricePerUnit" label="Price per unit" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="total" label="Total" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="location" label="Location" sortState={tableSorts.inventory} onSort={handleTableSort} />
                      <SortableHeader tableId="inventory" sortKey="statusLabel" label="Status" sortState={tableSorts.inventory} onSort={handleTableSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryTableRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.sku}</td>
                        <td>{row.name}</td>
                        <td>{row.category}</td>
                        <td>{row.subcategory}</td>
                        <td>{row.quantity}</td>
                        <td>{row.uom}</td>
                        <td>{row.pricePerUnit}</td>
                        <td>{row.total}</td>
                        <td>{row.location}</td>
                        <td>
                          <span className={`status-pill status-${row.status}`}>{row.statusLabel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="actions">
              <button type="button" disabled={busy || materialPage <= 1} onClick={() => setMaterialPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </button>
              <button
                type="button"
                disabled={busy || materialPage >= materialTotalPages}
                onClick={() => setMaterialPage((prev) => Math.min(materialTotalPages, prev + 1))}
              >
                Next
              </button>
              <p className="subtle-line">
                Page {materialPage}/{materialTotalPages}
              </p>
            </div>
          </section>
        </>
      ) : null}

    </>
  );
}
