"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Material = {
  id: string;
  sku: string;
  name: string;
  min_stock: number;
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

type OrganizationMembership = {
  role: "owner" | "manager" | "member" | "viewer";
  organization: {
    id: string;
    name: string;
    created_at: string;
  };
};

type ActivityEntry = {
  id: number;
  line: string;
};

const STORAGE_KEYS = {
  baseUrl: "lockstock.baseUrl",
  token: "lockstock.accessToken",
  orgId: "lockstock.orgId"
} as const;

export function LockstockWorkbench() {
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

  const [movementMaterialId, setMovementMaterialId] = useState("");
  const [movementLocationId, setMovementLocationId] = useState("");
  const [movementQuantity, setMovementQuantity] = useState(1);
  const [movementReason, setMovementReason] = useState("adjustment");

  const [materials, setMaterials] = useState<Material[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [stockHealth, setStockHealth] = useState<StockHealth | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const activityIdRef = useRef(0);

  const normalizedBaseUrl = useMemo(() => baseUrl.replace(/\/+$/, ""), [baseUrl]);
  const isOrgScopedReady = Boolean(accessToken && orgId);

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
          setSignedInAs("");
          setOrganizations([]);
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

  function addActivity(message: string) {
    const stamp = new Date().toLocaleTimeString();
    activityIdRef.current += 1;
    setActivity((prev) => [{ id: activityIdRef.current, line: `${stamp} - ${message}` }, ...prev].slice(0, 10));
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
      setOrganizations([]);
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
      setOrganizations([]);
      setSignedInAs("");
      addActivity("Signed out.");
    } catch (error) {
      addActivity(`Logout failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadOrganizations() {
    try {
      setBusy(true);
      const response = await apiRequest<{ data: OrganizationMembership[] }>("/api/organizations", {
        requireOrg: false
      });

      setOrganizations(response.data);

      if (response.data.length === 0) {
        addActivity("No organizations found for this user.");
        return;
      }

      const currentInList = response.data.find((item) => item.organization.id === orgId);
      const selected = currentInList ? currentInList.organization.id : response.data[0].organization.id;
      setOrgId(selected);
      addActivity(`Loaded ${response.data.length} organizations.`);
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthTokenError(message)) {
        setAccessToken("");
        setSignedInAs("");
        setOrganizations([]);
      }
      addActivity(`Loading organizations failed: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function refreshCoreData(targetOrgId?: string) {
    const orgValue = targetOrgId ?? orgId;
    if (!orgValue) {
      addActivity("Set an organization ID before loading materials and locations.");
      return;
    }

    const [materialsResult, locationsResult] = await Promise.all([
      apiRequest<{ data: Material[] }>("/api/materials", { orgOverride: orgValue }),
      apiRequest<{ data: Location[] }>("/api/locations", { orgOverride: orgValue })
    ]);

    setMaterials(materialsResult.data);
    setLocations(locationsResult.data);
    addActivity(`Loaded ${materialsResult.data.length} materials and ${locationsResult.data.length} locations.`);
  }

  async function handleCreateOrganization() {
    try {
      setBusy(true);
      const response = await apiRequest<{ data: { id: string } }>("/api/organizations", {
        method: "POST",
        requireOrg: false,
        body: { name: orgName }
      });

      setOrgId(response.data.id);
      addActivity(`Organization created: ${response.data.id}`);
      await refreshCoreData(response.data.id);
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthTokenError(message)) {
        setAccessToken("");
        setSignedInAs("");
        setOrganizations([]);
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
      <section className="card">
        <h2>Workbench</h2>
        <p>Bootstrap and test the core flow directly from UI. Use Supabase email/password login or paste a JWT manually.</p>
        <div className="grid grid-2">
          <label className="field">
            <span>Base URL</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:3000" />
          </label>
          <label className="field">
            <span>Organization ID (manual)</span>
            <input value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="uuid" />
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
            Load Organizations
          </button>
        </div>
        {signedInAs ? <p>Signed in as: <strong>{signedInAs}</strong></p> : <p>Not signed in.</p>}
        {organizations.length > 0 ? (
          <label className="field">
            <span>Organization Picker</span>
            <select value={orgId} onChange={(event) => setOrgId(event.target.value)}>
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
            Reload Organizations
          </button>
          <button type="button" disabled={busy || !isOrgScopedReady} onClick={() => refreshCoreData()}>
            Load Materials + Locations
          </button>
          <button type="button" disabled={busy || !isOrgScopedReady} onClick={handleRefreshHealth}>
            Refresh Health
          </button>
        </div>
      </section>

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

      <section className="card">
        <h3>Create Location</h3>
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
      </section>

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
      </section>

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

      <section className="card">
        <h3>Data Snapshot</h3>
        <p>
          Materials: <strong>{materials.length}</strong> | Locations: <strong>{locations.length}</strong> | Low stock:{" "}
          <strong>{lowStockCount ?? "-"}</strong>
        </p>
        {stockHealth ? (
          <p>
            Total Qty: <strong>{stockHealth.total_quantity}</strong> | Out of stock: <strong>{stockHealth.out_of_stock}</strong> |
            Low stock: <strong>{stockHealth.low_stock}</strong>
          </p>
        ) : (
          <p>Run &quot;Refresh Health&quot; to load metrics.</p>
        )}
      </section>

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
