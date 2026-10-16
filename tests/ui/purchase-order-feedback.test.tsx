import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const language = vi.hoisted(() => ({ locale: "en" as "en" | "fr" }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => language }));
import { WorkbenchPurchaseOrderForms as Forms } from "@/components/workbench/purchase-order-forms";
import { WorkbenchPurchaseOrdersSection as Orders } from "@/components/workbench/purchase-orders-section";

afterEach(() => { cleanup(); language.locale = "en"; });
const line = { id: "line", material_id: "mat", quantity_ordered: 10, quantity_received: 0, unit_price: 2 };
const po: ComponentProps<typeof Orders>["purchaseOrderTableRows"][number]["po"] = {
  id: "po", po_number: "PO-TEST", status: "draft", currency: "EUR", supplier: { id: "sup", name: "Supplier" }, lines: [line]
};
const warning = "The operation completed, but the latest data could not be loaded. Refresh data before starting another operation.";
function formProps(flow: "create" | "receive", overrides: Partial<ComponentProps<typeof Forms>> = {}): ComponentProps<typeof Forms> {
  return {
    busy: false, isOrgScopedReady: true, canManageCatalog: true, canReceivePurchaseOrders: true, onRefreshRequiredChange: vi.fn(),
    apiRequest: vi.fn().mockResolvedValue({}), onActivity: vi.fn(), onBusyChange: vi.fn(), onRefreshCoreData: vi.fn().mockResolvedValue(undefined),
    showPoCreateForm: flow === "create", showPoReceiveForm: flow === "receive",
    activeSuppliers: [{ id: "sup", name: "Supplier" }], activeMaterials: [{ id: "mat", sku: "MAT", name: "Cement", uom: "PC" }],
    activeLocations: [{ id: "loc", name: "Warehouse" }], purchaseOrders: [{ ...po, status: "sent" }],
    initialReceivePoId: "po", initialReceivePoLineId: "line", onClosePoCreateForm: vi.fn(), onClosePoReceiveForm: vi.fn(), ...overrides
  };
}
function prepare(flow: "create" | "receive") {
  if (flow === "create") {
    fireEvent.change(screen.getByRole("combobox", { name: "Supplier" }), { target: { value: "sup" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Material" }), { target: { value: "mat" } });
    fireEvent.change(screen.getByLabelText("Quantity", { exact: true }), { target: { value: "7" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Notes (optional)" }), { target: { value: "Keep note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
  } else {
    fireEvent.change(screen.getByRole("combobox", { name: "Location" }), { target: { value: "loc" } });
    fireEvent.change(screen.getByLabelText("Quantity Received", { exact: true }), { target: { value: "7" } });
  }
}
const submit = (flow: "create" | "receive") => screen.getByRole("button", { name: flow === "create" ? "Create Purchase Order" : "Receive" });

describe.each(["create", "receive"] as const)("purchase order %s feedback", flow => {
  it("shows failure inside the dialog, preserves the draft and allows a corrected retry", async () => {
    const props = formProps(flow, { apiRequest: vi.fn().mockRejectedValueOnce(new Error("Business rule rejected this operation.")).mockResolvedValueOnce({}) });
    render(<Forms {...props} />); prepare(flow); fireEvent.click(submit(flow));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Business rule rejected this operation.");
    expect(screen.getByRole("dialog")).toContainElement(alert);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Business rule rejected this operation.");
    if (flow === "create") expect(screen.getByRole("textbox", { name: "Notes (optional)" })).toHaveValue("Keep note");
    else expect(screen.getByLabelText("Quantity Received")).toHaveValue(7);
    expect(props.onRefreshCoreData).not.toHaveBeenCalled();
    fireEvent.click(submit(flow));
    await waitFor(() => expect(flow === "create" ? props.onClosePoCreateForm : props.onClosePoReceiveForm).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(props.apiRequest).toHaveBeenCalledTimes(2);
  });

  it("clears a dismissed failure before reopening", async () => {
    const props = formProps(flow, { apiRequest: vi.fn().mockRejectedValue(new Error("Cannot save.")) });
    const { rerender } = render(<Forms {...props} />); prepare(flow); fireEvent.click(submit(flow));
    await screen.findByRole("alert");
    rerender(<Forms {...props} showPoCreateForm={false} showPoReceiveForm={false} />);
    rerender(<Forms {...props} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes a committed mutation from refresh failure and only retries the refresh", async () => {
    const props = formProps(flow, { onRefreshCoreData: vi.fn().mockRejectedValueOnce(new Error("Private read error")).mockResolvedValueOnce(undefined) });
    render(<Forms {...props} />); prepare(flow); fireEvent.click(submit(flow));
    expect(await screen.findByRole("alert")).toHaveTextContent(warning);
    expect(submit(flow)).toBeDisabled();
    expect(flow === "create" ? props.onClosePoCreateForm : props.onClosePoReceiveForm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(flow === "create" ? props.onClosePoCreateForm : props.onClosePoReceiveForm).toHaveBeenCalledOnce());
    expect(props.apiRequest).toHaveBeenCalledOnce();
    expect(props.onRefreshCoreData).toHaveBeenCalledTimes(2);
    expect(props.onActivity).not.toHaveBeenCalledWith(expect.stringContaining("failed"));
    expect(screen.queryByText("Private read error")).not.toBeInTheDocument();
    expect(props.onRefreshRequiredChange).toHaveBeenNthCalledWith(1, true);
    expect(props.onRefreshRequiredChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps the page refresh guard raised when a committed form is dismissed", async () => {
    const props = formProps(flow, { onRefreshCoreData: vi.fn().mockRejectedValue(new Error("Read unavailable")) });
    render(<Forms {...props} />); prepare(flow); fireEvent.click(submit(flow));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(flow === "create" ? props.onClosePoCreateForm : props.onClosePoReceiveForm).toHaveBeenCalledOnce();
    expect(props.onRefreshRequiredChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(props.apiRequest).toHaveBeenCalledOnce();
  });

  it("uses a localized safe fallback for unexpected rejection values", async () => {
    language.locale = "fr";
    const props = formProps(flow, { apiRequest: vi.fn().mockRejectedValue({ details: "Private data" }) });
    render(<Forms {...props} />);
    if (flow === "create") {
      fireEvent.change(screen.getByRole("combobox", { name: "Fournisseur" }), { target: { value: "sup" } });
      fireEvent.change(screen.getByRole("combobox", { name: "Matériau" }), { target: { value: "mat" } });
      fireEvent.click(screen.getByRole("button", { name: "Ajouter l'article" }));
    } else fireEvent.change(screen.getByRole("combobox", { name: "Emplacement" }), { target: { value: "loc" } });
    fireEvent.click(screen.getByRole("button", { name: flow === "create" ? "Créer une commande" : "Receptionner" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Erreur serveur inattendue.");
    expect(screen.queryByText("Private data")).not.toBeInTheDocument();
  });
});

function orderProps(overrides: Partial<ComponentProps<typeof Orders>> = {}): ComponentProps<typeof Orders> {
  return {
    busy: false, canManageCatalog: true, canReceivePurchaseOrders: true, canExportCsv: false, refreshRequired: false, formOpen: false, onRefreshRequiredChange: vi.fn(),
    apiRequest: vi.fn().mockResolvedValue({}), onActivity: vi.fn(), onBusyChange: vi.fn(), onRefreshCoreData: vi.fn().mockResolvedValue(undefined),
    poTotal: 1, poPage: 1, poTotalPages: 1, poOverview: { totalOrders: 1, openOrders: 1, receivedOrders: 0, totalValue: 20, totalValueByCurrency: { EUR: 20, USD: 0 }, statusCounts: { draft: 1, sent: 0, partial: 0, received: 0, cancelled: 0 } },
    poFilterQuery: "", poFilterStatus: "all", poFilterSupplierId: "all", suppliers: [],
    purchaseOrderTableRows: [{ po, summary: { supplierLabel: "Supplier", lineCount: 1, linePreview: "MAT", totalOrdered: 10, totalReceived: 0, progressPercentage: 0, totalAmount: 20, currency: "EUR" } }],
    selectedPoDetails: null, pendingCancelPo: null, materials: [], tableSortState: undefined,
    onOpenCreatePurchaseOrderForm: vi.fn(), onOpenReceivePurchaseOrderForm: vi.fn(), onPrepareReceivePurchaseOrder: vi.fn(),
    onSelectedPoDetailsIdChange: vi.fn(), onPendingCancelPoChange: vi.fn(), onPoFilterQueryChange: vi.fn(), onPoFilterStatusChange: vi.fn(), onPoFilterSupplierIdChange: vi.fn(), onPoPageChange: vi.fn(), onExportCsv: vi.fn(), onSort: vi.fn(), ...overrides
  };
}
describe("purchase order status feedback", () => {
  it("blocks mutations after a dismissed form commit until a successful refresh", async () => {
    const props = orderProps({ refreshRequired: true, onRefreshCoreData: vi.fn().mockRejectedValueOnce(new Error("Read unavailable")).mockResolvedValueOnce(undefined) });
    const { rerender } = render(<Orders {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent(warning);
    for (const name of ["Create PO", "Receive order", "Mark Sent", "Cancel"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledOnce());
    expect(props.onRefreshRequiredChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(warning);
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(props.onRefreshRequiredChange).toHaveBeenCalledWith(false));
    rerender(<Orders {...props} refreshRequired={false} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(props.apiRequest).not.toHaveBeenCalled();
  });
  it("shows a failed send and keeps the action available for retry", async () => {
    const props = orderProps({ apiRequest: vi.fn().mockRejectedValueOnce(new Error("Cannot send this order.")).mockResolvedValueOnce({}) });
    render(<Orders {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Sent" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot send this order.");
    fireEvent.click(screen.getByRole("button", { name: "Mark Sent" }));
    await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows cancellation failure inside its confirmation dialog", async () => {
    const props = orderProps({ pendingCancelPo: po, apiRequest: vi.fn().mockRejectedValue(new Error("Already received.")) });
    render(<Orders {...props} />);
    const dialog = screen.getByRole("dialog", { name: "Confirm purchase order cancellation" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel PO" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Already received.");
    expect(props.onPendingCancelPoChange).not.toHaveBeenCalled();
  });

  it.each([false, true])("never repeats a committed status change when refresh fails (cancel=%s)", async cancel => {
    const props = orderProps({ pendingCancelPo: cancel ? po : null, onRefreshCoreData: vi.fn().mockRejectedValueOnce(new Error("Read failed")).mockResolvedValueOnce(undefined) });
    render(<Orders {...props} />);
    const action = cancel ? within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel PO" }) : screen.getByRole("button", { name: "Mark Sent" });
    fireEvent.click(action);
    expect(await screen.findByRole("alert")).toHaveTextContent(warning);
    expect(action).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledTimes(2));
    expect(props.apiRequest).toHaveBeenCalledOnce();
    expect(props.onActivity).not.toHaveBeenCalledWith(expect.stringContaining("failed"));
  });

  it.each([false, true])("uses a safe status error for unexpected rejection values (cancel=%s)", async cancel => {
    const props = orderProps({ pendingCancelPo: cancel ? po : null, apiRequest: vi.fn().mockRejectedValue({ details: "Private status data" }) });
    render(<Orders {...props} />);
    const scope = cancel ? within(screen.getByRole("dialog")) : screen;
    fireEvent.click(scope.getByRole("button", { name: cancel ? "Cancel PO" : "Mark Sent" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unexpected server error.");
    expect(screen.queryByText("Private status data")).not.toBeInTheDocument();
  });

  it("keeps stale actions blocked when a committed cancellation dialog is dismissed", async () => {
    const props = orderProps({ pendingCancelPo: po, onRefreshCoreData: vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce(undefined) });
    const { rerender } = render(<Orders {...props} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel PO" }));
    await within(dialog).findByRole("alert");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(props.onPendingCancelPoChange).toHaveBeenCalledWith(null);
    rerender(<Orders {...props} pendingCancelPo={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(warning);
    expect(screen.getByRole("button", { name: "Mark Sent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create PO" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(props.apiRequest).toHaveBeenCalledOnce();
  });

  it("clears a rejected cancellation when it is dismissed and another order is selected", async () => {
    const props = orderProps({ pendingCancelPo: po, apiRequest: vi.fn().mockRejectedValue(new Error("Unavailable")) });
    const { rerender } = render(<Orders {...props} />);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel PO" }));
    await screen.findByRole("alert");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "x" }));
    rerender(<Orders {...props} pendingCancelPo={{ ...po, id: "another", po_number: "PO-OTHER" }} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["sent", "partial", "received", "cancelled"] as const)("does not expose mutations to a viewer for a %s order", status => {
    const props = orderProps({ canManageCatalog: false, canReceivePurchaseOrders: false });
    props.purchaseOrderTableRows[0].po = { ...po, status };
    render(<Orders {...props} />);
    for (const name of ["Mark Sent", "Receive", "Create PO", "Cancel"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(props.apiRequest).not.toHaveBeenCalled();
  });
});
