// Builds the pitch video (cap 4:00) from raw/ (record.mjs) and vo/ (../tts.cjs at the normal voice speed, as in the Appointique video):
//   out/ai-playbook-pitch.mp4             voice + music, with closed captions in a strip below the picture
//   out/ai-playbook-pitch-no-captions.mp4 the same without captions
//   out/captions.srt / captions.vtt        the captions as files (for players and web pages)
//   out/ai-playbook-pitch-music-only.mp4  music only, for recording your own voice (e.g. in iMovie)
//   out/cue-sheet.md                      every line's start time, for reading along
// Music: "Life of Riley" by Kevin MacLeod (incompetech.com), CC BY 4.0. Credited on the end card.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const FF = require(path.join(__dirname, "../node_modules/ffmpeg-static"));
const run = (args) => execFileSync(FF, ["-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const m = require("./raw/marks.json");
const ids = Object.keys(m).filter((k) => /^[bdt]\d+$/.test(k));
const first = Math.min(...ids.map((k) => m[k])), from = Math.max(0, first - 0.2), total = m.end - from; // start once the title card is fully on (no blend with the page behind it)
if (total > 247) console.warn(`WARNING: ${total.toFixed(1)} s is longer than planned (about 4:06)`);
fs.mkdirSync("build", { recursive: true }); fs.mkdirSync("out", { recursive: true });

run(["-ss", String(from), "-i", m.file, "-t", total.toFixed(2), "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,fade=in:d=0.6", "-an", "-c:v", "libx264", "-crf", "18", "build/video.mp4"]);
const at = (id) => Math.round((m[id] - from + 0.3) * 1000);
run([...ids.flatMap((id) => ["-i", `vo/${id}.wav`]), "-filter_complex",
  `${ids.map((id, i) => `[${i}:a]adelay=${at(id)}|${at(id)}[a${i}]`).join(";")};${ids.map((_, i) => `[a${i}]`).join("")}amix=inputs=${ids.length}:normalize=0,apad,atrim=0:${total.toFixed(2)},loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
  "-map", "[a]", "-ar", "48000", "build/vo.wav"]);
// The sticky-note pop, placed where the note pops in.
if (m.pop) run(["-i", "build/vo.wav", "-i", path.join(__dirname, "../assets/pop.wav"), "-filter_complex",
  `[1:a]volume=0.6,adelay=${Math.round((m.pop - from) * 1000)}|${Math.round((m.pop - from) * 1000)}[p];[0:a][p]amix=inputs=2:normalize=0:duration=first[a]`,
  "-map", "[a]", "-ar", "48000", "build/vo-pop.wav"]), fs.renameSync("build/vo-pop.wav", "build/vo.wav");
// Softer pops for the sticky notes inside the demo.
for (const [i, t] of (m.pops || []).entries()) {
  const d = Math.round((t - from) * 1000);
  run(["-i", "build/vo.wav", "-i", path.join(__dirname, "../assets/pop.wav"), "-filter_complex",
    `[1:a]volume=0.3,adelay=${d}|${d}[p];[0:a][p]amix=inputs=2:normalize=0:duration=first[a]`, "-map", "[a]", "-ar", "48000", `build/vo-p${i}.wav`]);
  fs.renameSync(`build/vo-p${i}.wav`, "build/vo.wav");
}
run(["-stream_loop", "-1", "-i", path.join(__dirname, "../assets/life-of-riley.mp3"), "-t", total.toFixed(2),
  "-af", `volume=0.20,afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(2)}:d=3`, "-ar", "48000", "build/music.wav"]);
run(["-i", "build/music.wav", "-i", "build/vo.wav", "-filter_complex",
  "[0:a][1:a]sidechaincompress=threshold=0.03:ratio=2.5:attack=20:release=400[duck];[duck][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
  "-map", "[a]", "-ar", "48000", "build/mix.wav"]);
const mux = (audio, out) => run(["-i", "build/video.mp4", "-i", audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
// Closed captions in a strip below the picture (the picture shrinks slightly, so nothing is covered).
execFileSync("node", [path.join(__dirname, "captions.cjs")], { stdio: "inherit", cwd: __dirname });
run(["-i", "build/video.mp4", "-vf",
  "scale=1766:-2,pad=1920:1080:77:0:color=0x2a1d3d,subtitles=out/captions.srt:fontsdir=/System/Library/Fonts/Supplemental:force_style='FontName=Arial,Bold=1,FontSize=11,PrimaryColour=&H00FFFFFF,BorderStyle=1,Outline=0,Shadow=0,Alignment=2,MarginV=6'",
  "-c:v", "libx264", "-crf", "18", "-an", "build/video-cc.mp4"]);
run(["-i", "build/video-cc.mp4", "-i", "build/mix.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "out/ai-playbook-pitch.mp4"]);
mux("build/mix.wav", "out/ai-playbook-pitch-no-captions.mp4");
mux("build/music.wav", "out/ai-playbook-pitch-music-only.mp4");

const lines = Object.fromEntries(fs.readFileSync("lines.txt", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("|")), l.slice(l.indexOf("|") + 1).replace(/[{}]/g, "")]));
const t = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
fs.writeFileSync("out/cue-sheet.md", `# AI Playbook pitch: cue sheet\n\nTotal ${t(total)}. Start reading each line at its time.\n\n| Start | Line |\n| --- | --- |\n${ids.map((id) => `| ${t(m[id] - from + 0.3)} | ${lines[id]} |`).join("\n")}\n`);
console.log("total", total.toFixed(1), "s → out/");
