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

function cellTone(count: number): string {
  if (count <= 0) return 'bg-gray-800/60 border-gray-700/40';
  if (count === 1) return 'bg-purple-500/40 border-purple-400/40';
  if (count === 2) return 'bg-purple-500/65 border-purple-400/60';
  if (count <= 4) return 'bg-gradient-to-br from-purple-500 to-pink-500 border-pink-400/60';
  return 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 border-amber-300/70 shadow shadow-pink-500/30';
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
      <div className="animate-pulse h-28 rounded-xl bg-gray-800/40 border border-gray-700/40" />
    );
  }

  if (!data) return null;

  const isAlive = data.current_streak > 0;
  const subtitle =
    data.today_count > 0
      ? `${data.today_count} application${data.today_count === 1 ? '' : 's'} today`
      : isAlive
        ? 'Tailor one today to keep it alive'
        : 'Start your first streak today';

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/15 bg-gradient-to-br from-gray-900 via-gray-900 to-amber-950/10">
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full bg-pink-500/5 blur-3xl pointer-events-none" />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${
                isAlive
                  ? 'bg-gradient-to-br from-amber-500/20 to-pink-500/15 border-amber-400/30 shadow-inner shadow-amber-500/10'
                  : 'bg-gray-800/60 border-gray-700/40'
              }`}
            >
              <FlameIcon className="w-6 h-6" muted={!isAlive} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl font-bold tabular-nums tracking-tight ${
                    isAlive
                      ? 'bg-gradient-to-br from-amber-300 via-pink-400 to-purple-400 bg-clip-text text-transparent'
                      : 'text-gray-500'
                  }`}
                >
                  {data.current_streak}
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  day streak
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-gray-200 tabular-nums">{data.today_count}</span>
              <span className="text-[11px] uppercase tracking-wider text-gray-500">today</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-medium text-gray-300 tabular-nums">{data.total_applications}</span>
              <span className="text-[11px] uppercase tracking-wider text-gray-500">all-time</span>
            </div>
            {data.longest_streak > 0 && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-gray-300 tabular-nums">{data.longest_streak}</span>
                <span className="text-[11px] uppercase tracking-wider text-gray-500">best</span>
              </div>
            )}
          </div>
        </div>

        {!compact && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Last 30 days</p>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <span>less</span>
                <span className="w-2 h-2 rounded-sm bg-gray-800/60 border border-gray-700/40" />
                <span className="w-2 h-2 rounded-sm bg-purple-500/40 border border-purple-400/40" />
                <span className="w-2 h-2 rounded-sm bg-purple-500/65 border border-purple-400/60" />
                <span className="w-2 h-2 rounded-sm bg-gradient-to-br from-purple-500 to-pink-500 border border-pink-400/60" />
                <span className="w-2 h-2 rounded-sm bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 border border-amber-300/70" />
                <span>more</span>
              </div>
            </div>
            <div className="grid grid-cols-30 gap-[3px]" style={{ gridTemplateColumns: 'repeat(30, minmax(0, 1fr))' }}>
              {data.heatmap.map((cell, idx) => {
                const isToday = idx === data.heatmap.length - 1;
                return (
                  <div
                    key={cell.date}
                    title={`${dayLabel(cell.date)} • ${cell.count} application${cell.count === 1 ? '' : 's'}`}
                    className={`aspect-square rounded-[3px] border ${cellTone(cell.count)} ${
                      isToday ? 'ring-1 ring-amber-300/60' : ''
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

StreakWidget.displayName = 'StreakWidget';

export default StreakWidget;
