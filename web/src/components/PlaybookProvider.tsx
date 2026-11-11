"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Content, Role, Term, Tool } from "@/lib/types";
import { fmtDate } from "@/lib/text";
import UnderReview from "./UnderReview";
import { useMounted, usePref } from "@/lib/prefs";
import ToolDrawer from "./ToolDrawer";
import SearchDialog from "./SearchDialog";
import AccountMenu from "./AccountMenu";
import { useMemberContent } from "./useMemberContent";
import styles from "./PlaybookProvider.module.css";

// The playbook shell: header, tabs and the overlays every view shares (scouting-report drawer,
// search, tooltips, term pop-ups, toast, "back to report" bar). Views read content and helpers
// through usePlaybook().

type Focus = { kind: "play" | "sys" | "term"; id: string } | null;
type Ctx = {
  content: Content;
  roleById: Record<string, Role>;
  sdgById: Record<string, string>;
  toolById: Record<string, Tool>;
  catOf: (t: Tool) => { label: string; color: string };
  role: string;
  setRole: (r: string) => void;
  openTool: (id: string) => void;
  goTo: (kind: "play" | "sys" | "term", id: string, fromTool?: string) => void;
  focus: Focus;
  clearFocus: () => void;
  copyText: (text: string, el?: HTMLElement | null) => void;
};

const PlaybookContext = createContext<Ctx | null>(null);
export const usePlaybook = () => {
  const c = useContext(PlaybookContext);
  if (!c) throw new Error("usePlaybook must be used inside PlaybookProvider");
  return c;
};

const TABS = [
  { href: "/", label: "The Roster", count: (c: Content) => c.tools.length },
  { href: "/top-5", label: "Top 5 by Role" },
  { href: "/plays", label: "The Plays", count: (c: Content) => c.plays.length },
  { href: "/system-prompts", label: "System Prompts", count: (c: Content) => c.systemPrompts.length },
  { href: "/lingo", label: "Lingo & Acronyms", count: (c: Content) => c.terms.length },
];
const VIEW_FOR = { play: "/plays", sys: "/system-prompts", term: "/lingo" };
const ROLE_KEY = "aipbs:role";

