// Checks the database's security rules with a throwaway non-admin account.
// Run against the LOCAL Supabase only (supabase start), never production:
//   node --env-file=.env.local scripts/check-security.mjs
import { createClient } from "@supabase/supabase-js";

// Accepts either key naming style (anon/service_role or publishable/secret).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url?.includes("127.0.0.1") && !url?.includes("localhost")) throw new Error("Refusing to run: point .env.local at the local Supabase.");
const admin = createClient(url, service, { auth: { persistSession: false } });

const email = `rls-check-${Date.now()}@example.test`, password = `pw-${crypto.randomUUID()}`;
const { data: created, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (ce) throw ce;
const me = created.user.id;
const user = createClient(url, anon, { auth: { persistSession: false } });
const { error: se } = await user.auth.signInWithPassword({ email, password });
if (se) throw se;

let failures = 0;
const check = (name, ok) => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) failures++; };

const { data: profiles } = await user.from("profiles").select("id");
check("a user sees only their own profile", profiles.length === 1 && profiles[0].id === me);

const { data: content } = await user.from("tools").select("id");
check("anyone can read playbook content", content.length > 0);

const { error: ownUpdate } = await user.from("profiles").update({ role_id: "counselor" }).eq("id", me);
check("a user can update their own answers", !ownUpdate);

const { error: emailUpdate } = await user.from("profiles").update({ email: "someone@else.test" }).eq("id", me);
check("a user can't change their profile email", !!emailUpdate);

// Account settings: when the sign-in email changes (after both confirmations), the profile copy follows.
const synced = `rls-synced-${Date.now()}@example.test`;
await admin.auth.admin.updateUserById(me, { email: synced, email_confirm: true });
const { data: syncedProfile } = await admin.from("profiles").select("email").eq("id", me).single();
check("a confirmed email change updates the profile email", syncedProfile?.email === synced);

const { data: others } = await user.from("profiles").update({ display_name: "hacked" }).neq("id", me).select("id");
check("a user can't edit anyone else's profile", !others || others.length === 0);

const { error: selfAdmin } = await user.from("admins").insert({ user_id: me });
check("a user can't add themselves to admins", !!selfAdmin);

const { error: rpcAdmin } = await user.rpc("set_admin", { target: me, make: true });
check("a user can't make themselves admin through set_admin", !!rpcAdmin);

const { error: contentWrite } = await user.from("tools").update({ name: "hacked" }).eq("id", "magicschool");
const { data: tool } = await admin.from("tools").select("name").eq("id", "magicschool").single();
check("a user can't change playbook content", tool.name !== "hacked" || !!contentWrite);

const { error: notOfferedWrite } = await user.from("tools").update({ not_offered: ["Everything"] }).eq("id", "magicschool");
const { data: toolNo } = await admin.from("tools").select("not_offered").eq("id", "magicschool").single();
check("a user can't change a tool's \"not offered\" list", !toolNo.not_offered.includes("Everything") || !!notOfferedWrite);
const { error: tooManyNo } = await admin.from("tools").update({ not_offered: Array.from({ length: 13 }, (_, i) => `Item ${i}`) }).eq("id", "magicschool");
check("a tool's \"not offered\" list can't grow oversized", !!tooManyNo);

// ---- Phase 3: ratings, feedback, voice files, approvals, settings ----
const { error: rateOwn } = await user.from("ratings").upsert({ user_id: me, tool_id: "magicschool", stars: 4 });
check("a user can rate a tool", !rateOwn);

// Role-based ranking, step 1: each rating keeps the rater's role, set by the database.
const roleOf = async () => (await admin.from("ratings").select("rater_role").eq("user_id", me).eq("tool_id", "brisk").single()).data?.rater_role;
await user.from("ratings").upsert({ user_id: me, tool_id: "brisk", stars: 5 });
check("a rating saves the rater's role from their profile", (await roleOf()) === "counselor");
await user.from("ratings").upsert({ user_id: me, tool_id: "brisk", stars: 4, rater_role: "admin" });
check("a user can't set the role on their rating", (await roleOf()) === "counselor");
await user.from("profiles").update({ role_id: "teacher" }).eq("id", me);
await user.from("ratings").upsert({ user_id: me, tool_id: "brisk", stars: 3 });
check("re-rating after a role change saves the new role", (await roleOf()) === "teacher");
await user.from("profiles").update({ role_id: "counselor" }).eq("id", me);

