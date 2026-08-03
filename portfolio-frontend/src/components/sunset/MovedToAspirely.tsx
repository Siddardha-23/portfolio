/**
 * MovedToAspirely — the card shown in place of every retired workspace tab.
 *
 * Answers three questions in the order people ask them:
 *   1. Is my data gone?      → no, and here is what still works
 *   2. What happened?        → tailoring moved
 *   3. Where do I go?        → Aspirely, and here is what is there
 *
 * Deliberately not a modal or a toast: this is the whole content of the tab,
 * so there is nothing behind it to dismiss it and get back to.
 */
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";

import {
  ASPIRELY_HIGHLIGHTS,
  ASPIRELY_NAME,
  ASPIRELY_URL,
  STILL_WORKS,
  SUNSET_TITLE,
} from "@/lib/sunset";

export default function MovedToAspirely({
  /** Names the specific thing the user clicked, e.g. "Batch Tailor". */
  feature,
}: {
  feature?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="mx-auto max-w-3xl"
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900/50">
        {/* Header */}
        <div className="relative border-b border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-7 dark:border-white/10 dark:from-indigo-500/10 dark:via-transparent dark:to-purple-500/10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                {feature ? `${feature} has moved to ${ASPIRELY_NAME}` : SUNSET_TITLE}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                This portfolio no longer tailors resumes.{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  Nothing was deleted
                </span>{" "}
                — your resumes, tailored versions and application history are all
                still here, and you can still download every one of them.
              </p>
            </div>
          </div>
        </div>

        {/* Still works here */}
        <div className="border-b border-gray-200 px-6 py-5 dark:border-white/10">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Still works on this site
          </p>
          <ul className="mt-3 space-y-2">
            {STILL_WORKS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What's on Aspirely */}
        <div className="px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            What you get on {ASPIRELY_NAME}
          </p>
          <ul className="mt-3 space-y-3.5">
            {ASPIRELY_HIGHLIGHTS.map((h) => (
              <li key={h.title}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {h.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {h.detail}
                </p>
              </li>
            ))}
          </ul>

          <a
            href={ASPIRELY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-purple-500 hover:to-indigo-500 hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 sm:w-auto"
          >
            Continue on {ASPIRELY_NAME}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
          <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400">
            Free to start — upload a resume and see up to 5 matched jobs plus one
            tailored resume. No card needed.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
