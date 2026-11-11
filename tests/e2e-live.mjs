// Live-site end-to-end tests: 26 happy-path and 14 edge-case checks, as a visitor.
// Never signs in, creates accounts or changes data. Read-only against the live site.
//
// Run from the repo root (uses Playwright from video/; run `npm install` there once):
//   node tests/e2e-live.mjs
// Test another address (e.g. a Vercel preview or `next start` on port 3100):
//   SITE=http://localhost:3100 node tests/e2e-live.mjs
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(path.join(repo, "video/package.json"));
const { chromium } = req("playwright");
const L = process.env.SITE || "https://ai-playbook-for-schools-nfw1.vercel.app";
const results = [];
const ok = (group, name, pass, note = "") => { results.push({ group, name, pass, note }); console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name}${note ? "  — " + note : ""}`); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const closeDrawer = async () => { await p.keyboard.press("Escape"); await p.waitForFunction(() => !document.querySelector("#drawer[open]"), null, { timeout: 3000 }).catch(() => {}); };
const openReport = async (id) => {
  await p.locator(`#tool-${id}`).getByRole("button", { name: /scouting/i }).click();
  await p.waitForSelector("#drawer[open]", { timeout: 5000 });
  await p.waitForTimeout(150);
};
const H = "happy path", E = "edge case";

// ---------- Happy path ----------
await p.goto(L + "/", { waitUntil: "networkidle" });
const cards = await p.locator("main article").count();
ok(H, "Home shows every tool", cards >= 19, `${cards} tools`);
const checked = ((await p.locator("header").innerText()).match(/Tools last checked\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/) || [])[1];
ok(H, 'Date under the Demo bubble reads "Tools last checked …"', !!checked, checked);
for (const [role, re] of [["Teachers", /MagicSchool|Amira|Claude/], ["Special Ed", /Diffit|Read&Write|Goalbook/], ["Counselors", /Gemini|TalkingPoints/], ["Administrators", /Copilot|ParentSquare|Edthena/], ["Front Office", /Gemini|TalkingPoints/], ["Coaches", /NotebookLM|MagicSchool|Edthena/]]) {
  const btn = p.getByRole("button", { name: new RegExp("^" + role) }).first();
  await btn.click(); await p.waitForTimeout(250);
  const first = await p.locator("main article h3").first().innerText();
  ok(H, `Pick "${role}": a top pick comes first`, re.test(first), first);
  await btn.click(); await p.waitForTimeout(150);
}
await p.getByRole("button", { name: "Free for teachers" }).click(); await p.waitForTimeout(250);
const freeCount = await p.locator("main article").count();
ok(H, 'Free-for-teachers filter narrows the list and shows "Filters on"', freeCount < cards && /Filters on/.test(await p.locator("[role=status]").first().innerText()), `${freeCount} tools`);
await p.getByRole("button", { name: "Clear filters" }).click(); await p.waitForTimeout(250);
ok(H, "Clear filters restores the full list and returns focus to search", (await p.locator("main article").count()) === cards && (await p.evaluate(() => document.activeElement?.id)) === "q");
await p.selectOption("#category", "family"); await p.waitForTimeout(250);
ok(H, "Category: Family communication shows its tools", (await p.locator("main article").count()) >= 2);
await p.selectOption("#category", ""); await p.waitForTimeout(150);
const ids = await p.locator("main article").evaluateAll((els) => els.map((e) => e.id.replace("tool-", "")));
const bad = [];
for (const id of ids) {
  await openReport(id);
  const txt = await p.locator("#drawer").innerText();
  if (!(/Student data & privacy/i.test(txt) && /Where your data goes/i.test(txt) && txt.includes(`Checked on the official site ${checked}`) && !/[‚√Ã]/.test(txt))) bad.push(id);
  await closeDrawer();
}
ok(H, `All ${ids.length} Scouting Reports open with privacy facts, where data goes, the date and clean text`, bad.length === 0, bad.join(", "));
await openReport("eduaide");
ok(H, '"Confirmed: not offered" appears (Eduaide)', /Confirmed: not offered/i.test(await p.locator("#drawer").innerText()));
await closeDrawer();
await p.getByRole("button", { name: "Under review" }).click(); await p.waitForSelector("dialog[open]");
const ur = await p.locator("dialog[open]").innerText();
ok(H, "Under review pop-up lists tools, with no counts", /Curipod/.test(ur) && /Brisk/.test(ur) && !/\b\d+\s+(facts|items)\b/i.test(ur));
await p.locator("dialog[open]").getByRole("button", { name: "Curipod" }).click(); await p.waitForSelector("#drawer[open]");
ok(H, "Tapping a tool in Under review opens its Scouting Report", /Curipod/.test(await p.locator("#drawerTitle").innerText()));
await closeDrawer();
const fb = p.locator("#tool-chatgpt .pv", { hasText: "FERPA" }).first();
await fb.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await fb.hover(); await p.waitForTimeout(300);
const tip = await p.evaluate(() => document.getElementById("tip")?.textContent || "");
ok(H, "A badge bubble shows only its own topic (ChatGPT FERPA)", /FERPA/.test(tip) && !/COPPA|train/.test(tip), tip.slice(0, 80));
await p.getByRole("link", { name: "How we check the tools →" }).click(); await p.waitForURL(/what-we-check/);
ok(H, 'The "How we check the tools →" link under the date opens the page', /what-we-check/.test(p.url()));
await p.goto(L + "/what-we-check", { waitUntil: "networkidle" });
ok(H, "How we check the tools page loads", /How we check the tools/i.test(await p.locator("main").innerText()));
await p.goto(L + "/plays", { waitUntil: "networkidle" });
const plays = await p.locator("main article").count(), locks = await p.getByText(/members only/i).count();
ok(H, "Plays: every play shows, with members-only locks for visitors", plays >= 25 && locks > 0, `${plays} plays, ${locks} lock notes`);
await p.getByRole("button", { name: "Copy prompt" }).first().click(); await p.waitForTimeout(400);
const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ""));
ok(H, "Copy prompt on a free play copies the text and confirms", clip.length > 40 && /copied/i.test(await p.locator("body").innerText()), `${clip.length} characters`);
ok(H, 'Locked previews end with a clean "…"', !/‚Ä/.test(await p.locator("main").innerText()) && /…/.test(await p.locator("main").innerText()));
await p.goto(L + "/system-prompts", { waitUntil: "networkidle" });
ok(H, "System prompts page loads", (await p.locator("main article").count()) >= 6);
await p.goto(L + "/top-5", { waitUntil: "networkidle" });
ok(H, "Top 5 page loads", (await p.locator("main").innerText()).length > 200);
await p.goto(L + "/lingo", { waitUntil: "networkidle" });
ok(H, "Lingo glossary loads", (await p.locator("main [id^=term-]").count()) > 30);
await p.goto(L + "/", { waitUntil: "networkidle" });
await p.keyboard.press("/"); await p.waitForSelector("#searchDlg[open]"); await p.keyboard.type("FERPA"); await p.waitForTimeout(400);
ok(H, 'Search (press "/") finds FERPA', /FERPA/.test(await p.locator("#searchDlg").innerText()));
await p.keyboard.press("Escape");
await p.goto(L + "/sign-in", { waitUntil: "networkidle" });
const si = await p.locator("main").innerText();
ok(H, "Sign-in page offers email, Google and Microsoft", /email/i.test(si) && /Google/.test(si) && /Microsoft/.test(si));

