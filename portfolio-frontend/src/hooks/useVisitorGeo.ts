/**
 * Fetches visitor stats and turns them into globe-ready geometry.
 *
 * All the messy normalisation lives here: the API can return a country as an
 * alpha-2 code, a display name or a legacy alias, and city coordinates are
 * frequently missing. Everything is resolved to one canonical country, with a
 * country centroid standing in when there is no city fix, so a visitor is never
 * silently dropped from the globe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/lib/api';
import { cleanCity, resolveCountry, type ResolvedCountry } from '@/lib/geo';

export type Period = 'all' | '24h' | '7d' | '30d' | 'custom';

export interface VisitorPoint {
    /** Stable key: alpha-2 plus city. */
    id: string;
    code: string;
    country: string;
    flag: string;
    city: string | null;
    /** Human label, e.g. "Bengaluru, India". */
    label: string;
    lat: number;
    lng: number;
    count: number;
    /** True when we fell back to the country centroid. */
    approximate: boolean;
}

export interface VisitorCountry {
    code: string;
    name: string;
    flag: string;
    count: number;
    lat: number | null;
    lng: number | null;
}

export interface VisitorGeo {
    points: VisitorPoint[];
    countries: VisitorCountry[];
    totalVisitors: number;
    /** Sum of plotted visitors — can trail totalVisitors when geo is missing. */
    plottedVisitors: number;
    loading: boolean;
    error: string | null;
}

function isUsableCoord(lat: unknown, lng: unknown): boolean {
    return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180 &&
        // 0,0 is the null-island signature of a failed lookup, not the Atlantic.
        !(lat === 0 && lng === 0)
    );
}

/**
 * @param initialPeriod  period to load on mount
 * @param autoFetch      false for surfaces that are mounted but not yet visible
 *                       (the modal), so opening triggers the only request
 */
export function useVisitorGeo(initialPeriod: Period = 'all', autoFetch = true) {
    const [state, setState] = useState<VisitorGeo>({
        points: [],
        countries: [],
        totalVisitors: 0,
        plottedVisitors: 0,
        loading: autoFetch,
        error: null,
    });

    // Guards against a slow early request overwriting a newer filter's result.
    const requestSeq = useRef(0);

    const fetchGeo = useCallback(async (query = '') => {
        const seq = ++requestSeq.current;
        setState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await apiService.getOrgStats(query);
            if (seq !== requestSeq.current) return;

            const data = response.data;
            if (!data) {
                setState((prev) => ({ ...prev, loading: false, error: 'No data' }));
                return;
            }

            const byPoint = new Map<string, VisitorPoint>();
            const byCountry = new Map<string, VisitorCountry>();

            const rows = data.map_locations?.length
                ? data.map_locations
                : (data.top_countries ?? []).map((c) => ({
                      country: c.country,
                      country_code: c.country_code,
                      city: null,
                      latitude: null,
                      longitude: null,
                      count: c.count,
                  }));

            for (const row of rows) {
                // Prefer the canonical code; fall back to naming for legacy rows.
                const country: ResolvedCountry | null =
                    resolveCountry(row.country_code) ?? resolveCountry(row.country);
                if (!country) continue;

                const city = cleanCity(row.city);
                const hasFix = isUsableCoord(row.latitude, row.longitude);

                const lat = hasFix ? (row.latitude as number) : country.lat;
                const lng = hasFix ? (row.longitude as number) : country.lng;

                // A country we cannot place at all contributes to the tally but
                // has no pin to draw.
                if (lat != null && lng != null) {
                    const id = `${country.code}:${city ?? ''}`;
                    const existing = byPoint.get(id);
                    if (existing) {
                        existing.count += row.count;
                    } else {
                        byPoint.set(id, {
                            id,
                            code: country.code,
                            country: country.name,
                            flag: country.flag,
                            city,
                            label: city ? `${city}, ${country.name}` : country.name,
                            lat,
                            lng,
                            count: row.count,
                            approximate: !hasFix,
                        });
                    }
                }

                const seen = byCountry.get(country.code);
                if (seen) {
                    seen.count += row.count;
                } else {
                    byCountry.set(country.code, {
                        code: country.code,
                        name: country.name,
                        flag: country.flag,
                        count: row.count,
                        lat: country.lat,
                        lng: country.lng,
                    });
                }
            }

            const points = [...byPoint.values()].sort((a, b) => b.count - a.count);
            const countries = [...byCountry.values()].sort((a, b) => b.count - a.count);

            setState({
                points,
                countries,
                totalVisitors: data.total_visitors ?? 0,
                plottedVisitors: countries.reduce((sum, c) => sum + c.count, 0),
                loading: false,
                error: null,
            });
        } catch {
            if (seq !== requestSeq.current) return;
            setState((prev) => ({ ...prev, loading: false, error: 'Could not load visitor data' }));
        }
    }, []);

    useEffect(() => {
        if (!autoFetch) return;
        fetchGeo(initialPeriod === 'all' ? '' : `?period=${initialPeriod}`);
    }, [fetchGeo, initialPeriod, autoFetch]);

    return { ...state, refetch: fetchGeo };
}

/** Builds the query string for a period selection. */
export function periodQuery(period: Period, from?: string, to?: string): string {
    if (period === 'custom') {
        if (!from) return '';
        return `?from=${from}${to ? `&to=${to}` : ''}`;
    }
    return period === 'all' ? '' : `?period=${period}`;
}
