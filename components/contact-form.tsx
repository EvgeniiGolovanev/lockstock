"use client";

import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export function ContactForm() {
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
        throw new Error(body.error || "Could not send your message.");
      }

      form.reset();
      setState("sent");
    } catch (submitError) {
      setState("error");
      setError((submitError as Error).message);
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="grid grid-2">
        <label className="field">
          <span>Name</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>

      <label className="field">
        <span>Company</span>
        <input name="company" autoComplete="organization" />
      </label>

      <label className="contact-form-honeypot" aria-hidden="true">
        <span>Website</span>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="field">
        <span>Message</span>
        <textarea name="message" rows={7} required />
      </label>

      {state === "sent" ? <p className="contact-form-success">Message sent. We will reply by email.</p> : null}
      {state === "error" ? <p className="contact-form-error">{error}</p> : null}

      <button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
