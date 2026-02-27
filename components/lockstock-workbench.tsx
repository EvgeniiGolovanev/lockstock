"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { filterInventoryRows, inventoryMetrics, normalizeStatus, purchaseOrderProgress } from "@/lib/ui/parity-models";

type Material = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  min_stock: number;
  total_quantity?: number;
  primary_location?: string | null;
  stock_status?: "in-stock" | "low-stock" | "out-of-stock";
};

type Location = {
  id: string;
  name: string;
  code: string | null;
};

type StockHealth = {
  total_materials: number;
  total_quantity: number;
  out_of_stock: number;
  low_stock: number;
};

type Supplier = {
  id: string;
  name: string;
  lead_time_days: number;
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
  supplier: { id: string; name: string } | null;
  lines: PurchaseOrderLine[];
};

type PurchaseOrderFilterStatus = "all" | PurchaseOrder["status"];

type OrganizationMembership = {
  role: "owner" | "manager" | "member" | "viewer";
  organization: {
    id: string;
    name: string;
    created_at: string;
  };
};

type ActivityEntry = {
  id: string;
  line: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

const MATERIALS_PAGE_SIZE = 25;
const PURCHASE_ORDERS_PAGE_SIZE = 20;

const STORAGE_KEYS = {
  baseUrl: "lockstock.baseUrl",
  token: "lockstock.accessToken",
  orgId: "lockstock.orgId"
} as const;

type NavIcon = "inventory" | "materials" | "locations" | "vendors" | "purchase-orders";
type NavHref = "/" | "/materials" | "/locations" | "/vendors" | "/purchase-orders";

const NAV_ITEMS: Array<{ href: NavHref; label: string; icon: NavIcon }> = [
  { href: "/", label: "Inventory", icon: "inventory" },
  { href: "/materials", label: "Materials & Stock", icon: "materials" },
  { href: "/locations", label: "Locations", icon: "locations" },
  { href: "/vendors", label: "Vendors", icon: "vendors" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "purchase-orders" }
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h2l2 9h10l2-7H8M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  );
}

