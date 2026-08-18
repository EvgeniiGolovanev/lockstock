import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { createTeamSchema } from "@/lib/validators/team";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { orgId, supabase } = await requireRequestContext(request);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("teams")
      .select("*, members:team_members(user_id)", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const total = count ?? 0;

    return NextResponse.json({
      data: data ?? [],
      meta: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, role, supabase } = await requireRequestContext(request);
    requireMinRole(role, "manager");
    const payload = createTeamSchema.parse(await request.json());

    const { data, error } = await supabase.rpc("create_team_with_owner", {
      p_org_id: orgId,
      p_name: payload.name,
      ...(payload.description ? { p_description: payload.description } : {})
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
