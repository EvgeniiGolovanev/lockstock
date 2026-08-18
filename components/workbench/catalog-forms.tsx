"use client";

import { useEffect, useState } from "react";

import { message, type Locale, type StaticMessageKey } from "@/lib/i18n";
import { MATERIAL_CATEGORIES, getMaterialSubcategories, type MaterialCategory } from "@/lib/material-categories";
import { MATERIAL_DUPLICATE_SKU_ERROR } from "@/lib/material-errors";
import { MATERIAL_UNITS, formatMaterialUnitLabel } from "@/lib/material-units";
import { materialDuplicateSkuMessage, validateMaterialDraftRequiredFields, type MaterialDraftRequiredField } from "@/lib/ui/material-form";
import styles from "./catalog-forms.module.css";

import type { WorkbenchLocation } from "./locations-section";
import type { WorkbenchMaterial } from "./materials-section";

type CatalogFormsProps = {
  busy: boolean;
  canManageCatalog: boolean;
  isOrgScopedReady: boolean;
  locale: Locale;
  apiRequest: <T>(
    path: string,
    options?: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      body?: Record<string, unknown>;
      orgOverride?: string;
      requireOrg?: boolean;
      tokenOverride?: string;
    }
  ) => Promise<T>;
  onActivity: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
  onRefreshCoreData: () => Promise<void>;
  showLocationForm: boolean;
  editingLocation: WorkbenchLocation | null;
  pendingLocationUsageChange: WorkbenchLocation | null;
  onCloseLocationForm: () => void;
  onClosePendingLocationUsageChange: () => void;
  showMaterialCreateForm: boolean;
  editingMaterial: WorkbenchMaterial | null;
  pendingMaterialUsageChange: WorkbenchMaterial | null;
  onCloseMaterialCreateForm: () => void;
  onCloseEditMaterialForm: () => void;
  onClosePendingMaterialUsageChange: () => void;
};

