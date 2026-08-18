import { expect, test, type Page } from "@playwright/test";

const sessionStorageKey = "sb-127-auth-token";
const orgId = "11111111-1111-4111-8111-111111111111";
const secondaryOrgId = "22222222-2222-4222-8222-222222222222";
const materialId = "33333333-3333-4333-8333-333333333333";
const locationId = "44444444-4444-4444-8444-444444444444";
const supplierId = "55555555-5555-4555-8555-555555555555";
const draftPoId = "66666666-6666-4666-8666-666666666666";
const sentPoId = "77777777-7777-4777-8777-777777777777";
const poLineId = "88888888-8888-4888-8888-888888888888";

type BillingSummary = {
  plan: string;
  status: string;
  billing_interval: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  scheduled_plan: string | null;
  scheduled_interval: string | null;
  scheduled_effective_at: string | null;
  trial_ends_at: string | null;
  past_due_since: string | null;
  cancel_at_period_end: boolean;
};

type Entitlements = {
  selectedPlan: "starter" | "operations" | "business" | "enterprise";
  effectivePlan: "starter" | "operations" | "business" | "enterprise";
  billingStatus: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  isReadOnly: boolean;
  accessReason: string;
  features: { organizationAuditLog: boolean; auditCsvExport: boolean };
  limits: Record<string, number | null>;
};

type AppState = {
  organizations: Array<{
    role: "owner" | "manager" | "member" | "viewer";
    organization: { id: string; name: string; created_at: string };
  }>;
  membersByOrg: Record<string, Array<{ user_id: string; email: string | null; full_name: string | null; role: string; created_at: string }>>;
  materials: Array<{ id: string; sku: string; name: string; uom: string; is_active: boolean; min_stock: number; total_quantity: number; primary_location: string }>;
  locations: Array<{ id: string; code: string; name: string; is_active: boolean }>;
  suppliers: Array<{ id: string; name: string; lead_time_days: number; is_active: boolean; created_at: string; vendor_number: number }>;
  purchaseOrders: Array<{
    id: string;
    po_number: string;
    status: "draft" | "sent" | "partial" | "received" | "cancelled";
    currency: "EUR";
    created_at: string;
    expected_at: string | null;
    sent_at: string | null;
    received_at: string | null;
    supplier: { id: string; name: string } | null;
    lines: Array<{ id: string; material_id: string; quantity_ordered: number; quantity_received: number; unit_price: number }>;
  }>;
  movements: Array<{ id: string; created_at: string; quantity_delta: number; reason: string; note: string | null; material: { sku: string; name: string; uom: string } | null; location: { code: string | null; name: string } | null }>;
  billingSummary: BillingSummary;
  entitlements: Entitlements;
  readOnlyStockFailure?: string;
  stockMovementPosts: number;
};

