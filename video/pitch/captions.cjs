// Builds closed captions (out/captions.srt and out/captions.vtt) timed to the voiceover.
// Each line is split into short phrases; every phrase is voiced on its own with the same voice and speed
// to measure how long it takes, and the phrases are then fitted to the real length of that line's audio.
// Run after record.mjs (needs raw/marks.json and vo/*.wav):  node captions.cjs
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const FF = require(path.join(__dirname, "../node_modules/ffmpeg-static"));
const NORMAL = Number(process.env.TTS_RATE || 175), SLOW = 118; // must match ../tts.cjs
const MAX = 62; // characters per caption (one line in the caption strip)

const m = require("./raw/marks.json");
const ids = Object.keys(m).filter((k) => /^[bdt]\d+$/.test(k));
const from = Math.max(0, Math.min(...ids.map((k) => m[k])) - 0.2); // same start as assemble.cjs
const lines = Object.fromEntries(fs.readFileSync("lines.txt", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("|")), l.slice(l.indexOf("|") + 1)]));
const dur = (f) => { try { execFileSync(FF, ["-i", f], { stdio: "pipe" }); } catch (e) { const s = String(e.stderr).match(/Duration: (\d+):(\d+):([\d.]+)/); return +s[1] * 3600 + +s[2] * 60 + +s[3]; } };

// Phrase splitting: sentences and clauses first, then long ones at a word boundary near the middle.
function phrases(text) {
  const parts = text.split(/(?<=[.:;?!])\s+|(?<=,)\s+(?=\S)/).filter(Boolean);
  const out = [];
  const push = (p) => {
    if (p.length <= MAX) return out.push(p);
    const words = p.split(" "); let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(" ").length - p.length / 2); if (d < bestDiff) { bestDiff = d; best = i; } }
    push(words.slice(0, best).join(" ")); push(words.slice(best).join(" "));
  };
  // Join tiny clauses with the next one so captions don't flicker.
  let buf = "";
  for (const p of parts) { const joined = buf ? `${buf} ${p}` : p; if (joined.length < 28) { buf = joined; continue; } push(joined); buf = ""; }
  if (buf) out.length && (out[out.length - 1] + " " + buf).length <= MAX ? (out[out.length - 1] += " " + buf) : push(buf);
  return out;
}

// How long one phrase takes in this voice (trimmed of silence, like tts.cjs).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cap-"));
const cache = {};
function spoken(text, slow) {
  const key = `${slow}|${text}`; if (cache[key]) return cache[key];
  const aiff = path.join(tmp, "p.aiff"), wav = path.join(tmp, "p.wav");
  execFileSync("say", ["-r", String(slow ? SLOW : NORMAL), "-o", aiff, text]);
  execFileSync(FF, ["-loglevel", "error", "-y", "-i", aiff, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.07", wav]);
  return (cache[key] = dur(wav));
}

const cues = [];
for (const id of ids) {
  const raw = lines[id];
  // Keep slow {braced} parts separate (they're voiced at the slow speed), and split the rest into phrases.
  const segs = raw.split(/(\{[^}]+\})/).filter((s) => s.trim()).flatMap((s) => s.startsWith("{")
    ? [{ text: s.slice(1, -1).trim(), slow: true }]
    : phrases(s.trim()).map((t) => ({ text: t, slow: false })));
  const lens = segs.map((s) => spoken(s.text, s.slow));
  const placed = m[id] - from + 0.3; // where this line's audio file starts in the video
  const lineStart = placed + 0.3;     // after its lead-in silence
  const speech = dur(`vo/${id}.wav`) - 0.3;
  // Slow {braced} parts are voiced exactly as measured; only the normal-speed phrases are fitted to the rest of the line.
  const slowTotal = segs.reduce((a, s, i) => a + (s.slow ? lens[i] : 0), 0);
  const normTotal = segs.reduce((a, s, i) => a + (s.slow ? 0 : lens[i]), 0) || 1;
  const k = Math.max(0.5, (speech - slowTotal) / normTotal);
  segs.forEach((s, i) => { if (!s.slow) lens[i] *= k; });
  // First guess from those lengths.
  let t = lineStart; const lineCues = [];
  segs.forEach((s, i) => { const d = lens[i]; lineCues.push({ start: t, end: t + d, text: s.text, slow: s.slow }); t += d; });
  // Then anchor to the voice's real pauses: every place speech starts again after a short silence in this line's audio.
  const det = spawnSync(FF, ["-nostdin", "-i", `vo/${id}.wav`, "-af", "silencedetect=noise=-38dB:d=0.1", "-f", "null", "-"], { encoding: "utf8" });
  const onsets = [...det.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((x) => placed + Number(x[1]));
  const anchors = [{ i: 0, t: lineStart }];
  lineCues.forEach((c, i) => {
    if (!i) return;
    const prev = lineCues[i - 1].text, sentence = /[.:;?!]$/.test(prev) || c.slow || lineCues[i - 1].slow, clause = /,$/.test(prev);
    if (!sentence && !clause) return;
    const win = sentence ? 1.4 : 0.6;
    // Speech resumes after a pause, so prefer the first restart from just before the guess onward.
    const near = onsets.filter((o) => o >= c.start - (sentence ? 0.5 : 0.3) && o <= c.start + win && o > anchors[anchors.length - 1].t + 0.4);
    if (near.length) anchors.push({ i, t: near[0] });
  });
  anchors.push({ i: lineCues.length, t: lineStart + speech });
  // Space the phrases between two anchors by their measured lengths.
  for (let a = 0; a < anchors.length - 1; a++) {
    const { i: i0, t: t0 } = anchors[a], { i: i1, t: t1 } = anchors[a + 1];
    const span = lens.slice(i0, i1).reduce((x, y) => x + y, 0) || 1; let tt = t0;
    for (let i = i0; i < i1; i++) { const d = (t1 - t0) * lens[i] / span; lineCues[i].start = tt; lineCues[i].end = tt + d; tt += d; }
  }
  cues.push(...lineCues);
}
// Tidy: a short gap between cues, a minimum on-screen time, and never overlapping the next cue.
for (let i = 0; i < cues.length; i++) {
  const next = cues[i + 1];
  cues[i].end = Math.max(cues[i].end, cues[i].start + 1.0);
  if (next) cues[i].end = Math.min(cues[i].end, next.start - 0.04);
}
const ts = (s, sep) => { const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = Math.floor(s % 60), ms = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(se).padStart(2, "0")}${sep}${String(ms).padStart(3, "0")}`; };
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/captions.srt", cues.map((c, i) => `${i + 1}\n${ts(c.start, ",")} --> ${ts(c.end, ",")}\n${c.text}\n`).join("\n"));
fs.writeFileSync("out/captions.vtt", "WEBVTT\n\n" + cues.map((c) => `${ts(c.start, ".")} --> ${ts(c.end, ".")}\n${c.text}\n`).join("\n"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(cues.length, "captions → out/captions.srt, out/captions.vtt");