export default function PlaybookProvider({ content: cached, children }: { content: Content; children: ReactNode }) {
  const content = useMemberContent(cached);
  const router = useRouter();
  const pathname = usePathname();
  const maps = useMemo(() => ({
    roleById: Object.fromEntries(content.roles.map((r) => [r.id, r])),
    sdgById: Object.fromEntries(content.sdgTargets.map((s) => [s.id, s.text])),
    toolById: Object.fromEntries(content.tools.map((t) => [t.id, t])),
    catById: Object.fromEntries(content.categories.map((c) => [c.id, c])),
  }), [content]);
  const catOf = useCallback((t: Tool) => maps.catById[t.cat] ?? { label: t.cat, color: "var(--ink-soft)" }, [maps]);

  const [role, setRole] = usePref<string>(ROLE_KEY, "");

  const [drawerTool, setDrawerTool] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const [backTool, setBackTool] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = useCallback((msg: string) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2200); }, []);

  const openTool = useCallback((id: string) => { setSearchOpen(false); setDrawerTool(id); }, []);
  const goTo = useCallback((kind: "play" | "sys" | "term", id: string, fromTool?: string) => {
    setDrawerTool(null); setSearchOpen(false); setBackTool(fromTool ?? null);
    setFocus({ kind, id });
    if (pathname !== VIEW_FOR[kind]) router.push(VIEW_FOR[kind]);
  }, [pathname, router]);
  const clearFocus = useCallback(() => setFocus(null), []);

  const copyText = useCallback(async (text: string, el?: HTMLElement | null) => {
    try { await navigator.clipboard.writeText(text); say("Copied. Paste it into your AI tool."); }
    catch {
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); }
      say("Select the text and copy it with your keyboard.");
    }
  }, [say]);

  // "/" opens search from anywhere except text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea, [contenteditable]") && !searchOpen) { e.preventDefault(); setSearchOpen(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Memoized: every view reads this, so a new object would re-render the page whenever the drawer,
  // search or toast changes.
  const ctx = useMemo<Ctx>(() => ({ content, ...maps, catOf, role, setRole, openTool, goTo, focus, clearFocus, copyText }),
    [content, maps, catOf, role, setRole, openTool, goTo, focus, clearFocus, copyText]);

  return (
    <PlaybookContext.Provider value={ctx}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <svg width="72" height="50" viewBox="0 0 72 50" aria-hidden="true">
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5 L18 18 M18 5 L5 18" stroke="var(--blue)" strokeWidth="4.5" />
                <circle cx="61" cy="33" r="8" stroke="var(--pop)" strokeWidth="4.5" />
                <path d="M12 25 C 13 46, 33 48, 41 37" stroke="var(--ink)" strokeWidth="3.6" strokeDasharray="5 5" />
              </g>
              <polygon points="49,27 47.5,40.5 37,33" fill="var(--ink)" />
            </svg>
            <h1 className={styles.title}>AI Playbook <span className={styles.titleFor}>for Schools</span></h1>
            <span className={styles.demoStack}>
              <span className={styles.demo} tabIndex={0} data-tip="This is a demo. The tools are real, but the role picks, plays and wording are sample content for review. Prices and privacy notes are rechecked on official sites; nothing here is district-approved.">Demo · sample content</span>
              <span className={styles.checks}>
                <span className={styles.checkedDate}>Tools last checked <time dateTime={content.checkedOn}>{fmtDate(content.checkedOn)}</time> · <UnderReview /></span>
                <Link href="/what-we-check" className={styles.howLink}>How we check the tools →</Link>
              </span>
            </span>
            <span className={styles.motto}>Teach smart. Lead bold. Go team!</span>
            <span className={styles.tagline}>AI Game plans for teachers, counselors, admin &amp; the whole school staff</span>
            <span className={styles.spacer} />
            <button type="button" className={styles.searchBtn} onClick={() => setSearchOpen(true)} aria-keyshortcuts="/">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M11 11l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <span>Search tools, plays &amp; terms</span><kbd>/</kbd>
            </button>
            <AccountMenu />
          </div>
          <nav className={styles.tabs} aria-label="Sections">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={styles.tab} aria-current={pathname === t.href ? "page" : undefined} onClick={() => setBackTool(null)}>
                {t.label}{t.count && <span className="count">{t.count(content)}</span>}
              </Link>
            ))}
          </nav>
        </header>

        <main id="main">
        {children}
        </main>

        <footer className={styles.footer}>
          <p className={styles.footerLine}><span className={styles.footerMotto}>Teach smart. Lead bold. Go team!</span><span>· Demo with sample content. Always confirm prices and privacy terms on the vendor&apos;s site and with your district.</span></p>
        <div className={styles.notice}>
          <span className={styles.stamp}>Demo</span>
          <p>
            <b>Sample content for school staff.</b> The tools are real and their prices and privacy notes were checked on official sites on {fmtDate(content.checkedOn)} (<Link href="/what-we-check">how we check tools</Link>). Role picks, plays and prompts are examples. Each tool has an <b>Equity check</b> and each play shows the <button type="button" className="term" data-term="sdg4">SDG 4</button> targets it supports. Before anyone uses a tool with student information, check your <button type="button" className="term" data-term="aup">district AI policy</button> and whether the district has a signed <button type="button" className="term" data-term="dpa">DPA</button> with that vendor.
          </p>
        </div>
        </footer>
      </div>

      <ToolDrawer toolId={drawerTool} onClose={() => setDrawerTool(null)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Overlays terms={content.terms} drawerOpen={!!drawerTool} searchOpen={searchOpen} onGoTerm={(id) => goTo("term", id)} />
      {backTool && maps.toolById[backTool] && (
        <div className={styles.backbar}>
          <button type="button" className="btn primary" onClick={() => { const id = backTool; setBackTool(null); router.push("/"); openTool(id); }}>
            ← Back to {maps.toolById[backTool].name} report
          </button>
        </div>
      )}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </PlaybookContext.Provider>
  );
}

const EDGE = 12; // minimum gap between a tooltip or pop-up and the edge of its frame

/** The visible box a floating layer must stay inside: its host dialog, clipped to the screen (minus scrollbars). */
function frame(el: HTMLElement) {
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const host = el.parentElement;
  const h = host && host !== document.body ? host.getBoundingClientRect() : { left: 0, top: 0, right: vw, bottom: vh };
  return { left: Math.max(0, h.left), top: Math.max(0, h.top), right: Math.min(vw, h.right), bottom: Math.min(vh, h.bottom) };
}

/** Center el below its anchor (above if there's more room there), then clamp it inside the frame. */
function place(el: HTMLElement, a: DOMRect, b: ReturnType<typeof frame>, gap: number) {
  const { width: w, height: h } = el.getBoundingClientRect();
  const left = Math.max(b.left + EDGE, Math.min(a.left + a.width / 2 - w / 2, b.right - w - EDGE));
  const below = a.bottom + gap, above = a.top - gap - h;
  const top = below + h <= b.bottom - EDGE || b.bottom - a.bottom >= a.top - b.top ? below : above;
  el.style.left = left + "px";
  el.style.top = Math.max(b.top + EDGE, Math.min(top, b.bottom - h - EDGE)) + "px";
}

