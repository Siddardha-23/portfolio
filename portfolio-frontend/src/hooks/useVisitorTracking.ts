import { useEffect, useRef } from 'react';
import { apiService } from '@/lib/api';

interface FingerprintData {
    userAgent: string;
    screen: any;
    window: any;
    browser: any;
    network: any;
    timestamp: string;
    timezoneOffset: number;
    canvasFingerprint: string;
    webgl: any;
    plugins: any[];
    fonts: string[];
    battery?: any;
    mediaDevices?: number;
    page: string;
    referrer: string;
    sessionId: string;
    clientIp?: string;
}

// Session ID management - persists across page refreshes but not browser sessions
const SESSION_STORAGE_KEY = 'portfolio_session_id';
const SESSION_TRACKED_KEY = 'portfolio_session_tracked';

/**
 * Get or create a unique session ID.
 * Uses sessionStorage to persist across page navigation within the same tab.
 */
const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
        // Generate a unique session ID with timestamp and random string
        sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}-${Math.random().toString(36).substring(2, 6)}`;
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }
    return sessionId;
};

/**
 * Check if this session has already been tracked (visitor entry created)
 */
const isSessionTracked = (): boolean => {
    return sessionStorage.getItem(SESSION_TRACKED_KEY) === 'true';
};

/**
 * Mark this session as tracked
 */
const markSessionTracked = (): void => {
    sessionStorage.setItem(SESSION_TRACKED_KEY, 'true');
};

/**
 * Fetch the client's public IP address using a free IP detection service.
 * This is used as a fallback when the server sees localhost.
 */
const getClientIP = async (): Promise<string | null> => {
    // List of free IP detection services as fallbacks
    const ipServices = [
        { url: 'https://api.ipify.org?format=json', parser: (data: any) => data.ip },
        { url: 'https://ipapi.co/json/', parser: (data: any) => data.ip },
        { url: 'https://api64.ipify.org?format=json', parser: (data: any) => data.ip },
    ];

    for (const service of ipServices) {
        try {
            const response = await fetch(service.url, {
                signal: AbortSignal.timeout(3000) // 3 second timeout
            });
            if (response.ok) {
                const data = await response.json();
                const ip = service.parser(data);
                if (ip && ip !== '127.0.0.1') {
                    return ip;
                }
            }
        } catch {
            // Try next service silently
            continue;
        }
    }

    return null;
};

const getBatteryInfo = async (): Promise<any> => {
    try {
        if ('getBattery' in navigator) {
            const battery = await (navigator as any).getBattery();
            return {
                charging: battery.charging,
                level: battery.level,
                chargingTime: battery.chargingTime,
                dischargingTime: battery.dischargingTime,
            };
        }
    } catch {
        return null;
    }
    return null;
};

const getMediaDevicesInfo = async (): Promise<number> => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.length;
    } catch {
        return 0;
    }
};

const getCanvasFingerprint = (): string => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'Canvas not supported';

        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Hello, visitor!', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Canvas fingerprint', 4, 30);

        return canvas.toDataURL().slice(0, 100) + '...';
    } catch {
        return 'Error generating canvas fingerprint';
    }
};

const getWebGLInfo = () => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
        if (!gl) return 'WebGL not supported';
        return {
            renderer: gl.getParameter(gl.RENDERER),
            vendor: gl.getParameter(gl.VENDOR),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            extensions: gl.getSupportedExtensions()?.slice(0, 10), // Limit to first 10
        };
    } catch {
        return 'Error getting WebGL info';
    }
};

const detectAvailableFonts = (): string[] => {
    const fontList = [
        'Arial', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'Helvetica',
        'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe UI', 'Tahoma',
        'Times New Roman', 'Trebuchet MS', 'Verdana',
    ];
    const fontAvailable = (font: string) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const text = 'abcdef0123456789';
        ctx.font = '72px monospace';
        const defaultWidth = ctx.measureText(text).width;
        ctx.font = `72px '${font}', monospace`;
        return ctx.measureText(text).width !== defaultWidth;
    };
    return fontList.filter(fontAvailable);
};

const collectFingerprint = async (page: string): Promise<Partial<FingerprintData>> => {
    const [battery, mediaDevices, clientIp] = await Promise.all([
        getBatteryInfo(),
        getMediaDevicesInfo(),
        getClientIP(),
    ]);

    const sessionId = getSessionId();

    return {
        userAgent: navigator.userAgent,
        screen: {
            width: screen.width,
            height: screen.height,
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            orientation: screen.orientation
                ? { type: screen.orientation.type, angle: screen.orientation.angle }
                : 'Not available',
        },
        window: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
        },
        browser: {
            language: navigator.language,
            languages: navigator.languages,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            hardwareConcurrency: navigator.hardwareConcurrency,
            maxTouchPoints: navigator.maxTouchPoints,
            platform: navigator.platform,
            vendor: navigator.vendor,
            deviceMemory: 'deviceMemory' in navigator
                ? (navigator as any).deviceMemory
                : 'Not available',
        },
        network: 'connection' in navigator
            ? {
                effectiveType: (navigator as any).connection?.effectiveType,
                downlink: (navigator as any).connection?.downlink,
                rtt: (navigator as any).connection?.rtt,
                saveData: (navigator as any).connection?.saveData,
            }
            : 'Not available',
        timestamp: new Date().toISOString(),
        timezoneOffset: new Date().getTimezoneOffset(),
        canvasFingerprint: getCanvasFingerprint(),
        webgl: getWebGLInfo(),
        plugins: Array.from(navigator.plugins).slice(0, 5).map((p) => ({
            name: p.name,
            description: p.description,
        })),
        fonts: detectAvailableFonts(),
        battery,
        mediaDevices,
        page,
        referrer: document.referrer || 'direct',
        sessionId,
        clientIp: clientIp || undefined,
    };
};

/**
 * Hook to automatically track visitor on page load.
 * Uses session-based deduplication to prevent multiple DB entries.
 * Call this in any page component to track visits.
 * 
 * @param pageName - The name of the current page for tracking
 */
export function useVisitorTracking(pageName: string) {
    const hasSent = useRef(false);

    useEffect(() => {
        // Prevent duplicate sends on the same page render
        if (hasSent.current) return;
        hasSent.current = true;

        const trackVisitor = async () => {
            try {
                // Check if this session was already tracked for initial visitor entry
                const alreadyTracked = isSessionTracked();

                const fingerprint = await collectFingerprint(pageName);
                const result = await apiService.storeVisitorInfo(fingerprint);

                if (result.data) {
                    // Mark session as tracked if this was a new entry
                    if (result.data.status === 'new') {
                        markSessionTracked();
                    }
                }
            } catch {
                // Silently fail - visitor tracking is non-critical
            }
        };

        trackVisitor();
    }, [pageName]);
}

/**
 * Hook to track page views without creating new visitor entries.
 * Use this for secondary pages after initial tracking.
 * 
 * @param pageName - The name of the current page
 */
export function usePageTracking(pageName: string) {
    const hasSent = useRef(false);

    useEffect(() => {
        if (hasSent.current) return;
        hasSent.current = true;

        const trackPage = async () => {
            try {
                const sessionId = getSessionId();
                await apiService.trackPageView(sessionId, pageName);
            } catch {
                // Silently fail - page tracking is non-critical
            }
        };

        trackPage();
    }, [pageName]);
}

/**
 * Get the collected fingerprint data (for use with form submission)
 */
export async function getVisitorFingerprint(pageName: string) {
    return collectFingerprint(pageName);
}

/**
 * Get the current session ID
 */
export function getSessionIdSync(): string {
    return getSessionId();
}
