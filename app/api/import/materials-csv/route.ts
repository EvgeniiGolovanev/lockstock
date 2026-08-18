import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { createCorrelationId } from "@/lib/api/correlation-id";
import { requireMinRole, requireRequestContext } from "@/lib/api/route-context";
import { requireWithinPlanLimit } from "@/lib/billing/entitlements";
import {
  MaterialsCsvValidationError,
  MaterialsCsvRowLimitError,
  MAX_MATERIALS_CSV_ROWS,
  normalizeMaterialsCsvImport
} from "@/lib/import/materials-csv";

const MAX_MATERIALS_CSV_BYTES = 5 * 1024 * 1024;

async function readCsvBody(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MATERIALS_CSV_BYTES) {
    throw new ApiError(413, "CSV file is too large. Maximum size is 5 MiB.");
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MATERIALS_CSV_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "CSV file is too large. Maximum size is 5 MiB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new MaterialsCsvValidationError([
      { row: 1, field: "file", message: "CSV must be UTF-8 encoded." }
    ]);
  }
}

export async function POST(request: NextRequest) {
  let effectivePlan = "current";
  let csvRowLimit: number | null = null;
  try {
    const { orgId, userId, role, entitlements, supabase } = await requireRequestContext(request);
    effectivePlan = entitlements.effectivePlan;
    requireMinRole(role, "manager");

    const csv = await readCsvBody(request);
    csvRowLimit = entitlements.limits.csvImportRows;
    const parsed = normalizeMaterialsCsvImport(csv, {
      maxRows: csvRowLimit === null ? MAX_MATERIALS_CSV_ROWS : Math.min(csvRowLimit, MAX_MATERIALS_CSV_ROWS)
    });
    requireWithinPlanLimit(entitlements, "csvImportRows", 0, parsed.inputRowCount);

    if (parsed.rows.length === 0) {
      return NextResponse.json({ data: { inserted: 0, updated: 0, duplicates: 0, materials: [] } });
    }

    const { count: currentMaterialCount, error: currentMaterialCountError } = await supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (currentMaterialCountError) {
      throw currentMaterialCountError;
    }

    const { data: existingMaterials, error: existingMaterialsError } = await supabase
      .from("materials")
      .select("sku")
      .eq("org_id", orgId)
      .in(
        "sku",
        parsed.rows.map((row) => row.sku)
      );

    if (existingMaterialsError) {
      throw existingMaterialsError;
    }

    const existingSkus = new Set((existingMaterials ?? []).map((material) => (material as { sku?: string | null }).sku).filter((sku): sku is string => typeof sku === "string" && sku.length > 0));
    const newMaterialRows = parsed.rows.filter((row) => !existingSkus.has(row.sku));
    requireWithinPlanLimit(entitlements, "materials", Number(currentMaterialCount ?? 0), newMaterialRows.length);

    const rows = parsed.rows.map((item) => ({
      org_id: orgId,
      created_by: userId,
      sku: item.sku,
      name: item.name,
      uom: item.uom,
      min_stock: Number.isFinite(item.min_stock) ? item.min_stock : 0,
      is_active: true
    }));

    if (rows.length === 0) {
      return NextResponse.json({ data: { inserted: 0, updated: 0, duplicates: 0, materials: [] } });
    }

    const { data, error } = await supabase
      .from("materials")
      .upsert(rows, { onConflict: "org_id,sku", ignoreDuplicates: false })
      .select("id,sku,name,uom,min_stock");

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: {
        inserted: newMaterialRows.length,
        updated: rows.length - newMaterialRows.length,
        duplicates: parsed.duplicateSkus.length,
        materials: data
      }
    }, { status: 201 });
  } catch (error) {
    if (error instanceof MaterialsCsvRowLimitError) {
      if (csvRowLimit === null || csvRowLimit > MAX_MATERIALS_CSV_ROWS) {
        return handleApiError(new ApiError(413, `CSV has too many rows. Maximum is ${MAX_MATERIALS_CSV_ROWS}.`));
      }
      return handleApiError(new ApiError(403, `The ${effectivePlan} plan limit for csvImportRows has been reached.`));
    }

    if (error instanceof MaterialsCsvValidationError) {
      const requestId = createCorrelationId();
      return NextResponse.json({
        error: "CSV validation failed.",
        code: "validation_failed",
        requestId,
        details: { issues: error.issues }
      }, { status: 400, headers: { "x-request-id": requestId } });
    }

    return handleApiError(error);
  }
}
