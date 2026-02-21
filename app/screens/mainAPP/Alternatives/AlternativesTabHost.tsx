/**
 * AlternativesTabHost
 *
 * Sub-tab switcher for the Alternatives bottom tab.
 * Sub-tabs: My List | Discover
 *
 * - Reads AlternativesLinkContext: if params present, shows InterventionTopBar
 *   and forces My List active + passes highlightTrigger.
 * - InterventionTopBar Back/X clears params and resets to normal.
 */

import InterventionTopBar from '@/app/components/alternatives/InterventionTopBar';
import { useAlternativesLink } from '@/src/contexts/AlternativesLinkContext';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DiscoverScreen from './DiscoverScreen';
import MyListScreen from './MyListScreen';

type SubTab = 'MY_LIST' | 'DISCOVER';

export default function AlternativesTabHost() {
    const { params } = useAlternativesLink();
    const [activeTab, setActiveTab] = useState<SubTab>('MY_LIST');

    // When a deep link arrives, force My List and log
    useEffect(() => {
        if (params) {
            setActiveTab('MY_LIST');
        }
    }, [params]);

    return (
        <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
            {/* Intervention top bar (only visible when launched from intervention) */}
            <InterventionTopBar />

            {/* Header — only shown when NOT in intervention context */}
            {!params && (
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Alternatives</Text>
                </View>
            )}

            {/* Sub-tab bar */}
            <View style={styles.tabBar}>
                <Pressable
                    style={[styles.tab, activeTab === 'MY_LIST' && styles.tabActive]}
                    onPress={() => setActiveTab('MY_LIST')}
                >
                    <Text
                        style={[
                            styles.tabLabel,
                            activeTab === 'MY_LIST' && styles.tabLabelActive,
                        ]}
                    >
                        My List
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, activeTab === 'DISCOVER' && styles.tabActive]}
                    onPress={() => setActiveTab('DISCOVER')}
                >
                    <Text
                        style={[
                            styles.tabLabel,
                            activeTab === 'DISCOVER' && styles.tabLabelActive,
                        ]}
                    >
                        Discover
                    </Text>
                </Pressable>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {activeTab === 'MY_LIST' && (
                    <MyListScreen highlightTrigger={params?.trigger ?? null} />
                )}
                {activeTab === 'DISCOVER' && <DiscoverScreen />}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0A0A0F',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FAFAFA',
        letterSpacing: -0.5,
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 0,
        gap: 4,
    },
    tab: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    tabActive: {
        backgroundColor: '#27272A',
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#71717A',
        letterSpacing: 0.1,
    },
    tabLabelActive: {
        color: '#FAFAFA',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
});
