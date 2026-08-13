import { getSupabaseServiceClient } from "@/lib/supabase-service";

export type StripeWebhookLedgerState = {
  event_id: string;
  event_type: string;
  event_created_at: string;
  status: "processing" | "processed" | "failed";
  attempt_count: number;
  claimed_at: string | null;
  processed_at: string | null;
  failed_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  claimed: boolean;
};

export async function claimStripeWebhookEvent(event: { id: string; type: string; created: number }) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created_at: new Date(event.created * 1000).toISOString()
  });
  if (error) throw error;
  return data as StripeWebhookLedgerState;
}

export async function completeStripeWebhookEvent(eventId: string) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("complete_stripe_webhook_event", { p_event_id: eventId });
  if (error) throw error;
}

export async function failStripeWebhookEvent(eventId: string, errorCode: string, errorMessage: string) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.rpc("fail_stripe_webhook_event", {
    p_event_id: eventId,
    p_error_code: errorCode,
    p_error_message: errorMessage
  });
  if (error) throw error;
}
