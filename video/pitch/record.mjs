// Records the pitch video (cap 4:00) from the LIVE site (or SITE=http://localhost:3100 for a local copy).
// Scenes follow docs/demo-video-script-DRAFT.md (v3). Each scene runs its actions, then holds until its
// voice-over line (vo/<id>.wav, made by ../tts.cjs from lines.txt) has room to finish.
// Visitor only: never signs in or changes data. Writes raw/marks.json and the raw .webm.
// Run from video/pitch:  node record.mjs   then   node assemble.cjs
import { createRequire } from "node:module";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const req = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = req("playwright");
const FF = req("ffmpeg-static");

const SITE = process.env.SITE || "https://ai-playbook-for-schools-nfw1.vercel.app";
const W = 1440, H = 810;
const dur = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const s = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); return +s[1] * 3600 + +s[2] * 60 + +s[3]; } };
fs.rmSync("raw", { recursive: true, force: true }); fs.mkdirSync("raw");

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light", recordVideo: { dir: "raw", size: { width: W, height: H } }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage(); const t0 = Date.now();

// The visible cursor, caption banner, source line and title/end cards, styled like the playbook.
const OVERLAY_CSS = `
  #vcur { display: none; position: fixed; z-index: 2147483647; width: 24px; height: 24px; margin: -3px 0 0 -4px; pointer-events: none; transition: transform .12s; left: -50px; top: -50px; }
  #vcur.down { transform: scale(.85); }
  .vripple { position: fixed; z-index: 2147483646; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; border: 3px solid #cc1e6c; pointer-events: none; animation: vr .55s ease-out forwards; }
  @keyframes vr { from { opacity: .95; transform: scale(.3); } to { opacity: 0; transform: scale(1.5); } }
  #vcap { position: fixed; z-index: 2147483646; left: 50%; bottom: 34px; transform: translateX(-50%); background: #2a1d3d; color: #fff; border: 3px solid #cc1e6c; box-shadow: 5px 5px 0 #cc1e6c; font: 900 30px/1.1 "Big Shoulders", "Big Shoulders Display", sans-serif; letter-spacing: .05em; text-transform: uppercase; padding: 12px 26px; border-radius: 14px; white-space: nowrap; pointer-events: none; transition: opacity .35s, transform .35s; }
  #vcap:empty { opacity: 0; transform: translateX(-50%) translateY(20px); }
  #vsrc { position: fixed; z-index: 2147483646; left: 16px; bottom: 8px; font: 400 14px/1.3 "Atkinson Hyperlegible", sans-serif; color: #66597a; background: rgba(255,255,255,.85); padding: 2px 8px; border-radius: 6px; pointer-events: none; }
  #vsrc:empty { display: none; }
  .vcard { position: fixed; inset: 0; z-index: 2147483645; display: grid; place-content: center; text-align: center; gap: 14px; background: #f7f3fc; background-image: radial-gradient(#dcd0ec 1px, transparent 1px); background-size: 22px 22px; opacity: 0; transition: opacity .8s; pointer-events: none; padding: 40px; }
  .vcard.on { opacity: 1; }
  .vcard h1 { font: 900 96px/1 "Big Shoulders", "Big Shoulders Display", sans-serif; text-transform: uppercase; color: #2a1d3d; margin: 0; }
  .vcard h1 span { color: #cc1e6c; }
  .vcard p { font: 900 40px/1.1 "Big Shoulders", "Big Shoulders Display", sans-serif; text-transform: uppercase; letter-spacing: .04em; color: #cc1e6c; margin: 0; }
  .vcard small { font: 400 19px/1.45 "Atkinson Hyperlegible", sans-serif; color: #66597a; max-width: 1100px; margin: 0 auto; }
  .vcard .credits { font-size: 16px; }
  .vnote { position: absolute; right: 90px; bottom: 40px; width: 420px; background: #ffc8e3; border: 3px solid #2a1d3d; box-shadow: 6px 6px 0 #cc1e6c; padding: 20px 24px; text-align: left; transform: rotate(-3deg) scale(.6); opacity: 0; color: #2a1d3d; transition: transform .28s cubic-bezier(.3,1.6,.6,1), opacity .2s; }
  .vnote.on { transform: rotate(-3deg) scale(1); opacity: 1; }
  .vnext { text-align: left; place-content: center; }
  .vnext .in { width: min(1000px, 90vw); }
  .vnext h2 { font: 900 54px/1 "Big Shoulders", "Big Shoulders Display", sans-serif; text-transform: uppercase; color: #2a1d3d; margin: 0 0 6px; }
  .vnext .sub { font: 700 20px/1.3 "Atkinson Hyperlegible", sans-serif; color: #66597a; margin: 0 0 22px; }
  .vnext ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  .vnext li { font: 400 24px/1.35 "Atkinson Hyperlegible", sans-serif; color: #2a1d3d; background: #fff; border: 3px solid #2a1d3d; border-radius: 10px; box-shadow: 4px 4px 0 #cc1e6c; padding: 12px 18px; opacity: 0; transform: translateY(10px); transition: opacity .4s, transform .4s; }
  .vnext li.on { opacity: 1; transform: none; }
  .vnext li b { font-weight: 700; }
  .vnext li.ask { background: #ffc8e3; }
  .vsnote { position: fixed; z-index: 2147483647; width: 330px; background: #ffc8e3; border: 3px solid #2a1d3d; box-shadow: 5px 5px 0 #cc1e6c; padding: 16px 20px; text-align: left; transform: rotate(-2.5deg) scale(.6); opacity: 0; color: #2a1d3d; transition: transform .28s cubic-bezier(.3,1.6,.6,1), opacity .2s; pointer-events: none; }
  .vsnote.on { transform: rotate(-2.5deg) scale(1); opacity: 1; }
  .vsnote b { display: block; font: 900 24px/1.1 "Big Shoulders", "Big Shoulders Display", sans-serif; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 6px; }
  .vsnote span { display: block; font: 700 18px/1.35 "Atkinson Hyperlegible", sans-serif; }
  .vsnote .pin { position: absolute; top: -11px; left: 50%; width: 20px; height: 20px; border-radius: 50%; background: #cc1e6c; border: 3px solid #2a1d3d; transform: translateX(-50%); }
  .vnote b { display: block; font: 900 26px/1.1 "Big Shoulders", "Big Shoulders Display", sans-serif; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 8px; }
  .vnote ul { margin: 0; padding-left: 22px; font: 700 21px/1.4 "Atkinson Hyperlegible", sans-serif; }
  .vnote .pin { position: absolute; top: -12px; left: 50%; width: 22px; height: 22px; border-radius: 50%; background: #cc1e6c; border: 3px solid #2a1d3d; transform: translateX(-50%); }
  .vcard.on small { animation: vfade .7s both; } .vcard.on small.credits { animation-delay: .6s; }
  @keyframes vfade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`;
