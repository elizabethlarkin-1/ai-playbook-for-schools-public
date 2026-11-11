// Records the demo walkthrough of ../index.html in one take, scene by scene.
// Each scene runs its actions, then holds until its voice-over line (vo/<id>.wav) has room to finish.
// Writes raw/marks.json (scene start times) and the raw .webm.
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import FF from "ffmpeg-static";

const W = 1440, H = 810;
const dur = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const s = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); return +s[1] * 3600 + +s[2] * 60 + +s[3]; } };
const page = fs.readFileSync("../index.html", "utf8");
fs.writeFileSync("page.html", `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${page}</body></html>`);
fs.rmSync("raw", { recursive: true, force: true }); fs.mkdirSync("raw");

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: "light", recordVideo: { dir: "raw", size: { width: W, height: H } }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage(); const t0 = Date.now();
await p.goto(new URL("page.html", import.meta.url).href);
await p.evaluate(() => document.fonts.ready);
// A visible cursor and a caption banner, styled to match the playbook.
await p.addStyleTag({ content: `
  #vcur { position: fixed; z-index: 99999; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 3px solid #e0267a; background: rgba(224,38,122,.18); pointer-events: none; transition: transform .12s; left: -50px; top: -50px; }
  #vcur.down { transform: scale(.7); background: rgba(224,38,122,.45); }
  #vcap { position: fixed; z-index: 99998; left: 50%; bottom: 34px; transform: translateX(-50%); background: #2a1d3d; color: #fff; border: 3px solid #e0267a; box-shadow: 5px 5px 0 #e0267a; font: 900 30px/1.1 "Big Shoulders Display", sans-serif; letter-spacing: .05em; text-transform: uppercase; padding: 12px 26px; border-radius: 14px; white-space: nowrap; pointer-events: none; transition: opacity .35s; }
  #vcap:empty { opacity: 0; }
  #vend { position: fixed; inset: 0; z-index: 99997; display: grid; place-content: center; text-align: center; gap: 14px; background: #f7f3fc; background-image: radial-gradient(#dcd0ec 1px, transparent 1px); background-size: 22px 22px; opacity: 0; transition: opacity .8s; pointer-events: none; }
  #vend h1 { font: 900 96px/1 "Big Shoulders Display", sans-serif; text-transform: uppercase; color: #2a1d3d; margin: 0; }
  #vend h1 span { color: #e0267a; }
  #vend p { font: 900 40px/1.1 "Big Shoulders Display", sans-serif; text-transform: uppercase; letter-spacing: .04em; color: #e0267a; margin: 0; }
  #vend small { font: 400 20px/1.4 "Atkinson Hyperlegible", sans-serif; color: #66597a; }` });
await p.evaluate(() => {
  const c = document.createElement("div"); c.id = "vcur"; document.body.append(c);
  const cap = document.createElement("div"); cap.id = "vcap"; document.body.append(cap);
  const end = document.createElement("div"); end.id = "vend"; end.innerHTML = `<h1>AI Playbook <span>for Schools</span></h1><p>Teach smart. Lead bold. Go team!</p><small>Demo with sample content · tool facts checked Oct 2026</small><small style="font-size:15px">Music: “Life of Riley” by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0</small>`; document.body.append(end);
  addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
  addEventListener("mousedown", () => c.classList.add("down"), true); addEventListener("mouseup", () => c.classList.remove("down"), true);
});
await p.mouse.move(W / 2, H / 2);

const wait = (ms) => p.waitForTimeout(ms);
const cap = (t, left = "50%") => p.evaluate(([t, left]) => { const c = document.getElementById("vcap"); c.textContent = t; c.style.left = left; }, [t, left]);
let cur = { x: W / 2, y: H / 2 };
async function moveTo(sel, { dx = 0, dy = 0, steps = 28 } = {}) {
  // Keep the target clear of the sticky header and the caption banner (smooth, not a jump).
  await p.evaluate(async (sel) => {
    if (document.querySelector("dialog[open]")) return;
    const el = document.querySelector(sel), hb = document.querySelector("header.top").getBoundingClientRect().bottom, r = el.getBoundingClientRect();
    const by = r.top < hb + 20 ? r.top - hb - 60 : r.bottom > innerHeight - 120 ? r.bottom - innerHeight + 160 : 0;
    if (!by) return; const s = scrollY, n = 45;
    for (let i = 1; i <= n; i++) { scrollTo(0, s + by * (0.5 - Math.cos(Math.PI * i / n) / 2)); await new Promise((r) => setTimeout(r, 16)); }
  }, sel);
  const el = p.locator(sel).first();
  const r = await el.boundingBox(); const x = r.x + r.width / 2 + dx, y = r.y + r.height / 2 + dy;
  await p.mouse.move(x, y, { steps }); cur = { x, y };
}
async function click(sel, opts) { await moveTo(sel, opts); await wait(250); await p.mouse.down(); await wait(90); await p.mouse.up(); }
const glide = (sel, offset = 120, ms = 1300) => p.evaluate(async ([sel, offset, ms]) => {
  const el = document.querySelector(sel); const y = el.getBoundingClientRect().top + scrollY - offset;
  const s = scrollY, d = y - s, n = Math.round(ms / 16);
  for (let i = 1; i <= n; i++) { scrollTo(0, s + d * (0.5 - Math.cos(Math.PI * i / n) / 2)); await new Promise((r) => setTimeout(r, 16)); }
}, [sel, offset, ms]);

