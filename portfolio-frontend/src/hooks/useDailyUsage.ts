import { useCallback, useEffect, useState } from "react";
import { apiService } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface DailyUsage {
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
  resets_in_seconds: number;
  date: string;
}

/**
 * Subscribe to the current user's daily tailor quota.
 *
 * - Fetches once when the user becomes authenticated.
 * - `refresh()` is exposed so callers can re-pull right after a successful
 *   tailor submit (the API response includes the new `usage`, but the
 *   simplest contract is "tell the badge to re-read").
 * - When a tailor call returns 429, the caller can also pass the
 *   `usage` payload from the error response directly via `applyUsage()`.
 */
export function useDailyUsage() {
  const { isAuthenticated } = useAuth();
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setUsage(null);
      return;
    }
    setLoading(true);
    setError(null);
    const resp = await apiService.getDailyUsage();
    setLoading(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    if (resp.data) setUsage(resp.data);
  }, [isAuthenticated]);

  const applyUsage = useCallback((u: DailyUsage) => setUsage(u), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, loading, error, refresh, applyUsage };
}
