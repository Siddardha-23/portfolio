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

function shortDay(dateStr: string, isToday: boolean): string {
  if (isToday) return 'Today';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function dayOfMonth(dateStr: string): string {
  return String(parseInt(dateStr.slice(8, 10), 10));
}

function cellTone(count: number): string {
  if (count <= 0) return 'bg-gray-800/60 border-gray-700/40 text-gray-600';
  if (count === 1) return 'bg-amber-500/15 border-amber-500/30 text-amber-300';
  if (count === 2) return 'bg-amber-500/25 border-amber-400/45 text-amber-200';
  if (count <= 4)
    return 'bg-gradient-to-br from-amber-500/40 to-pink-500/30 border-pink-400/50 text-amber-100';
  return 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 border-amber-300/70 text-white shadow shadow-pink-500/30';
}

const StreakWidget = forwardRef<StreakWidgetHandle, { compact?: boolean }>(({ compact = false }, ref) => {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const resp = await apiService.getApplicationStreak();
    if (resp.data) {
      setData(resp.data);
    } else {
      // API not available yet (e.g. backend not restarted) — show empty state
      // rather than disappearing silently.
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
      <div className="animate-pulse h-10 rounded-lg bg-gray-800/40 border border-gray-700/40" />
    );
  }

  if (!data) return null;

  const isAlive = data.current_streak > 0;
  // Most-recent-first: today, yesterday, ... going back. Show last 10 days
  // so cells stay readable with their date labels.
  const recent = [...data.heatmap].reverse().slice(0, 10);

  return (
    <div className="relative overflow-hidden rounded-lg border border-amber-500/15 bg-gradient-to-r from-gray-900 via-gray-900 to-amber-950/10">
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

      <div className="relative px-3 py-2 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Left: streak count + flame */}
        <div
          className={`flex items-center gap-1.5 shrink-0 pr-3 border-r ${
            isAlive ? 'border-amber-500/20' : 'border-gray-700/60'
          }`}
          title={
            data.longest_streak > 0
              ? `Personal best: ${data.longest_streak} day${data.longest_streak === 1 ? '' : 's'}`
              : 'Apply daily to start a streak'
          }
        >
          <FlameIcon className="w-5 h-5 shrink-0" muted={!isAlive} />
          <span
            className={`text-xl font-bold tabular-nums leading-none ${
              isAlive
                ? 'bg-gradient-to-br from-amber-300 via-pink-400 to-purple-400 bg-clip-text text-transparent'
                : 'text-gray-500'
            }`}
          >
            {data.current_streak}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 leading-none">
            day streak
          </span>
        </div>

        {/* Right: today-first per-day cells, each with its day label */}
        {!compact && (
          <div className="flex items-end gap-1.5 ml-auto shrink-0 overflow-x-auto">
            {recent.map((cell, idx) => {
              const isToday = idx === 0;
              const tone = cellTone(cell.count);
              return (
                <div
                  key={cell.date}
                  className="flex flex-col items-center gap-0.5"
                  title={`${dayLabel(cell.date)} — ${cell.count} application${cell.count === 1 ? '' : 's'}`}
                >
                  <div
                    className={`relative w-7 h-7 rounded-md border flex items-center justify-center text-[12px] font-semibold tabular-nums ${tone} ${
                      isToday ? 'ring-1 ring-amber-300/70' : ''
                    }`}
                  >
                    {cell.count > 0 && (
                      <FlameIcon className="absolute inset-0 w-full h-full opacity-15 pointer-events-none" />
                    )}
                    <span className="relative">{cell.count}</span>
                  </div>
                  <span
                    className={`text-[9px] font-medium leading-none ${
                      isToday ? 'text-amber-300' : 'text-gray-500'
                    }`}
                  >
                    {isToday ? 'Today' : `${shortDay(cell.date, false)} ${dayOfMonth(cell.date)}`}
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