export function LockstockWorkbench() {
  const pathname = usePathname();
  const [baseUrl, setBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInAs, setSignedInAs] = useState("");
  const [orgName, setOrgName] = useState("LockStock Workspace");

  const [locationName, setLocationName] = useState("Main Warehouse");
  const [locationCode, setLocationCode] = useState("MAIN");
  const [materialSku, setMaterialSku] = useState("MAT-001");
  const [materialName, setMaterialName] = useState("Cement");
  const [materialUom, setMaterialUom] = useState("bag");
  const [materialMinStock, setMaterialMinStock] = useState(10);
  const [supplierName, setSupplierName] = useState("Acme Supply");
  const [supplierLeadTime, setSupplierLeadTime] = useState(5);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showPoCreateForm, setShowPoCreateForm] = useState(false);

  const [movementMaterialId, setMovementMaterialId] = useState("");
  const [movementLocationId, setMovementLocationId] = useState("");
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [movementReason, setMovementReason] = useState("adjustment");
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poMaterialId, setPoMaterialId] = useState("");
  const [poQuantityOrdered, setPoQuantityOrdered] = useState(1);
  const [poUnitPrice, setPoUnitPrice] = useState(0);
  const [receivePoId, setReceivePoId] = useState("");
  const [receivePoLineId, setReceivePoLineId] = useState("");
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState(1);
  const [materialFilterQuery, setMaterialFilterQuery] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("all");
  const [materialPage, setMaterialPage] = useState(1);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [poFilterStatus, setPoFilterStatus] = useState<PurchaseOrderFilterStatus>("all");
  const [poFilterSupplierId, setPoFilterSupplierId] = useState("all");
  const [poFilterQuery, setPoFilterQuery] = useState("");
  const [poPage, setPoPage] = useState(1);
  const [poTotal, setPoTotal] = useState(0);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [stockHealth, setStockHealth] = useState<StockHealth | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/+$/, ""), [baseUrl]);
  const isOrgScopedReady = Boolean(accessToken && orgId);
  const selectedPurchaseOrder = useMemo(
    () => purchaseOrders.find((po) => po.id === receivePoId) ?? null,
    [purchaseOrders, receivePoId]
  );
  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const inventoryCategories = useMemo(() => {
    const categories = Array.from(new Set(materials.map((material) => material.uom || "Uncategorized")));
    return ["all", ...categories];
  }, [materials]);
  const inventoryRows = useMemo(
    () => filterInventoryRows(materials, materialFilterQuery, inventoryCategory),
    [inventoryCategory, materialFilterQuery, materials]
  );
  const metrics = useMemo(() => inventoryMetrics(materials, purchaseOrders), [materials, purchaseOrders]);
  const priceByMaterial = useMemo(() => {
    const next = new Map<string, number>();
    for (const po of purchaseOrders) {
      for (const line of po.lines) {
        if (line.unit_price != null) {
          next.set(line.material_id, Number(line.unit_price));
        }
      }
    }
    return next;
  }, [purchaseOrders]);
  const poStatusCounts = useMemo(
    () =>
      purchaseOrders.reduce(
        (acc, po) => {
          acc[po.status] += 1;
          return acc;
        },
        { draft: 0, sent: 0, partial: 0, received: 0, cancelled: 0 }
      ),
    [purchaseOrders]
  );
  const materialTotalPages = Math.max(1, Math.ceil(materialTotal / MATERIALS_PAGE_SIZE));
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
    return { title: "Inventory Management", subtitle: "Manage your stock and track inventory levels." };
  }, [pathname]);

  const showLocationSection = pathname === "/locations";
  const showMaterialSection = pathname === "/materials";
  const showSupplierSection = pathname === "/vendors";
  const showPurchaseOrderSection = pathname === "/purchase-orders";
  const showReceiveSection = pathname === "/purchase-orders";
  const showPoTableSection = pathname === "/purchase-orders";
  const showMovementSection = pathname === "/materials";
  const showSnapshotSection = pathname === "/";
  const showAuthPanel = pathname !== "/" || !signedInAs;
  const showOrgCreatePanel = pathname !== "/";

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

      void supabase.auth.getSession().then(({ data, error }) => {
        if (unmounted || error) {
          return;
        }
        if (!data.session) {
          if (window.localStorage.getItem(STORAGE_KEYS.token)) {
            setAccessToken("");
            setSignedInAs("");
            clearWorkspaceData();
            addActivity("No active Supabase session. Cleared saved token.");
          }
          return;
        }
        setAccessToken((current) => current || data.session?.access_token || "");
        setSignedInAs(data.session.user.email ?? "");
        setEmail((current) => current || data.session?.user.email || "");
      });

      const authListener = supabase.auth.onAuthStateChange((event, session) => {
        if (unmounted) {
          return;
        }

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
          setAccessToken(session.access_token);
          setSignedInAs(session.user.email ?? "");
          setEmail((current) => current || session.user.email || "");
        }

        if (event === "SIGNED_OUT") {
          setAccessToken("");
          setSignedInAs("");
          clearWorkspaceData();
        }
      });

      unsubscribe = () => authListener.data.subscription.unsubscribe();
    } catch {
      addActivity("Supabase browser auth is not configured.");
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

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
    if (!poSupplierId && suppliers[0]) {
      setPoSupplierId(suppliers[0].id);
    }
  }, [poSupplierId, suppliers]);

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

  function addActivity(message: string) {
    const stamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setActivity((prev) => [{ id, line: `${stamp} - ${message}` }, ...prev].slice(0, 10));
  }

  function clearWorkspaceData() {
    setOrgId("");
    setOrganizations([]);
    setMaterials([]);
    setLocations([]);
    setSuppliers([]);
    setPurchaseOrders([]);
    setMaterialTotal(0);
    setPoTotal(0);
    setMaterialPage(1);
    setPoPage(1);
    setStockHealth(null);
    setLowStockCount(null);
  }

  function getDefaultOrganizationName() {
    const source = signedInAs || email;
    if (source.includes("@")) {
      return `${source.split("@")[0]} Workspace`;
    }
    return "LockStock Workspace";
  }

  function getPoProgress(po: PurchaseOrder) {
    return purchaseOrderProgress(po);
  }

  async function apiRequest<T>(
    path: string,
    options?: {
      method?: "GET" | "POST";
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
      throw new Error("Organization ID is required.");
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

      setAccessToken(data.session.access_token);
      setSignedInAs(data.user?.email ?? email);
      setPassword("");
      addActivity(`Signed in as ${data.user?.email ?? email}.`);
    } catch (error) {
      setAccessToken("");
      setSignedInAs("");
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
      clearWorkspaceData();
      addActivity("Signed out.");
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

  async function refreshCoreData(targetOrgId?: string, tokenOverride?: string) {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      addActivity("No active organization. Sign in again or sync workspace.");
      return;
    }

    const [materialsResult, locationsResult, suppliersResult, purchaseOrdersResult] = await Promise.all([
      loadMaterials(orgValue, tokenOverride),
      apiRequest<{ data: Location[] }>("/api/locations", { orgOverride: orgValue, tokenOverride }),
      apiRequest<{ data: Supplier[] }>("/api/suppliers", { orgOverride: orgValue, tokenOverride }),
      loadPurchaseOrders(orgValue, tokenOverride)
    ]);

    setLocations(locationsResult.data);
    setSuppliers(suppliersResult.data);
    addActivity(
      `Loaded ${materialsResult.count} materials, ${locationsResult.data.length} locations, ${suppliersResult.data.length} suppliers, ${purchaseOrdersResult.count} purchase orders.`
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
        const defaultOrgName = getDefaultOrganizationName();
        await apiRequest("/api/organizations", {
          method: "POST",
          requireOrg: false,
          tokenOverride: effectiveToken,
          body: { name: defaultOrgName }
        });
        addActivity(`No organization found. Created "${defaultOrgName}".`);
        organizationsResult = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
          requireOrg: false,
          tokenOverride: effectiveToken
        });
      }

      if (organizationsResult.data.length === 0) {
        throw new Error("No organization available after bootstrap.");
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

      await refreshCoreData(selectedMembership.organization.id, effectiveToken);
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthTokenError(message)) {
        setAccessToken("");
        setSignedInAs("");
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
      const nextOrgName = orgName.trim() || getDefaultOrganizationName();
      const response = await apiRequest<{ data: { id: string } }>("/api/organizations", {
        method: "POST",
        requireOrg: false,
        body: { name: nextOrgName }
      });

      setOrgId(response.data.id);
      addActivity(`Organization created: ${response.data.id}`);
      const organizationsResponse = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
        requireOrg: false
      });
      setOrganizations(organizationsResponse.data);
      await refreshCoreData(response.data.id);
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthTokenError(message)) {
        setAccessToken("");
        setSignedInAs("");
        clearWorkspaceData();
      }
      addActivity(`Create organization failed: ${message}`);
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
          code: locationCode
        }
      });
      addActivity("Location created.");
      await refreshCoreData();
    } catch (error) {
      addActivity(`Create location failed: ${(error as Error).message}`);
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
          uom: materialUom,
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

  async function handleCreateSupplier() {
    try {
      setBusy(true);
      await apiRequest("/api/suppliers", {
        method: "POST",
        body: {
          name: supplierName,
          lead_time_days: Number(supplierLeadTime)
        }
      });
      addActivity("Supplier created.");
      await refreshCoreData();
    } catch (error) {
      addActivity(`Create supplier failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePurchaseOrder() {
    try {
      setBusy(true);
      await apiRequest("/api/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: poSupplierId,
          lines: [
            {
              material_id: poMaterialId,
              quantity_ordered: Number(poQuantityOrdered),
              unit_price: Number(poUnitPrice)
            }
          ]
        }
      });
      addActivity("Purchase order created.");
      await refreshCoreData();
    } catch (error) {
      addActivity(`Create purchase order failed: ${(error as Error).message}`);
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
    } catch (error) {
      addActivity(`Receive purchase order failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMovement() {
    try {
      setBusy(true);
      await apiRequest("/api/stock/movements", {
        method: "POST",
        body: {
          material_id: movementMaterialId,
          location_id: movementLocationId,
          quantity_delta: Number(movementQuantity),
          reason: movementReason
        }
      });
      addActivity("Stock movement recorded.");
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
        </div>
      </section>

      <section className="card">
        <div className="title-row">
          <div>
            <h1>{currentScreen.title}</h1>
            <p>{currentScreen.subtitle}</p>
          </div>
          {pathname === "/" ? (
            <Link className="action-link" href="/materials">
              + Add Item
            </Link>
          ) : null}
        </div>
      </section>

      {showAuthPanel ? (
        <section className="card">
        <h2>Access & Environment</h2>
        <p>Sign in and the workspace will auto-bootstrap organization context.</p>
        <div className="grid grid-2">
          <label className="field">
            <span>Base URL</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:3000" />
          </label>
          <label className="field">
            <span>Active Organization ID</span>
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
            <span>Organization Picker</span>
            <select
              value={orgId}
              onChange={(event) => {
                const nextOrgId = event.target.value;
                setOrgId(nextOrgId);
                addActivity(`Switched organization to ${nextOrgId}.`);
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
            type="password"
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

      {showOrgCreatePanel ? (
        <section className="card">
        <h3>Create Organization</h3>
        <div className="grid grid-2">
          <label className="field">
            <span>Name</span>
            <input value={orgName} onChange={(event) => setOrgName(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" disabled={busy || !accessToken} onClick={handleCreateOrganization}>
              Create Org
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {showLocationSection ? (
        <section className="card">
          <div className="title-row">
            <h3>Location Management</h3>
            <button type="button" onClick={() => setShowLocationForm((prev) => !prev)}>
              {showLocationForm ? "Close" : "Add Location"}
            </button>
          </div>
          {showLocationForm ? (
            <>
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
              <div className="actions">
                <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleCreateLocation}>
                  Create Location
                </button>
              </div>
            </>
          ) : null}
          <div className="kpi-grid">
            <div className="kpi-card">
              <p>Total Locations</p>
              <strong>{locations.length}</strong>
            </div>
            <div className="kpi-card">
              <p>Materials Assigned</p>
              <strong>{materials.filter((material) => material.primary_location).length}</strong>
            </div>
            <div className="kpi-card">
              <p>Tracked Materials</p>
              <strong>{materials.length}</strong>
            </div>
            <div className="kpi-card">
              <p>Stock Entries</p>
              <strong>{materials.filter((material) => Number(material.total_quantity ?? 0) > 0).length}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No locations created yet.</td>
                  </tr>
                ) : (
                  locations.map((location) => (
                    <tr key={location.id}>
                      <td>{location.code ?? "-"}</td>
                      <td>{location.name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showMaterialSection ? (
        <section className="card">
          <h3>Create Material</h3>
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
            <span>UOM</span>
            <input value={materialUom} onChange={(event) => setMaterialUom(event.target.value)} />
          </label>
          <label className="field">
            <span>Min Stock</span>
            <input
              type="number"
              value={materialMinStock}
              onChange={(event) => setMaterialMinStock(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleCreateMaterial}>
            Create Material
          </button>
        </div>
        <div className="grid grid-2">
          <label className="field">
            <span>Material Search</span>
            <input
              value={materialFilterQuery}
              onChange={(event) => {
                setMaterialFilterQuery(event.target.value);
                setMaterialPage(1);
              }}
              placeholder="Filter by SKU or name"
            />
          </label>
          <div className="field">
            <span>Material Page</span>
            <p className="subtle-line">
              Page {materialPage} / {materialTotalPages} ({materialTotal} total)
            </p>
          </div>
        </div>
        {materials.length === 0 ? (
          <p>No materials on this page.</p>
        ) : (
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Min Stock</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => {
                  const quantity = Number(material.total_quantity ?? 0);
                  const status = normalizeStatus(material.stock_status, quantity, Number(material.min_stock));
                  return (
                    <tr key={material.id}>
                      <td>{material.sku}</td>
                      <td>{material.name}</td>
                      <td>{material.uom}</td>
                      <td>{quantity.toLocaleString()}</td>
                      <td>{material.min_stock}</td>
                      <td>{material.primary_location ?? "-"}</td>
                      <td>
                        <span className={`status-pill status-${status}`}>
                          {status === "out-of-stock" ? "Out of Stock" : status === "low-stock" ? "Low Stock" : "In Stock"}
                        </span>
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
            Previous Materials
          </button>
          <button
            type="button"
            disabled={busy || materialPage >= materialTotalPages}
            onClick={() => setMaterialPage((prev) => Math.min(materialTotalPages, prev + 1))}
          >
            Next Materials
          </button>
        </div>
        </section>
      ) : null}

      {showSupplierSection ? (
        <section className="card">
          <div className="title-row">
            <h3>Vendor Management</h3>
            <button type="button" onClick={() => setShowSupplierForm((prev) => !prev)}>
              {showSupplierForm ? "Close" : "Add Vendor"}
            </button>
          </div>
          {showSupplierForm ? (
            <>
              <div className="grid grid-2">
                <label className="field">
                  <span>Name</span>
                  <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
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
              </div>
              <div className="actions">
                <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleCreateSupplier}>
                  Create Supplier
                </button>
              </div>
            </>
          ) : null}
          <div className="kpi-grid">
            <div className="kpi-card">
              <p>Total Vendors</p>
              <strong>{suppliers.length}</strong>
            </div>
            <div className="kpi-card">
              <p>Average Lead Time</p>
              <strong>
                {suppliers.length === 0
                  ? "0"
                  : Math.round(
                      suppliers.reduce((sum, supplier) => sum + Number(supplier.lead_time_days || 0), 0) / suppliers.length
                    )}
                d
              </strong>
            </div>
            <div className="kpi-card">
              <p>Open Orders</p>
              <strong>{purchaseOrders.filter((po) => po.status !== "received" && po.status !== "cancelled").length}</strong>
            </div>
            <div className="kpi-card">
              <p>Received Orders</p>
              <strong>{poStatusCounts.received}</strong>
            </div>
          </div>
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Lead Time (days)</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No suppliers created yet.</td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.name}</td>
                      <td>{supplier.lead_time_days}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showPurchaseOrderSection ? (
        <section className="card">
          <div className="title-row">
            <h3>Create Purchase Order</h3>
            <button type="button" onClick={() => setShowPoCreateForm((prev) => !prev)}>
              {showPoCreateForm ? "Close" : "Create PO"}
            </button>
          </div>
          {showPoCreateForm ? (
            <>
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
                  <span>Quantity Ordered</span>
                  <input
                    type="number"
                    min={0.001}
                    step="0.001"
                    value={poQuantityOrdered}
                    onChange={(event) => setPoQuantityOrdered(Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  <span>Unit Price</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={poUnitPrice}
                    onChange={(event) => setPoUnitPrice(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy || !isOrgScopedReady || !poSupplierId || !poMaterialId || poQuantityOrdered <= 0}
                  onClick={handleCreatePurchaseOrder}
                >
                  Create Purchase Order
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {showReceiveSection ? (
        <section className="card">
          <h3>Receive Purchase Order</h3>
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
        <div className="actions">
          <button
            type="button"
            disabled={busy || !isOrgScopedReady || !receivePoId || !receivePoLineId || !receiveLocationId || receiveQuantity <= 0}
            onClick={handleReceivePurchaseOrder}
          >
            Receive
          </button>
        </div>
        </section>
      ) : null}

      {showPoTableSection ? (
        <section className="card">
          <h3>Purchase Orders</h3>
          <div className="kpi-grid">
            <div className="kpi-card">
              <p>Total POs</p>
              <strong>{poTotal}</strong>
            </div>
            <div className="kpi-card">
              <p>Pending</p>
              <strong>{poStatusCounts.draft + poStatusCounts.sent + poStatusCounts.partial}</strong>
            </div>
            <div className="kpi-card">
              <p>Received</p>
              <strong>{poStatusCounts.received}</strong>
            </div>
            <div className="kpi-card">
              <p>Total Value</p>
              <strong>
                $
                {purchaseOrders
                  .reduce(
                    (sum, po) =>
                      sum + po.lines.reduce((lineSum, line) => lineSum + Number(line.quantity_ordered) * Number(line.unit_price ?? 0), 0),
                    0
                  )
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        <div className="grid grid-3">
          <label className="field">
            <span>Search</span>
            <input
              value={poFilterQuery}
              onChange={(event) => {
                setPoFilterQuery(event.target.value);
                setPoPage(1);
              }}
              placeholder="PO number"
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select
              value={poFilterStatus}
              onChange={(event) => {
                setPoFilterStatus(event.target.value as PurchaseOrderFilterStatus);
                setPoPage(1);
              }}
            >
              <option value="all">all</option>
              <option value="draft">draft</option>
              <option value="sent">sent</option>
              <option value="partial">partial</option>
              <option value="received">received</option>
              <option value="cancelled">cancelled</option>
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
              <option value="all">all suppliers</option>
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
        {purchaseOrders.length === 0 ? (
          <p>No purchase orders match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Status</th>
                  <th>Supplier</th>
                  <th>Lines</th>
                  <th>Received</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => {
                  const progress = getPoProgress(po);
                  const linePreview = po.lines
                    .slice(0, 2)
                    .map((line) => materialById.get(line.material_id)?.sku ?? "material")
                    .join(", ");

                  return (
                    <tr key={po.id}>
                      <td>{po.po_number}</td>
                      <td>
                        <span className={`status-pill status-${po.status}`}>{po.status}</span>
                      </td>
                      <td>{po.supplier?.name ?? "Unknown"}</td>
                      <td>
                        {po.lines.length}
                        <div className="subtle-line">
                          {linePreview}
                          {po.lines.length > 2 ? ` +${po.lines.length - 2} more` : ""}
                        </div>
                      </td>
                      <td>
                        <div>
                          {progress.totalReceived}/{progress.totalOrdered}
                        </div>
                        <div className="progress-track" aria-label="received progress">
                          <span className="progress-fill" style={{ width: `${progress.percentage}%` }} />
                        </div>
                        <div className="subtle-line">{progress.percentage}%</div>
                      </td>
                      <td>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setReceivePoId(po.id);
                            setReceivePoLineId(po.lines[0]?.id ?? "");
                            addActivity(`Selected ${po.po_number} in receive form.`);
                          }}
                        >
                          Use in Receive
                        </button>
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
            Previous Page
          </button>
          <button type="button" disabled={busy || poPage >= poTotalPages} onClick={() => setPoPage((prev) => Math.min(poTotalPages, prev + 1))}>
            Next Page
          </button>
        </div>
        </section>
      ) : null}

      {showMovementSection ? (
        <section className="card">
          <h3>Record Stock Movement</h3>
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
          <label className="field">
            <span>Quantity Delta</span>
            <input
              type="number"
              value={movementQuantity}
              onChange={(event) => setMovementQuantity(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Reason</span>
            <select value={movementReason} onChange={(event) => setMovementReason(event.target.value)}>
              <option value="adjustment">adjustment</option>
              <option value="transfer_in">transfer_in</option>
              <option value="transfer_out">transfer_out</option>
              <option value="purchase_receive">purchase_receive</option>
              <option value="correction">correction</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            disabled={busy || !isOrgScopedReady || !movementMaterialId || !movementLocationId}
            onClick={handleCreateMovement}
          >
            Record Movement
          </button>
        </div>
        </section>
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
                    $
                  </span>
                </div>
                <strong>
                  $
                  {metrics.totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </strong>
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
                      {category === "all" ? "All Categories" : category}
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
                      <th>Category</th>
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
                      const unitPrice = priceByMaterial.get(material.id);

                      return (
                        <tr key={material.id}>
                          <td>{material.name}</td>
                          <td>{material.sku}</td>
                          <td>{material.uom}</td>
                          <td>{quantity.toLocaleString()}</td>
                          <td>
                            {unitPrice == null
                              ? "-"
                              : `$${unitPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}`}
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

      <section className="card">
        <h3>Activity</h3>
        {activity.length === 0 ? <p>No activity yet.</p> : null}
        {activity.map((item) => (
          <p key={item.id} className="mono-line">
            {item.line}
          </p>
        ))}
      </section>
    </>
  );
}