const { data: other } = await admin.auth.admin.createUser({ email: `rls-other-${Date.now()}@example.test`, password, email_confirm: true });
const otherId = other.user.id;
const { error: rateOther } = await user.from("ratings").upsert({ user_id: otherId, tool_id: "magicschool", stars: 1 });
check("a user can't rate as someone else", !!rateOther);

const { data: stats } = await createClient(url, anon, { auth: { persistSession: false } }).rpc("tool_stats");
check("anyone (even signed out) can read rating numbers", stats?.some((r) => r.tool_id === "magicschool" && r.rating_count >= 1));

const body = "This is a test review that is long enough to be accepted by the check.";
const { error: selfApproved } = await user.from("feedback").insert({ user_id: me, tool_id: "brisk", kind: "text", body, status: "approved" });
check("a user can't submit feedback as already approved", !!selfApproved);

const { data: fb, error: fbErr } = await user.from("feedback").insert({ user_id: me, tool_id: "brisk", kind: "text", body }).select("id, status").single();
check("a user can submit feedback (it starts as pending)", !fbErr && fb?.status === "pending");

const { data: selfReview } = await user.from("feedback").update({ status: "approved" }).eq("id", fb.id).select("id");
check("a user can't approve their own feedback", !selfReview || selfReview.length === 0);

const { data: otherFb } = await admin.from("feedback").insert({ user_id: otherId, tool_id: "brisk", kind: "text", body }).select("id").single();
const { data: peek } = await user.from("feedback").select("id").eq("id", otherFb.id);
check("a user can't read someone else's feedback", peek.length === 0);

const tiny = new Blob([new Uint8Array([26, 69, 223, 163])], { type: "audio/webm" });
const { error: upOwn } = await user.storage.from("voice-feedback").upload(`${me}/test.webm`, tiny, { contentType: "audio/webm" });
check("a user can upload a recording to their own folder", !upOwn);
const { error: upOther } = await user.storage.from("voice-feedback").upload(`${otherId}/test.webm`, tiny, { contentType: "audio/webm" });
check("a user can't upload into someone else's folder", !!upOther);
await admin.storage.from("voice-feedback").upload(`${otherId}/secret.webm`, tiny, { contentType: "audio/webm" });
const { error: readOther } = await user.storage.from("voice-feedback").download(`${otherId}/secret.webm`);
check("a user can't listen to someone else's recording", !!readOther);

const { error: settingErr } = await user.from("app_settings").update({ value: 365 }).eq("key", "feedback_reward_days");
const { data: setting } = await admin.from("app_settings").select("value").eq("key", "feedback_reward_days").single();
check("a user can't change the reward setting", Number(setting.value) !== 365 || !!settingErr);

// ---- Phase 4a: members-only text (0005_memberships.sql). This user isn't a member yet. ----
const anonClient = createClient(url, anon, { auth: { persistSession: false } });
const { data: guestPlays } = await anonClient.rpc("play_texts");
const lockedPlay = guestPlays?.find((p) => p.members_only), freePlay = guestPlays?.find((p) => !p.members_only);
const { data: fullPlay } = await admin.from("plays").select("prompt").eq("id", lockedPlay?.id).single();
check("signed out: members-only plays show only a preview", lockedPlay?.locked && lockedPlay.prompt.endsWith("…") && lockedPlay.prompt.length < fullPlay.prompt.length && lockedPlay.tip === "");
check("signed out: sample plays show in full", freePlay && !freePlay.locked && freePlay.prompt.length > 200);
const { data: freeSys } = await user.rpc("system_prompt_texts");
check("a free account gets previews of system prompts", freeSys?.length > 0 && freeSys.every((s) => s.locked && s.prompt.endsWith("…") && s.example === null));
const { error: rawPlay } = await user.from("plays").select("prompt").limit(1);
const { error: rawPlayAnon } = await anonClient.from("plays").select("*").limit(1);
const { error: rawSys } = await user.from("system_prompts").select("prompt").limit(1);
check("nobody can read prompt text straight from the tables", !!rawPlay && !!rawPlayAnon && !!rawSys);
const { data: titles } = await anonClient.from("plays").select("id, title").limit(1);
check("anyone can still read play titles", titles?.length === 1);

const soon = new Date(Date.now() + 30 * 864e5).toISOString();
const { error: selfSub } = await user.from("subscriptions").insert({ user_id: me, stripe_customer_id: "cus_fake", paid_through: soon, status: "active" });
check("a user can't give themselves a subscription", !!selfSub);
const { error: selfEarned } = await user.from("profiles").update({ earned_until: soon }).eq("id", me);
check("a user can't give themselves earned days", !!selfEarned);
const { error: selfEvent } = await user.from("stripe_events").insert({ id: "evt_fake", type: "x" });
check("a user can't touch the Stripe event log", !!selfEvent);
const { data: notYet } = await user.rpc("my_membership");
check("a new account isn't a member (no trial by default)", notYet?.[0]?.member === false);

