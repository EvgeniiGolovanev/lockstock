import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/contact/route";
import { resetContactRateLimit } from "@/lib/api/contact-rate-limit";
import { sendTransactionalEmail } from "@/lib/api/mailer";

vi.mock("@/lib/api/mailer", () => ({
  sendTransactionalEmail: vi.fn()
}));

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetContactRateLimit();
    vi.mocked(sendTransactionalEmail).mockResolvedValue();
  });

  it("sends contact messages to the LockStock contact inbox", async () => {
    const request = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        message: "I would like to talk about inventory setup."
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.sent).toBe(true);
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "contact@lockstockapp.com",
        subject: "New LockStock contact request from Ada Lovelace",
        text: expect.stringContaining("ada@example.com"),
        replyTo: "ada@example.com"
      })
    );
  });

  it("rejects invalid contact payloads", async () => {
    const request = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "not-an-email",
        message: ""
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Validation failed");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("rejects honeypot submissions without sending email", async () => {
    const request = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        message: "I would like to talk about inventory setup.",
        website: "https://spam.example"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Could not send your message.");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("rate limits repeated contact submissions from the same client", async () => {
    const createRequest = () =>
      new NextRequest("http://localhost:3000/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.10"
        },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          message: "I would like to talk about inventory setup."
        })
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(createRequest());
      expect(response.status).toBe(200);
    }

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many contact requests. Please try again later.");
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(5);
  });

  it("returns a safe error when email delivery is not configured", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(new Error("Missing required environment variable: RESEND_API_KEY"));
    const request = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        message: "I would like to talk about inventory setup."
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Contact email delivery is not configured.");
    expect(body.error).not.toContain("RESEND_API_KEY");
  });

  it("returns a safe error when the email provider cannot be reached", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(new TypeError("fetch failed"));
    const request = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Ada Lovelace",
        email: "ada@example.com",
        message: "I would like to talk about inventory setup."
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Contact email delivery is temporarily unavailable.");
    expect(body.error).not.toContain("fetch failed");
  });
});
