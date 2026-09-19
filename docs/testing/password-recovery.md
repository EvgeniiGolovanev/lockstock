# Password recovery acceptance

Password recovery uses the existing Supabase email flow and the public
`/forgot-password` and `/reset-password` pages. The reset page validates the
recovery credentials with Supabase, removes them from the URL, and keeps its
session in memory separately from the normal browser login. Reloading the reset
page requires opening the email link again or requesting another link.

## Deployment configuration

Before release, add `https://lockstockapp.com/reset-password` to the production
Supabase Auth redirect allow list. Keep the canonical Site URL configured and
verify SMTP delivery. The recovery email template must retain Supabase's
confirmation URL so the link is verified before redirecting to the application.
Use `supabase/templates/recovery.html` for the Reset Password email body in
hosted Supabase Auth. Local configuration already selects this template; it
offers only the supported reset link, without an alternative code.
The application uses the default implicit flow; custom token-hash or PKCE email
templates are not supported by this page.

Local configuration includes both localhost and 127.0.0.1 on port 3000. Restart
local Supabase to apply configuration changes, without resetting the database.
Supabase Auth's email rate limits apply to recovery requests. No service-role
key is used in the browser.

## Acceptance checks

Use a disposable test account and the local email inbox before production:

1. Request recovery from the sign-in form. Check the neutral confirmation and
   the email's redirect target.
2. Open the email link in a fresh browser context. Check that the URL fragment
   disappears and the new-password form appears.
3. Submit mismatched passwords, then matching passwords of at least eight
   characters. Check that the first submission is rejected and the second
   succeeds.
4. Follow Back to sign in. Verify the old password fails and the new one works.
5. Open the reset page without a link and with an expired or consumed link.
   Check that no password form appears and a new link can be requested.
6. Repeat with an existing login for a different account. Recovery must not
   overwrite that account's persisted session or change its password.
7. Check English and French at desktop and mobile widths.

Run focused automated checks with:

```powershell
npx.cmd vitest run tests/auth/password-recovery.test.ts tests/ui/password-recovery.test.tsx
npx.cmd playwright test tests/e2e/password-recovery.spec.ts
npm.cmd run verify
```

Local success does not establish production SMTP delivery or redirect settings.
The browser regression tests intercept Auth responses; they verify the SDK/UI
integration and isolation, not real email delivery.

For real local acceptance, start the local app on port 3000 with this project's
local Supabase URL and anon key, then run:

```powershell
node scripts/verify-password-recovery.mjs
```

This requires the Supabase CLI, running local Supabase with Mailpit, and the
Playwright Chromium browser. It creates a unique local Auth user, checks mail
delivery and the password change, and removes that user in a cleanup step. It
does not reset the database or modify existing accounts.

Verified on September 13, 2026: real local email delivery, recovery redirect,
URL credential removal, password update, rejection of the old password, login
with the new password, and rejection of the consumed email link all passed.
Production SMTP and redirect allow-list configuration were not changed.
