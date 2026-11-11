// Builds out/ai-playbook-for-schools-demo.mp4 from raw/ (record.mjs) and vo/ (tts.cjs).
const fs = require("fs");
const { execFileSync } = require("child_process");
const FF = require("ffmpeg-static");
const run = (args) => execFileSync(FF, ["-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const m = require("./raw/marks.json");
const ids = Object.keys(m).filter((k) => /^v\d+$/.test(k));
const from = m.v01 - 0.4, total = m.end - from;
fs.mkdirSync("build", { recursive: true }); fs.mkdirSync("out", { recursive: true });
run(["-ss", String(from), "-i", m.file, "-t", total.toFixed(2), "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,fade=in:d=0.5", "-an", "-c:v", "libx264", "-crf", "18", "build/video.mp4"]);
const at = (id) => Math.round((m[id] - from + 0.3) * 1000);
run([...ids.flatMap((id) => ["-i", `vo/${id}.wav`]), "-filter_complex",
  `${ids.map((id, i) => `[${i}:a]adelay=${at(id)}|${at(id)}[a${i}]`).join(";")};${ids.map((_, i) => `[a${i}]`).join("")}amix=inputs=${ids.length}:normalize=0,apad,atrim=0:${total.toFixed(2)},loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
  "-map", "[a]", "-ar", "48000", "build/vo.wav"]);
// Music: "Life of Riley" by Kevin MacLeod (incompetech.com), CC BY 4.0. Looped low, ducked under the voice, faded out.
run(["-stream_loop", "-1", "-i", "assets/life-of-riley.mp3", "-t", total.toFixed(2),
  "-af", `volume=0.22,afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(2)}:d=3`, "-ar", "48000", "build/music.wav"]);
run(["-i", "build/music.wav", "-i", "build/vo.wav", "-filter_complex",
  "[0:a][1:a]sidechaincompress=threshold=0.03:ratio=2.5:attack=20:release=400[duck];[duck][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11[a]",
  "-map", "[a]", "-ar", "48000", "build/mix.wav"]);
run(["-i", "build/video.mp4", "-i", "build/mix.wav", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "out/ai-playbook-for-schools-demo.mp4"]);
console.log("total", total.toFixed(1), "s");
