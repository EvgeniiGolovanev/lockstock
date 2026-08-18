"use client";

import type { ReactNode } from "react";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { type SortState } from "@/lib/ui/table-tools";
import styles from "./members-section.module.css";

type SortableHeaderProps = {
  tableId: "organization-members" | "memberships" | "invitations";
  sortKey: string;
  label: string;
  sortState: SortState | undefined;
  onSort: (tableId: "organization-members" | "memberships" | "invitations", key: string) => void;
  sortAriaLabel: string;
};

function SortableHeader({ tableId, sortKey, label, sortState, onSort, sortAriaLabel }: SortableHeaderProps) {
  const isActive = sortState?.key === sortKey;
  return (
    <th>
      <button
        type="button"
        className={`table-sort-trigger ${isActive ? "is-sorted" : ""}`}
        aria-label={sortAriaLabel}
        aria-pressed={isActive}
        onClick={() => onSort(tableId, sortKey)}
      >
        {label}
        <span aria-hidden="true">{isActive ? (sortState?.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

type MembersSectionRow = {
  key: string;
  member: string;
  email: string;
  role: string;
  joined: string;
  action: ReactNode;
};

type MembershipSectionRow = {
  key: string;
  group: string;
  role: string;
  joined: string;
  action: ReactNode;
};

type InvitationSectionRow = {
  id: string;
  direction: string;
  group: string;
  person: string;
  role: string;
  expires: string;
  invitation: {
    direction: "sent" | "received";
    status: string;
  };
};

type MembersSectionProps = {
  busy: boolean;
  canUseMembersScreen: boolean;
  ownedGroupName: string;
  ownedGroup: { organization: { name: string } } | null;
  ownedGroupsLength: number;
  renamingOrgId: string;
  renameOrgName: string;
  accessToken: string;
  memberInviteEmail: string;
  memberInviteRole: string;
  organizationMemberTableRows: MembersSectionRow[];
  membershipTableRows: MembershipSectionRow[];
  invitationTableRows: InvitationSectionRow[];
  roleAuthorizations: ReadonlyArray<readonly [string, string, string, string, string]>;
  tableSortStateOrganizationMembers: SortState | undefined;
  tableSortStateMemberships: SortState | undefined;
  tableSortStateInvitations: SortState | undefined;
  onRenameGroupClick: () => void;
  onRefreshMembersClick: () => void;
  onRenameOrgNameChange: (value: string) => void;
  onSaveGroupName: () => void;
  onCancelRenameGroup: () => void;
  onMemberInviteEmailChange: (value: string) => void;
  onMemberInviteRoleChange: (value: string) => void;
  onSendInvitation: () => void;
  onRefreshInvitations: () => void;
  onRefreshGroups: () => void;
  onAcceptInvitation: (id: string) => void;
  onRejectInvitation: (id: string) => void;
  onSort: (tableId: "organization-members" | "memberships" | "invitations", key: string) => void;
};

export function WorkbenchMembersSection({
  busy,
  canUseMembersScreen,
  ownedGroupName,
  ownedGroup,
  ownedGroupsLength,
  renamingOrgId,
  renameOrgName,
  accessToken,
  memberInviteEmail,
  memberInviteRole,
  organizationMemberTableRows,
  membershipTableRows,
  invitationTableRows,
  roleAuthorizations,
  tableSortStateOrganizationMembers,
  tableSortStateMemberships,
  tableSortStateInvitations,
  onRenameGroupClick,
  onRefreshMembersClick,
  onRenameOrgNameChange,
  onSaveGroupName,
  onCancelRenameGroup,
  onMemberInviteEmailChange,
  onMemberInviteRoleChange,
  onSendInvitation,
  onRefreshInvitations,
  onRefreshGroups,
  onAcceptInvitation,
  onRejectInvitation,
  onSort
}: MembersSectionProps) {
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const sortAriaLabel = (label: string, sortState: SortState | undefined, sortKey: string) => {
    const active = sortState?.key === sortKey;
    const state = active ? t(sortState?.direction === "asc" ? "workbench.table.ascending" : "workbench.table.descending") : "";
    return message(locale, "workbench.table.sortBy", { label, state });
  };
  if (!canUseMembersScreen) {
    return null;
  }

  return (
    <section className="card" data-testid="members-section">
      <div className="title-row">
        <div>
          <h3>{message(locale, "workbench.members.groupHeading", { name: ownedGroupName })}</h3>
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !ownedGroup} onClick={onRenameGroupClick}>
            {t("workbench.members.renameGroup")}
          </button>
          <button type="button" disabled={busy || !ownedGroup} onClick={onRefreshMembersClick}>
            {t("workbench.members.refreshMembers")}
          </button>
        </div>
      </div>

      {renamingOrgId ? (
        <div className="grid grid-2">
          <label className="field">
            <span>{t("workbench.members.renameGroupLabel")}</span>
            <input value={renameOrgName} onChange={(event) => onRenameOrgNameChange(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" disabled={busy || !renameOrgName.trim()} onClick={onSaveGroupName}>
              {t("workbench.members.saveGroupName")}
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={onCancelRenameGroup}>
              {t("workbench.movement.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {!ownedGroup ? <p className="subtle-line">{t("workbench.members.noOwnedGroup")}</p> : null}

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <SortableHeader tableId="organization-members" sortKey="member" label={t("workbench.members.member")} sortState={tableSortStateOrganizationMembers} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.member"), tableSortStateOrganizationMembers, "member")} />
              <SortableHeader tableId="organization-members" sortKey="email" label={t("workbench.members.memberEmail")} sortState={tableSortStateOrganizationMembers} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.memberEmail"), tableSortStateOrganizationMembers, "email")} />
              <SortableHeader tableId="organization-members" sortKey="role" label={t("workbench.members.role")} sortState={tableSortStateOrganizationMembers} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.role"), tableSortStateOrganizationMembers, "role")} />
              <SortableHeader tableId="organization-members" sortKey="joined" label={t("workbench.members.joined")} sortState={tableSortStateOrganizationMembers} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.joined"), tableSortStateOrganizationMembers, "joined")} />
              <th>
                <span className="table-static-head">{t("workbench.location.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!ownedGroup ? (
              <tr>
                <td colSpan={5}>{t("workbench.members.noOwnedGroup")}</td>
              </tr>
            ) : organizationMemberTableRows.length === 0 ? (
              <tr>
                <td colSpan={5}>{t("workbench.members.noInvited")}</td>
              </tr>
            ) : (
              organizationMemberTableRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.member}</td>
                  <td>{row.email}</td>
                  <td>{row.role}</td>
                  <td>{row.joined}</td>
                  <td>
                    <div className="row-actions table-action-buttons">{row.action}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.sectionDivider} />

      <div className="title-row">
        <div>
          <h3>{t("workbench.members.myMemberships")}</h3>
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !accessToken} onClick={onRefreshGroups}>
            {t("workbench.members.refreshGroups")}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <SortableHeader tableId="memberships" sortKey="group" label={t("workbench.members.group")} sortState={tableSortStateMemberships} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.group"), tableSortStateMemberships, "group")} />
              <SortableHeader tableId="memberships" sortKey="role" label={t("workbench.members.myRole")} sortState={tableSortStateMemberships} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.myRole"), tableSortStateMemberships, "role")} />
              <SortableHeader tableId="memberships" sortKey="joined" label={t("workbench.members.joined")} sortState={tableSortStateMemberships} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.joined"), tableSortStateMemberships, "joined")} />
              <th>
                <span className="table-static-head">{t("workbench.location.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {membershipTableRows.length === 0 ? (
              <tr>
                <td colSpan={4}>{t("workbench.members.noMemberships")}</td>
              </tr>
            ) : (
              membershipTableRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.group}</td>
                  <td>{row.role}</td>
                  <td>{row.joined}</td>
                  <td>
                    <div className="row-actions table-action-buttons">{row.action}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ownedGroupsLength === 0 ? (
        <p className="subtle-line">{t("workbench.members.defaultPreparing")}</p>
      ) : null}

      <div className={styles.sectionDivider} />

      <h3>{t("workbench.members.invitations")}</h3>

      {ownedGroup ? (
        <>
          <p className="subtle-line">
            {message(locale, "workbench.members.inviteGroup", { name: ownedGroup.organization.name })}
          </p>
          <div className={styles.inviteRow}>
            <label className="field">
              <span>{t("workbench.members.inviteByEmail")}</span>
              <input
                value={memberInviteEmail}
                onChange={(event) => onMemberInviteEmailChange(event.target.value)}
                placeholder={t("workbench.members.inviteEmailPlaceholder")}
                type="email"
              />
            </label>
            <label className="field">
              <span>{t("workbench.members.assignedRole")}</span>
              <select value={memberInviteRole} onChange={(event) => onMemberInviteRoleChange(event.target.value)} required>
                <option value="">{t("workbench.members.selectRole")}</option>
                <option value="viewer">{t("workbench.members.viewer")}</option>
                <option value="member">{t("workbench.members.member")}</option>
                <option value="manager">{t("workbench.members.manager")}</option>
              </select>
            </label>
            <button type="button" className={styles.inlineButton} disabled={busy || !memberInviteEmail.trim() || !memberInviteRole} onClick={onSendInvitation}>
              {t("workbench.members.sendInvitation")}
            </button>
            <button type="button" className={styles.inlineButton} disabled={busy || !accessToken} onClick={onRefreshInvitations}>
              {t("workbench.members.refreshInvitations")}
            </button>
          </div>
        </>
      ) : null}

      <h3 className={styles.tableTitle}>{t("workbench.members.sentReceived")}</h3>

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <SortableHeader tableId="invitations" sortKey="direction" label={t("workbench.members.direction")} sortState={tableSortStateInvitations} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.direction"), tableSortStateInvitations, "direction")} />
              <SortableHeader tableId="invitations" sortKey="group" label={t("workbench.members.group")} sortState={tableSortStateInvitations} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.group"), tableSortStateInvitations, "group")} />
              <SortableHeader tableId="invitations" sortKey="person" label={t("workbench.members.person")} sortState={tableSortStateInvitations} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.person"), tableSortStateInvitations, "person")} />
              <SortableHeader tableId="invitations" sortKey="role" label={t("workbench.members.role")} sortState={tableSortStateInvitations} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.role"), tableSortStateInvitations, "role")} />
              <SortableHeader tableId="invitations" sortKey="expires" label={t("workbench.members.expires")} sortState={tableSortStateInvitations} onSort={onSort} sortAriaLabel={sortAriaLabel(t("workbench.members.expires"), tableSortStateInvitations, "expires")} />
              <th>
                <span className="table-static-head">{t("workbench.location.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitationTableRows.length === 0 ? (
              <tr>
                <td colSpan={6}>{t("workbench.members.nonePending")}</td>
              </tr>
            ) : (
              invitationTableRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.direction}</td>
                  <td>{row.group}</td>
                  <td>{row.person}</td>
                  <td>{row.role}</td>
                  <td>{row.expires}</td>
                  <td>
                    {row.invitation.direction === "received" ? (
                      <div className="row-actions table-action-buttons">
                        <button type="button" disabled={busy} onClick={() => onAcceptInvitation(row.id)}>
                          {t("workbench.members.accept")}
                        </button>
                        <button type="button" className="ghost-btn" disabled={busy} onClick={() => onRejectInvitation(row.id)}>
                          {t("workbench.members.reject")}
                        </button>
                      </div>
                    ) : (
                      <span className="subtle-line">{row.invitation.status}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={`${styles.sectionDivider} ${styles.roleDivider}`} />

      <h3 className={styles.tableTitle}>{t("workbench.members.roleAuthorizations")}</h3>

      <div className="table-wrap">
        <table className={`compact-table ${styles.roleAuthorizationsTable}`}>
          <thead>
            <tr>
              <th>{t("workbench.members.capability")}</th>
              <th>{t("workbench.members.viewer")}</th>
              <th>{t("workbench.members.member")}</th>
              <th>{t("workbench.members.manager")}</th>
              <th>{t("workbench.members.owner")}</th>
            </tr>
          </thead>
          <tbody>
            {roleAuthorizations.map(([capability, viewer, member, manager, owner]) => (
              <tr key={capability}>
                <td>{capability}</td>
                <td>{viewer}</td>
                <td>{member}</td>
                <td>{manager}</td>
                <td>{owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
