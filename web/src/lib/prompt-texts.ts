// Rows from the database's play_texts() / system_prompt_texts(), and how they map onto Play and
// SystemPrompt. Members-only items come back as a preview (locked) unless the caller is a member.

export type PlayText = { id: string; prompt: string; tip: string; members_only: boolean; locked: boolean };
export type SysText = { id: string; prompt: string; example: string | null; try_it: string; members_only: boolean; locked: boolean };

export const playTextFields = (t?: PlayText) =>
  ({ prompt: t?.prompt ?? "", tip: t?.tip ?? "", membersOnly: t?.members_only ?? false, locked: t?.locked ?? false });
export const sysTextFields = (t?: SysText) =>
  ({ prompt: t?.prompt ?? "", example: t?.example ?? undefined, tryIt: t?.try_it ?? "", membersOnly: t?.members_only ?? false, locked: t?.locked ?? false });
