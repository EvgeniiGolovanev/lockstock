import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";

const LATEST_LIMIT = 20;
const MAX_EXPORT_DAYS = 366;

type AuditLogRow = {
  id?: string;
  org_id?: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  message: string;
  metadata: unknown;
  created_at: string;
};

function parseDateOnly(value: string | null, label: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${label} must use YYYY-MM-DD format.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${label} must be a valid date.`);
  }

  return date;
}

function endOfUtcDate(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: AuditLogRow[]) {
  const header = ["created_at", "actor_user_id", "action", "entity_type", "entity_id", "entity_label", "message", "metadata"];
  const body = rows.map((row) =>
    [
      row.created_at,
      row.actor_user_id ?? "",
      row.action,
      row.entity_type,
      row.entity_id ?? "",
      row.entity_label ?? "",
      row.message,
      row.metadata ?? {}
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...body].join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, role, supabase } = await requireRequestContext(request);
    const format = request.nextUrl.searchParams.get("format");

    if (format === "csv") {
      requireMinRole(role, "manager");

      const fromValue = request.nextUrl.searchParams.get("from");
      const toValue = request.nextUrl.searchParams.get("to");
      const fromDate = parseDateOnly(fromValue, "from");
      parseDateOnly(toValue, "to");
      const toEnd = endOfUtcDate(toValue as string);

      if (fromDate > toEnd) {
        throw new ApiError(400, "from must be on or before to.");
      }

      const days = (toEnd.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000);
      if (days > MAX_EXPORT_DAYS) {
        throw new ApiError(400, `Export range cannot exceed ${MAX_EXPORT_DAYS} days.`);
      }

      const { data, error } = await supabase
        .from("audit_log")
        .select("created_at,actor_user_id,action,entity_type,entity_id,entity_label,message,metadata")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .gte("created_at", fromDate.toISOString())
        .lte("created_at", toEnd.toISOString());

      if (error) {
        throw error;
      }

      const filename = `audit-log-${fromValue}-${toValue}.csv`;
      return new NextResponse(toCsv((data ?? []) as AuditLogRow[]), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`
        }
      });
    }

    const { data, error, count } = await supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(LATEST_LIMIT)
      .range(0, LATEST_LIMIT - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: data ?? [],
      meta: {
        limit: LATEST_LIMIT,
        total: count ?? (data ?? []).length
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
