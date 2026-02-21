/**
 * InterventionTopBar
 *
 * Temporary top bar shown when the Alternatives tab is opened
 * via a deep link from the Intervention flow (spec §6).
 *
 * Phase 1: "Back" clears the deep-link params (showcase only).
 * Phase 2: "Back" will navigate to the originating checkpoint surface.
 *
 * Layout:
 *   [ ← Back ]   Alternatives for <Trigger>   [ ✕ ]
 */

import { useAlternativesLink } from '@/src/contexts/AlternativesLinkContext';
import { TRIGGER_LABELS } from '@/src/core/alternatives/types';
import { ChevronLeft, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InterventionTopBar() {
    const { params, clearLinkParams } = useAlternativesLink();
    const insets = useSafeAreaInsets();

    if (!params) return null;

    const triggerLabel = TRIGGER_LABELS[params.trigger] ?? params.trigger;

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <Pressable
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                onPress={clearLinkParams}
                hitSlop={12}
            >
                <ChevronLeft size={20} color="#8B7AE8" strokeWidth={2.5} />
                <Text style={styles.backLabel}>Back</Text>
            </Pressable>

            <Text style={styles.title} numberOfLines={1}>
                Alternatives for {triggerLabel}
            </Text>

            <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                onPress={clearLinkParams}
                hitSlop={12}
            >
                <X size={18} color="#71717A" strokeWidth={2} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A24',
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#3B3B4F',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minWidth: 72,
    },
    backLabel: {
        color: '#8B7AE8',
        fontSize: 15,
        fontWeight: '500',
    },
    title: {
        flex: 1,
        textAlign: 'center',
        color: '#FAFAFA',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    closeBtn: {
        minWidth: 72,
        alignItems: 'flex-end',
    },
    pressed: {
        opacity: 0.6,
    },
});
