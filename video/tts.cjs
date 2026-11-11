// Voices one line with macOS `say` (the system voice). Parts in {braces} are spoken
// slower, as separate takes spliced in, because this voice ignores in-line rate changes.
// Usage: node tts.cjs <lines.txt> <id> <out.wav>
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const FF = require("ffmpeg-static");
const [linesFile, id, out] = process.argv.slice(2);
const NORMAL = Number(process.env.TTS_RATE || 175), SLOW = 118; // TTS_RATE speeds up the normal voice (the 3:00 pitch uses 195)

const line = fs.readFileSync(linesFile, "utf8").split("\n").find((l) => l.startsWith(id + "|"));
if (!line) throw new Error(`no line ${id}`);
const text = line.slice(id.length + 1);
const parts = text.split(/(\{[^}]+\})/).filter((s) => s.trim());
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tts-"));
const files = parts.map((part, i) => {
  const slow = part.startsWith("{"), words = slow ? part.slice(1, -1) : part;
  const aiff = path.join(tmp, `${i}.aiff`), wav = path.join(tmp, `${i}.wav`);
  execFileSync("say", ["-r", String(slow ? SLOW : NORMAL), "-o", aiff, words]);
  // Trim each take's own leading/trailing silence, then leave a short natural gap.
  execFileSync(FF, ["-loglevel", "error", "-y", "-i", aiff, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.07",
    "-ar", "48000", "-ac", "2", wav]);
  return wav;
});
const lead = path.join(tmp, "lead.wav");
execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.3", lead]);
const all = [lead, ...files];
execFileSync(FF, ["-loglevel", "error", "-y", ...all.flatMap((f) => ["-i", f]), "-filter_complex",
  `${all.map((_, i) => `[${i}:a]`).join("")}concat=n=${all.length}:v=0:a=1[a]`, "-map", "[a]", out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(id, "→", out);