/** Tooltips for [data-tip] and glossary terms, and the term pop-up. Rendered inside an open dialog so they show above it. */
function Overlays({ terms, drawerOpen, searchOpen, onGoTerm }: { terms: Term[]; drawerOpen: boolean; searchOpen: boolean; onGoTerm: (id: string) => void }) {
  const [tip, setTip] = useState<{ el: HTMLElement } | null>(null);
  const [pop, setPop] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null), popRef = useRef<HTMLDivElement>(null);
  // For tap-again-to-close: which word's bubble was open when the latest tap started, and whether it was a touch.
  const openTip = useRef<HTMLElement | null>(null), openAtTap = useRef<HTMLElement | null>(null), touchTap = useRef(false);
  useEffect(() => { openTip.current = tip?.el ?? null; }, [tip]);
  const termById = useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const mounted = useMounted();
  const host = !mounted ? null
    : (searchOpen && document.getElementById("searchDlg")) || (drawerOpen && document.getElementById("drawer")) || document.body;

  useEffect(() => {
    const target = (e: Event) => (e.target as HTMLElement).closest?.(".term, [data-tip]") as HTMLElement | null;
    // Keep the same state object while the pointer stays on one element, so the tip isn't re-measured.
    const show = (el: HTMLElement) => setTip((p) => (p?.el === el ? p : { el }));
    const over = (e: Event) => { const t = target(e); if (t) show(t); };
    const out = (e: Event) => { if (target(e)) setTip(null); };
    const focusIn = (e: Event) => { const t = target(e); if (t) show(t); else setTip(null); };
    const click = (e: MouseEvent) => {
      const term = (e.target as HTMLElement).closest(".term") as HTMLElement | null;
      if (term && !popRef.current?.contains(term)) { e.preventDefault(); setTip(null); setPop({ id: term.dataset.term!, anchor: term }); return; }
      const h = (e.target as HTMLElement).closest("[data-tip]") as HTMLElement | null;
      // On touch screens, tapping the word whose bubble is already open closes it (like a switch).
      if (h) { e.preventDefault(); e.stopPropagation(); if (touchTap.current && h === openAtTap.current) setTip(null); else show(h); }
    };
    const down = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      touchTap.current = e.pointerType === "touch"; openAtTap.current = openTip.current;
      if (!el.closest("[data-tip], .term")) setTip(null);
      if (!popRef.current?.contains(el) && !el.closest(".term")) setPop(null);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPop((p) => { if (p) { e.preventDefault(); e.stopPropagation(); p.anchor.focus({ preventScroll: true }); } return null; }); };
    const scroll = () => setTip(null);
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("click", click, true);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key, true);
    // Capture, so scrolling inside the scouting report or search dialog also hides the tooltip.
    document.addEventListener("scroll", scroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("click", click, true);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("scroll", scroll, { capture: true });
    };
  }, []);

  // Keep the tooltip and term pop-up fully inside the frame they're drawn in (the page, the
  // scouting report or the search dialog): never cut off by an edge, on any screen size.
  useLayoutEffect(() => {
    const t = tipRef.current; if (!tip || !t) return;
    const b = frame(t); t.style.maxWidth = Math.max(0, Math.min(320, b.right - b.left - 2 * EDGE)) + "px";
    place(t, tip.el.getBoundingClientRect(), b, 8);
  }, [tip]);
  useLayoutEffect(() => {
    const p = popRef.current; if (!pop || !p) return;
    p.querySelector<HTMLElement>("[data-popgo]")?.focus({ preventScroll: true });
    if (innerWidth <= 600) { p.style.left = ""; p.style.top = ""; return; }
    place(p, pop.anchor.getBoundingClientRect(), frame(p), 10);
  }, [pop]);

  if (!host) return null;
  const tipTerm = tip?.el.classList.contains("term") ? termById[tip.el.dataset.term!] : null;
  const popTerm = pop ? termById[pop.id] : null;
  return createPortal(
    <>
      {tip && (tipTerm || tip.el.dataset.tip) && (
        <div id="tip" className={styles.tip} role="tooltip" ref={tipRef}>
          {tipTerm ? <><b>{tipTerm.abbr}</b> · {tipTerm.full}<br />{tipTerm.def}<span className={styles.tipMore}>Click for more</span></> : tip.el.dataset.tip}
        </div>
      )}
      {popTerm && (
        <div id="termPop" className={styles.termPop} role="dialog" aria-modal="false" aria-labelledby="termPopTitle" ref={popRef}>
          <div className={styles.termHead}>
            <div><div className={styles.termAbbr} id="termPopTitle">{popTerm.abbr}</div><div className={styles.termFull}>{popTerm.full}</div></div>
            <button type="button" className="x" aria-label="Close" onClick={() => setPop(null)}>×</button>
          </div>
          <p>{popTerm.def}</p>
          <div className={styles.termActions}>
            <button type="button" className="btn small primary" data-popgo onClick={() => { setPop(null); onGoTerm(popTerm.id); }}>See in glossary →</button>
            <button type="button" className="btn small ghost" onClick={() => setPop(null)}>Close</button>
          </div>
        </div>
      )}
    </>,
    host,
  );
}