const CREDITS = "Elizabeth M. Larkin, AI-Native Developer · Cecily Hibbs, Developer · Shannon Seaver, guidance and oversight · Stone Arch Collective<br>Built with Next.js, Supabase, Vercel and Claude Code · Video: Playwright, FFmpeg, macOS voice<br>Music: “Life of Riley” by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0";
async function setup() {
  await p.evaluate(() => document.fonts.ready);
  await p.addStyleTag({ content: OVERLAY_CSS });
  await p.evaluate((credits) => {
    if (document.getElementById("vcur")) return;
    const add = (html) => { const d = document.createElement("div"); d.innerHTML = html; document.body.append(d.firstElementChild); };
    add(`<div id="vcur"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#2a1d3d" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></div>`); add(`<div id="vcap"></div>`); add(`<div id="vsrc"></div>`);
    add(`<div class="vcard" id="vtitle"><h1>AI Playbook <span>for Schools</span></h1><p>Teach smart. Lead bold. Go team!</p><div class="vnote" id="vnote"><span class="pin"></span><b>A responsible AI guide for school staff</b><ul><li>Pick your role</li><li>See the privacy and fairness facts on each AI tool</li><li>Choose tools that work for every student</li></ul></div></div>`);
    add(`<div class="vcard vnext" id="vnext"><div class="in"><h2>Coming in future phases</h2><p class="sub">Enhancements planned after the hackathon</p><ul>
      <li id="vn1"><b>District AI policy fit</b> (members): the playbook matches your district's rules</li>
      <li id="vn2"><b>Prompt builder:</b> pick a tool, say what you need, and get a prompt that keeps student data private</li>
      <li id="vn3"><b>Pilot</b> with Stone Arch Collective, starting in Minnesota</li>
      <li id="vn4"><b>Beyond the U.S.</b>, including Canada</li>
      <li id="vn5" class="ask"><b>Our ask:</b> introductions to schools and educators who want to help shape it</li></ul></div></div>`);
    add(`<div class="vcard" id="vend"><h1>AI Playbook <span>for Schools</span></h1><p>Teach smart. Lead bold. Go team!</p><small>ai-playbook-for-schools-nfw1.vercel.app · Demo with sample content · tool facts checked on official vendor sites</small><small class="credits">${credits}</small></div>`);
    const c = document.getElementById("vcur");
    addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", (e) => { c.classList.add("down"); const r = document.createElement("div"); r.className = "vripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.append(r); setTimeout(() => r.remove(), 650); }, true); addEventListener("mouseup", () => c.classList.remove("down"), true);
  }, CREDITS);
}
// Overlays are re-added after each page load (client-side navigation keeps them).
async function go(path) { await p.goto(SITE + path, { waitUntil: "load" }); await p.waitForSelector("main"); await setup(); await p.mouse.move(cur.x, cur.y); if (lastCap) await cap(...lastCap); }

