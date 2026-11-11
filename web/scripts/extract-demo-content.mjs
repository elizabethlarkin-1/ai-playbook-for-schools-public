// One-time export: reads the content constants from the original single-file demo (../index.html)
// and writes them to src/data/content.json, the seed for the database and the app's fallback.
import fs from "node:fs";

const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const start = script.indexOf("// ---------- data (demo) ----------");
const end = script.indexOf("// ---------- state ----------");
const body = script.slice(start, end);
const names = ["CHECKED", "ROLES", "SUBJECTS", "CATS", "EASE", "SDG", "UNDER_REVIEW", "TOOLS", "TERMS", "PLAYS", "SYSP", "WHERE", "TOP5"];
const read = new Function(`${body}; return { ${names.join(", ")} };`);
const c = read();

const content = {
  checkedOn: c.CHECKED,
  roles: Object.entries(c.ROLES).map(([id, r], i) => ({ id, ...r, sort: i })),
  subjects: Object.entries(c.SUBJECTS).map(([id, label], i) => ({ id, label, sort: i })),
  categories: Object.entries(c.CATS).map(([id, x]) => ({ id, ...x })),
  ease: c.EASE,
  sdgTargets: Object.entries(c.SDG).map(([id, text]) => ({ id, text })),
  tools: c.TOOLS,
  terms: c.TERMS,
  plays: c.PLAYS,
  systemPrompts: c.SYSP.map((x) => ({ ...x, whereText: c.WHERE[x.where] })),
  topFive: Object.entries(c.TOP5).flatMap(([role, items]) => items.map(([kind, refId, why], i) => ({ role, rank: i + 1, kind, refId, why }))),
};
fs.writeFileSync(new URL("../src/data/content.json", import.meta.url), JSON.stringify(content, null, 2) + "\n");
console.log(Object.fromEntries(Object.entries(content).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v])));
