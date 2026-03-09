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
    const [enabled, setEnabled] = useState(false);
    const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

    const toggle = useCallback(() => {
        setEnabled((prev) => {
            if (prev) setActiveDrawer(null); // close drawer when disabling
            return !prev;
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