function makeSession(email = "ava@northstar.build", fullName = "Ava Laurent") {
  return {
    access_token: `access-${email}`,
    refresh_token: `refresh-${email}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      aud: "authenticated",
      role: "authenticated",
      email,
      user_metadata: {
        full_name: fullName,
        selected_plan: "starter"
      },
      app_metadata: { provider: "email", providers: ["email"] }
    }
  };
}

async function seedSession(page: Page, session = makeSession()) {
  await page.addInitScript(
    ({ storageKey, tokenKey, value }) => {
      localStorage.setItem(tokenKey, value.access_token);
      localStorage.setItem(storageKey, JSON.stringify(value));
    },
    { storageKey: sessionStorageKey, tokenKey: "lockstock.accessToken", value: session }
  );
}

function baseAppState(): AppState {
  return {
    organizations: [
      { role: "owner", organization: { id: orgId, name: "Northstar Materials", created_at: "2026-08-01T09:00:00.000Z" } },
      { role: "manager", organization: { id: secondaryOrgId, name: "South Bay Logistics", created_at: "2026-08-02T09:00:00.000Z" } }
    ],
    membersByOrg: {
      [orgId]: [
        { user_id: "user-ava", email: "ava@northstar.build", full_name: "Ava Laurent", role: "owner", created_at: "2026-08-01T09:00:00.000Z" },
        { user_id: "user-noah", email: "noah@northstar.build", full_name: "Noah Martin", role: "manager", created_at: "2026-08-03T09:00:00.000Z" }
      ],
      [secondaryOrgId]: [
        { user_id: "user-zoe", email: "zoe@southbay.build", full_name: "Zoe Kim", role: "owner", created_at: "2026-08-02T09:00:00.000Z" }
      ]
    },
    materials: [
      { id: materialId, sku: "MAT-100", name: "Masonry Cement", uom: "BAG", is_active: true, min_stock: 10, total_quantity: 26, primary_location: "Main Warehouse" }
    ],
    locations: [
      { id: locationId, code: "MAIN", name: "Main Warehouse", is_active: true }
    ],
    suppliers: [
      { id: supplierId, name: "Acme Supply", lead_time_days: 7, is_active: true, created_at: "2026-08-01T09:00:00.000Z", vendor_number: 42 }
    ],
    purchaseOrders: [
      {
        id: draftPoId,
        po_number: "PO-2001",
        status: "draft",
        currency: "EUR",
        created_at: "2026-08-13T10:00:00.000Z",
        expected_at: "2026-08-30T00:00:00.000Z",
        sent_at: null,
        received_at: null,
        supplier: { id: supplierId, name: "Acme Supply" },
        lines: [{ id: poLineId, material_id: materialId, quantity_ordered: 12, quantity_received: 0, unit_price: 18 }]
      },
      {
        id: sentPoId,
        po_number: "PO-2002",
        status: "sent",
        currency: "EUR",
        created_at: "2026-08-13T11:00:00.000Z",
        expected_at: "2026-08-28T00:00:00.000Z",
        sent_at: "2026-08-13T12:00:00.000Z",
        received_at: null,
        supplier: { id: supplierId, name: "Acme Supply" },
        lines: [{ id: "99999999-9999-4999-8999-999999999999", material_id: materialId, quantity_ordered: 5, quantity_received: 0, unit_price: 22 }]
      }
    ],
    movements: [
      {
        id: "move-1",
        created_at: "2026-08-13T10:30:00.000Z",
        quantity_delta: 4,
        reason: "adjustment",
        note: null,
        material: { sku: "MAT-100", name: "Masonry Cement", uom: "BAG" },
        location: { code: "MAIN", name: "Main Warehouse" }
      }
    ],
    billingSummary: {
      plan: "business",
      status: "trialing",
      billing_interval: "monthly",
      stripe_subscription_id: "sub_123",
      current_period_end: null,
      scheduled_plan: null,
      scheduled_interval: null,
      scheduled_effective_at: null,
      trial_ends_at: "2026-08-28T00:00:00.000Z",
      past_due_since: null,
      cancel_at_period_end: false
    },
    entitlements: {
      selectedPlan: "business",
      effectivePlan: "business",
      billingStatus: "trialing",
      trialEndsAt: "2026-08-28T00:00:00.000Z",
      currentPeriodEnd: null,
      isReadOnly: false,
      accessReason: "trial",
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
      }
    },
    stockMovementPosts: 0
  };
}

async function installAuthRoutes(page: Page, session = makeSession()) {
  await page.route("**/auth/v1/token*", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
}

async function installAppRoutes(page: Page, state: AppState) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    const fulfill = (status: number, payload: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

    if (path === "/api/platform/me") {
      return fulfill(200, { isPlatformAdmin: false, role: null });
    }

    if (path === "/api/account/profile" && method === "POST") {
      return fulfill(200, { data: { ok: true } });
    }

    if (path === "/api/organizations" && method === "GET") {
      return fulfill(200, { data: state.organizations });
    }

    if (path === "/api/organizations" && method === "POST") {
      const body = request.postDataJSON() as { name?: string };
      state.organizations = [
        ...state.organizations,
        {
          role: "owner",
          organization: { id: `org-${Date.now()}`, name: body.name ?? "LockStock Group", created_at: new Date().toISOString() }
        }
      ];
      return fulfill(201, { data: { id: state.organizations[0].organization.id, name: body.name ?? "LockStock Group" } });
    }

    const membersMatch = path.match(/^\/api\/organizations\/([^/]+)\/members$/);
    if (membersMatch && method === "GET") {
      return fulfill(200, { data: state.membersByOrg[membersMatch[1]] ?? [] });
    }

    if (path === "/api/billing/summary" && method === "GET") {
      return fulfill(200, { data: state.billingSummary });
    }

    if (path === "/api/billing/entitlements" && method === "GET") {
      return fulfill(200, { data: state.entitlements });
    }

    if (path === "/api/audit-log" && method === "GET") {
      return fulfill(200, { data: [] });
    }

    if (path === "/api/invitations/pending" && method === "GET") {
      return fulfill(200, { data: [] });
    }

    if (path === "/api/billing/start-trial" && method === "POST") {
      state.billingSummary = { ...state.billingSummary, status: "trialing", trial_ends_at: "2026-08-31T00:00:00.000Z" };
      return fulfill(201, { data: { orgId, trialEndsAt: state.billingSummary.trial_ends_at } });
    }

    if (path === "/api/billing/cancel" && method === "POST") {
      state.billingSummary = { ...state.billingSummary, cancel_at_period_end: true };
      return fulfill(200, { data: { cancelAtPeriodEnd: true } });
    }

    if (path === "/api/billing/reactivate" && method === "POST") {
      state.billingSummary = { ...state.billingSummary, cancel_at_period_end: false };
      return fulfill(200, { data: { cancelAtPeriodEnd: false } });
    }

    if (path === "/api/billing/portal-session" && method === "POST") {
      return fulfill(201, { data: { url: `${page.url().split("/").slice(0, 3).join("/")}/billing-portal` } });
    }

    if (path === "/api/reports/stock-health" && method === "GET") {
      return fulfill(200, { data: { total_materials: state.materials.length, total_quantity: 26, out_of_stock: 0, low_stock: 1 } });
    }

    if (path === "/api/alerts/low-stock" && method === "GET") {
      return fulfill(200, { data: [] });
    }

    if (path === "/api/locations" && method === "GET") {
      return fulfill(200, { data: state.locations, meta: { total: state.locations.length, page: 1, limit: 20, total_pages: 1 } });
    }

    if (path === "/api/suppliers" && method === "GET") {
      return fulfill(200, { data: state.suppliers, meta: { total: state.suppliers.length, page: 1, limit: 20, total_pages: 1 } });
    }

    if (path === "/api/materials" && method === "GET") {
      return fulfill(200, { data: state.materials, meta: { total: state.materials.length, page: 1, limit: 20, total_pages: 1 } });
    }

    if (path === "/api/stock/movements" && method === "GET") {
      return fulfill(200, { data: state.movements, meta: { total: state.movements.length, page: 1, limit: 20, total_pages: 1 } });
    }

    if (path === "/api/stock/movements" && method === "POST") {
      state.stockMovementPosts += 1;
      if (state.readOnlyStockFailure) {
        return fulfill(403, { error: state.readOnlyStockFailure });
      }
      state.movements = [
        {
          id: `move-${state.movements.length + 1}`,
          created_at: new Date().toISOString(),
          quantity_delta: 3,
          reason: "adjustment",
          note: null,
          material: { sku: "MAT-100", name: "Masonry Cement", uom: "BAG" },
          location: { code: "MAIN", name: "Main Warehouse" }
        },
        ...state.movements
      ];
      return fulfill(201, { data: { id: state.movements[0].id } });
    }

    if (path === "/api/purchase-orders" && method === "GET") {
      return fulfill(200, { data: state.purchaseOrders, meta: { total: state.purchaseOrders.length, page: 1, limit: 20, total_pages: 1 } });
    }

    const poStatusMatch = path.match(/^\/api\/purchase-orders\/([^/]+)\/status$/);
    if (poStatusMatch && method === "PATCH") {
      const body = request.postDataJSON() as { status: "sent" | "cancelled" };
      state.purchaseOrders = state.purchaseOrders.map((po) =>
        po.id === poStatusMatch[1]
          ? {
              ...po,
              status: body.status,
              sent_at: body.status === "sent" ? new Date("2026-08-16T10:00:00.000Z").toISOString() : po.sent_at,
              received_at: body.status === "cancelled" ? null : po.received_at
            }
          : po
      );
      return fulfill(200, { data: { id: poStatusMatch[1], status: body.status } });
    }

    const receiveMatch = path.match(/^\/api\/purchase-orders\/([^/]+)\/receive$/);
    if (receiveMatch && method === "POST") {
      state.purchaseOrders = state.purchaseOrders.map((po) =>
        po.id === receiveMatch[1]
          ? { ...po, status: "received", received_at: new Date("2026-08-16T10:05:00.000Z").toISOString() }
          : po
      );
      return fulfill(200, { data: { id: receiveMatch[1] } });
    }

    throw new Error(`Unhandled API request in E2E fixture: ${method} ${path}`);
  });
}

async function seedSignedInPage(page: Page) {
  await seedSession(page);
  await page.addInitScript(
    ({ orgKey, orgValue }) => {
      localStorage.setItem(orgKey, orgValue);
    },
    { orgKey: "lockstock.orgId", orgValue: orgId }
  );
}

type A11yNode = {
  role?: string;
  name?: string;
  children?: A11yNode[];
};

function collectA11yViolations(node: A11yNode | null, path: string[] = [], violations: string[] = []) {
  if (!node) {
    return violations;
  }

  const role = node.role ?? "";
  const name = typeof node.name === "string" ? node.name.trim() : "";
  const actionableRoles = new Set(["button", "checkbox", "combobox", "dialog", "link", "radio", "slider", "switch", "textbox", "tab", "menuitem"]);

  if (actionableRoles.has(role) && !name) {
    violations.push(`${[...path, role || "node"].join(" > ")} is missing an accessible name`);
  }

  for (const child of node.children ?? []) {
    collectA11yViolations(child, [...path, role || "node"], violations);
  }

  return violations;
}

test("landing sign-in redirects into the inventory shell", async ({ page }) => {
  await installAppRoutes(page, baseAppState());
  await installAuthRoutes(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Sign In" }).click();
  const authDialog = page.getByRole("dialog", { name: "Welcome back" });
  await expect(authDialog).toBeVisible();
  await authDialog.locator('input[type="email"]').fill("ava@northstar.build");
  await authDialog.locator('input[type="password"]').fill("strong-password");
  await authDialog.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole("heading", { name: "Inventory Management" })).toBeVisible();
});

test("contact page persists the selected locale and renders explicit French messages", async ({ page }) => {
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "FR" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { name: "Parlez-nous de vos operations d'inventaire" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { name: "Parlez-nous de vos operations d'inventaire" })).toBeVisible();
});

test("landing page renders French copy from message keys after a locale switch", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "FR", exact: true }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { name: /Maitrisez votre inventaire/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Tout ce dont vous avez besoin/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Demarrer/ })).toHaveCount(2);
});

test("payment trial start stores the workspace and opens inventory", async ({ page }) => {
  await seedSession(page);
  await installAppRoutes(page, baseAppState());
  await page.goto("/payment", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Start free trial" }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.locator("body")).toContainText("Inventory Management");
});

test("real platform me route rejects unauthenticated requests", async ({ page }) => {
  const response = await page.request.get("/api/platform/me");
  expect(response.status()).toBe(401);
});

test("critical pages stay accessible at desktop and mobile widths", async ({ page }) => {
  await installAppRoutes(page, baseAppState());
  await installAuthRoutes(page);

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Master Your Inventory/i })).toBeVisible();

  await seedSignedInPage(page);
  for (const viewportWidth of [1280, 375]) {
    await page.setViewportSize({ width: viewportWidth, height: 1200 });

    const scans: Array<{ path: string; heading: RegExp }> = [
      { path: "/account", heading: /^Account$/ },
      { path: "/inventory", heading: /^Inventory Management$/ },
      { path: "/payment", heading: /Pay for the capacity you need/i }
    ];

    for (const scan of scans) {
      await page.goto(scan.path, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: scan.heading })).toBeVisible();
      const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
      expect(collectA11yViolations(snapshot)).toEqual([]);
    }
  }
});

test("inventory page can switch workspaces after login", async ({ page }) => {
  const state = baseAppState();
  await seedSignedInPage(page);
  await installAppRoutes(page, state);

  await page.goto("/members", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Active group:")).toContainText("Northstar Materials");

  await page.getByRole("button", { name: "Open Group" }).click();
  await expect(page.getByText("Active group:")).toContainText("South Bay Logistics");
});

test("stock movement creation works and rejects read-only workspaces", async ({ page }) => {
  const state = baseAppState();
  await seedSignedInPage(page);
  await installAppRoutes(page, state);

  await page.goto("/stock-movements", { waitUntil: "domcontentloaded" });
  const moveDialog = page.getByRole("dialog", { name: "Move material" });
  await page.getByRole("button", { name: "Move Material" }).click();
  await expect(moveDialog).toBeVisible();
  await moveDialog.getByRole("combobox", { name: "Material" }).selectOption(materialId);
  await moveDialog.getByRole("combobox", { name: "Reason" }).selectOption("adjustment");
  await moveDialog.getByRole("combobox", { name: "Location" }).selectOption(locationId);
  await moveDialog.getByLabel("Quantity Delta").fill("3");
  await page.getByRole("button", { name: "Add to Stock" }).click();

  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody tr").first()).toContainText("3");
  expect(state.stockMovementPosts).toBe(1);

  state.readOnlyStockFailure = "Workspace is read-only.";
  state.entitlements = {
    ...state.entitlements,
    isReadOnly: true,
    accessReason: "trial_expired",
    billingStatus: "trialing"
  };

  await page.getByRole("button", { name: "Move Material" }).click();
  await expect(moveDialog).toBeVisible();
  await moveDialog.getByRole("combobox", { name: "Material" }).selectOption(materialId);
  await moveDialog.getByRole("combobox", { name: "Reason" }).selectOption("adjustment");
  await moveDialog.getByRole("combobox", { name: "Location" }).selectOption(locationId);
  await moveDialog.getByLabel("Quantity Delta").fill("3");
  await page.getByRole("button", { name: "Add to Stock" }).click();

  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody tr").first()).toContainText("3");
  expect(state.stockMovementPosts).toBe(2);
});

test("purchase orders and owner billing actions follow the critical path", async ({ page }) => {
  const state = baseAppState();
  await seedSignedInPage(page);
  await installAppRoutes(page, state);

  await page.goto("/purchase-orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Mark Sent" }).click();
  await expect(page.locator("tr", { hasText: "PO-2001" })).toContainText("SENT");

  await page.goto("/account", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Subscription" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel at renewal" }).click();
  await expect(page.getByText("Reactivate")).toBeVisible();
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("button", { name: "Cancel at renewal" })).toBeVisible();
});

test("members table keeps the desktop and mobile visual baseline", async ({ page }) => {
  await seedSignedInPage(page);
  await installAppRoutes(page, baseAppState());

  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/members", { waitUntil: "domcontentloaded" });
  const membersTable = page.getByTestId("members-section").locator("table").first();
  await expect(membersTable).toBeVisible();
  await page.mouse.move(1279, 1199);
  await expect(membersTable).toHaveScreenshot("members-desktop.png", { animations: "disabled" });

  await page.setViewportSize({ width: 375, height: 1200 });
  await page.mouse.move(374, 1199);
  await expect(membersTable).toHaveScreenshot("members-mobile.png", { animations: "disabled" });
});

test("landing shell keeps the desktop and mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const landing = page.locator("body");
  await expect(landing).toHaveScreenshot("landing-desktop.png", { animations: "disabled" });

  await page.setViewportSize({ width: 375, height: 1200 });
  await expect(landing).toHaveScreenshot("landing-mobile.png", { animations: "disabled" });
});

test("public page responsive shells keep the desktop and mobile visual baseline", async ({ page }) => {
  for (const path of ["/about", "/contact", "/pricing"]) {
    await page.setViewportSize({ width: 1280, height: 1200 });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toHaveScreenshot(`${path.slice(1)}-desktop.png`, { animations: "disabled" });

    await page.setViewportSize({ width: 375, height: 1200 });
    await expect(page.locator("body")).toHaveScreenshot(`${path.slice(1)}-mobile.png`, { animations: "disabled" });
  }
});
