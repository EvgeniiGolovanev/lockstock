type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("EMAIL_FROM");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html ?? undefined
    })
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Failed to send email: ${raw || response.statusText}`);
  }
}
