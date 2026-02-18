/**
 * useSectionTimeTracking - Tracks time spent in each portfolio section
 *
 * Uses IntersectionObserver to detect when sections are visible and
 * accumulates time spent in each. On page unload (or periodically),
 * it sends the data to the backend for analytics.
 */
import { useEffect, useRef, useCallback } from 'react';
import { apiService } from '@/lib/api';
import { getSessionIdSync } from '@/hooks/useVisitorTracking';

interface SectionTimeData {
    [sectionId: string]: {
        totalMs: number;
        enterTime: number | null;
        visits: number;
    };
}

const SECTION_IDS = ['hero', 'about', 'skills', 'education', 'experience', 'projects', 'contact'];
const FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds
const LOCAL_STORAGE_KEY = 'portfolio_section_times';

export function useSectionTimeTracking() {
    const sectionTimes = useRef<SectionTimeData>({});
    const pageStartTime = useRef<number>(Date.now());
    const hasFlushed = useRef(false);

    // Initialize section times
    useEffect(() => {
        SECTION_IDS.forEach(id => {
            sectionTimes.current[id] = {
                totalMs: 0,
                enterTime: null,
                visits: 0
            };
        });
    }, []);

    // Flush accumulated times to backend
    const flushTimes = useCallback(async () => {
        try {
            const sessionId = getSessionIdSync();
            if (!sessionId) return;

            // Finalize any currently-active sections
            const now = Date.now();
            const sections: { [key: string]: { timeMs: number; visits: number } } = {};
            let hasData = false;

            Object.entries(sectionTimes.current).forEach(([id, data]) => {
                let totalMs = data.totalMs;
                if (data.enterTime) {
                    totalMs += now - data.enterTime;
                }
                if (totalMs > 0 || data.visits > 0) {
                    hasData = true;
                    sections[id] = {
                        timeMs: Math.round(totalMs),
                        visits: data.visits
                    };
                }
            });

            if (!hasData) return;

            const totalTimeMs = now - pageStartTime.current;

            const payload = {
                session_id: sessionId,
                page: 'home',
                totalTimeMs: Math.round(totalTimeMs),
                sections,
                timestamp: new Date().toISOString()
            };

            // Save to localStorage as a backup
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));

            // Send to backend
            await apiService.trackSectionTime(payload);
        } catch {
            // Silently fail - analytics should never break the UX
        }
    }, []);

    // Set up IntersectionObserver
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const id = entry.target.id;
                    if (!sectionTimes.current[id]) return;

                    if (entry.isIntersecting) {
                        // Section entered viewport
                        if (!sectionTimes.current[id].enterTime) {
                            sectionTimes.current[id].enterTime = Date.now();
                            sectionTimes.current[id].visits += 1;
                        }
                    } else {
                        // Section left viewport
                        if (sectionTimes.current[id].enterTime) {
                            const elapsed = Date.now() - sectionTimes.current[id].enterTime;
                            sectionTimes.current[id].totalMs += elapsed;
                            sectionTimes.current[id].enterTime = null;
                        }
                    }
                });
            },
            {
                threshold: 0.3, // Section is "visible" when 30% is in view
                rootMargin: '0px'
            }
        );

        // Observe all sections
        SECTION_IDS.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                observer.observe(element);
            }
        });

        // Periodic flush
        const flushInterval = setInterval(flushTimes, FLUSH_INTERVAL_MS);

        // Flush on page unload using sendBeacon with proper Content-Type
        const handleUnload = () => {
            if (!hasFlushed.current) {
                hasFlushed.current = true;
                const sessionId = getSessionIdSync();
                if (sessionId) {
                    const now = Date.now();
                    const sections: { [key: string]: { timeMs: number; visits: number } } = {};
                    Object.entries(sectionTimes.current).forEach(([id, data]) => {
                        let totalMs = data.totalMs;
                        if (data.enterTime) {
                            totalMs += now - data.enterTime;
                        }
                        if (totalMs > 0 || data.visits > 0) {
                            sections[id] = {
                                timeMs: Math.round(totalMs),
                                visits: data.visits
                            };
                        }
                    });

                    const payload = JSON.stringify({
                        session_id: sessionId,
                        page: 'home',
                        totalTimeMs: Math.round(now - pageStartTime.current),
                        sections,
                        timestamp: new Date().toISOString()
                    });

                    // Use Blob with explicit JSON content type so backend parses correctly
                    const blob = new Blob([payload], { type: 'application/json' });
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                    navigator.sendBeacon(`${apiUrl}/session/track-time`, blob);
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushTimes();
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            observer.disconnect();
            clearInterval(flushInterval);
            window.removeEventListener('beforeunload', handleUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            hasFlushed.current = false;
            flushTimes();
        };
    }, [flushTimes]);
}
