/**
 * IntentBus - Executes site-control verbs emitted by the Concierge backend.
 *
 * The model returns a list of intents; this module translates them into real
 * DOM/router actions (scroll, glow, modal open, deep links). Each handler is
 * defensive: it tries the action, swallows individual failures so a bad
 * intent never kills the turn, and emits a CustomEvent so any listener (a
 * project tile, a section header) can react.
 */
import type { ConciergeIntent } from "./types";

const SECTION_TO_ID: Record<string, string> = {
  hero: "hero",
  about: "about",
  skills: "skills",
  education: "education",
  experience: "experience",
  projects: "projects",
  contact: "contact",
};

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function highlightSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Inject a one-shot pulse class
  el.classList.add("concierge-pulse");
  window.setTimeout(() => el.classList.remove("concierge-pulse"), 2200);
}

function highlightProject(slug: string) {
  // Project cards aren't keyed by slug in the DOM yet — emit an event the
  // Projects section can subscribe to.
  window.dispatchEvent(new CustomEvent("concierge:highlight-project", { detail: { slug } }));
}

function emitFilterSkills(group: string) {
  window.dispatchEvent(new CustomEvent("concierge:filter-skills", { detail: { group } }));
}

function openResume() {
  // Notify listeners (e.g., a ResumeViewer overlay) and open the PDF in a new
  // tab as a guaranteed fallback so users always see something.
  window.dispatchEvent(new CustomEvent("concierge:open-resume"));
  window.open("/Harshith_Manne_Cloud_DevOps_Engineer_Resume.pdf", "_blank", "noopener,noreferrer");
}

function downloadResume() {
  // Direct link to the PDF in /public
  const a = document.createElement("a");
  a.href = "/Harshith_Manne_Cloud_DevOps_Engineer_Resume.pdf";
  a.download = "Harshith_Manne_Resume.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openContact(channel: "email" | "linkedin" | "github") {
  const map: Record<string, string> = {
    email: "mailto:harshith.siddardha@gmail.com",
    linkedin: "https://linkedin.com/in/harshith-siddardha",
    github: "https://github.com/Siddardha-23",
  };
  const url = map[channel];
  if (!url) return;
  if (channel === "email") {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Execute a sequence of intents with small staggers so the page motion is
 * legible rather than chaotic.
 */
export async function executeIntents(intents: ConciergeIntent[]): Promise<void> {
  for (const intent of intents) {
    try {
      switch (intent.name) {
        case "navigate_to_section": {
          const id = SECTION_TO_ID[intent.args.section];
          if (id) scrollToId(id);
          break;
        }
        case "highlight_section": {
          const id = SECTION_TO_ID[intent.args.section];
          if (id) {
            scrollToId(id);
            window.setTimeout(() => highlightSection(id), 450);
          }
          break;
        }
        case "open_project": {
          // First scroll to projects, then ask the section to highlight + open
          scrollToId("projects");
          window.setTimeout(() => highlightProject(intent.args.slug), 500);
          break;
        }
        case "open_resume":
          openResume();
          break;
        case "download_resume":
          downloadResume();
          break;
        case "contact":
          openContact(intent.args.channel);
          break;
        case "filter_skills":
          scrollToId("skills");
          window.setTimeout(() => emitFilterSkills(intent.args.group), 400);
          break;
        case "tailor_resume_to_jd":
          // The card render carries the result; just notify analytics.
          window.dispatchEvent(new CustomEvent("concierge:jd-tailored"));
          break;
        case "show_card":
        case "no_op":
        default:
          break;
      }
    } catch (err) {
      console.warn("[Concierge] intent failed:", intent.name, err);
    }
    // Tiny stagger so navigations don't race
    await new Promise((r) => setTimeout(r, 180));
  }
}

/** Determine the current visible section from the viewport (for ambient context). */
export function detectCurrentSection(): string | null {
  const ids = Object.values(SECTION_TO_ID);
  let best: { id: string; score: number } | null = null;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    const score = visible / Math.max(1, vh);
    if (!best || score > best.score) best = { id, score };
  }
  return best && best.score > 0.25 ? best.id : null;
}
