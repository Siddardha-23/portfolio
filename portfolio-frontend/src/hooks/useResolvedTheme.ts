/**
 * The concrete theme currently painted, "light" or "dark".
 *
 * ThemeProvider stores the user's *preference*, which may be "system", and it
 * applies the resolved value as a class on <html>. Canvas and SVG work needs the
 * resolved value rather than the preference, so this reads the class directly and
 * follows it — which also covers the provider's synchronous class swap during a
 * toggle, and the OS flipping while the preference is "system".
 */
import { useEffect, useState } from 'react';

export type ResolvedTheme = 'light' | 'dark';

function readTheme(): ResolvedTheme {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useResolvedTheme(): ResolvedTheme {
    const [theme, setTheme] = useState<ResolvedTheme>(readTheme);

    useEffect(() => {
        const root = document.documentElement;

        // Re-read on any class change; the provider swaps light/dark in one pass.
        const observer = new MutationObserver(() => {
            setTheme((prev) => {
                const next = readTheme();
                return prev === next ? prev : next;
            });
        });
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });

        // The class is set in an effect, so the first paint can precede it.
        setTheme(readTheme());

        return () => observer.disconnect();
    }, []);

    return theme;
}
