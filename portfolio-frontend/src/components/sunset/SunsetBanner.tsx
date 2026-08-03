/**
 * SunsetBanner — slim, persistent notice across the top of the workspace.
 *
 * Sits above every tab, including the ones that still work, so someone who
 * lands directly on Job Opportunities still learns that tailoring moved
 * without having to click a dead tab to find out.
 *
 * Not dismissible. A dismissed banner plus a `localStorage` flag means the
 * next visitor on the same browser — or the same person a month later — gets
 * no warning at all, and the whole point is that this state is permanent.
 */
import { ArrowUpRight } from "lucide-react";

import { ASPIRELY_NAME, ASPIRELY_URL } from "@/lib/sunset";

export default function SunsetBanner() {
  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/25 dark:bg-amber-400/10"
    >
      <p className="text-[13px] leading-relaxed text-amber-900 dark:text-amber-100">
        <span className="font-bold">Resume tailoring has moved to {ASPIRELY_NAME}.</span>{" "}
        Your data is still here and still downloadable, and job search still
        works — but new tailoring, cover letters, ATS scores and interview prep
        now happen on {ASPIRELY_NAME}.
      </p>
      <a
        href={ASPIRELY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-900 px-3.5 py-2 text-xs font-bold text-amber-50 transition-colors hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
      >
        Go to {ASPIRELY_NAME}
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
    </div>
  );
}
