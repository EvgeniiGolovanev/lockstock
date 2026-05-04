"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSignedOutRedirectPath, shouldShowSignedOutPanels } from "@/lib/auth/route-guards";
import { MATERIAL_CATEGORIES, getMaterialSubcategories, type MaterialCategory } from "@/lib/material-categories";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useActivityLog } from "@/lib/ui/use-activity-log";
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
  min_stock: number;
  total_quantity?: number;
  primary_location?: string | null;
  stock_status?: "in-stock" | "low-stock" | "out-of-stock";
};

type Location = {
  id: string;
  name: string;
  code: string | null;
  address?: string | null;
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
type MaterialsTab = "create" | "add-stock";
type ManualMovementReason = "adjustment" | "transfer";
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

const MATERIALS_PAGE_SIZE = 25;
const MOVEMENTS_PAGE_SIZE = 25;
const PURCHASE_ORDERS_PAGE_SIZE = 20;

const STORAGE_KEYS = {
  baseUrl: "lockstock.baseUrl",
  token: "lockstock.accessToken",
  orgId: "lockstock.orgId"
} as const;

type NavIcon = "inventory" | "materials" | "locations" | "vendors" | "purchase-orders" | "members";
type NavHref = "/inventory" | "/materials" | "/locations" | "/vendors" | "/purchase-orders" | "/members";

const NAV_ITEMS: Array<{ href: NavHref; label: string; icon: NavIcon }> = [
  { href: "/inventory", label: "Inventory", icon: "inventory" },
  { href: "/materials", label: "Materials & Stock", icon: "materials" },
  { href: "/locations", label: "Locations", icon: "locations" },
  { href: "/vendors", label: "Vendors", icon: "vendors" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "purchase-orders" },
  { href: "/members", label: "Members", icon: "members" }
] as const;

function NavItemIcon({ icon }: { icon: NavIcon }) {
  if (icon === "inventory") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16M6 7V5h12v2M6 19v-2h12v2" />
      </svg>
    );
  }

  if (icon === "materials") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 4 7.2 12 11.4 20 7.2 12 3Zm-8 9L12 16l8-4M4 16l8 4 8-4" />
      </svg>
    );
  }

  if (icon === "locations") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.4 6-10.5A6 6 0 1 0 6 10.5C6 15.6 12 21 12 21Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </svg>
    );
  }

  if (icon === "vendors") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 20a4 4 0 0 0-8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 8a4 4 0 0 0-3-3.9M17 11a2.5 2.5 0 1 0 0-5" />
      </svg>
    );
  }

  if (icon === "members") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 20a4 4 0 0 0-8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 8a4 4 0 0 0-3-3.9M17 11a2.5 2.5 0 1 0 0-5M4 20a4 4 0 0 1 3-3.9M7 11a2.5 2.5 0 1 1 0-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h2l2 9h10l2-7H8M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  );
}