const marks = {};
async function scene(id, caption, fn, left) {
  const start = Date.now(); marks[id] = (start - t0) / 1000; await cap(caption, left);
  await fn();
  const need = (dur(`vo/${id}.wav`) + 0.9) * 1000 - (Date.now() - start);
  if (need > 0) await wait(need);
  console.log(id, marks[id].toFixed(1));
}

await wait(1200);
await scene("v01", "", async () => { await wait(1500); await moveTo(".brand .motto"); });
await scene("v02", "Every answer in one place", async () => {
  await moveTo(".demo"); await wait(2600); await moveTo("#demoNote p", { dx: -200 }); await wait(1500); await moveTo("#demoNote .term[data-term='dpa']"); await wait(2200);
});
await scene("v03", "1 · Pick your role", async () => {
  await glide(".gameplan", 250); await click("[data-role='teacher']"); await wait(900);
  await click("#subjChips [data-subj='sci']"); await wait(700); await glide("#resultLine", 240, 1500); await wait(800);
});
await scene("v04", "2 · Clean cards, details on tap", async () => {
  await moveTo(".card .persona.top"); await wait(2200);
  await moveTo(".card .pv.ok"); await wait(2200);
  await moveTo(".card .eq"); await wait(3200);
});
await scene("v05", "3 · Works with your school systems", async () => {
  await glide(".controls", 250, 900); await moveTo("#worksWith"); await wait(300);
  await p.selectOption("#worksWith", "Infinite Campus"); await wait(1700);
  await moveTo("#tool-schoolai .conn .sys:nth-of-type(4)"); await wait(2200);
  await p.selectOption("#worksWith", "Schoology"); await moveTo("#worksWith"); await wait(1600);
});
await scene("v06", "4 · Scouting report → plays", async () => {
  await p.selectOption("#worksWith", ""); await click("#tool-gemini [data-open='gemini']"); await wait(1300);
  await p.evaluate(async () => { const d = document.getElementById("drawer"), el = d.querySelector(".playlink"); const to = el.offsetTop - 260, s = d.scrollTop, n = 70; for (let i = 1; i <= n; i++) { d.scrollTop = s + (to - s) * (0.5 - Math.cos(Math.PI * i / n) / 2); await new Promise((r) => setTimeout(r, 16)); } });
  await wait(600); await click("#drawerBody .playlink[data-goto='play:newsletter']"); await wait(2600);
  await click("#backBtn"); await wait(1500);
}, "28%");
await scene("v07", "5 · Copy-ready plays", async () => {
  await click("#drawerBody [data-close]"); await wait(400); await click("#tab-plays"); await wait(600);
  await glide("#play-iep-goals", 230, 1500); await moveTo("#play-iep-goals .guard"); await wait(2200);
  await click("#play-iep-goals [data-copy]"); await wait(2400);
});
await scene("v08", "6 · SDG 4: Quality Education", async () => {
  await glide("#view-plays", 260, 1200); await moveTo("#playsOut .sdg"); await wait(2400);
  await click("#playFocus .chip.incl"); await wait(900); await glide("#play-accessible", 230, 1600); await wait(1200);
});
await scene("v09", "7 · System prompts & Top 5", async () => {
  await click("#tab-sys"); await wait(600); await glide("#sysOut", 240, 1200); await moveTo("#sys-sys-teacher pre"); await wait(2000);
  await click("#tab-top"); await wait(500); await click("#topChips [data-trole='counselor']"); await wait(1800);
});
await scene("v10", "8 · Plain-English lingo & search", async () => {
  await click("#tab-glossary"); await wait(900); await moveTo("#term-iep"); await wait(1200);
  await click("#searchBtn"); await wait(500); await p.keyboard.type("rubric", { delay: 140 }); await wait(1600);
});
await scene("v11", "", async () => {
  await p.keyboard.press("Escape"); await p.evaluate(() => scrollTo(0, 0)); await p.mouse.move(-60, -60, { steps: 10 });
  await wait(300); await p.evaluate(() => { document.getElementById("vcur").style.display = "none"; document.getElementById("vend").style.opacity = 1; }); await wait(2500);
});
marks.end = (Date.now() - t0) / 1000 + 0.6; await wait(600);
const v = p.video(); await p.close(); marks.file = await v.path();
fs.writeFileSync("raw/marks.json", JSON.stringify(marks, null, 2));
await ctx.close(); await b.close();
console.log("done", marks.end.toFixed(1));
