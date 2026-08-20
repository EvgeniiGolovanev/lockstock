import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { consumePublicRateLimit, getRateLimitSubject } from "@/lib/api/public-rate-limit";
import { sendTransactionalEmail } from "@/lib/api/mailer";
import { contactMessageSchema } from "@/lib/validators/contact";

const CONTACT_INBOX = "contact@lockstockapp.com";

function isEmailConfigurationError(error: unknown) {
  return error instanceof Error && error.message.includes("Missing required environment variable");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: NextRequest) {
  try {
    const payload = contactMessageSchema.parse(await request.json());

    if (payload.website) {
      throw new ApiError(400, "Could not send your message.");
    }

    const rateLimit = await consumePublicRateLimit("contact", getRateLimitSubject(request, payload.email));
    if (!rateLimit.allowed) {
      throw new ApiError(429, "Too many contact requests. Please try again later.", { retryAfterSeconds: rateLimit.retryAfterSeconds });
    }

    const companyLine = payload.company ? `Company: ${payload.company}\n` : "";
    const text = `Name: ${payload.name}\nEmail: ${payload.email}\n${companyLine}\nMessage:\n${payload.message}`;
    const html = `
      <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
      ${payload.company ? `<p><strong>Company:</strong> ${escapeHtml(payload.company)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(payload.message).replace(/\n/g, "<br />")}</p>
    `;

    try {
      await sendTransactionalEmail({
        to: CONTACT_INBOX,
        subject: `New LockStock contact request from ${payload.name}`,
        text,
        html,
        replyTo: payload.email
      });
    } catch (emailError) {
      if (isEmailConfigurationError(emailError)) {
        throw new ApiError(503, "Contact email delivery is not configured.");
      }
      console.error("Contact email delivery failed:", emailError);
      throw new ApiError(503, "Contact email delivery is temporarily unavailable.");
    }

    return NextResponse.json({ data: { sent: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