export function LockstockWorkbench() {
  const pathname = usePathname();
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const { addActivity } = useActivityLog(signedInAs || email);
  const [signedInFullName, setSignedInFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [renamingOrgId, setRenamingOrgId] = useState("");
  const [renameOrgName, setRenameOrgName] = useState("");

  const [locationName, setLocationName] = useState("Main Warehouse");
  const [locationCode, setLocationCode] = useState("MAIN");
  const [locationAddress, setLocationAddress] = useState("");
  const [materialSku, setMaterialSku] = useState("MAT-001");
  const [materialName, setMaterialName] = useState("Cement");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialUom, setMaterialUom] = useState("bag");
  const [materialCategory, setMaterialCategory] = useState<MaterialCategory>(MATERIAL_CATEGORIES[0]);
  const [materialSubcategory, setMaterialSubcategory] = useState(getMaterialSubcategories(MATERIAL_CATEGORIES[0])[0] ?? "");
  const [materialMinStock, setMaterialMinStock] = useState(10);
  const [supplierVendorNumber, setSupplierVendorNumber] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("Acme Supply");
  const [supplierPhoneCountryCode, setSupplierPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [supplierPhoneNumber, setSupplierPhoneNumber] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierLeadTime, setSupplierLeadTime] = useState(5);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [showPoCreateForm, setShowPoCreateForm] = useState(false);
  const [showPoReceiveForm, setShowPoReceiveForm] = useState(false);
  const [materialsTab, setMaterialsTab] = useState<MaterialsTab>("create");

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
  const [inventoryCategory, setInventoryCategory] = useState("all");
  const [materialPage, setMaterialPage] = useState(1);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [poFilterStatus, setPoFilterStatus] = useState<PurchaseOrderFilterStatus>("all");
  const [poFilterSupplierId, setPoFilterSupplierId] = useState("all");
  const [poFilterQuery, setPoFilterQuery] = useState("");
  const [poPage, setPoPage] = useState(1);
  const [poTotal, setPoTotal] = useState(0);

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
  const [busy, setBusy] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [memberInviteEmail, setMemberInviteEmail] = useState("");
  const [memberInviteOrgId, setMemberInviteOrgId] = useState("");

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
  const canManageMembers = activeMembership?.role === "owner";
  const ownedGroups = useMemo(() => organizations.filter((item) => item.role === "owner"), [organizations]);
  const selectedReceiveMaterial = useMemo(
    () => (selectedReceiveLine ? materials.find((material) => material.id === selectedReceiveLine.material_id) ?? null : null),
    [materials, selectedReceiveLine]
  );
  const inventoryCategories = useMemo(() => {
    const categories = Array.from(new Set(materials.map((material) => material.uom || "Uncategorized")));
    return ["all", ...categories];
  }, [materials]);
  const availableMaterialSubcategories = useMemo(
    () => getMaterialSubcategories(materialCategory),
    [materialCategory]
  );
  const inventoryRows = useMemo(
    () => filterInventoryRows(materials, materialFilterQuery, inventoryCategory),
    [inventoryCategory, materialFilterQuery, materials]
  );
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
    if (!query) {
      return supplierRows;
    }
    return supplierRows.filter((row) =>
      [row.name, row.phone, row.address, formatVendorNumber(row.vendorNumber)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );
  }, [supplierRows, supplierSearch]);
  const materialTotalPages = Math.max(1, Math.ceil(materialTotal / MATERIALS_PAGE_SIZE));
  const movementTotalPages = Math.max(1, Math.ceil(movementTotal / MOVEMENTS_PAGE_SIZE));
  const poTotalPages = Math.max(1, Math.ceil(poTotal / PURCHASE_ORDERS_PAGE_SIZE));
  const currentScreen = useMemo(() => {
    if (pathname === "/materials") {
      return { title: "Materials & Stock", subtitle: "Manage materials and stock movements." };
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
    return { title: "Inventory Management", subtitle: "Manage your stock and track inventory levels." };
  }, [pathname]);

  const showLocationSection = pathname === "/locations";
  const showMaterialSection = pathname === "/materials";
  const showSupplierSection = pathname === "/vendors";
  const showPurchaseOrderSection = pathname === "/purchase-orders";
  const showMembersSection = pathname === "/members";
  const showSnapshotSection = pathname === "/inventory";
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

  useEffect(() => {
    setBaseUrl(window.localStorage.getItem(STORAGE_KEYS.baseUrl) ?? window.location.origin);
    setAccessToken(window.localStorage.getItem(STORAGE_KEYS.token) ?? "");
    setOrgId(window.localStorage.getItem(STORAGE_KEYS.orgId) ?? "");
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
  }, [addActivity]);

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
    window.localStorage.setItem(STORAGE_KEYS.token, accessToken);
  }, [accessToken]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.orgId, orgId);
  }, [orgId]);

  // bootstrapOrganizationContext is intentionally excluded to avoid re-bootstrap loops from function identity changes.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!accessToken || !signedInAs || !normalizedBaseUrl) {
      return;
    }
    void bootstrapOrganizationContext({ tokenOverride: accessToken, announce: false });
  }, [accessToken, signedInAs, normalizedBaseUrl]);
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
  }, [isOrgScopedReady, normalizedBaseUrl, materialFilterQuery, materialPage]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // loadMaterialMovements is intentionally excluded to avoid dependency churn on function identity.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!showMaterialSection || !isOrgScopedReady || !normalizedBaseUrl) {
      return;
    }
    void loadMaterialMovements().catch((error) => {
      addActivity(`Loading material movements failed: ${(error as Error).message}`);
    });
  }, [showMaterialSection, isOrgScopedReady, normalizedBaseUrl, orgId, movementPage]);
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
    const activeOwnedGroup = ownedGroups.find((item) => item.organization.id === orgId);
    const selectedOwnedGroup = ownedGroups.find((item) => item.organization.id === memberInviteOrgId);
    const nextInviteGroupId = selectedOwnedGroup?.organization.id ?? activeOwnedGroup?.organization.id ?? ownedGroups[0]?.organization.id ?? "";

    if (nextInviteGroupId !== memberInviteOrgId) {
      setMemberInviteOrgId(nextInviteGroupId);
    }
  }, [memberInviteOrgId, orgId, ownedGroups]);

  useEffect(() => {
    if (!movementMaterialId && materials[0]) {
      setMovementMaterialId(materials[0].id);
    }
  }, [movementMaterialId, materials]);

  useEffect(() => {
    if (!movementLocationId && locations[0]) {
      setMovementLocationId(locations[0].id);
    }
  }, [locations, movementLocationId]);

  useEffect(() => {
    if (!movementFromLocationId && locations[0]) {
      setMovementFromLocationId(locations[0].id);
    }
  }, [locations, movementFromLocationId]);

  useEffect(() => {
    if (movementToLocationId) {
      return;
    }
    const fallbackLocation = locations.find((location) => location.id !== movementFromLocationId) ?? locations[0];
    if (fallbackLocation) {
      setMovementToLocationId(fallbackLocation.id);
    }
  }, [locations, movementFromLocationId, movementToLocationId]);

  useEffect(() => {
    if (movementReason !== "transfer" || movementFromLocationId !== movementToLocationId) {
      return;
    }
    const fallbackLocation = locations.find((location) => location.id !== movementFromLocationId);
    if (fallbackLocation) {
      setMovementToLocationId(fallbackLocation.id);
    }
  }, [locations, movementFromLocationId, movementReason, movementToLocationId]);

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
    if (!poMaterialId && materials[0]) {
      setPoMaterialId(materials[0].id);
    }
  }, [materials, poMaterialId]);

  useEffect(() => {
    if (!receiveLocationId && locations[0]) {
      setReceiveLocationId(locations[0].id);
    }
  }, [locations, receiveLocationId]);

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
    setMemberInviteOrgId("");
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
    return "Adjustment";
  }

  function formatMovementLocation(location: MaterialMovement["location"]) {
    if (!location) {
      return "-";
    }
    return location.code ? `${location.code} - ${location.name}` : location.name;
  }

  function formatDateLabel(value?: string | null) {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleDateString();
  }

  function formatPersonLabel(person: { full_name?: string | null; email?: string | null }) {
    const fullName = person.full_name?.trim();
    const personEmail = person.email?.trim();

    if (fullName && personEmail) {
      return `${fullName} (${personEmail})`;
    }
    return fullName || personEmail || "Name or email unavailable";
  }

  function formatGroupAccess(role: OrganizationMembership["role"]) {
    return role === "owner" ? "Owner" : "Member";
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
      return;
    }

    const response = await apiRequest<{ data: OrganizationMember[] }>(`/api/organizations/${orgValue}/members`, {
      orgOverride: orgValue,
      tokenOverride
    });
    setOrganizationMembers(response.data);
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
    if (materialFilterQuery.trim()) {
      params.set("q", materialFilterQuery.trim());
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
    tokenOverride?: string,
    membershipRole?: OrganizationMembership["role"]
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

    const resolvedRole =
      membershipRole ?? organizations.find((membership) => membership.organization.id === orgValue)?.role ?? null;
    if (resolvedRole === "owner") {
      await loadOrganizationMembers(orgValue, tokenOverride);
    } else {
      setOrganizationMembers([]);
    }

    await loadPendingInvitations(tokenOverride);

    addActivity(
      `Loaded ${materialsResult.count} materials, ${movementsResult.count} movements, ${locationsResult.data.length} locations, ${suppliersResult.data.length} suppliers, ${purchaseOrdersResult.count} purchase orders.`
    );
  }

  async function bootstrapOrganizationContext(options?: { tokenOverride?: string; announce?: boolean }) {
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

      if (organizationsResult.data.length === 0) {
        const defaultOrgName = getDefaultGroupName();
        await apiRequest("/api/organizations", {
          method: "POST",
          requireOrg: false,
          tokenOverride: effectiveToken,
          body: { name: defaultOrgName }
        });
        addActivity(`No group found. Created "${defaultOrgName}".`);
        organizationsResult = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
          requireOrg: false,
          tokenOverride: effectiveToken
        });
      }

      if (organizationsResult.data.length === 0) {
        throw new Error("No group available after bootstrap.");
      }

      setOrganizations(organizationsResult.data);

      const existingSelection = organizationsResult.data.find((item) => item.organization.id === orgId);
      const selectedMembership = existingSelection ?? organizationsResult.data[0];
      if (selectedMembership.organization.id !== orgId) {
        setOrgId(selectedMembership.organization.id);
      }

      if (options?.announce ?? true) {
        addActivity(`Workspace ready: ${selectedMembership.organization.name} (${selectedMembership.role}).`);
      }

      await refreshCoreData(selectedMembership.organization.id, effectiveToken, selectedMembership.role);
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

  async function handleCreateOrganization() {
    try {
      setBusy(true);
      const nextOrgName = orgName.trim() || getDefaultGroupName();
      const response = await apiRequest<{ data: { id: string } }>("/api/organizations", {
        method: "POST",
        requireOrg: false,
        body: { name: nextOrgName }
      });

      setOrgId(response.data.id);
      setOrgName("");
      addActivity(`Group created: ${nextOrgName}.`);
      const organizationsResponse = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
        requireOrg: false
      });
      setOrganizations(organizationsResponse.data);
      await refreshCoreData(response.data.id, undefined, "owner");
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthTokenError(message)) {
        setAccessToken("");
        setSignedInAs("");
        setSignedInFullName("");
        clearWorkspaceData();
      }
      addActivity(`Create group failed: ${message}`);
    } finally {
      setBusy(false);
    }
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

  async function handleDeleteGroup(membership: OrganizationMembership) {
    const confirmed = window.confirm(`Delete group "${membership.organization.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      setBusy(true);
      await apiRequest(`/api/organizations/${membership.organization.id}`, {
        method: "DELETE",
        orgOverride: membership.organization.id
      });

      addActivity(`Group deleted: ${membership.organization.name}.`);
      const organizationsResponse = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
        requireOrg: false
      });

      if (organizationsResponse.data.length === 0) {
        setOrgId("");
        setOrganizations([]);
        setOrganizationMembers([]);
        await bootstrapOrganizationContext({ announce: true });
        return;
      }

      setOrganizations(organizationsResponse.data);
      const nextMembership =
        organizationsResponse.data.find((item) => item.organization.id === orgId) ?? organizationsResponse.data[0];
      if (nextMembership.organization.id !== orgId) {
        setOrgId(nextMembership.organization.id);
      }
      await refreshCoreData(nextMembership.organization.id, undefined, nextMembership.role);
    } catch (error) {
      addActivity(`Delete group failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLocation() {
    try {
      setBusy(true);
      await apiRequest("/api/locations", {
        method: "POST",
        body: {
          name: locationName,
          code: locationCode,
          address: locationAddress
        }
      });
      addActivity("Location created.");
      setShowLocationForm(false);
      await refreshCoreData();
    } catch (error) {
      addActivity(`Create location failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteMemberByEmail() {
    if (!memberInviteOrgId) {
      addActivity("Invite failed: select a group.");
      return;
    }

    try {
      setBusy(true);
      const email = memberInviteEmail.trim().toLowerCase();
      const targetGroup = ownedGroups.find((item) => item.organization.id === memberInviteOrgId);
      if (!targetGroup) {
        throw new Error("Selected group is not available for invitations.");
      }
      const response = await apiRequest<{
        data: {
          email: string;
          expires_in_days: number;
          email_delivery: "sent" | "skipped" | "failed";
          email_delivery_message: string | null;
        };
      }>(`/api/organizations/${memberInviteOrgId}/members`, {
        method: "POST",
        orgOverride: memberInviteOrgId,
        body: { email }
      });
      setMemberInviteEmail("");
      if (memberInviteOrgId === orgId) {
        await loadOrganizationMembers();
      }
      await loadPendingInvitations();
      const deliveryMessage =
        response.data.email_delivery === "sent"
          ? "Invitation email sent."
          : response.data.email_delivery === "skipped"
            ? response.data.email_delivery_message ?? "Email delivery skipped."
            : response.data.email_delivery_message ?? "Email delivery failed.";
      addActivity(`Invitation created for ${targetGroup.organization.name}: ${response.data.email}`);
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
      await bootstrapOrganizationContext({ announce: true });
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
    if (!orgId) {
      addActivity("Remove member failed: no active group.");
      return;
    }

    try {
      setBusy(true);
      await apiRequest(`/api/organizations/${orgId}/members/${userId}`, {
        method: "DELETE"
      });
      await loadOrganizationMembers();
      addActivity("Group member removed.");
    } catch (error) {
      addActivity(`Remove member failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMaterial() {
    try {
      setBusy(true);
      await apiRequest("/api/materials", {
        method: "POST",
        body: {
          sku: materialSku,
          name: materialName,
          description: materialDescription.trim() || undefined,
          uom: materialUom,
          category: materialCategory,
          subcategory: materialSubcategory,
          min_stock: Number(materialMinStock)
        }
      });
      addActivity("Material created.");
      await refreshCoreData();
    } catch (error) {
      addActivity(`Create material failed: ${(error as Error).message}`);
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
        return;
      }
      if (movementReason === "transfer") {
        if (!movementFromLocationId || !movementToLocationId) {
          addActivity("Stock movement failed: select both transfer locations.");
          return;
        }
        if (movementFromLocationId === movementToLocationId) {
          addActivity("Stock movement failed: transfer locations must be different.");
          return;
        }
        if (Number(movementQuantity) <= 0) {
          addActivity("Stock movement failed: transfer quantity must be greater than zero.");
          return;
        }
      } else if (!movementLocationId || Number(movementQuantity) === 0) {
        addActivity("Stock movement failed: select a location and non-zero quantity.");
        return;
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
                quantity_delta: Number(movementQuantity),
                reason: movementReason,
                note: trimmedComment || undefined
              }
      });
      addActivity("Stock movement recorded.");
      setMovementComment("");
      setMovementQuantity(1);
      await refreshCoreData();
    } catch (error) {
      addActivity(`Stock movement failed: ${(error as Error).message}`);
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

  return (
    <>
      <section className="card shell-nav">
        <div className="shell-top">
          <div className="brand-wrap">
            <div className="brand-mark">LS</div>
            <div>
              <h2>LockStock</h2>
            </div>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
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
          </div>
          {pathname === "/inventory" ? (
            <Link className="action-link" href="/materials">
              + Add Item
            </Link>
          ) : null}
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
                setOrgId(nextOrgId);
                const nextMembership = organizations.find((item) => item.organization.id === nextOrgId);
                addActivity(`Switched group to ${nextMembership?.organization.name ?? "selected group"}.`);
                void refreshCoreData(nextOrgId, undefined, nextMembership?.role);
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

      {showMembersSection && canUseMembersScreen ? (
        <section className="card">
          <div className="title-row">
            <div>
              <h3>Groups & Members</h3>
            </div>
            <div className="actions">
              <button type="button" disabled={busy || !accessToken} onClick={handleLoadOrganizations}>
                Refresh Groups
              </button>
              {canManageMembers ? (
                <button type="button" disabled={busy} onClick={() => loadOrganizationMembers()}>
                  Refresh Members
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-2">
            <label className="field">
              <span>Create group</span>
              <input
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                placeholder={getDefaultGroupName()}
              />
            </label>
            <div className="actions">
              <button type="button" disabled={busy || !accessToken} onClick={handleCreateOrganization}>
                Create Group
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

          {!activeMembership ? <p className="subtle-line">No active group membership found.</p> : null}

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Member</th>
                  <th>Your Access</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No groups in workspace yet.</td>
                  </tr>
                ) : (
                  organizations.flatMap((item) => {
                    const isActiveOrganization = item.organization.id === orgId;
                    const groupAction =
                      item.role === "owner" ? (
                        <div className="actions">
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => startRenameGroup(item)}>
                            Rename Group
                          </button>
                          <button type="button" className="ghost-btn" disabled={busy} onClick={() => handleDeleteGroup(item)}>
                            Delete Group
                          </button>
                        </div>
                      ) : isActiveOrganization ? (
                        "Current"
                      ) : (
                        "-"
                      );
                    const rows =
                      isActiveOrganization && canManageMembers && organizationMembers.length > 0
                        ? organizationMembers.map((member) => ({
                            key: `${item.organization.id}-${member.user_id}`,
                            organization: item.organization.name,
                            member: formatPersonLabel(member),
                            access: formatGroupAccess(item.role),
                            role: member.role,
                            joined: formatDateLabel(member.created_at),
                            action:
                              member.role === "owner" ? (
                                groupAction
                              ) : (
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  disabled={busy}
                                  onClick={() => handleRemoveOrganizationMember(member.user_id)}
                                >
                                  Remove
                                </button>
                              )
                          }))
                        : [
                            {
                              key: item.organization.id,
                              organization: item.organization.name,
                              member: formatPersonLabel({ email: signedInAs || email }),
                              access: formatGroupAccess(item.role),
                              role: item.role,
                              joined: formatDateLabel(item.organization.created_at),
                              action: groupAction
                            }
                          ];

                    return rows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.organization}</td>
                        <td>{row.member}</td>
                        <td>{row.access}</td>
                        <td>{row.role}</td>
                        <td>{row.joined}</td>
                        <td>{row.action}</td>
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>

          {ownedGroups.length === 0 ? (
            <p className="subtle-line">Only group owner can invite and manage members in this MVP.</p>
          ) : null}

          {ownedGroups.length > 0 ? (
            <>
              <div className="grid grid-2">
                <label className="field">
                  <span>Invite to group</span>
                  <select value={memberInviteOrgId} onChange={(event) => setMemberInviteOrgId(event.target.value)}>
                    {ownedGroups.map((item) => (
                      <option key={item.organization.id} value={item.organization.id}>
                        {item.organization.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Invite by email</span>
                  <input
                    value={memberInviteEmail}
                    onChange={(event) => setMemberInviteEmail(event.target.value)}
                    placeholder="new.user@example.com"
                    type="email"
                  />
                </label>
                <div className="actions">
                  <button type="button" disabled={busy || !memberInviteOrgId || !memberInviteEmail.trim()} onClick={handleInviteMemberByEmail}>
                    Send Invitation
                  </button>
                </div>
              </div>

            </>
          ) : null}

          <div className="members-section-divider" />

          <div className="title-row">
            <div>
              <h4>Invitations</h4>
            </div>
            <div className="actions">
              <button type="button" disabled={busy || !accessToken} onClick={() => loadPendingInvitations()}>
                Refresh Invitations
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>Group</th>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No pending invitations.</td>
                  </tr>
                ) : (
                  pendingInvitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td>{invitation.direction === "sent" ? "Sent" : "Received"}</td>
                      <td>{invitation.organization_name}</td>
                      <td>{invitation.email}</td>
                      <td>{invitation.role}</td>
                      <td>{formatDateLabel(invitation.expires_at)}</td>
                      <td>
                        {invitation.direction === "received" ? (
                          <div className="actions">
                            <button type="button" disabled={busy} onClick={() => handleAcceptInvitation(invitation)}>
                              Accept
                            </button>
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => handleRejectInvitation(invitation)}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="subtle-line">{invitation.status}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showLocationSection ? (
        <section className="card">
          <div className="title-row">
            <div>
              <h3>Location Management</h3>
              <p className="subtle-line">Create and manage warehouse locations.</p>
            </div>
            <button type="button" onClick={() => setShowLocationForm(true)}>
              Add Location
            </button>
          </div>

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Location Name</th>
                  <th>Code</th>
                  <th>Low stock</th>
                  <th>Out of stock</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No locations created yet.</td>
                  </tr>
                ) : (
                  locations.map((location) => (
                    <tr key={location.id}>
                      <td>{location.name}</td>
                      <td>{location.code ?? "-"}</td>
                      <td>{locationSkuAlertCounts[location.id]?.lowStock ?? 0}</td>
                      <td>{locationSkuAlertCounts[location.id]?.outOfStock ?? 0}</td>
                      <td>{location.address?.trim() ? location.address : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {showLocationForm ? (
            <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add location">
              <div className="modal-card">
                <div className="title-row">
                  <h4>Add New Location</h4>
                  <button type="button" className="ghost-btn" onClick={() => setShowLocationForm(false)}>
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
                  <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleCreateLocation}>
                    Create Location
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {showMaterialSection ? (
        <section className="card">
          <h3>Materials & Stock Management</h3>
          <p className="subtle-line">Create materials and add stock to specific locations.</p>

          <div className="materials-main">
            <div className="materials-tabs">
              <button
                type="button"
                className={`tab-btn ${materialsTab === "create" ? "tab-btn-active" : ""}`}
                onClick={() => setMaterialsTab("create")}
              >
                Create Material
              </button>
              <button
                type="button"
                className={`tab-btn ${materialsTab === "add-stock" ? "tab-btn-active" : ""}`}
                onClick={() => setMaterialsTab("add-stock")}
              >
                Add to Stock
              </button>
            </div>

              {materialsTab === "create" ? (
                <div className="materials-form-wrap">
                  <div className="grid grid-2">
                    <label className="field">
                      <span>SKU</span>
                      <input value={materialSku} onChange={(event) => setMaterialSku(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Name</span>
                      <input value={materialName} onChange={(event) => setMaterialName(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <select
                        value={materialCategory}
                        onChange={(event) => setMaterialCategory(event.target.value as MaterialCategory)}
                      >
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
                      <input value={materialUom} onChange={(event) => setMaterialUom(event.target.value)} placeholder="pcs, kg, m, box" />
                    </label>
                    <label className="field">
                      <span>Minimum Stock</span>
                      <input
                        type="number"
                        min={0}
                        value={materialMinStock}
                        onChange={(event) => setMaterialMinStock(Number(event.target.value))}
                      />
                    </label>
                    <label className="field">
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
                  </div>
                </div>
              ) : (
                <div className="materials-form-wrap">
                  <div className="grid grid-2">
                    <label className="field">
                      <span>Material</span>
                      <select value={movementMaterialId} onChange={(event) => setMovementMaterialId(event.target.value)}>
                        <option value="">Select material</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.sku} - {material.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {movementReason === "transfer" ? (
                      <>
                        <label className="field">
                          <span>Transfer out</span>
                          <select value={movementFromLocationId} onChange={(event) => setMovementFromLocationId(event.target.value)}>
                            <option value="">Select location</option>
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.code ? `${location.code} - ` : ""}
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span>Transfer in</span>
                          <select value={movementToLocationId} onChange={(event) => setMovementToLocationId(event.target.value)}>
                            <option value="">Select location</option>
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.code ? `${location.code} - ` : ""}
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : (
                      <label className="field">
                        <span>Location</span>
                        <select value={movementLocationId} onChange={(event) => setMovementLocationId(event.target.value)}>
                          <option value="">Select location</option>
                          {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.code ? `${location.code} - ` : ""}
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      <span>{movementReason === "transfer" ? "Quantity" : "Quantity Delta"}</span>
                      <input
                        type="number"
                        min={movementReason === "transfer" ? 1 : undefined}
                        value={movementQuantity}
                        onChange={(event) => setMovementQuantity(Number(event.target.value))}
                      />
                    </label>
                    <label className="field">
                      <span>Reason</span>
                      <select value={movementReason} onChange={(event) => setMovementReason(event.target.value as ManualMovementReason)}>
                        <option value="adjustment">Adjustment</option>
                        <option value="transfer">Transfer</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Comments</span>
                      <textarea value={movementComment} onChange={(event) => setMovementComment(event.target.value)} rows={3} />
                    </label>
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
                          : !movementLocationId || Number(movementQuantity) === 0)
                      }
                      onClick={handleCreateMovement}
                    >
                      Add to Stock
                    </button>
                  </div>
                </div>
              )}
	          </div>

          <div className="materials-table-head">
            <div className="field">
              <span>Material movements</span>
              <p className="subtle-line">
                Page {movementPage} / {movementTotalPages} ({movementTotal} total)
              </p>
            </div>
          </div>

          {materialMovements.length === 0 ? (
            <p>No material movements yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Material</th>
                    <th>Location</th>
                    <th>Quantity</th>
                    <th>UoM</th>
                    <th>Category</th>
                    <th>Reason</th>
                    <th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {materialMovements.map((movement) => {
                    return (
                      <tr key={movement.id}>
                        <td>{new Date(movement.created_at).toLocaleString()}</td>
                        <td>{movement.material ? `${movement.material.sku} - ${movement.material.name}` : "-"}</td>
                        <td>{formatMovementLocation(movement.location)}</td>
                        <td>{Number(movement.quantity_delta).toLocaleString()}</td>
                        <td>{movement.material?.uom ?? "-"}</td>
                        <td>{movement.material?.category ?? "-"}</td>
                        <td>{formatMovementReason(movement.reason)}</td>
                        <td>{movement.note?.trim() ? movement.note : "-"}</td>
                      </tr>
                    );
                  })}
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
          </div>
        </section>
      ) : null}

      {showSupplierSection ? (
        <section className="card">
          <div className="title-row">
            <div>
              <h3>Vendor Management</h3>
              <p className="subtle-line">Manage your material suppliers and vendors.</p>
            </div>
            <button type="button" onClick={openCreateSupplierForm}>
              Add Vendor
            </button>
          </div>

          <div className="vendors-table-head">
            <label className="field">
              <span>Search Vendor</span>
                <input
                  value={supplierSearch}
                  onChange={(event) => setSupplierSearch(event.target.value)}
                  placeholder="Filter by vendor name, ID, phone, or address"
                />
              </label>
            </div>

          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Vendor ID</th>
                  <th>Vendor Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Lead Time (days)</th>
                  <th>Open POs</th>
                  <th>Received POs</th>
                  <th>Total POs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSupplierRows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>No suppliers created yet.</td>
                  </tr>
                ) : (
                  filteredSupplierRows.map((supplier) => {
                    const editableSupplier = supplierById.get(supplier.supplierId);
                    return (
                      <tr key={supplier.supplierId}>
                        <td className="mono-line">{formatVendorNumber(supplier.vendorNumber) || "-"}</td>
                        <td>{supplier.name}</td>
                        <td>{supplier.phone || "-"}</td>
                        <td>{supplier.address || "-"}</td>
                        <td>{supplier.leadTimeDays}</td>
                        <td>{supplier.openOrders}</td>
                        <td>{supplier.receivedOrders}</td>
                        <td>{supplier.totalOrders}</td>
                        <td>
                          {editableSupplier ? (
                            <button type="button" className="ghost-btn" onClick={() => openEditSupplierForm(editableSupplier)}>
                              Edit
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {showSupplierForm ? (
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
        </section>
      ) : null}

      {showPurchaseOrderSection ? (
        <>
          <section className="card">
            <div className="title-row">
              <div>
                <h3>Purchase Orders</h3>
                <p className="subtle-line">Create and manage purchase orders for materials.</p>
              </div>
              <div className="actions purchase-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowPoReceiveForm(true)}>
                  Receive
                </button>
                <button type="button" onClick={() => setShowPoCreateForm(true)}>
                  Create PO
                </button>
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
                <span className="search-icon" aria-hidden="true">
                  S
                </span>
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
                <span>Status</span>
                <select
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
                <span>Supplier</span>
                <select
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
            <p className="subtle-line">
              Page {poPage} / {poTotalPages} ({poTotal} total)
            </p>
          </section>

          <section className="card">
            <div className="title-row">
              <h3>All Purchase Orders</h3>
            </div>
            {purchaseOrders.length === 0 ? (
              <div className="po-empty">
                <p>No purchase orders match these filters.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="compact-table purchase-orders-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Lines</th>
                      <th>Progress</th>
                      <th>Total</th>
                      <th>Expected</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poTableRows.map(({ po, summary }) => {
                      const canReceive = po.status === "sent" || po.status === "partial";
                      return (
                        <tr key={po.id}>
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
                            <div className="po-cell-subtle">
                              {po.received_at
                                ? `Received ${formatDateLabel(po.received_at)}`
                                : po.sent_at
                                  ? `Sent ${formatDateLabel(po.sent_at)}`
                                  : "Not sent"}
                            </div>
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
                          <td>
                            <div className="row-actions">
                              {po.status === "draft" ? (
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
                              {po.status !== "draft" && !canReceive ? <span className="po-cell-subtle">No actions</span> : null}
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
            </div>
          </section>

          {showPoCreateForm ? (
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
                          {suppliers.map((supplier) => (
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
                          {materials.map((material) => (
                            <option key={material.id} value={material.id}>
                              {material.sku} - {material.name}
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
                      {poDraftSummary.lineCount} item(s) - {formatCurrencyAmount(poDraftSummary.totalAmount, poCurrency)}
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

          {showPoReceiveForm ? (
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
                          {locations.map((location) => (
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
                  <p>Total Items</p>
                  <span className="kpi-dot kpi-blue" aria-hidden="true">
                    ▣
                  </span>
                </div>
                <strong>{stockHealth?.total_quantity ?? metrics.totalItems}</strong>
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
                <span className="search-icon" aria-hidden="true">
                  ⌕
                </span>
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
                <span className="filter-icon" aria-hidden="true">
                  ⌄
                </span>
                <select value={inventoryCategory} onChange={(event) => setInventoryCategory(event.target.value)}>
                  {inventoryCategories.map((category) => (
                    <option key={category} value={category}>
                      {category === "all" ? "All UoM" : category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card">
            {inventoryRows.length === 0 ? (
              <p>No inventory items match these filters.</p>
            ) : (
              <div className="table-wrap">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>SKU</th>
                      <th>Unit of Measure</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRows.map((material) => {
                      const quantity = Number(material.total_quantity ?? 0);
                      const status = normalizeStatus(material.stock_status, quantity, Number(material.min_stock));
                      const materialPrice = priceByMaterial.get(material.id);

                      return (
                        <tr key={material.id}>
                          <td>{material.name}</td>
                          <td>{material.sku}</td>
                          <td>{material.uom}</td>
                          <td>{quantity.toLocaleString()}</td>
                          <td>
                            {materialPrice == null
                              ? "-"
                              : formatCurrencyAmount(materialPrice.unitPrice, materialPrice.currency)}
                          </td>
                          <td>{material.primary_location ?? "-"}</td>
                          <td>
                            <span className={`status-pill status-${status}`}>
                              {status === "out-of-stock" ? "Out of Stock" : status === "low-stock" ? "Low Stock" : "In Stock"}
                            </span>
                          </td>
                          <td>
                            <div className="row-actions">
                              <button type="button" disabled className="icon-btn">
                                ✎
                              </button>
                              <button type="button" disabled className="icon-btn danger">
                                🗑
                              </button>
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
                Page {materialPage} / {materialTotalPages} ({materialTotal} total)
              </p>
            </div>
          </section>
        </>
      ) : null}

    </>
  );
}
