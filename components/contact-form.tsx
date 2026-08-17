"use client";

import { FormEvent, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { message } from "@/lib/i18n";

type SubmitState = "idle" | "submitting" | "sent" | "error";

const CONTACT_API_ERROR_KEYS = {
  "Contact email delivery is not configured.": "contact.deliveryNotConfigured",
  "Contact email delivery is temporarily unavailable.": "contact.deliveryUnavailable",
  "Too many contact requests. Please try again later.": "contact.rateLimited",
  "Could not send your message.": "contact.sendFailed"
} as const;

function contactErrorMessage(locale: "en" | "fr", error: Error) {
  const key = CONTACT_API_ERROR_KEYS[error.message as keyof typeof CONTACT_API_ERROR_KEYS];
  return key ? message(locale, key) : error.message;
}

export function ContactForm() {
  const { locale } = useLanguage();
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setState("submitting");
      setError("");

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          company: formData.get("company"),
          website: formData.get("website"),
          message: formData.get("message")
        })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || message(locale, "contact.sendFailed"));
      }

      form.reset();
      setState("sent");
    } catch (submitError) {
      setState("error");
      setError(contactErrorMessage(locale, submitError as Error));
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} data-i18n-rendered="true">
      <div className="grid grid-2">
        <label className="field">
          <span>{message(locale, "contact.name")}</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label className="field">
          <span>{message(locale, "contact.email")}</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>

      <label className="field">
        <span>{message(locale, "contact.company")}</span>
        <input name="company" autoComplete="organization" />
      </label>

      <label className="contact-form-honeypot" aria-hidden="true">
        <span>{message(locale, "contact.website")}</span>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="field">
        <span>{message(locale, "contact.message")}</span>
        <textarea name="message" rows={7} required />
      </label>

      {state === "sent" ? <p className="contact-form-success">{message(locale, "contact.sent")}</p> : null}
      {state === "error" ? <p className="contact-form-error">{error}</p> : null}

      <button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? message(locale, "contact.sending") : message(locale, "contact.send")}
      </button>
    </form>
  );
}
