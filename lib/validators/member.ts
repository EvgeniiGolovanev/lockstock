import { z } from "zod";

const orgRoleSchema = z.enum(["owner", "manager", "member", "viewer"]);

export const createOrganizationMemberSchema = z.object({
  email: z.string().email().max(320)
});

export const updateOrganizationMemberRoleSchema = z.object({
  role: orgRoleSchema
});

export const invitationIdParamSchema = z.object({
  id: z.string().uuid()
});
