import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface UnderTheHoodState {
    enabled: boolean;
    toggle: () => void;
    activeDrawer: string | null;
    openDrawer: (featureId: string) => void;
    closeDrawer: () => void;
}

const UnderTheHoodContext = createContext<UnderTheHoodState | undefined>(undefined);

export function UnderTheHoodProvider({ children }: { children: ReactNode }) {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('under_the_hood_enabled') === 'true';
        }
        return false;
    });
    const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

    const toggle = useCallback(() => {
        setEnabled((prev) => {
            const next = !prev;
            if (prev) setActiveDrawer(null); // close drawer when disabling
            localStorage.setItem('under_the_hood_enabled', String(next));
            return next;
        });
    }, []);

    const openDrawer = useCallback(
        (featureId: string) => {
            if (enabled) setActiveDrawer(featureId);
        },
        [enabled],
    );

    const closeDrawer = useCallback(() => setActiveDrawer(null), []);

    return (
        <UnderTheHoodContext.Provider
            value={{ enabled, toggle, activeDrawer, openDrawer, closeDrawer }}
        >
            {children}
        </UnderTheHoodContext.Provider>
    );
}

export function useUnderTheHood() {
    const ctx = useContext(UnderTheHoodContext);
    if (!ctx) throw new Error('useUnderTheHood must be used within UnderTheHoodProvider');
    return ctx;
}
