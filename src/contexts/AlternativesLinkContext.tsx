/**
 * AlternativesLinkContext
 *
 * Holds deep-link params passed from the Intervention flow to the
 * Alternatives tab (spec §6).
 *
 * Phase 1: params are set via a dev test button on InsightsScreen.
 * Phase 2: will be set by a NativeEventEmitter from the native bridge.
 */

import type { AlternativesDeepLinkParams } from '@/src/core/alternatives/types';
import React, { createContext, useCallback, useContext, useState } from 'react';

interface AlternativesLinkContextValue {
    params: AlternativesDeepLinkParams | null;
    setLinkParams: (p: AlternativesDeepLinkParams) => void;
    clearLinkParams: () => void;
}

const AlternativesLinkContext = createContext<AlternativesLinkContextValue>({
    params: null,
    setLinkParams: () => { },
    clearLinkParams: () => { },
});

export function AlternativesLinkProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [params, setParams] = useState<AlternativesDeepLinkParams | null>(null);

    const setLinkParams = useCallback((p: AlternativesDeepLinkParams) => {
        setParams(p);
        if (__DEV__) {
            console.log('[AlternativesLink] deep_link_received', {
                trigger: p.trigger,
                source: p.source,
            });
        }
    }, []);

    const clearLinkParams = useCallback(() => {
        if (__DEV__ && params) {
            console.log('[AlternativesLink] intervention_back', {
                trigger: params.trigger,
            });
        }
        setParams(null);
    }, [params]);

    return (
        <AlternativesLinkContext.Provider
            value={{ params, setLinkParams, clearLinkParams }}
        >
            {children}
        </AlternativesLinkContext.Provider>
    );
}

export function useAlternativesLink() {
    return useContext(AlternativesLinkContext);
}
