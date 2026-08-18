import { useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { PHONE_COUNTRY_CODES, buildPhoneNumber, formatVendorNumber, splitPhoneNumber } from "@/lib/ui/vendor-fields";
import styles from "./suppliers-section.module.css";

export type WorkbenchSupplier = {
  id: string;
  vendor_number: number | null;
  name: string;
  phone?: string | null;
  address?: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
};

export type WorkbenchSupplierRow = {
  supplierId: string;
  vendorId: string;
  name: string;
  phone: string;
  address: string;
  leadTimeDays: number;
  status: string;
  openOrders: number;
  receivedOrders: number;
  totalOrders: number;
  editableSupplier: WorkbenchSupplier | undefined;
};

function SearchFieldIcon() {
  return (
    <svg className="search-field-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10 4a6 6 0 104.472 10.007l4.26 4.26 1.414-1.414-4.26-4.26A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z" />
    </svg>
  );
}

function SelectFieldIcon() {
  return (
    <svg className="select-field-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

type WorkbenchSuppliersSectionProps = {
  busy: boolean;
  canExportCsv: boolean;
  canManageCatalog: boolean;
  hasSuppliers: boolean;
  isOrgScopedReady: boolean;
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
  supplierPage: number;
  supplierTotalPages: number;
  supplierTableRows: WorkbenchSupplierRow[];
  supplierSearchQuery: string;
  supplierStatusFilter: string;
  showSupplierForm: boolean;
  editingSupplier: WorkbenchSupplier | null;
  pendingSupplierUsageChange: WorkbenchSupplier | null;
  onCreateSupplier: () => void;
  onEditSupplier: (supplier: WorkbenchSupplier) => void;
  onToggleSupplierUsage: (supplier: WorkbenchSupplier) => void;
  onCloseSupplierForm: () => void;
  onClosePendingSupplierUsageChange: () => void;
  onExportCsv: () => void;
  onSupplierSearchChange: (nextValue: string) => void;
  onSupplierStatusFilterChange: (nextValue: string) => void;
  onSupplierPageChange: (updater: number | ((prev: number) => number)) => void;
};

export function WorkbenchSuppliersSection({
  busy,
  canExportCsv,
  canManageCatalog,
  hasSuppliers,
  isOrgScopedReady,
  apiRequest,
  onActivity,
  onBusyChange,
  onRefreshCoreData,
  supplierPage,
  supplierTotalPages,
  supplierTableRows,
  supplierSearchQuery,
  supplierStatusFilter,
  showSupplierForm,
  editingSupplier,
  pendingSupplierUsageChange,
  onCreateSupplier,
  onEditSupplier,
  onToggleSupplierUsage,
  onCloseSupplierForm,
  onClosePendingSupplierUsageChange,
  onExportCsv,
  onSupplierSearchChange,
  onSupplierStatusFilterChange,
  onSupplierPageChange,
}: WorkbenchSuppliersSectionProps) {
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const statusLabel = (status: string) => t(status === "Active" ? "workbench.location.active" : "workbench.location.blocked");
  const [supplierVendorNumber, setSupplierVendorNumber] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState("Acme Supply");
  const [supplierPhoneCountryCode, setSupplierPhoneCountryCode] = useState("+33");
  const [supplierPhoneNumber, setSupplierPhoneNumber] = useState("");
  const [supplierLeadTime, setSupplierLeadTime] = useState(5);
  const [supplierAddress, setSupplierAddress] = useState("");

  useEffect(() => {
    if (!showSupplierForm) {
      setSupplierVendorNumber(null);
      setSupplierName("Acme Supply");
      setSupplierPhoneCountryCode("+33");
      setSupplierPhoneNumber("");
      setSupplierLeadTime(5);
      setSupplierAddress("");
      return;
    }

    if (editingSupplier) {
      const { countryCode, localNumber } = splitPhoneNumber(editingSupplier.phone);
      setSupplierVendorNumber(editingSupplier.vendor_number ?? null);
      setSupplierName(editingSupplier.name);
      setSupplierPhoneCountryCode(countryCode);
      setSupplierPhoneNumber(localNumber);
      setSupplierLeadTime(Number(editingSupplier.lead_time_days || 0));
      setSupplierAddress(editingSupplier.address ?? "");
    }
  }, [editingSupplier, showSupplierForm]);

  async function handleSaveSupplier() {
    try {
      onBusyChange(true);
      const payload = {
        name: supplierName,
        phone: buildPhoneNumber(supplierPhoneCountryCode, supplierPhoneNumber),
        address: supplierAddress.trim() || undefined,
        lead_time_days: Number(supplierLeadTime)
      };

      if (editingSupplier) {
        await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
          method: "PATCH",
          body: payload
        });
        onActivity("Supplier updated.");
      } else {
        await apiRequest("/api/suppliers", {
          method: "POST",
          body: payload
        });
        onActivity("Supplier created.");
      }

      onCloseSupplierForm();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(
        editingSupplier
          ? `Update supplier failed: ${(error as Error).message}`
          : `Create supplier failed: ${(error as Error).message}`
      );
    } finally {
      onBusyChange(false);
    }
  }

  async function handleConfirmSupplierUsageChange() {
    if (!pendingSupplierUsageChange) {
      return;
    }

    const nextIsActive = pendingSupplierUsageChange.is_active === false;

    try {
      onBusyChange(true);
      await apiRequest(`/api/suppliers/${pendingSupplierUsageChange.id}`, {
        method: "PATCH",
        body: {
          is_active: nextIsActive
        }
      });
      onActivity(`${pendingSupplierUsageChange.name} ${nextIsActive ? "unblocked for usage" : "blocked for usage"}.`);
      onClosePendingSupplierUsageChange();
      await onRefreshCoreData();
    } catch (error) {
      onActivity(`Update supplier usage failed: ${(error as Error).message}`);
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <>
      <section className="card">
        <div className={`inventory-toolbar ${styles.toolbar}`}>
          <div className="search-input-wrap">
            <SearchFieldIcon />
            <input
              value={supplierSearchQuery}
              onChange={(event) => onSupplierSearchChange(event.target.value)}
              placeholder={t("workbench.supplier.searchPlaceholder")}
              aria-label={t("workbench.supplier.searchLabel")}
            />
          </div>
          <div className="category-wrap">
            <SelectFieldIcon />
            <select
              value={supplierStatusFilter}
              onChange={(event) => onSupplierStatusFilterChange(event.target.value)}
              aria-label={t("workbench.location.statusFilter")}
            >
              <option value="all">{t("workbench.location.allStatuses")}</option>
              <option value="active">{t("workbench.location.active")}</option>
              <option value="blocked">{t("workbench.location.blocked")}</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-section-head">
          <h2>{t("workbench.supplier.title")}</h2>
          <div className="actions table-head-actions inventory-table-actions">
            {canManageCatalog ? (
              <button type="button" className="ghost-btn" onClick={onCreateSupplier}>
                {t("workbench.supplier.add")}
              </button>
            ) : null}
            {canExportCsv ? (
              <button type="button" className="ghost-btn export-csv-btn" disabled={supplierTableRows.length === 0} onClick={onExportCsv}>
                {t("workbench.location.exportCsv")}
              </button>
            ) : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className={`compact-table ${styles.suppliersTable}`}>
            <thead>
              <tr>
                <th><span className="table-static-head">{t("workbench.supplier.vendorId")}</span></th>
                <th><span className="table-static-head">{t("workbench.supplier.vendorName")}</span></th>
                <th><span className="table-static-head">{t("workbench.supplier.phone")}</span></th>
                <th><span className="table-static-head">{t("workbench.location.address")}</span></th>
                <th><span className="table-static-head">{t("workbench.supplier.leadTime")}</span></th>
                <th><span className="table-static-head">{t("workbench.location.status")}</span></th>
                <th><span className="table-static-head">{t("workbench.supplier.openPos")}</span></th>
                <th><span className="table-static-head">{t("workbench.supplier.receivedPos")}</span></th>
                <th><span className="table-static-head">{t("workbench.supplier.totalPos")}</span></th>
                <th><span className="table-static-head">{t("workbench.location.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {supplierTableRows.length === 0 ? (
                <tr>
                  <td colSpan={10}>{hasSuppliers ? t("workbench.supplier.noMatch") : t("workbench.supplier.none")}</td>
                </tr>
              ) : (
                supplierTableRows.map((supplier) => {
                  const editableSupplier = supplier.editableSupplier;
                  return (
                    <tr key={supplier.supplierId}>
                      <td className="mono-line">{supplier.vendorId}</td>
                      <td>{supplier.name}</td>
                      <td>{supplier.phone}</td>
                      <td>{supplier.address}</td>
                      <td>{supplier.leadTimeDays}</td>
                      <td>
                        <span className={`status-pill ${supplier.status === "Active" ? "status-received" : "status-cancelled"}`}>{statusLabel(supplier.status)}</span>
                      </td>
                      <td>{supplier.openOrders}</td>
                      <td>{supplier.receivedOrders}</td>
                      <td>{supplier.totalOrders}</td>
                      <td>
                        {editableSupplier && canManageCatalog ? (
                          <div className="row-actions table-action-buttons">
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => onEditSupplier(editableSupplier)}>
                              {t("workbench.location.edit")}
                            </button>
                            <button type="button" className="ghost-btn" disabled={busy} onClick={() => onToggleSupplierUsage(editableSupplier)}>
                              {editableSupplier.is_active === false ? t("workbench.location.unblock") : t("workbench.location.block")}
                            </button>
                          </div>
                        ) : (
                          <span className="subtle-line">{t("workbench.location.noActions")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      <div className="actions">
        <button type="button" disabled={busy || supplierPage <= 1} onClick={() => onSupplierPageChange((prev) => Math.max(1, prev - 1))}>
          {t("workbench.location.previous")}
          </button>
          <button type="button" disabled={busy || supplierPage >= supplierTotalPages} onClick={() => onSupplierPageChange((prev) => Math.min(supplierTotalPages, prev + 1))}>
            {t("workbench.location.next")}
          </button>
          <p className="subtle-line">
            {message(locale, "workbench.location.page", { page: String(supplierPage), total: String(supplierTotalPages) })}
          </p>
        </div>
      </section>

      {showSupplierForm && canManageCatalog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingSupplier ? t("workbench.supplier.editDialog") : t("workbench.supplier.addDialog")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{editingSupplier ? t("workbench.supplier.edit") : t("workbench.supplier.add")}</h4>
              <button type="button" className="ghost-btn" onClick={onCloseSupplierForm}>
                {t("common.close")}
              </button>
            </div>
            <div className="grid grid-2">
              <label className="field">
                <span>{t("workbench.supplier.vendorId")}</span>
                <input readOnly value={formatVendorNumber(supplierVendorNumber)} placeholder={t("workbench.supplier.assignedAutomatically")} />
                <p className="subtle-line">{t("workbench.supplier.idImmutable")}</p>
              </label>
              <label className="field">
                <span>{t("workbench.location.name")}</span>
                <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
              </label>
              <label className="field field-span-2">
                <span>{t("workbench.supplier.phone")}</span>
                <div className="phone-input-row">
                  <select value={supplierPhoneCountryCode} onChange={(event) => setSupplierPhoneCountryCode(event.target.value)}>
                    {PHONE_COUNTRY_CODES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={supplierPhoneNumber}
                    onChange={(event) => setSupplierPhoneNumber(event.target.value)}
                    placeholder="6 12 34 56 78"
                  />
                </div>
              </label>
              <label className="field">
                <span>{t("workbench.supplier.leadTime")}</span>
                <input type="number" min={0} value={supplierLeadTime} onChange={(event) => setSupplierLeadTime(Number(event.target.value))} />
              </label>
              <label className="field field-span-2">
                <span>{t("workbench.location.address")}</span>
                <textarea maxLength={256} rows={3} value={supplierAddress} onChange={(event) => setSupplierAddress(event.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button type="button" disabled={busy || !isOrgScopedReady || !supplierName.trim()} onClick={() => void handleSaveSupplier()}>
                {editingSupplier ? t("workbench.supplier.update") : t("workbench.supplier.create")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingSupplierUsageChange ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t("workbench.supplier.confirmUsage")}>
          <div className="modal-card">
            <div className="title-row">
              <h4>{pendingSupplierUsageChange.is_active === false ? t("workbench.supplier.unblockVendor") : t("workbench.supplier.blockVendor")}</h4>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingSupplierUsageChange}>
                {t("common.close")}
              </button>
            </div>
            <p>
              {pendingSupplierUsageChange.is_active === false
                ? message(locale, "workbench.supplier.unblockConfirm", { name: pendingSupplierUsageChange.name })
                : message(locale, "workbench.supplier.blockConfirm", { name: pendingSupplierUsageChange.name })}
            </p>
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => void handleConfirmSupplierUsageChange()}>
                {t("workbench.supplier.confirm")}
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={onClosePendingSupplierUsageChange}>
                {t("workbench.movement.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