// ---------- Edge cases ----------
await p.goto(L + "/", { waitUntil: "networkidle" });
await p.fill("#q", "zzzz-no-such-tool"); await p.waitForTimeout(350);
ok(E, "Search with no matches shows a friendly empty state", (await p.locator("main article").count()) === 0 && (await p.locator(".empty, [class*=empty]").count()) > 0);
await p.fill("#q", "<img src=x onerror=window.__pwn=1>"); await p.waitForTimeout(350);
ok(E, "HTML typed into search is treated as text, never run", !(await p.evaluate(() => window.__pwn)));
await p.fill("#q", "K–12"); await p.waitForTimeout(400);
const dashHits = await p.locator("main article").count();
ok(E, "Search with a special dash (K–12) finds tools", dashHits > 0, `${dashHits} results`);
await p.fill("#q", "   "); await p.waitForTimeout(300);
ok(E, "Search with only spaces shows every tool", (await p.locator("main article").count()) === cards);
await p.fill("#q", "");
await p.getByRole("button", { name: "Free for teachers" }).click();
await p.selectOption("#category", "family");
await p.getByRole("button", { name: /Signs district DPAs/ }).click(); await p.waitForTimeout(350);
const combo = await p.locator("main article").count();
ok(E, "Stacking filters down to zero results still offers Clear filters", combo > 0 || (await p.getByRole("button", { name: "Clear filters" }).count()) > 0, `${combo} results`);
await p.getByRole("button", { name: "Clear filters" }).first().click().catch(() => {});
const r404 = await p.goto(L + "/no-such-page", { waitUntil: "networkidle" });
ok(E, "A made-up address shows a 404 page", r404.status() === 404, `status ${r404.status()}`);
await p.goto(L + "/admin", { waitUntil: "networkidle" });
const adminTxt = await p.locator("main").innerText();
ok(E, "Admin page shows no admin tools to visitors", /sign in/i.test(adminTxt) && !/Approve|Decline/.test(adminTxt));
await p.goto(L + "/my-activity", { waitUntil: "networkidle" });
ok(E, "My ratings & feedback asks visitors to sign in", /sign in/i.test(await p.locator("main").innerText()));
const acct = await p.goto(L + "/account", { waitUntil: "networkidle" });
ok(E, "Account settings (if live) asks visitors to sign in", acct.status() === 404 || /sign in/i.test(await p.locator("main").innerText()), acct.status() === 404 ? "not live yet (#37)" : "");
await p.goto(L + "/membership", { waitUntil: "networkidle" });
ok(E, "Membership page loads for visitors", (await p.locator("main").innerText()).length > 50);
await p.goto(L + "/sign-in", { waitUntil: "networkidle" });
const email = p.locator("input[type=email]").first();
await email.fill("not-an-email"); await email.press("Enter"); await p.waitForTimeout(400);
ok(E, "Sign-in rejects a malformed email before sending anything", await email.evaluate((e) => !e.checkValidity()));
await p.goto(L + "/plays#play-does-not-exist", { waitUntil: "load" }); await p.waitForSelector("main article");
ok(E, "A link to a play that doesn't exist still loads the Plays page", (await p.locator("main article").count()) === plays);
const pm = await b.newPage({ viewport: { width: 375, height: 812 }, colorScheme: "dark" });
await pm.goto(L + "/", { waitUntil: "networkidle" });
await pm.getByRole("button", { name: "Under review" }).click(); await pm.waitForSelector("dialog[open]");
ok(E, "Phone, dark mode: Under review pop-up fits the screen", await pm.evaluate(() => { const r = document.querySelector("dialog[open]").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1; }));
await pm.close();
ok(E, "No JavaScript errors during the visit", errors.filter((e) => !/favicon|ERR_ABORTED|status of 404/.test(e)).length === 0, errors.filter((e) => !/favicon|ERR_ABORTED|status of 404/.test(e)).slice(0, 2).join(" | "));
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length} of ${results.length} passed`);
await b.close();
process.exit(fails.length ? 1 : 0);
