begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select lives_ok(
  $$select * from public.claim_stripe_webhook_event(
    'evt_ledger_1',
    'checkout.session.completed',
    timezone('utc', now())
  )$$,
  'claims a fresh Stripe webhook event'
);

select is(
  (select claimed from public.claim_stripe_webhook_event(
    'evt_ledger_1',
    'checkout.session.completed',
    timezone('utc', now())
  ) limit 1),
  false,
  'an active in-flight duplicate is not reclaimed'
);

select lives_ok(
  $$select public.complete_stripe_webhook_event('evt_ledger_1')$$,
  'completes a claimed webhook event'
);

select is(
  (select claimed from public.claim_stripe_webhook_event(
    'evt_ledger_1',
    'checkout.session.completed',
    timezone('utc', now())
  ) limit 1),
  false,
  'a processed duplicate stays a no-op'
);

select lives_ok(
  $$select * from public.claim_stripe_webhook_event(
    'evt_ledger_2',
    'invoice.payment_failed',
    timezone('utc', now())
  )$$,
  'claims a second webhook event for failure testing'
);

select lives_ok(
  $$select public.fail_stripe_webhook_event('evt_ledger_2', 'processing_failed', 'boom')$$,
  'marks a claimed webhook event failed'
);

select is(
  (select attempt_count from public.claim_stripe_webhook_event(
    'evt_ledger_2',
    'invoice.payment_failed',
    timezone('utc', now())
  ) limit 1),
  2,
  'a failed webhook event is safely reclaimable'
);

select * from finish();

rollback;
