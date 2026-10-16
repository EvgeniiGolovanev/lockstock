import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const settings = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: settings.locale }) }));
import { ListReadBoundary } from "@/components/workbench/list-read-boundary";
import { WorkbenchMaterialsSection } from "@/components/workbench/materials-section";
afterEach(cleanup);

const props = {
  busy: false, canExportCsv: true, canManageCatalog: true, isOrgScopedReady: true,
  materialPage: 1, materialTotalPages: 1, materialTableRows: [], materialSearchQuery: "",
  materialCategoryFilter: "all", materialSubcategoryFilter: "all", materialCategoryOptions: [], materialFilterSubcategories: [],
  onCreateMaterial: vi.fn(), onEditMaterial: vi.fn(), onToggleMaterialUsage: vi.fn(), onExportCsv: vi.fn(),
  onMaterialSearchChange: vi.fn(), onMaterialCategoryFilterChange: vi.fn(), onMaterialSubcategoryFilterChange: vi.fn(), onMaterialPageChange: vi.fn(), onSort: vi.fn()
};

it.each([
  ["en", "Loading data", "Could not load data", "Retry", "No materials match these filters."],
  ["fr", "Chargement des données", "Impossible de charger les données", "Réessayer", "Aucun materiau ne correspond a ces filtres."]
])("distinguishes loading, error and a successful empty result in %s", (locale, loading, error, retry, empty) => {
  settings.locale = locale;
  const onRetry = vi.fn();
  const view = render(<ListReadBoundary state={{ phase: "loading", hasData: false }} enabled onRetry={onRetry}><WorkbenchMaterialsSection {...props} /></ListReadBoundary>);
  expect(screen.getByRole("status")).toHaveTextContent(loading);
  expect(screen.queryByText(empty)).not.toBeInTheDocument();
  expect(view.container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  view.rerender(<ListReadBoundary state={{ phase: "error", hasData: true }} enabled onRetry={onRetry}><WorkbenchMaterialsSection {...props} /></ListReadBoundary>);
  expect(screen.getByRole("alert")).toHaveTextContent(error);
  expect(screen.queryByText(empty)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: retry })); expect(onRetry).toHaveBeenCalledOnce();
  view.rerender(<ListReadBoundary state={{ phase: "ready", hasData: true }} enabled onRetry={onRetry}><WorkbenchMaterialsSection {...props} /></ListReadBoundary>);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.getByText(empty)).toBeVisible();
  view.rerender(<ListReadBoundary state={{ phase: "error", hasData: false }} enabled={false} onRetry={onRetry}><WorkbenchMaterialsSection {...props} /></ListReadBoundary>);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.getByText(empty)).toBeVisible();
});
