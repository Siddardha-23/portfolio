/**
 * AspirelyCallout — home-page section announcing that the Resume Tailor is
 * retired and pointing at Aspirely.
 *
 * Placed on the portfolio landing rather than only inside the workspace: most
 * of the people who used the tailor arrived from the nav, not from a bookmark
 * deep in `/resume-parser`, so the announcement has to be visible before
 * anyone signs in.
 *
 * Framed as "shipped, then graduated" instead of "shut down" — the tool is the
 * portfolio's headline build, and the honest story is that it outgrew a
 * portfolio subpage, not that it broke.
 */
import { motion } from "framer-motion";
import { ArrowUpRight, Check } from "lucide-react";

import { ASPIRELY_NAME, ASPIRELY_URL } from "@/lib/sunset";

const MOVED = [
  "Resume tailoring, batch tailoring, and cover letters",
  "ATS scoring and interview prep",
  "Auto-Apply — Aspirely fills the application forms for you",
];

export default function AspirelyCallout() {
  return (
    <section
      id="aspirely"
      aria-labelledby="aspirely-heading"
      className="px-4 py-12 sm:px-6 lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-purple-500/[0.07]"
      >
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              This project has graduated
            </span>

            <h2
              id="aspirely-heading"
              className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
            >
              The AI Resume Tailor is now {ASPIRELY_NAME}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              What started here as a portfolio experiment turned into a real
              product, so it moved to its own home at{" "}
              <span className="font-semibold text-foreground">aspirely.me</span>{" "}
              — with auto-apply, an application tracker, and a managed inbox that
              a portfolio subpage was never going to carry.
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">
                Nothing here was deleted.
              </span>{" "}
              If you have an account, your resumes, tailored versions and
              application history are all still on this site and still
              downloadable — and job search still runs. Only the AI generation
              moved.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={ASPIRELY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-purple-500 hover:to-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                Try {ASPIRELY_NAME} — it's free
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <a
                href="/resume-parser"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Get my data / search jobs
              </a>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Upload a resume and see up to 5 matched jobs plus one tailored
              resume, free. No account or card needed.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Moved to {ASPIRELY_NAME}
            </p>
            <ul className="mt-3 space-y-2.5">
              {MOVED.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85"
                >
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Still here
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                "Job search across employer career sites",
                "Every resume and tailored version you saved",
                "Applications, saved jobs, visa timeline",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
