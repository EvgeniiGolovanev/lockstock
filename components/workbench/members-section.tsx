"use client";

import type { ReactNode } from "react";

import { type SortState } from "@/lib/ui/table-tools";

type SortableHeaderProps = {
  tableId: "organization-members" | "memberships" | "invitations";
  sortKey: string;
  label: string;
  sortState: SortState | undefined;
  onSort: (tableId: "organization-members" | "memberships" | "invitations", key: string) => void;
};

function SortableHeader({ tableId, sortKey, label, sortState, onSort }: SortableHeaderProps) {
  const isActive = sortState?.key === sortKey;
  const directionLabel = isActive ? (sortState?.direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th>
      <button
        type="button"
        className={`table-sort-trigger ${isActive ? "is-sorted" : ""}`}
        aria-label={`Sort by ${label}${isActive ? `, ${directionLabel}` : ""}`}
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
  if (!canUseMembersScreen) {
    return null;
  }

  return (
    <section className="card">
      <div className="title-row">
        <div>
          <h3>Members of my group {ownedGroupName}</h3>
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !ownedGroup} onClick={onRenameGroupClick}>
            Rename Group
          </button>
          <button type="button" disabled={busy || !ownedGroup} onClick={onRefreshMembersClick}>
            Refresh Members
          </button>
        </div>
      </div>

      {renamingOrgId ? (
        <div className="grid grid-2">
          <label className="field">
            <span>Rename group</span>
            <input value={renameOrgName} onChange={(event) => onRenameOrgNameChange(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" disabled={busy || !renameOrgName.trim()} onClick={onSaveGroupName}>
              Save Group Name
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={onCancelRenameGroup}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!ownedGroup ? <p className="subtle-line">No owned group found.</p> : null}

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <SortableHeader tableId="organization-members" sortKey="member" label="Member" sortState={tableSortStateOrganizationMembers} onSort={onSort} />
              <SortableHeader tableId="organization-members" sortKey="email" label="Member email" sortState={tableSortStateOrganizationMembers} onSort={onSort} />
              <SortableHeader tableId="organization-members" sortKey="role" label="Role" sortState={tableSortStateOrganizationMembers} onSort={onSort} />
              <SortableHeader tableId="organization-members" sortKey="joined" label="Joined" sortState={tableSortStateOrganizationMembers} onSort={onSort} />
              <th>
                <span className="table-static-head">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!ownedGroup ? (
              <tr>
                <td colSpan={5}>No owned group found.</td>
              </tr>
            ) : organizationMemberTableRows.length === 0 ? (
              <tr>
                <td colSpan={5}>No invited members found for this group.</td>
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

      <div className="members-section-divider" />

      <div className="title-row">
        <div>
          <h3>My memberships</h3>
        </div>
        <div className="actions">
          <button type="button" disabled={busy || !accessToken} onClick={onRefreshGroups}>
            Refresh Groups
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <SortableHeader tableId="memberships" sortKey="group" label="Group" sortState={tableSortStateMemberships} onSort={onSort} />
              <SortableHeader tableId="memberships" sortKey="role" label="My role" sortState={tableSortStateMemberships} onSort={onSort} />
              <SortableHeader tableId="memberships" sortKey="joined" label="Joined" sortState={tableSortStateMemberships} onSort={onSort} />
              <th>
                <span className="table-static-head">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {membershipTableRows.length === 0 ? (
              <tr>
                <td colSpan={4}>No group memberships found.</td>
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
        <p className="subtle-line">Your default group is being prepared. Invitations are available after it is ready.</p>
      ) : null}

      <div className="members-section-divider" />

      <h3>Invitations</h3>

      {ownedGroup ? (
        <>
          <p className="subtle-line">
            Invite people to your group <strong>{ownedGroup.organization.name}</strong>
          </p>
          <div className="members-invite-row">
            <label className="field">
              <span>Invite by email</span>
              <input
                value={memberInviteEmail}
                onChange={(event) => onMemberInviteEmailChange(event.target.value)}
                placeholder="new.user@example.com"
                type="email"
              />
            </label>
            <label className="field">
              <span>Assigned role</span>
              <select value={memberInviteRole} onChange={(event) => onMemberInviteRoleChange(event.target.value)} required>
                <option value="">Select role</option>
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            <button type="button" className="members-inline-button" disabled={busy || !memberInviteEmail.trim() || !memberInviteRole} onClick={onSendInvitation}>
              Send Invitation
            </button>
            <button type="button" className="members-inline-button" disabled={busy || !accessToken} onClick={onRefreshInvitations}>
              Refresh Invitations
            </button>
          </div>
        </>
      ) : null}

      <h3 className="members-table-title">Invitations sent and received</h3>

      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              <SortableHeader tableId="invitations" sortKey="direction" label="Direction" sortState={tableSortStateInvitations} onSort={onSort} />
              <SortableHeader tableId="invitations" sortKey="group" label="Group" sortState={tableSortStateInvitations} onSort={onSort} />
              <SortableHeader tableId="invitations" sortKey="person" label="Person" sortState={tableSortStateInvitations} onSort={onSort} />
              <SortableHeader tableId="invitations" sortKey="role" label="Role" sortState={tableSortStateInvitations} onSort={onSort} />
              <SortableHeader tableId="invitations" sortKey="expires" label="Expires" sortState={tableSortStateInvitations} onSort={onSort} />
              <th>
                <span className="table-static-head">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitationTableRows.length === 0 ? (
              <tr>
                <td colSpan={6}>No pending invitations.</td>
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
                          Accept
                        </button>
                        <button type="button" className="ghost-btn" disabled={busy} onClick={() => onRejectInvitation(row.id)}>
                          Reject
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

      <div className="members-section-divider members-role-divider" />

      <h3 className="members-table-title">Role Authorizations</h3>

      <div className="table-wrap">
        <table className="compact-table role-authorizations-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Viewer</th>
              <th>Member</th>
              <th>Manager</th>
              <th>Owner</th>
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
