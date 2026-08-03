/**
 * Resume Tailor sunset — AI features moved to Aspirely (https://aspirely.me).
 *
 * One source of truth for the migration copy and for WHICH parts of the
 * workspace are retired. `ResumeParser.tsx` derives its nav badges and its tab
 * bodies from `RETIRED_TABS` below, so a tab can never be marked "Moved" in
 * the sidebar while still rendering a live-looking form.
 *
 * The split mirrors the backend's `services/sunset.py`: anything that used to
 * call a model is retired; job discovery and read/download of existing data
 * are not. Keep the two lists in agreement — the backend answers 410 either
 * way, but a user reaching a dead form is a worse experience than never being
 * offered it.
 */

export const ASPIRELY_NAME = "Aspirely";
export const ASPIRELY_URL = "https://aspirely.me";

/** Headline for the full-page migration card. */
export const SUNSET_TITLE = "Resume tailoring has moved to Aspirely";

/**
 * The short version, reused by toasts and the API error path. Leads with the
 * reassurance — "did I lose my work?" is the first question anyone has.
 */
export const SUNSET_MESSAGE =
  "This tool no longer tailors resumes. Your resumes and history are still here " +
  `and still downloadable — nothing was deleted. Tailoring now lives on ${ASPIRELY_NAME} (${ASPIRELY_URL}).`;

/** Still functional here — stated plainly so nobody assumes the whole app died. */
export const STILL_WORKS: readonly string[] = [
  "Job search — Workday, Career Pages, and the daily pipeline",
  "Downloading every resume and tailored version you already made",
  "Your applications, saved jobs, and visa timeline",
];

/**
 * What Aspirely does, taken from its live navigation rather than a pitch deck,
 * so the list stays honest about what someone will actually find there.
 */
export const ASPIRELY_HIGHLIGHTS: readonly { title: string; detail: string }[] = [
  {
    title: "Jobs matched to your resume",
    detail:
      "Roles pulled straight from employer career sites, scored against your resume, with fit reasons and sponsorship signals.",
  },
  {
    title: "Tailoring and batch tailoring",
    detail:
      "Rewrite one resume for one job description, or queue many roles at once. Cover letters and ATS scoring included.",
  },
  {
    title: "Auto-Apply",
    detail:
      "Queue the roles you want and let Aspirely fill in the application forms, with as much or as little approval as you set.",
  },
  {
    title: "Tracker, inbox, and interview prep",
    detail:
      "Every application and where it stands, replies to a managed application address, and practice questions with a mock interviewer.",
  },
  {
    title: "Career Copilot and Learning Hub",
    detail:
      "Ask about your search and get a concrete next step. Close skill gaps with a guided sprint, and find referrals worth chasing.",
  },
];

/**
 * Workspace tabs whose entire purpose was model-generated output. These render
 * the migration card instead of their old body.
 *
 * Not retired, on purpose: `my-resumes`, `tailored`, `applications`, `jobs`,
 * `workday-jobs`, `career-pages`, `visa`, `profile` — every one of those is
 * either job discovery or reading back data the user already owns.
 */
export const RETIRED_TABS: readonly string[] = [
  "tailor",
  "batch",
  "interview",
  "copilot",
  "beta",
];

export function isRetiredTab(tab: string): boolean {
  return RETIRED_TABS.includes(tab);
}
