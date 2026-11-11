# Sign-in and email setup (Google, Microsoft, email sender)

Three things the live site needs before real people sign in, especially for the Nov 12 demo. Stone Arch Collective owns every account. Never paste secrets in chat, email or code; they go only into the Supabase dashboard.

**Why the email sender comes first:** Supabase's built-in email only sends to people on the Stone Arch Supabase team, and only 2 emails an hour. Anyone else who asks for a sign-in link gets nothing. A custom email sender (SMTP) fixes this.

Our sign-in callback, used below: `https://<project-ref>.supabase.co/auth/v1/callback`. Copy the exact value from Supabase → **Authentication → Sign In / Providers**, on the Google or Azure provider panel.

---

## 1. Email sender (about 20 minutes, plus DNS wait)

We recommend **Resend**: it's on Supabase's list of recommended senders, and its free plan covers 100 emails a day (3,000 a month).

1. Create a Resend account for Stone Arch Collective at https://resend.com.
2. **Domains → Add domain.** Use a subdomain of a domain Stone Arch controls, for example `mail.stonearch.ai`. Resend shows DNS records (TXT and MX). Whoever manages Stone Arch's DNS adds them. Verification can take from minutes to a few hours.
3. **API Keys → Create API key** with "Sending access". Copy it. You'll paste it once, in step 4.
4. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   | Field | Value |
   | --- | --- |
   | Sender email | `playbook@mail.stonearch.ai` (any address on the verified domain) |
   | Sender name | `AI Playbook for Schools` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the Resend API key |
   Save.
5. **Authentication → Rate Limits:** with custom SMTP the email limit starts at 30 an hour. For the demo, raise "emails sent per hour" to about **100** so a room full of people can sign up.
6. Test: on the live site, request a sign-in link with a personal email address that isn't on the Supabase team. It should arrive within a minute (check spam the first time).

Optional: in **Authentication → Emails → Templates**, change the "Magic Link" email's subject and wording to match the site.

---

## 2. Google sign-in (about 15 minutes)

1. Go to https://console.cloud.google.com and create a project named "AI Playbook for Schools" (or pick a Stone Arch project).
2. Open **Google Auth Platform**:
   - **Branding:** app name "AI Playbook for Schools", a support email, and the home page `https://ai-playbook-for-schools-nfw1.vercel.app`.
   - **Audience:** choose **External**, so any Google account (including school Google Workspace accounts) can sign in. While it's in "Testing", only the test users you list can sign in; click **Publish app** before the demo.
   - **Data Access:** keep the default `email` and `profile` scopes and add `openid`. Don't add any others; extra scopes trigger a long Google review.
3. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `https://ai-playbook-for-schools-nfw1.vercel.app`
   - **Authorized redirect URIs:** the Supabase callback URL (see the top of this page).
   - Create, then copy the **Client ID** and **Client secret**.
4. In Supabase: **Authentication → Sign In / Providers → Google**: turn it on, paste the Client ID and Client secret, and save.
5. Test: on the live site, click **Continue with Google**.

---

## 3. Microsoft sign-in (about 15 minutes)

Lets staff sign in with a school Microsoft 365 account (or a personal Microsoft account).

1. Go to https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration**.
   - **Name:** AI Playbook for Schools
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts" (any school can sign in).
   - **Redirect URI:** platform **Web**, value: the Supabase callback URL.
   - Register.
2. On the app's **Overview**, copy the **Application (client) ID**.
3. **Certificates & secrets → Client secrets → New client secret.** Pick an expiry (for example 12 months) and **put a reminder in the calendar to replace it before it expires**. Copy the **Value** column, not the "Secret ID".
4. Recommended: **Manifest**, then under `optionalClaims` add the `xms_edov` and `email` claims to `idToken`, and `xms_edov` to `accessToken`, then save. This lets Supabase tell whether a Microsoft email address is verified. Back up the manifest first.
5. In Supabase: **Authentication → Sign In / Providers → Azure**: turn it on, paste the client ID and the secret value, and leave **Azure Tenant URL** empty (any school). Save. The app already asks Microsoft for the email address, which Supabase needs.
6. Test: on the live site, click **Continue with Microsoft**.

Some school districts block staff from signing in to new apps until an IT admin approves them. If a district's staff see "Need admin approval", their IT team approves "AI Playbook for Schools" in their Microsoft tenant, or they use the email link instead.

---

## 4. Check the sign-in addresses

In Supabase: **Authentication → URL Configuration**:
- **Site URL:** `https://ai-playbook-for-schools-nfw1.vercel.app`
- **Redirect URLs** include `https://ai-playbook-for-schools-nfw1.vercel.app/auth/callback`

If the site moves to a custom domain later, update the Site URL, the redirect URLs, Google's JavaScript origin, and nothing else.