const wait = (ms) => p.waitForTimeout(ms);
let lastCap = null; // re-applied after a page load, so the caption stays on screen
const cap = (t, left = "50%") => (lastCap = [t, left], p.evaluate(([t, left]) => { const c = document.getElementById("vcap"); c.textContent = t; c.style.left = left; }, [t, left]));
const src = (t) => p.evaluate((t) => { document.getElementById("vsrc").textContent = t; }, t);
const card = (id, on) => p.evaluate(([id, on]) => document.getElementById(id).classList.toggle("on", on), [id, on]);
let cur = { x: W / 2, y: H / 2 };
// Smoothly scroll an element (in the page or inside the open scouting report) to the middle, then glide the cursor to it.
async function moveTo(loc, { dx = 0, dy = 0, steps = 28 } = {}) {
  const el = typeof loc === "string" ? p.locator(loc).first() : loc;
  await el.evaluate(async (node) => {
    const box = node.closest("#drawer") ?? null;
    const r = node.getBoundingClientRect();
    // Keep targets clear of the sticky page header (when it sticks) and of the caption banner at the bottom.
    const hd = box ? null : document.querySelector("header");
    const top = hd && getComputedStyle(hd).position === "sticky" ? hd.getBoundingClientRect().bottom + 24 : 90;
    const by = r.top < top ? r.top - (top + innerHeight) / 2 + r.height / 2 : r.bottom > innerHeight - 130 ? r.bottom - (top + innerHeight) / 2 : 0;
    if (!by) return;
    const target = box ?? document.scrollingElement; const s = target.scrollTop, n = 45;
    for (let i = 1; i <= n; i++) { target.scrollTop = s + by * (0.5 - Math.cos(Math.PI * i / n) / 2); await new Promise((r) => setTimeout(r, 16)); }
  });
  await p.evaluate(() => { document.getElementById("vcur").style.display = "block"; }); // pointer appears only once the demo points at something
  const r = await el.boundingBox(); const x = r.x + r.width / 2 + dx, y = r.y + r.height / 2 + dy;
  await p.mouse.move(x, y, { steps }); cur = { x, y };
}
async function click(loc, opts) { await moveTo(loc, opts); await wait(250); await p.mouse.down(); await wait(90); await p.mouse.up(); }
const btn = (name) => p.getByRole("button", { name }).first();