// An admin approves: the person gets their membership days, once.
const adminEmail = `rls-admin-${Date.now()}@example.test`;
const { data: adm } = await admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true });
await admin.from("admins").insert({ user_id: adm.user.id });
const asAdmin = createClient(url, anon, { auth: { persistSession: false } });
await asAdmin.auth.signInWithPassword({ email: adminEmail, password });
const { error: approveErr } = await asAdmin.from("feedback").update({ status: "approved" }).eq("id", fb.id);
const { data: credits } = await user.from("membership_credits").select("days, feedback_id");
check("approving feedback gives its author membership days", !approveErr && credits.length === 1 && credits[0].feedback_id === fb.id && credits[0].days === Number(setting.value));
await asAdmin.from("feedback").update({ status: "declined" }).eq("id", fb.id);
await asAdmin.from("feedback").update({ status: "approved" }).eq("id", fb.id);
const { data: credits2 } = await user.from("membership_credits").select("id");
check("re-approving the same feedback doesn't pay twice", credits2.length === 1);

const { data: earned } = await user.rpc("my_membership");
const days = (d) => (new Date(d) - Date.now()) / 864e5;
check("approved feedback makes its author a member for the reward days", earned?.[0]?.member && Math.abs(days(earned[0].earned_until) - Number(setting.value)) < 0.1);
const { data: memberPlays } = await user.rpc("play_texts");
check("members get the full text of members-only plays", memberPlays?.find((p) => p.id === lockedPlay.id)?.prompt === fullPlay.prompt);

// Earned days start after paid time: a paying member (60 days left) gets feedback approved.
const paidThrough = new Date(Date.now() + 60 * 864e5).toISOString();
await admin.from("subscriptions").insert({ user_id: otherId, stripe_customer_id: `cus_test_${Date.now()}`, status: "active", plan: "monthly", paid_through: paidThrough });
const { data: paidFb } = await admin.from("feedback").insert({ user_id: otherId, tool_id: "diffit", kind: "text", body }).select("id").single();
await asAdmin.from("feedback").update({ status: "approved" }).eq("id", paidFb.id);
const { data: otherProfile } = await admin.from("profiles").select("earned_until").eq("id", otherId).single();
check("earned days stack after paid time", Math.abs(days(otherProfile.earned_until) - (60 + Number(setting.value))) < 0.1);
const { data: peekSub } = await user.from("subscriptions").select("user_id").eq("user_id", otherId);
check("a user can't see someone else's subscription", peekSub?.length === 0);

const { data: quotes } = await user.rpc("approved_feedback", { p_tool: "brisk" });
check("approved feedback is public without names or account ids", quotes.some((q) => q.body === body) && quotes.every((q) => !("user_id" in q) && !("email" in q)));

// ---- Limits (0004_limits.sql) ----
const send = (tool_id) => user.from("feedback").insert({ user_id: me, tool_id, kind: "text", body });
const { error: firstPending } = await send("curipod");
const { error: dupPending } = await send("curipod");
check("one waiting-for-review feedback per tool", !firstPending && /waiting for review/.test(dupPending?.message ?? ""));
for (const t of ["diffit", "eduaide", "gemini"]) await send(t);
const { error: overDaily } = await send("notebooklm");
check("feedback is limited per person per day", /a day/.test(overDaily?.message ?? ""));

const { error: tooMany } = await user.from("profiles").update({ systems: Array.from({ length: 31 }, (_, i) => `System ${i}`) }).eq("id", me);
check("profiles can't hold oversized lists", !!tooMany);

let rateLimited = false;
for (let i = 0; i < 32 && !rateLimited; i++) {
  const { error } = await user.from("ratings").upsert({ user_id: me, tool_id: "magicschool", stars: (i % 5) + 1 });
  if (error) rateLimited = /Too many ratings/.test(error.message);
}
check("rapid-fire rating changes are slowed down", rateLimited);