export function WorkbenchCatalogForms({
  busy,
  canManageCatalog,
  isOrgScopedReady,
  locale,
  apiRequest,
  onActivity,
  onBusyChange,
  onRefreshCoreData,
  showLocationForm,
  editingLocation,
  pendingLocationUsageChange,
  onCloseLocationForm,
  onClosePendingLocationUsageChange,
  showMaterialCreateForm,
  editingMaterial,
  pendingMaterialUsageChange,
  onCloseMaterialCreateForm,
  onCloseEditMaterialForm,
  onClosePendingMaterialUsageChange
}: CatalogFormsProps) {
  const t = (key: StaticMessageKey) => message(locale, key);
  const [locationName, setLocationName] = useState("Main Warehouse");
  const [locationCode, setLocationCode] = useState("MAIN");
  const [locationAddress, setLocationAddress] = useState("");
  const [materialSku, setMaterialSku] = useState("MAT-001");
  const [materialName, setMaterialName] = useState("Cement");
  const [materialCategory, setMaterialCategory] = useState<MaterialCategory>(MATERIAL_CATEGORIES[0]);
  const [materialSubcategory, setMaterialSubcategory] = useState(
    MATERIAL_CATEGORIES[0] ? "" : ""
  );
  const [materialUom, setMaterialUom] = useState("BAG");
  const [materialMinStock, setMaterialMinStock] = useState("10");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialSkuDuplicate, setMaterialSkuDuplicate] = useState(false);
  const [materialRequiredErrors, setMaterialRequiredErrors] = useState<MaterialDraftRequiredField[]>([]);
  const [editMaterialName, setEditMaterialName] = useState("");
  const [editMaterialCategory, setEditMaterialCategory] = useState<MaterialCategory>(MATERIAL_CATEGORIES[0]);
  const [editMaterialSubcategory, setEditMaterialSubcategory] = useState("");
  const [editMaterialMinStock, setEditMaterialMinStock] = useState("");
  const [editMaterialDescription, setEditMaterialDescription] = useState("");
  const [editMaterialRequiredErrors, setEditMaterialRequiredErrors] = useState<MaterialDraftRequiredField[]>([]);
  const availableMaterialSubcategories = getMaterialSubcategories(materialCategory);
  const availableEditMaterialSubcategories = getMaterialSubcategories(editMaterialCategory);

  useEffect(() => {
    if (showLocationForm) {
      if (editingLocation) {
        setLocationName(editingLocation.name);
        setLocationCode(editingLocation.code ?? "");
        setLocationAddress(editingLocation.address ?? "");
      } else {
        setLocationName("Main Warehouse");
        setLocationCode("MAIN");
        setLocationAddress("");
      }
      return;
    }

    setLocationName("Main Warehouse");
    setLocationCode("MAIN");
    setLocationAddress("");
  }, [editingLocation, showLocationForm]);

  useEffect(() => {
    if (showMaterialCreateForm) {
      setMaterialSku("MAT-001");
      setMaterialName("Cement");
      setMaterialCategory(MATERIAL_CATEGORIES[0]);
      setMaterialSubcategory(getMaterialSubcategories(MATERIAL_CATEGORIES[0])[0] ?? "");
      setMaterialUom("BAG");
      setMaterialMinStock("10");
      setMaterialDescription("");
      setMaterialSkuDuplicate(false);
      setMaterialRequiredErrors([]);
      return;
    }

    setMaterialSku("MAT-001");
    setMaterialName("Cement");
    setMaterialCategory(MATERIAL_CATEGORIES[0]);
    setMaterialSubcategory(getMaterialSubcategories(MATERIAL_CATEGORIES[0])[0] ?? "");
    setMaterialUom("BAG");
    setMaterialMinStock("10");
    setMaterialDescription("");
    setMaterialSkuDuplicate(false);
    setMaterialRequiredErrors([]);
  }, [showMaterialCreateForm]);

  useEffect(() => {
    if (!showMaterialCreateForm) {
      return;
    }
    if (!availableMaterialSubcategories.includes(materialSubcategory)) {
      setMaterialSubcategory(availableMaterialSubcategories[0] ?? "");
    }
  }, [availableMaterialSubcategories, materialSubcategory, showMaterialCreateForm]);

  useEffect(() => {
    if (editingMaterial) {
      const category = MATERIAL_CATEGORIES.includes(editingMaterial.category as MaterialCategory)
        ? (editingMaterial.category as MaterialCategory)
        : MATERIAL_CATEGORIES[0];
      const subcategories = getMaterialSubcategories(category);

      setEditMaterialName(editingMaterial.name);
      setEditMaterialCategory(category);
      setEditMaterialSubcategory(
        editingMaterial.subcategory && subcategories.includes(editingMaterial.subcategory) ? editingMaterial.subcategory : subcategories[0] ?? ""
      );
      setEditMaterialMinStock(String(editingMaterial.min_stock ?? 0));
      setEditMaterialDescription(editingMaterial.description ?? "");
      setEditMaterialRequiredErrors([]);
      return;
    }

    setEditMaterialName("");
    setEditMaterialCategory(MATERIAL_CATEGORIES[0]);
    setEditMaterialSubcategory(getMaterialSubcategories(MATERIAL_CATEGORIES[0])[0] ?? "");
    setEditMaterialMinStock("");
    setEditMaterialDescription("");
    setEditMaterialRequiredErrors([]);
  }, [editingMaterial]);

  useEffect(() => {
    if (!editingMaterial) {
      return;
    }
    if (!availableEditMaterialSubcategories.includes(editMaterialSubcategory)) {
      setEditMaterialSubcategory(availableEditMaterialSubcategories[0] ?? "");
    }
  }, [availableEditMaterialSubcategories, editMaterialSubcategory, editingMaterial]);

  async function handleSaveLocation() {
    try {
      onBusyChange(true);
      const payload = {
        name: locationName,
        code: locationCode,
        address: locationAddress
      };

      if (editingLocation) {
        await apiRequest(`/api/locations/${editingLocation.id}`, {
          method: "PATCH",
          body: payload
        });
        onActivity("Location updated.");
      } else {
        await apiRequest("/api/locations", {
          method: "POST",
          body: payload
        });
        onActivity("Location created.");
      }

      onCloseLocationForm();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(
        editingLocation
          ? `Update location failed: ${(error as Error).message}`
          : `Create location failed: ${(error as Error).message}`
      );
    } finally {
      onBusyChange(false);
    }
  }

  async function handleConfirmLocationUsageChange() {
    if (!pendingLocationUsageChange) {
      return;
    }

    const nextIsActive = pendingLocationUsageChange.is_active === false;

    try {
      onBusyChange(true);
      await apiRequest(`/api/locations/${pendingLocationUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      onActivity(`${pendingLocationUsageChange.name} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`);
      onClosePendingLocationUsageChange();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(`Update location usage failed: ${(error as Error).message}`);
    } finally {
      onBusyChange(false);
    }
  }

  async function handleCreateMaterial() {
    const missingFields = validateMaterialDraftRequiredFields({
      sku: materialSku,
      name: materialName,
      minStock: materialMinStock
    });

    if (missingFields.length > 0) {
      setMaterialRequiredErrors(missingFields);
      setMaterialSkuDuplicate(false);
      onActivity("Create material failed: SKU, name, and minimum stock are required.");
      return;
    }

    try {
      onBusyChange(true);
      setMaterialRequiredErrors([]);
      setMaterialSkuDuplicate(false);
      await apiRequest("/api/materials", {
        method: "POST",
        body: {
          sku: materialSku.trim(),
          name: materialName.trim(),
          description: materialDescription.trim() || undefined,
          uom: materialUom,
          category: materialCategory,
          subcategory: materialSubcategory,
          min_stock: Number(materialMinStock)
        }
      });
      onActivity("Material created.");
      setMaterialSku("MAT-001");
      setMaterialName("Cement");
      setMaterialCategory(MATERIAL_CATEGORIES[0]);
      setMaterialSubcategory(availableMaterialSubcategories[0] ?? "");
      setMaterialUom("BAG");
      setMaterialMinStock("10");
      setMaterialDescription("");
      onCloseMaterialCreateForm();
      await onRefreshCoreData();
    } catch (error) {
      if ((error as Error).message === MATERIAL_DUPLICATE_SKU_ERROR) {
        setMaterialRequiredErrors(["sku"]);
        setMaterialSkuDuplicate(true);
      }
      onActivity(`Create material failed: ${(error as Error).message}`);
    } finally {
      onBusyChange(false);
    }
  }

  async function handleUpdateMaterial() {
    if (!editingMaterial) {
      return;
    }

    const missingFields: Array<"name" | "minStock"> = [];
    if (!editMaterialName.trim()) {
      missingFields.push("name");
    }
    if (editMaterialMinStock.trim() === "") {
      missingFields.push("minStock");
    }

    if (missingFields.length > 0) {
      setEditMaterialRequiredErrors(missingFields);
      onActivity("Update material failed: name and minimum stock are required.");
      return;
    }

    try {
      onBusyChange(true);
      setEditMaterialRequiredErrors([]);
      await apiRequest(`/api/materials/${editingMaterial.id}`, {
        method: "PATCH",
        body: {
          name: editMaterialName.trim(),
          category: editMaterialCategory,
          subcategory: editMaterialSubcategory,
          min_stock: Number(editMaterialMinStock),
          description: editMaterialDescription.trim() || null
        }
      });
      onActivity("Material updated.");
      onCloseEditMaterialForm();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(`Update material failed: ${(error as Error).message}`);
    } finally {
      onBusyChange(false);
    }
  }

  async function handleConfirmMaterialUsageChange() {
    if (!pendingMaterialUsageChange) {
      return;
    }

    const nextIsActive = pendingMaterialUsageChange.is_active === false;

    try {
      onBusyChange(true);
      await apiRequest(`/api/materials/${pendingMaterialUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      onActivity(`${pendingMaterialUsageChange.sku} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`);
      onClosePendingMaterialUsageChange();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(`Update material usage failed: ${(error as Error).message}`);
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <>
      {showLocationForm && canManageCatalog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingLocation ? t("workbench.catalog.editLocationDialog") : t("workbench.catalog.addLocationDialog")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{editingLocation ? t("workbench.catalog.editLocation") : t("workbench.catalog.addLocation")}</h4>
              <button type="button" className="ghost-btn" onClick={onCloseLocationForm}>
                {t("common.close")}
              </button>
            </div>
            <div className="grid grid-2">
              <label className="field">
                <span>{t("workbench.location.name")}</span>
                <input value={locationName} onChange={(event) => setLocationName(event.target.value)} />
              </label>
              <label className="field">
                <span>{t("workbench.location.code")}</span>
                <input value={locationCode} onChange={(event) => setLocationCode(event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>{t("workbench.location.address")}</span>
              <textarea value={locationAddress} maxLength={265} rows={3} onChange={(event) => setLocationAddress(event.target.value)} />
            </label>
            <div className="actions">
              <button type="button" disabled={busy || !isOrgScopedReady} onClick={() => void handleSaveLocation()}>
                {editingLocation ? t("workbench.catalog.saveLocation") : t("workbench.catalog.createLocation")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLocationUsageChange ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.catalog.confirmLocationUsage")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{pendingLocationUsageChange.is_active === false ? t("workbench.catalog.unblockLocation") : t("workbench.catalog.blockLocation")}</h4>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingLocationUsageChange}>
                {t("common.close")}
              </button>
            </div>
            <p>
              {pendingLocationUsageChange.is_active === false
                ? message(locale, "catalog.location.usage.unblockConfirm", { name: pendingLocationUsageChange.name })
                : message(locale, "catalog.location.usage.blockConfirm", { name: pendingLocationUsageChange.name })}
            </p>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => void handleConfirmLocationUsageChange()}>
                {t("workbench.supplier.confirm")}
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingLocationUsageChange}>
                {t("workbench.movement.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMaterialCreateForm && canManageCatalog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.catalog.createMaterialDialog")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{t("workbench.catalog.createMaterialDialog")}</h4>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onCloseMaterialCreateForm}>
                {t("common.close")}
              </button>
            </div>
            <div className={`materials-form-wrap ${styles.materialEditForm}`}>
              <div className="grid grid-2">
                <label className={`field ${materialRequiredErrors.includes("sku") ? "field-invalid" : ""}`}>
                  <span>{t("workbench.material.sku")}</span>
                  <input
                    value={materialSku}
                    required
                    aria-invalid={materialRequiredErrors.includes("sku")}
                    onChange={(event) => setMaterialSku(event.target.value)}
                  />
                  {materialSkuDuplicate ? <small className="field-message">{materialDuplicateSkuMessage(locale)}</small> : null}
                </label>
                <label className={`field ${materialRequiredErrors.includes("name") ? "field-invalid" : ""}`}>
                  <span>{t("workbench.material.name")}</span>
                  <input
                    value={materialName}
                    required
                    aria-invalid={materialRequiredErrors.includes("name")}
                    onChange={(event) => setMaterialName(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{t("workbench.material.category")}</span>
                  <select value={materialCategory} onChange={(event) => setMaterialCategory(event.target.value as MaterialCategory)}>
                    {MATERIAL_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("workbench.material.subcategory")}</span>
                  <select value={materialSubcategory} onChange={(event) => setMaterialSubcategory(event.target.value)}>
                    {availableMaterialSubcategories.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("workbench.catalog.unit")}</span>
                  <select value={materialUom} onChange={(event) => setMaterialUom(event.target.value)}>
                    {MATERIAL_UNITS.map((unit) => (
                      <option key={unit.code} value={unit.code}>
                        {formatMaterialUnitLabel(unit.code, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`field ${materialRequiredErrors.includes("minStock") ? "field-invalid" : ""}`}>
                  <span>{t("workbench.material.minimumStock")}</span>
                  <input
                    type="number"
                    min={0}
                    required
                    aria-invalid={materialRequiredErrors.includes("minStock")}
                    value={materialMinStock}
                    onChange={(event) => setMaterialMinStock(event.target.value)}
                  />
                </label>
                <label className="field field-span-2">
                  <span>{t("workbench.material.description")}</span>
                  <textarea value={materialDescription} maxLength={256} rows={3} onChange={(event) => setMaterialDescription(event.target.value)} />
                </label>
              </div>
              <div className="actions">
                <button type="button" disabled={busy || !isOrgScopedReady} onClick={() => void handleCreateMaterial()}>
                  {t("workbench.material.create")}
                </button>
                <button type="button" className="ghost-btn" disabled={busy} onClick={onCloseMaterialCreateForm}>
                  {t("workbench.movement.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingMaterial ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.catalog.editMaterialDialog")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{t("workbench.catalog.editMaterialDialog")}</h4>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onCloseEditMaterialForm}>
                {t("common.close")}
              </button>
            </div>
            <div className={`materials-form-wrap ${styles.materialEditForm}`}>
              <div className="grid grid-2">
                <label className="field">
                  <span>{t("workbench.catalog.materialNumber")}</span>
                  <input value={editingMaterial?.sku ?? ""} readOnly />
                </label>
                <label className="field">
                  <span>{t("workbench.material.uom")}</span>
                  <input value={editingMaterial ? formatMaterialUnitLabel(editingMaterial.uom, locale) : ""} readOnly />
                </label>
                <label className={`field ${editMaterialRequiredErrors.includes("name") ? "field-invalid" : ""}`}>
                  <span>{t("workbench.material.name")}</span>
                  <input
                    value={editMaterialName}
                    required
                    aria-invalid={editMaterialRequiredErrors.includes("name")}
                    onChange={(event) => setEditMaterialName(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{t("workbench.material.category")}</span>
                  <select value={editMaterialCategory} onChange={(event) => setEditMaterialCategory(event.target.value as MaterialCategory)}>
                    {MATERIAL_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("workbench.material.subcategory")}</span>
                  <select value={editMaterialSubcategory} onChange={(event) => setEditMaterialSubcategory(event.target.value)}>
                    {availableEditMaterialSubcategories.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`field ${editMaterialRequiredErrors.includes("minStock") ? "field-invalid" : ""}`}>
                  <span>{t("workbench.material.minimumStock")}</span>
                  <input
                    type="number"
                    min={0}
                    required
                    aria-invalid={editMaterialRequiredErrors.includes("minStock")}
                    value={editMaterialMinStock}
                    onChange={(event) => setEditMaterialMinStock(event.target.value)}
                  />
                </label>
                <label className="field field-span-2">
                  <span>{t("workbench.material.description")}</span>
                  <textarea value={editMaterialDescription} maxLength={256} rows={3} onChange={(event) => setEditMaterialDescription(event.target.value)} />
                </label>
              </div>
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => void handleUpdateMaterial()}>
                  {t("workbench.catalog.saveChanges")}
                </button>
                <button type="button" className="ghost-btn" disabled={busy} onClick={onCloseEditMaterialForm}>
                  {t("workbench.movement.cancel")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pendingMaterialUsageChange ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.catalog.confirmMaterialUsage")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{pendingMaterialUsageChange.is_active === false ? t("workbench.catalog.unblockMaterial") : t("workbench.catalog.blockMaterial")}</h4>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingMaterialUsageChange}>
                {t("common.close")}
              </button>
            </div>
            <p>
              {pendingMaterialUsageChange.is_active === false
                ? message(locale, "catalog.material.usage.unblockConfirm", { sku: pendingMaterialUsageChange.sku, name: pendingMaterialUsageChange.name })
                : message(locale, "catalog.material.usage.blockConfirm", { sku: pendingMaterialUsageChange.sku, name: pendingMaterialUsageChange.name })}
            </p>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => void handleConfirmMaterialUsageChange()}>
                {t("workbench.supplier.confirm")}
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingMaterialUsageChange}>
                {t("workbench.movement.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
