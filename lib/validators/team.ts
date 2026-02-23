import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional()
});

export const addTeamMemberSchema = z.object({
  user_id: z.string().uuid()
});
