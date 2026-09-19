# Google sign-in setup

LockStock uses Google through Supabase Auth. Configure both Google Cloud and
Supabase before using **Continue with Google**. Adding the application code
does not enable the hosted provider. No database migration is required.

## Configure Google

Create a Google Cloud project or use your existing project, then open
[Google Auth Platform](https://console.cloud.google.com/auth/overview).

1. Configure Branding with the LockStock name, support contact, application
   homepage, privacy policy, and terms URLs.
2. Choose the appropriate Audience. For public signup, use an external audience;
   while testing, add the Google accounts that will test the integration.
3. Use only the identity scopes: `openid`, `userinfo.email`, and
   `userinfo.profile`. Gmail and Drive access are not needed.
4. Create a client under **Clients**, with type **Web application**.
5. Add your application origin under **Authorized JavaScript origins**, for
   example `https://lockstockapp.com`.
6. Under **Authorized redirect URIs**, add the exact callback shown on the
   Supabase Google provider settings page, normally
   `https://<project-ref>.supabase.co/auth/v1/callback`.
7. Copy the Client ID and Client Secret into Supabase's Google provider settings.
   Keep the secret out of Git, browser code, and `NEXT_PUBLIC_*` variables.

The Google callback belongs to Supabase. It is different from the LockStock
callback below. Use separate OAuth clients for local and production environments.
See the [Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Configure hosted Supabase

In your production project's Authentication settings:

1. Enable Google and save the Client ID and Client Secret.
2. Set **Site URL** to the application's canonical origin.
3. Add `https://lockstockapp.com/auth/callback` to **Redirect URLs** (substitute
   your actual application origin). Add each supported origin explicitly.
4. Keep existing email confirmation and password recovery redirect entries.

Use HTTPS in production. Test with the Google application's allowed audience
before making the Google application available to everyone.

## Configure local Supabase

This repository uses API port `55321`, not the default `54321`.

1. In the development OAuth client, register the application origin, for example
   `http://127.0.0.1:3000`, and this Google redirect URI:
   `http://127.0.0.1:55321/auth/v1/callback`.
2. Set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` in your untracked local
   environment file used by the Supabase CLI.
3. In `supabase/config.toml`, set `[auth.external.google].enabled` to `true`.
   The checked-in default is disabled so credentials are optional for other
   development tasks.
4. Restart the local Supabase stack to apply Auth configuration. Do not reset
   the database or remove volumes. A restart briefly interrupts local services.
5. Run the application and use the same origin throughout the sign-in flow.
   Both localhost and 127.0.0.1 callback URLs at port 3000 are listed in the
   local config. If you use a different port, add its exact callback URL.

## Application behavior

The main page, payment page, and signed-out workbench offer Google sign-in.
The integration retains the existing Supabase browser session architecture:
the SDK consumes the OAuth token fragment, and API calls use its bearer token.
Email/password signup and the isolated password recovery client are unchanged.

The initiating tab remembers the return destination and signup choices for
30 minutes. Callback errors are shown in English or French; provider error
details and callback credentials are removed from the URL. Return destinations
are restricted to known application pages.

After login, LockStock loads memberships from the authenticated API and retains
the selected workspace only when it belongs to that user. Membership failures
stop the flow instead of being interpreted as an empty account.

Users without a workspace complete their name, company, and trial/paid choice
at `/auth/complete`. Trial activation uses the existing billing endpoint. Paid
signup continues to payment; it does not create a trial. Existing members skip
this step, with no profile overwrite or trial activation.

Supabase can link identities with the same email according to its verification
rules. A different Google email is a different account; this change does not
add manual account linking. See
[identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Verify before release

Automated tests exercise application behavior and the real browser SDK with
controlled Auth HTTP responses. They do not prove the Google Cloud credentials,
hosted redirect settings, or live identity linking work.

Run `npm run verify`, then
`npx playwright test tests/e2e/google-auth.spec.ts tests/e2e/password-recovery.spec.ts`.
Complete these live checks with dedicated test accounts after configuration:

1. Sign in with an existing Google-linked user; reload and verify workspace access.
2. Sign in using the same verified email as an existing password account. Verify
   the same Auth user ID, memberships, and subscription; verify password login.
3. Use a new Google account. Complete the trial flow and verify one workspace and
   one trial. Repeat with a separate account choosing a paid plan.
4. Start from annual payment and verify the interval survives the round trip.
5. Cancel Google consent, retry, and verify useful EN/FR errors.
6. Switch accounts in one browser and verify the previous workspace is not used.
7. Verify existing password recovery and email confirmation flows.
