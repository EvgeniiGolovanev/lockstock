import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { logPlatformAccess, requirePlatformAdmin } from "@/lib/api/platform-admin";

const TENANT_LIMIT = 25;
const AUDIT_LIMIT = 12;

type OrganizationRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type OrgUserRow = {
  org_id: string;
  user_id: string;
  role: string;
};

type OrgScopedRow = {
  org_id: string;
  id: string;
};

type PurchaseOrderRow = OrgScopedRow & {
  status: string;
};

type StockMovementRow = OrgScopedRow & {
  created_at: string;
};

type BillingRow = {
  org_id: string;
  plan: string;
  status: string;
  billing_interval: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  updated_at: string;
};

type AuditLogRow = {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  message: string;
  metadata: unknown;
  created_at: string;
};

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countByOrg(rows: OrgScopedRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    increment(counts, row.org_id);
  }
  return counts;
}

function latestMovementByOrg(rows: StockMovementRow[]) {
  const latest = new Map<string, string>();
  for (const row of rows) {
    const previous = latest.get(row.org_id);
    if (!previous || row.created_at > previous) {
      latest.set(row.org_id, row.created_at);
    }
  }
  return latest;
}

async function requireData<T>(result: { data: T | null; error: { message?: string } | null }, label: string): Promise<T> {
  if (result.error) {
    throw new ApiError(500, `Failed to load ${label}.`, result.error.message);
  }

  return result.data ?? ([] as T);
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePlatformAdmin(request);
    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    let organizationQuery = context.supabase
      .from("organizations")
      .select("id,name,created_at,updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(TENANT_LIMIT);

    if (search) {
      organizationQuery = organizationQuery.ilike("name", `%${search}%`);
    }

    const [
      organizationsResult,
      orgUsersResult,
      userProfilesResult,
      materialsResult,
      locationsResult,
      stockMovementsResult,
      purchaseOrdersResult,
      billingResult,
      auditResult
    ] = await Promise.all([
      organizationQuery,
      context.supabase.from("org_users").select("org_id,user_id,role"),
      context.supabase.from("user_profiles").select("user_id", { count: "exact", head: true }),
      context.supabase.from("materials").select("org_id,id"),
      context.supabase.from("locations").select("org_id,id"),
      context.supabase.from("stock_movements").select("org_id,id,created_at"),
      context.supabase.from("purchase_orders").select("org_id,id,status"),
      context.supabase
        .from("organization_billing")
        .select("org_id,plan,status,billing_interval,current_period_end,trial_ends_at,updated_at"),
      context.supabase
        .from("audit_log")
        .select("id,org_id,actor_user_id,action,entity_type,entity_label,message,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(AUDIT_LIMIT)
    ]);

    const organizations = await requireData<OrganizationRow[]>(organizationsResult, "organizations");
    const orgUsers = await requireData<OrgUserRow[]>(orgUsersResult, "organization users");
    const materials = await requireData<OrgScopedRow[]>(materialsResult, "materials");
    const locations = await requireData<OrgScopedRow[]>(locationsResult, "locations");
    const stockMovements = await requireData<StockMovementRow[]>(stockMovementsResult, "stock movements");
    const purchaseOrders = await requireData<PurchaseOrderRow[]>(purchaseOrdersResult, "purchase orders");
    const billingRows = await requireData<BillingRow[]>(billingResult, "billing plans");
    const auditRows = await requireData<AuditLogRow[]>(auditResult, "audit log");

    if (userProfilesResult.error) {
      throw new ApiError(500, "Failed to load registered users.", userProfilesResult.error.message);
    }

    const organizationNames = new Map(organizations.map((organization) => [organization.id, organization.name]));
    const usersByOrg = countByOrg(orgUsers.map((row) => ({ org_id: row.org_id, id: row.user_id })));
    const materialsByOrg = countByOrg(materials);
    const locationsByOrg = countByOrg(locations);
    const movementsByOrg = countByOrg(stockMovements);
    const purchaseOrdersByOrg = countByOrg(purchaseOrders);
    const latestMovement = latestMovementByOrg(stockMovements);
    const billingByOrg = new Map(billingRows.map((row) => [row.org_id, row]));

    const openPurchaseOrdersByOrg = new Map<string, number>();
    for (const row of purchaseOrders) {
      if (row.status !== "received" && row.status !== "cancelled") {
        increment(openPurchaseOrdersByOrg, row.org_id);
      }
    }

    const tenants = organizations.map((organization) => {
      const billing = billingByOrg.get(organization.id);

      return {
        id: organization.id,
        name: organization.name,
        createdAt: organization.created_at,
        updatedAt: organization.updated_at,
        plan: billing?.plan ?? "starter",
        billingStatus: billing?.status ?? "trialing",
        billingInterval: billing?.billing_interval ?? "monthly",
        currentPeriodEnd: billing?.current_period_end ?? null,
        trialEndsAt: billing?.trial_ends_at ?? null,
        billingUpdatedAt: billing?.updated_at ?? null,
        users: usersByOrg.get(organization.id) ?? 0,
        materials: materialsByOrg.get(organization.id) ?? 0,
        locations: locationsByOrg.get(organization.id) ?? 0,
        stockMovements: movementsByOrg.get(organization.id) ?? 0,
        purchaseOrders: purchaseOrdersByOrg.get(organization.id) ?? 0,
        openPurchaseOrders: openPurchaseOrdersByOrg.get(organization.id) ?? 0,
        lastActivityAt: latestMovement.get(organization.id) ?? null
      };
    });

    const tenantUsers = new Set(orgUsers.map((row) => row.user_id));
    const recentAudit = auditRows.map((row) => ({
      ...row,
      organizationName: organizationNames.get(row.org_id) ?? "Unknown organization"
    }));

    await logPlatformAccess(context, "platform.overview.read", {
      search: search || null,
      tenantCount: tenants.length,
      auditCount: recentAudit.length
    });

    return NextResponse.json({
      metrics: {
        totalOrganizations: organizationsResult.count ?? organizations.length,
        registeredUsers: userProfilesResult.count ?? tenantUsers.size,
        tenantUsers: tenantUsers.size,
        totalMaterials: materials.length,
        totalLocations: locations.length,
        totalStockMovements: stockMovements.length,
        totalPurchaseOrders: purchaseOrders.length,
        openPurchaseOrders: Array.from(openPurchaseOrdersByOrg.values()).reduce((sum, value) => sum + value, 0)
      },
      tenants,
      recentAudit,
      meta: {
        tenantLimit: TENANT_LIMIT,
        auditLimit: AUDIT_LIMIT,
        search: search || null
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
