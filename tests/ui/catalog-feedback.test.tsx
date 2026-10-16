import "@testing-library/jest-dom/vitest";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkbenchCatalogForms } from "@/components/workbench/catalog-forms";
import { WorkbenchSuppliersSection } from "@/components/workbench/suppliers-section";
import { MATERIAL_DUPLICATE_SKU_ERROR } from "@/lib/material-errors";

vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: "en" }) }));
afterEach(cleanup);

const location = { id: "l1", name: "Warehouse", code: "WH", address: "Paris", is_active: true, created_at: "2026-10-16", material_count: 0, total_quantity: 0 };
const material = { id: "m1", sku: "MAT-1", name: "Cement", uom: "PC", category: "Structural & Building Materials", subcategory: "Concrete & cement", min_stock: 10, is_active: true, created_at: "2026-10-16", total_quantity: 0, primary_location: "", stock_status: "in-stock", balances: [] };
const supplier = { id: "s1", vendor_number: 1, name: "Vendor", lead_time_days: 5, is_active: true, created_at: "2026-10-16" };
type CatalogProps = ComponentProps<typeof WorkbenchCatalogForms>;
type SupplierProps = ComponentProps<typeof WorkbenchSuppliersSection>;
function base() {
  return { busy: false, canManageCatalog: true, isOrgScopedReady: true, apiRequest: vi.fn().mockRejectedValueOnce(new Error("Permission changed. Please retry.")).mockResolvedValue({}), onActivity: vi.fn(), onBusyChange: vi.fn(), onRefreshCoreData: vi.fn().mockResolvedValue(undefined) };
}
function catalogProps(): CatalogProps {
  return { ...base(), locale: "en", showLocationForm: false, editingLocation: null, pendingLocationUsageChange: null, showMaterialCreateForm: false, editingMaterial: null, pendingMaterialUsageChange: null, onCloseLocationForm: vi.fn(), onClosePendingLocationUsageChange: vi.fn(), onCloseMaterialCreateForm: vi.fn(), onCloseEditMaterialForm: vi.fn(), onClosePendingMaterialUsageChange: vi.fn() };
}
function supplierProps(): SupplierProps {
  return { ...base(), canExportCsv: false, hasSuppliers: true, supplierPage: 1, supplierTotalPages: 1, supplierTableRows: [], supplierSearchQuery: "", supplierStatusFilter: "all", showSupplierForm: false, editingSupplier: null, pendingSupplierUsageChange: null, onCreateSupplier: vi.fn(), onEditSupplier: vi.fn(), onToggleSupplierUsage: vi.fn(), onCloseSupplierForm: vi.fn(), onClosePendingSupplierUsageChange: vi.fn(), onExportCsv: vi.fn(), onSupplierSearchChange: vi.fn(), onSupplierStatusFilterChange: vi.fn(), onSupplierPageChange: vi.fn() };
}
const cases = [
  { name: "location creation", catalog: { showLocationForm: true }, submit: "Create Location", close: "onCloseLocationForm" },
  { name: "location editing", catalog: { showLocationForm: true, editingLocation: location }, submit: "Save Location", close: "onCloseLocationForm" },
  { name: "location usage", catalog: { pendingLocationUsageChange: location }, submit: "Confirm", close: "onClosePendingLocationUsageChange" },
  { name: "material creation", catalog: { showMaterialCreateForm: true }, submit: "Create Material", close: "onCloseMaterialCreateForm" },
  { name: "material editing", catalog: { editingMaterial: material }, submit: "Save changes", close: "onCloseEditMaterialForm" },
  { name: "material usage", catalog: { pendingMaterialUsageChange: material }, submit: "Confirm", close: "onClosePendingMaterialUsageChange" },
  { name: "supplier creation", supplier: { showSupplierForm: true }, submit: "Create Supplier", close: "onCloseSupplierForm" },
  { name: "supplier editing", supplier: { showSupplierForm: true, editingSupplier: supplier }, submit: "Update Vendor", close: "onCloseSupplierForm" },
  { name: "supplier usage", supplier: { pendingSupplierUsageChange: supplier }, submit: "Confirm", close: "onClosePendingSupplierUsageChange" },
] as const;

function setup(entry: typeof cases[number]) {
  const cat = { ...catalogProps(), ...("catalog" in entry ? entry.catalog : {}) } as CatalogProps;
  const sup = { ...supplierProps(), ...("supplier" in entry ? entry.supplier : {}) } as SupplierProps;
  const props = "catalog" in entry ? cat : sup;
  const element = () => "catalog" in entry ? <WorkbenchCatalogForms {...cat} /> : <WorkbenchSuppliersSection {...sup} />;
  const rendered = render(element());
  return { props, cat, sup, element, ...rendered };
}

