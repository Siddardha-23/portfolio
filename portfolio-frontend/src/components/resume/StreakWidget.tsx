import { useEffect, useImperativeHandle, useState, forwardRef, useCallback } from 'react';
import { apiService } from '@/lib/api';

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  today_count: number;
  total_applications: number;
  last_application_date: string | null;
  heatmap: { date: string; count: number }[];
}

export interface StreakWidgetHandle {
  refresh: () => Promise<void>;
}

function FlameIcon({ className = 'w-5 h-5', muted = false }: { className?: string; muted?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor">
      <defs>
        <linearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={muted ? '#6b7280' : '#fbbf24'} />
          <stop offset="60%" stopColor={muted ? '#4b5563' : '#fb923c'} />
          <stop offset="100%" stopColor={muted ? '#374151' : '#ec4899'} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5c1.6 3.4 4.7 5 4.7 8.7 0 2-1.2 3.6-2.9 4.3.7-1.4.5-3-1-4.4-.4 2.4-2.1 3.4-3 4.6-1.4 1.8-1.4 4.6 1 6.2-3.6-.4-6.3-3.1-6.3-6.7 0-4.5 4-6.5 4-9.7 0-1 .3-2 .8-3 .7 1.2 2 1.7 2.7 0z"
        fill="url(#flame-grad)"
        stroke="none"
      />
    </svg>
  );
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayOfMonth(dateStr: string): string {
  return String(parseInt(dateStr.slice(8, 10), 10));
}

type CellVariant = 'empty' | 'low' | 'mid' | 'high' | 'peak';

function variantFor(count: number): CellVariant {
  if (count <= 0) return 'empty';
  if (count === 1) return 'low';
  if (count === 2) return 'mid';
  if (count <= 4) return 'high';
  return 'peak';
}

const CELL_BASE_STYLES: Record<CellVariant, string> = {
  empty: 'bg-gray-100 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/30 text-gray-400 dark:text-gray-600',
  low: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-300',
  mid: 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-400/40 text-amber-700 dark:text-amber-200',
  high: 'bg-gradient-to-br from-amber-200 to-pink-100 dark:from-amber-500/35 dark:to-pink-500/25 border-pink-300 dark:border-pink-400/45 text-amber-800 dark:text-amber-100',
  peak: 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 border-amber-300/70 text-white',
};

const StreakWidget = forwardRef<StreakWidgetHandle, { compact?: boolean }>(({ compact = false }, ref) => {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const resp = await apiService.getApplicationStreak();
    if (resp.data) {
      setData(resp.data);
    } else {
      const today = new Date();
      const heatmap = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today);
        d.setUTCDate(today.getUTCDate() - (29 - i));
        return { date: d.toISOString().slice(0, 10), count: 0 };
      });
      setData({
        current_streak: 0,
        longest_streak: 0,
        today_count: 0,
        total_applications: 0,
        last_application_date: null,
        heatmap,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onSaved = () => { load(); };
    window.addEventListener('resume:application-saved', onSaved);
    return () => window.removeEventListener('resume:application-saved', onSaved);
  }, [load]);

  useImperativeHandle(ref, () => ({ refresh: load }), [load]);

  if (loading) {
    return (
      <div className="animate-pulse h-12 rounded-xl bg-gray-200 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-700/30" />
    );
  }

  if (!data) return null;

  const isAlive = data.current_streak > 0;
  const todayActive = data.today_count > 0;
  const recent = [...data.heatmap].reverse().slice(0, 10);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 shadow-sm dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      {/* Top accent bar — gradient when alive, neutral when not */}
      <div
        className={`absolute inset-x-0 top-0 h-px ${
          isAlive
            ? 'bg-gradient-to-r from-transparent via-amber-400/60 to-transparent'
            : 'bg-gradient-to-r from-transparent via-gray-300/40 dark:via-gray-700/40 to-transparent'
        }`}
      />
      {/* Ambient glow — only when streak is alive */}
      {isAlive && (
        <>
          <div className="absolute -top-12 left-4 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 right-1/3 w-40 h-40 rounded-full bg-pink-500/5 blur-3xl pointer-events-none" />
        </>
      )}

      <div className="relative px-4 py-2.5 flex items-center gap-4 flex-wrap sm:flex-nowrap">
        {/* ── Today's count (primary) ───────────────────────────────── */}
        <div
          className="flex items-center gap-2 shrink-0"
          title={`${data.today_count} application${data.today_count === 1 ? '' : 's'} applied today`}
        >
          <div className="relative">
            {todayActive && (
              <div className="absolute inset-0 -m-1 rounded-full bg-amber-500/25 blur-md pointer-events-none" />
            )}
            <FlameIcon className="relative w-6 h-6" muted={!todayActive} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold tabular-nums leading-none tracking-tight ${
                todayActive
                  ? 'bg-gradient-to-br from-amber-200 via-pink-300 to-purple-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(251,146,60,0.3)]'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              {data.today_count}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 leading-none">
              today
            </span>
          </div>
        </div>

        {/* Soft gradient divider */}
        <div className="hidden sm:block h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-gray-300 dark:via-white/10 to-transparent" />

        {/* ── Day streak (secondary) ────────────────────────────────── */}
        <div
          className="flex items-center gap-2 shrink-0"
          title={
            data.longest_streak > 0
              ? `Personal best: ${data.longest_streak} day${data.longest_streak === 1 ? '' : 's'}`
              : 'Tailor a resume each day to build a streak'
          }
        >
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold tabular-nums leading-none tracking-tight ${
                isAlive
                  ? 'text-amber-500 dark:text-amber-200'
                  : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              {data.current_streak}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 leading-none">
              day streak
            </span>
          </div>
          {data.longest_streak > 0 && data.longest_streak > data.current_streak && (
            <span
              className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-medium leading-none px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700/40 bg-gray-100 dark:bg-gray-800/40"
              title={`Personal best: ${data.longest_streak} day${data.longest_streak === 1 ? '' : 's'}`}
            >
              <span className="text-gray-500 dark:text-gray-400">Best</span>
              <span className="tabular-nums text-gray-700 dark:text-gray-200 font-semibold">{data.longest_streak}</span>
            </span>
          )}
        </div>

        {/* Soft gradient divider */}
        <div
          className={`hidden sm:block h-8 w-px shrink-0 bg-gradient-to-b from-transparent via-gray-300 dark:via-white/10 to-transparent`}
        />

        {/* ── Right: today-first per-day cells ───────────────────────── */}
        {!compact && (
          <div className="flex items-end gap-1.5 ml-auto shrink-0">
            {recent.map((cell, idx) => {
              const isToday = idx === 0;
              const variant = variantFor(cell.count);
              const isActive = cell.count > 0;
              const isHeroToday = isToday && todayActive;

              const baseTone = isHeroToday
                ? 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 border-amber-300/80 text-white shadow-[0_0_18px_-2px_rgba(251,146,60,0.55)]'
                : CELL_BASE_STYLES[variant];

              const sizing = isHeroToday
                ? 'w-10 h-10 text-base ring-2 ring-amber-300/70 ring-offset-2 ring-offset-white dark:ring-offset-gray-950'
                : isToday
                  ? 'w-7 h-7 text-[12px] ring-1 ring-amber-400/40'
                  : 'w-7 h-7 text-[12px]';

              return (
                <div
                  key={cell.date}
                  className="flex flex-col items-center gap-1 group/cell"
                  title={`${dayLabel(cell.date)} — ${cell.count} application${cell.count === 1 ? '' : 's'}`}
                >
                  <div
                    className={`relative rounded-lg border flex items-center justify-center font-semibold tabular-nums transition-all duration-200 ${baseTone} ${sizing} ${
                      isActive
                        ? 'group-hover/cell:-translate-y-0.5 group-hover/cell:shadow-md'
                        : 'group-hover/cell:border-gray-300 dark:group-hover/cell:border-gray-600/50'
                    }`}
                  >
                    {isActive && (
                      <FlameIcon
                        className={`absolute inset-0 w-full h-full pointer-events-none ${
                          isHeroToday ? 'opacity-30 animate-pulse' : 'opacity-20'
                        }`}
                      />
                    )}
                    {/* Empty days show a dim dot rather than a loud "0" */}
                    {!isActive ? (
                      <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600/60" />
                    ) : (
                      <span className="relative leading-none">{cell.count}</span>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-semibold uppercase tracking-wider leading-none ${
                      isHeroToday
                        ? 'text-amber-600 dark:text-amber-200'
                        : isToday
                          ? 'text-amber-500 dark:text-amber-400/80'
                          : isActive
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    {isToday ? 'Today' : `${shortDay(cell.date)} ${dayOfMonth(cell.date)}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

StreakWidget.displayName = 'StreakWidget';

export default StreakWidget;