// Voice review: admins can correct a transcript; the person's original words are kept.
// (A fresh account, since the earlier checks used up the daily feedback limit.)
const vEmail = `rls-voice-${Date.now()}@example.test`;
const { data: vu } = await admin.auth.admin.createUser({ email: vEmail, password, email_confirm: true });
const vid = vu.user.id;
const voiceUser = createClient(url, anon, { auth: { persistSession: false } });
await voiceUser.auth.signInWithPassword({ email: vEmail, password });
const spoken = body + " (spoken)";
await voiceUser.storage.from("voice-feedback").upload(`${vid}/talk.webm`, tiny, { contentType: "audio/webm" });
const { data: voiceFb, error: vErr } = await voiceUser.from("feedback").insert({ user_id: vid, tool_id: "curipod", kind: "voice", body: spoken, audio_path: `${vid}/talk.webm` }).select("id").single();
if (vErr) console.warn("voice feedback insert:", vErr.message);
await voiceUser.from("feedback").update({ body: "I rewrote my own text after sending it" }).eq("id", voiceFb.id);
const { data: afterSelf } = await admin.from("feedback").select("body").eq("id", voiceFb.id).single();
check("a user can't edit feedback text after sending", afterSelf.body === spoken);
await asAdmin.from("feedback").update({ body: "Corrected transcript by an admin, long enough." }).eq("id", voiceFb.id);
await asAdmin.from("feedback").update({ body: "Second correction by an admin, long enough too." }).eq("id", voiceFb.id);
const { data: edited } = await admin.from("feedback").select("body, original_body").eq("id", voiceFb.id).single();
check("an admin can correct a transcript and the original words are kept", edited.body.startsWith("Second correction") && edited.original_body === spoken);
await asAdmin.from("feedback").update({ original_body: "tampered" }).eq("id", voiceFb.id);
const { data: notTampered } = await admin.from("feedback").select("original_body").eq("id", voiceFb.id).single();
check("the original words can't be overwritten", notTampered.original_body === spoken);
// Deleting your own recording early.
const { error: removeOthers } = await voiceUser.rpc("remove_my_recording", { p_feedback: otherFb.id });
check("a user can't delete someone else's recording", !!removeOthers);
const { data: myPath } = await voiceUser.rpc("remove_my_recording", { p_feedback: voiceFb.id });
await voiceUser.storage.from("voice-feedback").remove([myPath]);
const { data: stillThere } = await admin.storage.from("voice-feedback").list(vid);
const { data: textStays } = await admin.from("feedback").select("body, audio_path").eq("id", voiceFb.id).single();
check("a user can delete their own recording (the text stays)", myPath === `${vid}/talk.webm` && !(stillThere ?? []).some((f) => f.name === "talk.webm") && textStays.audio_path === null && !!textStays.body);
await voiceUser.storage.from("voice-feedback").remove([`${otherId}/secret.webm`]);
const { data: othersFiles } = await admin.storage.from("voice-feedback").list(otherId);
check("a user can't delete someone else's recording file", (othersFiles ?? []).some((f) => f.name === "secret.webm"));
await admin.auth.admin.deleteUser(vid);
// Role-based ranking, step 2: totals by role appear only at 10+ ratings, and never say who rated.
const raters = [];
for (let i = 0; i < 10; i++) {
  const { data: r } = await admin.auth.admin.createUser({ email: `rls-rater-${i}-${Date.now()}@example.test`, password, email_confirm: true });
  raters.push(r.user.id);
  await admin.from("profiles").update({ role_id: "office" }).eq("id", r.user.id);
}
const roleRow = async () => (await anonClient.rpc("tool_role_stats")).data?.find((x) => x.tool_id === "curipod" && x.role_id === "office");
for (const id of raters.slice(0, 9)) await admin.from("ratings").upsert({ user_id: id, tool_id: "curipod", stars: 5 });
check("ratings by role stay hidden below 10 raters", !(await roleRow()));
await admin.from("ratings").upsert({ user_id: raters[9], tool_id: "curipod", stars: 5 });
const shown = await roleRow();
check("ratings by role appear at 10 raters, as totals only", shown?.rating_count === 10 && Object.keys(shown).sort().join() === "avg_stars,rating_count,role_id,score,tool_id");
for (const id of raters) await admin.auth.admin.deleteUser(id);

await admin.storage.from("voice-feedback").remove([`${me}/test.webm`, `${otherId}/secret.webm`]);
await admin.auth.admin.deleteUser(otherId);
const { error: admDelete } = await admin.auth.admin.deleteUser(adm.user.id);
check("an admin's account can be deleted after they've reviewed feedback", !admDelete);
await admin.auth.admin.deleteUser(me);
console.log(failures ? `\n${failures} check(s) failed` : "\nAll security checks passed");
process.exit(failures ? 1 : 0);
