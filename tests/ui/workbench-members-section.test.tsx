import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() })
}));

import { WorkbenchMembersSection } from "@/components/workbench/members-section";

describe("WorkbenchMembersSection", () => {
  it("renders the members, invitations, and role authorization sections", () => {
    const onRenameGroupClick = vi.fn();
    const onRefreshMembersClick = vi.fn();
    const onRenameOrgNameChange = vi.fn();
    const onSaveGroupName = vi.fn();
    const onCancelRenameGroup = vi.fn();
    const onMemberInviteEmailChange = vi.fn();
    const onMemberInviteRoleChange = vi.fn();
    const onSendInvitation = vi.fn();
    const onRefreshInvitations = vi.fn();
    const onRefreshGroups = vi.fn();
    const onAcceptInvitation = vi.fn();
    const onRejectInvitation = vi.fn();

    render(
      <WorkbenchMembersSection
        busy={false}
        canUseMembersScreen={true}
        ownedGroupName="Acme Group"
        ownedGroup={{ organization: { name: "Acme Group" } }}
        ownedGroupsLength={1}
        renamingOrgId="org-1"
        renameOrgName="Acme Group"
        accessToken="token"
        memberInviteEmail="new.user@example.com"
        memberInviteRole="member"
        organizationMemberTableRows={[
          {
            key: "org-1-user-1",
            member: "Jane Doe",
            email: "jane@example.com",
            role: "manager",
            joined: "2026-08-01",
            action: <button type="button">Remove</button>
          }
        ]}
        membershipTableRows={[
          {
            key: "org-1",
            group: "Acme Group",
            role: "owner",
            joined: "2026-08-01",
            action: <span>Current</span>
          }
        ]}
        invitationTableRows={[
          {
            id: "inv-1",
            direction: "Received",
            group: "Acme Group",
            person: "invitee@example.com",
            role: "member",
            expires: "2026-08-31",
            invitation: { direction: "received", status: "pending" }
          },
          {
            id: "inv-2",
            direction: "Sent",
            group: "Acme Group",
            person: "other@example.com",
            role: "viewer",
            expires: "2026-08-31",
            invitation: { direction: "sent", status: "sent" }
          }
        ]}
        roleAuthorizations={[
          ["Read inventory", "✅", "✅", "✅", "✅"],
          ["Manage billing", "❌", "❌", "❌", "✅"]
        ]}
        tableSortStateOrganizationMembers={{ key: "member", direction: "asc" }}
        tableSortStateMemberships={{ key: "group", direction: "asc" }}
        tableSortStateInvitations={{ key: "direction", direction: "asc" }}
        onRenameGroupClick={onRenameGroupClick}
        onRefreshMembersClick={onRefreshMembersClick}
        onRenameOrgNameChange={onRenameOrgNameChange}
        onSaveGroupName={onSaveGroupName}
        onCancelRenameGroup={onCancelRenameGroup}
        onMemberInviteEmailChange={onMemberInviteEmailChange}
        onMemberInviteRoleChange={onMemberInviteRoleChange}
        onSendInvitation={onSendInvitation}
        onRefreshInvitations={onRefreshInvitations}
        onRefreshGroups={onRefreshGroups}
        onAcceptInvitation={onAcceptInvitation}
        onRejectInvitation={onRejectInvitation}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Members of my group Acme Group" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename Group" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refresh Members" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save Group Name" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send Invitation" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Refresh Invitations" })).toBeEnabled();
    expect(screen.queryByText("No owned group found.")).not.toBeInTheDocument();
    expect(screen.queryByText("Your default group is being prepared. Invitations are available after it is ready.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Role Authorizations" })).toBeInTheDocument();
  });
});