describe("catalog mutation feedback", () => {
  for (const entry of cases) {
    it(`${entry.name}: shows rejection, preserves input and safely retries`, async () => {
      const { props } = setup(entry);
      const dialog = screen.getByRole("dialog");
      // Enter every editable field, including optional metadata and selections.
      for (const input of dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input:not([readonly]),textarea,select")) {
        const value = input instanceof HTMLSelectElement ? input.options[input.options.length - 1].value : input.type === "number" ? "12" : "Preserved draft";
        fireEvent.change(input, { target: { value } });
      }
      const fields = Array.from(dialog.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")).map(field => [field, field.value] as const);
      fireEvent.click(within(dialog).getByRole("button", { name: entry.submit }));
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent("Permission changed. Please retry.");
      expect(dialog).toHaveAccessibleDescription("Permission changed. Please retry.");
      for (const [field, value] of fields) expect(field.value).toBe(value);
      expect(props.onRefreshCoreData).not.toHaveBeenCalled();
      expect((props as unknown as Record<string, ReturnType<typeof vi.fn>>)[entry.close]).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: entry.submit }));
      await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledTimes(1));
      expect(props.apiRequest).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });

    it(`${entry.name}: a committed write retries only reads, including after reopening`, async () => {
      const { props, cat, sup, element, rerender } = setup(entry);
      vi.mocked(props.apiRequest).mockReset().mockResolvedValue({});
      vi.mocked(props.onRefreshCoreData).mockRejectedValueOnce(new Error("Internal read detail")).mockResolvedValue(undefined);
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: entry.submit }));
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent("The operation completed");
      expect(screen.getByRole("alert")).not.toHaveTextContent("Internal read detail");
      expect(within(screen.getByRole("dialog")).getByRole("button", { name: entry.submit })).toBeDisabled();
      const active = { cat: { ...cat }, sup: { ...sup } };
      Object.assign(cat, { showLocationForm: false, editingLocation: null, pendingLocationUsageChange: null, showMaterialCreateForm: false, editingMaterial: null, pendingMaterialUsageChange: null });
      Object.assign(sup, { showSupplierForm: false, editingSupplier: null, pendingSupplierUsageChange: null });
      rerender(element());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      Object.assign(cat, active.cat); Object.assign(sup, active.sup); rerender(element());
      await expect(screen.findByRole("alert")).resolves.toHaveTextContent("The operation completed");
      fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
      await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledTimes(2));
      expect(props.apiRequest).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });
  }

  it("clears rejected feedback on dismissal and safely handles a non-Error rejection in French", async () => {
    const props = { ...catalogProps(), locale: "fr" as const, showLocationForm: true };
    vi.mocked(props.apiRequest).mockReset().mockRejectedValue({ internal: "secret" });
    const { rerender } = render(<WorkbenchCatalogForms {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Creer l'emplacement" }));
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent("L'operation n'a pas pu etre effectuee. Veuillez reessayer.");
    rerender(<WorkbenchCatalogForms {...props} showLocationForm={false} />);
    rerender(<WorkbenchCatalogForms {...props} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows material required-field validation without a request, then reports a duplicate SKU", async () => {
    const props = { ...catalogProps(), showMaterialCreateForm: true };
    render(<WorkbenchCatalogForms {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "SKU" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Material" }));
    expect(screen.getByRole("alert")).toHaveTextContent("required");
    expect(props.apiRequest).not.toHaveBeenCalled();
    vi.mocked(props.apiRequest).mockReset().mockRejectedValueOnce(new Error(MATERIAL_DUPLICATE_SKU_ERROR)).mockResolvedValue({});
    fireEvent.change(screen.getByRole("textbox", { name: "SKU" }), { target: { value: "EXISTING" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Material" }));
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(/SKU|number/);
    expect(screen.getByRole("textbox", { name: /^SKU/ })).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByRole("textbox", { name: /^SKU/ }), { target: { value: "UNIQUE" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Material" }));
    await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledTimes(1));
  });

  it("validates required material edits before saving", () => {
    const props = { ...catalogProps(), editingMaterial: material } as CatalogProps;
    render(<WorkbenchCatalogForms {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum stock" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("required");
    expect(props.apiRequest).not.toHaveBeenCalled();
  });

  for (const entry of cases.filter(entry => entry.name.endsWith("usage"))) {
    it(`${entry.name}: unblocks the selected record`, async () => {
      const { props, cat, sup, element, rerender } = setup(entry);
      for (const key of ["pendingLocationUsageChange", "pendingMaterialUsageChange"] as const) {
        if (cat[key]) cat[key] = { ...cat[key], is_active: false } as never;
      }
      if (sup.pendingSupplierUsageChange) sup.pendingSupplierUsageChange = { ...sup.pendingSupplierUsageChange, is_active: false };
      vi.mocked(props.apiRequest).mockReset().mockResolvedValue({});
      rerender(element());
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => expect(props.apiRequest).toHaveBeenCalledWith(expect.any(String), { method: "PATCH", body: { is_active: true } }));
      await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledTimes(1));
    });
  }
});
