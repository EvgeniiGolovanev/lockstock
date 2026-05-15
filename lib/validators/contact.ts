import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  email: z.string().trim().email("Enter a valid email address.").max(160, "Email is too long."),
  company: z.string().trim().max(140, "Company is too long.").optional().default(""),
  message: z.string().trim().min(1, "Message is required.").max(4000, "Message is too long.")
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
