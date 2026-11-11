// Turns database and storage errors into messages people can act on. Raw messages ("new row violates
// row-level security policy…") go to the browser console for developers, never on screen.

type DbError = { code?: string; message?: string } | null | undefined;

export const SIGNED_OUT = "Your sign-in changed or ran out. Refresh the page, sign in again if asked, and try once more.";

export function friendly(error: DbError, action: string): string {
  if (!error) return "";
  console.warn(`Couldn't ${action}:`, error.code ?? "", error.message ?? error);
  // Our own database messages (limits like "one waiting-for-review feedback per tool") are written for people.
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501" || /row-level security|jwt|not authorized|unauthorized/i.test(error.message ?? "")) return SIGNED_OUT;
  // The account behind the sign-in no longer exists.
  if (error.code === "23503" && /user_id/.test(error.message ?? "")) return SIGNED_OUT;
  if (error.code === "23514") return "Please check what you entered and try again.";
  return `We couldn't ${action}. Please try again in a minute.`;
}
