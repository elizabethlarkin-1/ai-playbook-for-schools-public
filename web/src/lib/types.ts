// Content shapes shared by the database, the seed file (src/data/content.json) and the UI.

export type Role = { id: string; label: string; one: string; tag: string; hint: string; sort: number };
export type Subject = { id: string; label: string; sort: number };
export type Category = { id: string; label: string; color: string };
export type SdgTarget = { id: string; text: string };

export type Persona = { id: string; why: string; top?: boolean };
/** "yes" | "limited" | "no" | "review" */
export type FreeStatus = "yes" | "limited" | "no" | "review";
export type Privacy = {
  ferpa: boolean;
  ferpaNote?: string;
  coppa: boolean | null;
  coppaNote?: string;
  /** "yes" = vendor signs DPAs, "district" = covered by a district contract, "none" = confirmed: no DPA published, "review" = unconfirmed */
  dpa: "yes" | "district" | "none" | "review";
  dpaNote: string;
  students: boolean;
  studentsNote: string;
  /** Other privacy facts (AI training, security certifications, other laws). Shown only in the scouting report, never in a badge's bubble. */
  dataNote?: string;
  /** Where your data goes, from the company's own pages. A part with `check` isn't fully stated and is listed under Under review. */
  location?: Location;
};
export type LocationPart = { t: string; check?: boolean };
export type Location = { hq: LocationPart; stored: LocationPart; processed: LocationPart };
export type Connection = { n: string; v: boolean; via?: string };
export type Connects = { roster: Connection[]; lms: Connection[]; grades: Connection[]; paid?: string; note?: string };
export type EquityItem = { s: "ok" | "warn" | "unknown"; t: string };
export type Equity = { free: EquityItem; device: EquityItem; lang: EquityItem; access: EquityItem };

export type Tool = {
  id: string;
  name: string;
  company: string;
  cat: string;
  ease: number;
  verified: boolean;
  subjects: string[];
  desc: string;
  uses: string[];
  personas: Persona[];
  free: FreeStatus;
  pricing: string;
  privacy: Privacy;
  connects?: Connects;
  equity?: Equity;
  review?: string;
  urls: string[];
  /** Things we confirmed on the vendor's own pages that the tool doesn't have. Shown in the scouting report. */
  notOffered?: string[];
};

export type Term = { id: string; abbr: string; full: string; kind: "school" | "privacy" | "ai"; def: string };

export type Play = {
  id: string;
  no: number;
  sdg: string[];
  incl?: boolean;
  title: string;
  roles: string[];
  subjects: string[];
  student: boolean;
  tools: string[];
  prompt: string;
  tip: string;
  /** Members-only item (set by the database). */
  membersOnly?: boolean;
  /** True when this viewer only has a preview: prompt is the first line, tip/example are empty. */
  locked?: boolean;
};

export type SystemPrompt = {
  id: string;
  title: string;
  roles: string[];
  where: string;
  whereText: string;
  prompt: string;
  example?: string;
  tryIt: string;
  /** Members-only item (set by the database). */
  membersOnly?: boolean;
  /** True when this viewer only has a preview: prompt is the first line, tip/example are empty. */
  locked?: boolean;
};

export type TopFiveItem = { role: string; rank: number; kind: "play" | "sys"; refId: string; why: string };

export type Content = {
  checkedOn: string;
  roles: Role[];
  subjects: Subject[];
  categories: Category[];
  ease: Record<string, string>;
  sdgTargets: SdgTarget[];
  tools: Tool[];
  terms: Term[];
  plays: Play[];
  systemPrompts: SystemPrompt[];
  topFive: TopFiveItem[];
  /** Demo-only "Top rated by [role]" examples (setting example_role_badges); empty before launch. */
  exampleRoleBadges?: { tool: string; role: string }[];
};
