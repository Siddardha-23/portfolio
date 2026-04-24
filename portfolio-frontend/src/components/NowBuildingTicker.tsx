/**
 * NowBuildingTicker — under-hero strip showing the latest Cloud Diary entry.
 *
 * Pulls /api/chat/diary/latest, displays a single live "what shipped this
 * week" line. Recruiter sees the page is *alive* before scrolling.
 *
 * Placement: between <Hero /> and <About /> in Home.tsx. Does not collide
 * with the hero's CTA stack (it sits below it as a slim ribbon).
 */
import { motion } from "framer-motion";
import { Activity, ArrowRight, Github, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { apiService } from "@/lib/api";

interface DiaryEntry {
  date: string;
  headline: string;
  highlights: string[];
  tech: string[];
  shipping_score?: number;
}

function formatRelative(dateStr: string): string {
  const then = new Date(dateStr + "T00:00:00Z").getTime();
  if (!isFinite(then)) return dateStr;
  const days = Math.max(0, Math.floor((Date.now() - then) / 86400000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 14) return `1w ago`;
  if (days < 31) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function NowBuildingTicker() {
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getLatestDiary()
      .then((res) => {
        if (cancelled) return;
        if (res.data?.data) {
          setEntry(res.data.data as DiaryEntry);
        } else {
          setFailed(true);
        }
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Render nothing if there's no entry yet (don't show an empty band)
  if (loading) {
    return (
      <div className="container mx-auto px-4 -mt-6 md:-mt-8">
        <div className="mx-auto max-w-4xl h-12 rounded-2xl border border-border/30 bg-foreground/[0.02] animate-pulse" />
      </div>
    );
  }
  if (failed || !entry) return null;

  return (
    <motion.section
      id="now-building"
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="container mx-auto px-4 -mt-6 md:-mt-8 scroll-mt-24"
    >
      <div className="mx-auto max-w-4xl">
        <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/70 backdrop-blur-xl shadow-lg shadow-black/5">
          {/* Animated gradient mesh */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 0% 50%, rgba(16,185,129,0.10), transparent 35%), radial-gradient(circle at 100% 50%, rgba(139,92,246,0.10), transparent 35%)",
            }}
            aria-hidden
          />
          {/* Vertical accent bar */}
          <div className="relative flex items-stretch">
            <div className="w-1 bg-gradient-to-b from-emerald-400 via-violet-400 to-rose-400" />
            <div className="flex-1 px-3.5 sm:px-4 py-2.5 sm:py-3">
              <div className="flex items-start gap-3 sm:items-center">
                {/* Pulse dot + label */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Now building
                  </span>
                </div>

                {/* Headline */}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] sm:text-[13px] leading-snug text-foreground/90 truncate sm:line-clamp-1">
                    {entry.headline}
                  </p>
                  {entry.tech?.length > 0 && (
                    <div className="mt-1 hidden sm:flex flex-wrap items-center gap-1">
                      {entry.tech.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="text-[9.5px] uppercase tracking-wider text-muted-foreground/80 px-1.5 py-0.5 rounded bg-foreground/[0.04]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right meta */}
                <div className="hidden sm:flex items-center gap-3 shrink-0 text-[10.5px] text-muted-foreground/80">
                  {typeof entry.shipping_score === "number" && (
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-emerald-400" />
                      <span className="font-mono font-semibold text-foreground/80">{entry.shipping_score}</span>
                    </div>
                  )}
                  <span className="font-mono">{formatRelative(entry.date)}</span>
                  <a
                    href="https://github.com/Siddardha-23"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Github className="h-3 w-3" />
                    <span>repos</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>

              {/* Highlights — surface 1 on small screens, up to 3 on desktop */}
              {entry.highlights?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/85">
                  {entry.highlights.slice(0, 3).map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-primary/70" />
                      <span className="truncate max-w-[260px]" title={h}>
                        {h}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