const marks = { pops: [] };
// A sticky note naming a hackathon theme point. Placed inside an open dialog when there is one, so it sits above the dimmed backdrop.
async function note(title, text, where) {
  marks.pops.push((Date.now() - t0) / 1000);
  await p.evaluate(([title, text, where]) => {
    document.querySelectorAll(".vsnote").forEach((n) => n.remove());
    const n = document.createElement("div"); n.className = "vsnote"; n.style.cssText = where;
    n.innerHTML = `<i class="pin"></i><b>${title}</b><span>${text}</span>`;
    (document.querySelector("dialog[open]") || document.body).append(n);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add("on")));
  }, [title, text, where]);
}
const unnote = () => p.evaluate(() => document.querySelectorAll(".vsnote").forEach((n) => n.remove()));
async function scene(id, caption, fn, left) {
  const start = Date.now(); marks[id] = (start - t0) / 1000; await unnote(); await cap(caption, left);
  await fn();
  const need = (dur(`vo/${id}.wav`) + 0.7) * 1000 - (Date.now() - start);
  if (need > 0) await wait(need);
  console.log(id, marks[id].toFixed(1));
}

await go("/");
await card("vtitle", true); await wait(700);

await scene("b0", "", async () => {
  await wait(900); marks.pop = (Date.now() - t0) / 1000; // the sticky note pops in (pop sound added when assembling)
  await p.evaluate(() => document.getElementById("vnote").classList.add("on"));
});
await scene("b1", "Every school vets AI tools alone", async () => {
  await wait(2200); await card("vtitle", false); await wait(900);
  await src("Gallup & Walton Family Foundation, 2025 (U.S., 2024–25 school year) · Fraser Institute / Leger, 2026 (Canada, grades 6–12)");
  await wait(2500);
});
await scene("b2", "Starts with your role, not the tool", async () => {
  await src(""); await moveTo(btn(/^Teachers/)); await wait(1800); await moveTo(btn(/^Special Ed/)); await wait(1800); await moveTo(btn(/^Counselors/)); await wait(1200);
});
await scene("d1", "1 · Pick your role", async () => {
  await click(btn(/^Special Ed/)); await wait(1200);
  await moveTo(p.locator("main article h3").first()); await wait(1500);
});
await scene("d2", "2 · Filter to your school", async () => {
  await click(btn("Free for teachers")); await wait(700);
  await moveTo("#worksWith"); await p.selectOption("#worksWith", "ClassLink"); await wait(1200);
  await moveTo(p.locator("[role=status]").first()); await wait(600);
  // "Tap the i": a real click on the i, so its bubble opens because it was tapped
  const help = p.getByRole("button", { name: "How Filter this list works" });
  if (await help.count()) { await click(help); await wait(2600); }
});
await scene("d3", "3 · Facts behind every badge", async () => {
  await click(btn("Clear filters")); await wait(500);
  if ((await btn(/^Special Ed/).getAttribute("aria-pressed")) !== "true") { await click(btn(/^Special Ed/)); await wait(600); }
  // "Tap it to see exactly what they promise": click the badges
  await note("Explainable AI", "Every badge in plain words, from the company's own site", "right: 50px; top: 170px;");
  const ferpa = p.locator("main article .pv", { hasText: "FERPA" }).first();
  await click(ferpa); await wait(1900);
  const dpa = p.locator("main article .pv", { hasText: "No public DPA" }).first();
  if (await dpa.count()) { await click(dpa); await wait(1500); }
});
await scene("d4", "4 · Where your data goes", async () => {
  if (!(await p.locator("#tool-chatgpt").count())) { await click(btn(/^Special Ed/)); await wait(700); }
  await unnote();
  await click(p.locator("#tool-chatgpt").getByRole("button", { name: /scouting/i })); await wait(1300);
  const where = p.locator("#drawer .label", { hasText: "Where your data goes" });
  if (await where.count()) {
    await moveTo(where, { dx: 120 }); await wait(400);
    await note("Privacy-preserving", "Where student data is stored and processed, for every tool", "left: 70px; top: 190px;"); await wait(800);
    await click(p.getByRole("button", { name: /Data may be processed in/ })); await wait(2900);
  }
  const notOffered = p.locator("#drawer .label", { hasText: "Confirmed: not offered" });
  if (await notOffered.count()) { await moveTo(notOffered, { dx: 120 }); await wait(2000); }
}, "28%");
await scene("d5", "5 · Honest about gaps", async () => {
  await p.keyboard.press("Escape"); await wait(500); await p.evaluate(() => scrollTo({ top: 0, behavior: "smooth" })); await wait(700);
  await unnote();
  await click(btn("Under review")); await wait(500);
  await note("Digital trust", "We don't guess. Gaps are listed, not hidden", "right: 60px; top: 230px;"); await wait(1700);
  await moveTo(p.locator("dialog[open]").getByRole("link", { name: /How we check/ })); await wait(1200);
});
await scene("d6", "Facts first. Your role. Your voice.", async () => {
  // Line order: prompts first ("Copy-ready prompts protect student privacy"), then ratings ("as staff rate tools...")
  await p.keyboard.press("Escape"); await go("/plays"); await wait(400);
  const guard = p.locator("main article", { hasText: /Student info/i }).first().getByText(/Student info/i).first();
  if (await guard.count()) { await moveTo(guard); await wait(900); }
  const copy = btn("Copy prompt"); await click(copy); await wait(900);
  await go("/"); await wait(300);
  if ((await btn(/^Special Ed/).getAttribute("aria-pressed")) !== "true") { await click(btn(/^Special Ed/)); await wait(700); } // the site remembers the role
  await p.locator("main article").getByText(/Top rated by/).first().waitFor({ timeout: 5000 }).catch(() => {}); // the badge loads just after the page
  const badge = p.locator("main article", { hasText: /Top rated by/ }).first();
  if (await badge.count()) { await moveTo(badge.getByText(/Top rated by/).first()); await wait(1500); }
});
await scene("t1", "AI does the heavy lifting. People stay in charge.", async () => {
  // "Claude Code helps us research and recheck each company's own pages, and a person approves every fact"
  await go("/what-we-check"); await wait(500);
  const src = p.getByRole("heading", { name: "Where the facts come from" });
  if (await src.count()) { await moveTo(src, { dx: -150 }); await wait(400); }
  await note("AI with people in charge", "Claude Code researches · A person approves every fact", "right: 60px; top: 200px;"); await wait(4800);
  await unnote();
  // "Voice reviews become text ... and a person checks every review before it's shown"
  await go("/"); await wait(300);
  await click(p.locator("#tool-brisk").getByRole("button", { name: /scouting/i })); await wait(1000);
  const fb = p.locator("#drawer .label", { hasText: /Ratings & feedback/ });
  if (await fb.count()) { await moveTo(fb, { dx: 120 }); await wait(4000); }
}, "28%");
await scene("b4", "From every school alone to a shared public resource", async () => {
  await p.keyboard.press("Escape"); await wait(300);
  await go("/what-we-check"); await wait(800);
  // "one recheck helps every school" → "publishing what companies haven't shared" → "rankings from staff"
  for (const [h, ms] of [["We check every tool at once", 6500], ["When we can't confirm something", 6500]]) {
    const el = p.getByRole("heading", { name: h }); if (await el.count()) { await moveTo(el, { dx: -200 }); await wait(ms); }
  }
  await go("/"); await wait(300);
  if ((await btn(/^Special Ed/).getAttribute("aria-pressed")) !== "true") { await click(btn(/^Special Ed/)); await wait(700); } // the site remembers the role
  await p.locator("main article").getByText(/Top rated by/).first().waitFor({ timeout: 5000 }).catch(() => {}); // the badge loads just after the page
  const badge = p.locator("main article", { hasText: /Top rated by/ }).first();
  if (await badge.count()) { await moveTo(badge.getByText(/Top rated by/).first()); await wait(300); }
  await note("Fair by design", "One rating per person · No paid placement", "right: 60px; top: 190px;"); await wait(1700);
});
await scene("b5", "Educators decide. We fix it in the open.", async () => {
  // "they rate, review and shape the rankings, and every fact links to its source"
  await click(p.locator("#tool-brisk").getByRole("button", { name: /scouting/i })); await wait(900);
  const fb = p.locator("#drawer .label", { hasText: /Ratings & feedback/ });
  if (await fb.count()) { await moveTo(fb, { dx: 120 }); await wait(2300); }
  const official = p.locator("#drawer .label", { hasText: /Official site/ });
  if (await official.count()) { await moveTo(official, { dx: 120 }); await wait(2300); }
  await p.keyboard.press("Escape"); await wait(400); await p.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
}, "28%");
await scene("b6", "Responsible AI · UN SDG 4: Quality Education", async () => {
  await wait(7000); // "Responsible AI isn't only about how a tool is built..." over the playbook home
  // "where student data goes, whether the tool works on every device and in every language, and whether it's accessible"
  await cap("Responsible AI · UN SDG 4: Quality Education", "28%"); // keep the caption clear of the side panel
  await click(p.locator("#tool-chatgpt").getByRole("button", { name: /scouting/i }).or(p.locator("#tool-brisk").getByRole("button", { name: /scouting/i })).first()); await wait(1200);
  const where = p.locator("#drawer .label", { hasText: "Where your data goes" });
  if (await where.count()) { await moveTo(where, { dx: 120 }); await wait(5000); }
  const equity = p.locator("#drawer .label", { hasText: /Equity check/ });
  if (await equity.count()) { await moveTo(equity, { dx: 120 }); await wait(7000); }
  // "That's what UN Sustainable Development Goal 4 asks for": the SDG 4.5 target on the Plays page
  await p.keyboard.press("Escape"); await cap("Responsible AI · UN SDG 4: Quality Education"); await go("/plays"); await wait(800);
  const incl = btn(/Inclusion/); if (await incl.count()) { await click(incl); await wait(4500); }
  const sdg = p.locator("main article .sdg", { hasText: "4.5" }).first();
  if (await sdg.count()) { await click(sdg); await wait(600); }
  await note("UN SDG 4.5", "Equal access to learning for every student", "right: 60px; top: 190px;"); await wait(4400);
});
await scene("b7", "Future phases · Our ask", async () => {
  // Each point appears as it is spoken (times follow the line's wording), then the end card on the closing line.
  await p.mouse.move(-60, -60, { steps: 6 }); await p.evaluate(() => { document.getElementById("vcur").style.display = "none"; });
  await card("vnext", true);
  const line = fs.readFileSync("lines.txt", "utf8").split("\n").find((l) => l.startsWith("b7|")).slice(3).replace(/[{}]/g, "");
  const total = dur("vo/b7.wav") * 1000, start = Date.now();
  const SLOGAN = 5200; // the closing line is spoken slowly; it gets the last ~5 s
  const body = line.slice(0, line.indexOf("AI Playbook for Schools."));
  const at = (phrase) => 300 + (total - SLOGAN) * line.indexOf(phrase) / body.length;
  const until = async (ms) => { const w = ms - (Date.now() - start); if (w > 0) await wait(w); };
  for (const [id, phrase] of [["vn1", "Members will be able"], ["vn2", "And a prompt builder"], ["vn3", "Stone Arch Collective plans"], ["vn4", "As we learn"], ["vn5", "We're asking"]]) {
    await until(at(phrase)); await p.evaluate((id) => document.getElementById(id).classList.add("on"), id);
    if (id === "vn3") await note("Route to market", "A pilot with schools, starting in Minnesota", "right: 70px; top: 120px;");
  }
  await until(total - SLOGAN + 200);
  await unnote(); await cap(""); await card("vnext", false); await card("vend", true);
});
await wait(2400);
marks.end = (Date.now() - t0) / 1000;
const v = p.video(); await p.close(); marks.file = await v.path();
fs.writeFileSync("raw/marks.json", JSON.stringify(marks, null, 2));
await ctx.close(); await b.close();
console.log("done", marks.end.toFixed(1), "s from", SITE);
