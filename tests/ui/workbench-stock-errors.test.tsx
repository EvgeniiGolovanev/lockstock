import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import { WorkbenchStockMovementsSection } from "@/components/workbench/stock-movements-section";
afterEach(cleanup);

function setup(overrides: Partial<ComponentProps<typeof WorkbenchStockMovementsSection>> = {}) {
  const props: ComponentProps<typeof WorkbenchStockMovementsSection> = {
    busy: false, canCreateStockMovement: true, canExportCsv: false,
    apiRequest: vi.fn().mockResolvedValue({ data: { id: "movement" } }),
    onActivity: vi.fn(), onBusyChange: vi.fn(), onRefreshCoreData: vi.fn().mockResolvedValue(undefined),
    movementPage: 1, movementTotalPages: 1, movementFilterQuery: "",
    movementLocationFilter: "all", movementReasonFilter: "all",
    movementLocations: ["all"], movementReasons: ["all"], movementTableRows: [],
    movementSortState: undefined, showMovementForm: true,
    activeMaterials: [{ id: "mat", sku: "MAT", name: "Cement" }],
    activeLocations: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    onShowMovementFormChange: vi.fn(), onMovementFilterQueryChange: vi.fn(),
    onMovementLocationFilterChange: vi.fn(), onMovementReasonFilterChange: vi.fn(),
    onMovementPageChange: vi.fn(), onExportCsv: vi.fn(), onSort: vi.fn(), ...overrides
  };
  return { props, ...render(<WorkbenchStockMovementsSection {...props} />) };
}

describe("stock movement form errors", () => {
  it("shows an API failure inside the dialog, preserves inputs, and clears it on a successful retry", async () => {
    const apiRequest = vi.fn().mockRejectedValueOnce(new Error("Not enough quantity at the specified location.")).mockResolvedValueOnce({});
    const { props } = setup({ apiRequest });
    fireEvent.change(screen.getByLabelText("Quantity Delta"), { target: { value: "-101" } });
    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "Cycle count" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Not enough quantity at the specified location.");
    expect(screen.getByRole("dialog")).toContainElement(alert);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Not enough quantity at the specified location.");
    expect(screen.getByLabelText("Quantity Delta")).toHaveValue(-101);
    expect(screen.getByLabelText("Comments")).toHaveValue("Cycle count");
    expect(props.onRefreshCoreData).not.toHaveBeenCalled();
    expect(props.onActivity).toHaveBeenCalledWith("Create movement failed: Not enough quantity at the specified location.");
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByLabelText("Quantity Delta"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));
    await waitFor(() => expect(props.onRefreshCoreData).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears an old error when the form is closed and reopened", async () => {
    const { props, rerender } = setup({ apiRequest: vi.fn().mockRejectedValue(new Error("Location is unavailable or blocked for usage.")) });
    fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));
    await screen.findByRole("alert");
    rerender(<WorkbenchStockMovementsSection {...props} showMovementForm={false} />);
    rerender(<WorkbenchStockMovementsSection {...props} showMovementForm={true} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses a safe fallback for an unexpected rejection value", async () => {
    setup({ apiRequest: vi.fn().mockRejectedValue({ details: "Private database details" }) });
    fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unexpected server error.");
    expect(screen.queryByText("Private database details")).not.toBeInTheDocument();
  });

  it.each([
    ["missing material", "adjustment", "material", "", "material is required."],
    ["missing transfer destination", "transfer", "destination", "", "source and destination locations are required."],
    ["same transfer location", "transfer", "destination", "a", "transfer source and destination must differ."],
    ["zero transfer", "transfer", "quantity", "0", "transfer quantity must be positive."],
    ["zero adjustment", "adjustment", "quantity", "0", "location and non-zero quantity are required."]
  ])("shows local validation for %s without sending a request", async (_name, reason, field, value, message) => {
    const { props } = setup(value === "" ? field === "material" ? { activeMaterials: [] } : { activeLocations: [] } : {});
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: reason } });
    const label = field === "material" ? "Material" : field === "destination" ? "Transfer to" : reason === "transfer" ? "Quantity" : "Quantity Delta";
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Add to Stock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(props.apiRequest).not.toHaveBeenCalled();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });
});
