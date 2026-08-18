import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
  stripeClient = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion });
  return stripeClient;
}

export function resetStripeClientForTests() {
  stripeClient = null;
}
