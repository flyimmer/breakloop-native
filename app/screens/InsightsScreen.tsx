import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * InsightsScreen
 * 
 * Main App UI: Insights & Statistics Tab
 * 
 * Content Structure:
 * 1. Your Values - User's selected core values (Career, Health, Love, etc.)
 * 2. Screen Time - Graph showing daily/weekly/monthly screen time patterns
 * 3. Deep Insights - AI-powered insights placeholder
 * 
 * Posture: Reflective, Retrospective
 * - Not governed by interaction gravity
 * - Rich UI allowed (charts, colors, details)
 * - User is curious, not vulnerable
 * 
 * Design authority:
 * - design/principles/main-app-posture.md
 * - design/ui/screens.md (5.1 Insights Tab Screen)
 * - design/ui/tokens.md (colors, typography, spacing)
 */

type TimePeriod = 'today' | 'week' | 'month';

// Mock user values - in production, this would come from user state
const userValues = [
  { id: 'work', label: 'Work', icon: '💼' },
  // Add more values when user selects them
];

export default function InsightsScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('today');
  const [currentDate] = useState('Today, 24 Oct');

  const handleEditValues = () => {
    console.log('Edit values');
    // TODO: Open values editor
  };

  // Mock data for bar chart (screen time in minutes for each hour)
  // In production, this would be calculated from actual usage data
  const screenTimeData = [
    { hour: '0m', minutes: 0 },
    { hour: '1m', minutes: 0 },
    { hour: '2m', minutes: 0 },
    { hour: '3m', minutes: 0 },
    { hour: '4m', minutes: 0 },
    { hour: '5m', minutes: 0 },
    { hour: '6m', minutes: 0 },
    { hour: '7m', minutes: 5 },
    { hour: '8m', minutes: 8 },
    { hour: '9m', minutes: 12 },
  ];

  const maxMinutes = Math.max(...screenTimeData.map(d => d.minutes));
  const totalScreenTime = '3h 12m'; // In production, calculate from actual data

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Your Values Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your values</Text>
              <Text style={styles.sectionSubtitle}>These help frame how you want to use your time.</Text>
            </View>
            <Pressable
              onPress={handleEditValues}
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.editButtonPressed,
              ]}
              hitSlop={8}
            >
              <Text style={styles.editIcon}>✏️</Text>
            </Pressable>
          </View>

          {/* Values Grid */}
          <View style={styles.valuesGrid}>
            {userValues.length === 0 ? (
              // Empty state - no values selected yet
              <View style={styles.emptyValuesContainer}>
                <View style={styles.addValueCard}>
                  <Text style={styles.addValueIcon}>+</Text>
                </View>
                <Text style={styles.emptyValuesText}>
                  Add values to frame how you want to use your time
                </Text>
              </View>
            ) : (
              // Render selected values
              <>
                {userValues.map((value) => (
                  <View key={value.id} style={styles.valueCard}>
                    <Text style={styles.valueIcon}>{value.icon}</Text>
                    <Text style={styles.valueLabel}>{value.label}</Text>
                  </View>
                ))}
                {/* Add value button */}
                <View style={styles.addValueCard}>
                  <Text style={styles.addValueIcon}>+</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Screen Time Section */}
        <View style={styles.section}>
          <View style={styles.screenTimeHeader}>
            <Text style={styles.screenTimeTitle}>Screen{'\n'}Time</Text>
            
            {/* Period Selector */}
            <View style={styles.periodSelector}>
              <Pressable
                onPress={() => setSelectedPeriod('today')}
                style={({ pressed }) => [
                  styles.periodButton,
                  selectedPeriod === 'today' && styles.periodButtonActive,
                  pressed && styles.periodButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === 'today' && styles.periodButtonTextActive,
                  ]}
                >
                  Today
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedPeriod('week')}
                style={({ pressed }) => [
                  styles.periodButton,
                  selectedPeriod === 'week' && styles.periodButtonActive,
                  pressed && styles.periodButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === 'week' && styles.periodButtonTextActive,
                  ]}
                >
                  Week
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedPeriod('month')}
                style={({ pressed }) => [
                  styles.periodButton,
                  selectedPeriod === 'month' && styles.periodButtonActive,
                  pressed && styles.periodButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === 'month' && styles.periodButtonTextActive,
                  ]}
                >
                  Month
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Date Navigation */}
          <View style={styles.dateNavigation}>
            <Pressable
              style={({ pressed }) => [
                styles.dateArrow,
                pressed && styles.dateArrowPressed,
              ]}
              hitSlop={8}
            >
              <Text style={styles.dateArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.dateText}>{currentDate}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.dateArrow,
                pressed && styles.dateArrowPressed,
              ]}
              hitSlop={8}
            >
              <Text style={styles.dateArrowText}>›</Text>
            </Pressable>
          </View>

          {/* Total Screen Time */}
          <View style={styles.totalTimeContainer}>
            <Text style={styles.totalTime}>{totalScreenTime}</Text>
            <Text style={styles.totalTimeLabel}>
              Screen time {selectedPeriod === 'today' ? 'today' : selectedPeriod === 'week' ? 'this week' : 'this month'}
            </Text>
          </View>

          {/* Bar Chart */}
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              {screenTimeData.map((data, index) => {
                const heightPercent = maxMinutes > 0 ? (data.minutes / maxMinutes) * 100 : 0;
                return (
                  <View key={`${data.hour}-${index}`} style={styles.barContainer}>
                    <View style={styles.barWrapper}>
                      {data.minutes > 0 && (
                        <>
                          <Text style={styles.barLabel}>{data.minutes}m</Text>
                          <View
                            style={[
                              styles.bar,
                              { height: `${Math.max(heightPercent, 10)}%` },
                            ]}
                          />
                        </>
                      )}
                      {data.minutes === 0 && (
                        <View style={styles.barEmpty} />
                      )}
                    </View>
                    <Text style={styles.barTime}>{data.hour}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Deep Insights Section - Placeholder for future implementation */}
        <View style={styles.section}>
          <View style={styles.deepInsightsCard}>
            <View style={styles.deepInsightsHeader}>
              <Text style={styles.deepInsightsIcon}>💡</Text>
              <Text style={styles.deepInsightsTitle}>Deep Insights</Text>
              <View style={styles.aiAnalysisBadge}>
                <Text style={styles.aiAnalysisBadgeText}>✨ AI Analysis</Text>
              </View>
            </View>
            
            {/* Placeholder content */}
            <View style={styles.deepInsightsPlaceholder}>
              <View style={styles.loadingIndicator}>
                <View style={styles.spinnerDot} />
                <View style={[styles.spinnerDot, styles.spinnerDotDelay1]} />
                <View style={[styles.spinnerDot, styles.spinnerDotDelay2]} />
              </View>
              <Text style={styles.deepInsightsPlaceholderText}>
                AI-powered insights coming soon
              </Text>
              <Text style={styles.deepInsightsDescription}>
                We'll analyze your screen time patterns and provide personalized insights to help you build healthier habits.
              </Text>
            </View>
          </View>
        </View>

        {/* Habit Loops Section - Placeholder for future implementation */}
        <View style={styles.section}>
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderTitle}>Habit Loops</Text>
            <Text style={styles.placeholderText}>
              Pattern analysis coming soon
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Subtle gradient background for depth
    backgroundColor: '#F8F9FA', // Softer, warmer background
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40, // Extra space for tab bar
    paddingTop: 16, // Better breathing room at top
  },

  // Sections
  section: {
    paddingHorizontal: 24, // Increased from 20 for better margins
    paddingTop: 28, // Increased from 24 for better separation
    marginBottom: 8, // Add margin between sections
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20, // Increased from 16
  },
  sectionTitle: {
    fontSize: 18, // Increased from 16 for better hierarchy
    lineHeight: 26,
    fontWeight: '700', // Bolder for clear hierarchy
    color: '#0F172A', // Darker, higher contrast
    marginBottom: 6, // Increased from 4
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13, // Increased from 12 for readability
    lineHeight: 18,
    fontWeight: '400',
    color: '#64748B', // Better contrast than #71717A
  },
  editButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  editButtonPressed: {
    opacity: 0.5,
  },
  editIcon: {
    fontSize: 16,
  },

  // Values Grid
  valuesGrid: {
    flexDirection: 'row',
    gap: 16, // Increased from 12 for better breathing room
    flexWrap: 'wrap',
  },
  emptyValuesContainer: {
    alignItems: 'center',
    gap: 16, // Increased from 12
    paddingVertical: 8,
  },
  emptyValuesText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#64748B', // Better contrast
    textAlign: 'center',
  },
  valueCard: {
    width: 88, // Increased from 80 for better tap targets
    height: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 16, // Increased from 12 for modern look
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6, // Increased from 4
    // Enhanced shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9', // Subtle border for definition
  },
  valueIcon: {
    fontSize: 28, // Increased from 24
  },
  valueLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600', // Bolder for clarity
    color: '#0F172A', // Darker for better contrast
  },
  addValueCard: {
    width: 88,
    height: 88,
    backgroundColor: '#F8FAFC', // Softer background
    borderRadius: 16,
    borderWidth: 2, // Thicker for visibility
    borderColor: '#CBD5E1', // Better contrast
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addValueIcon: {
    fontSize: 28, // Increased from 24
    color: '#94A3B8', // Better contrast
  },

  // Screen Time Section
  screenTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24, // Increased from 20
  },
  screenTimeTitle: {
    fontSize: 22, // Increased from 20 for better hierarchy
    lineHeight: 30,
    fontWeight: '700', // Bolder
    letterSpacing: -0.4,
    color: '#0F172A', // Darker for contrast
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9', // Better contrast
    borderRadius: 10, // Increased for modern look
    padding: 4, // Increased from 2
  },
  periodButton: {
    paddingHorizontal: 16, // Increased from 12
    paddingVertical: 8, // Increased from 6
    borderRadius: 8, // Increased from 6
    minWidth: 60, // Ensure consistent sizing
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
    // Enhanced shadow for active state
    shadowColor: '#8B7AE8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  periodButtonPressed: {
    opacity: 0.7,
  },
  periodButtonText: {
    fontSize: 13, // Increased from 12
    lineHeight: 18,
    fontWeight: '500',
    color: '#64748B', // Better contrast
    textAlign: 'center',
  },
  periodButtonTextActive: {
    color: '#8B7AE8', // Use primary color for active
    fontWeight: '700', // Bolder when active
  },

  // Date Navigation
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  dateArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  dateArrowPressed: {
    opacity: 0.5,
  },
  dateArrowText: {
    fontSize: 24,
    color: '#52525B', // textSecondary (light mode)
  },
  dateText: {
    fontSize: 14, // bodySecondary
    lineHeight: 20,
    fontWeight: '500',
    color: '#18181B', // textPrimary (light mode)
  },

  // Total Time Display
  totalTimeContainer: {
    alignItems: 'center',
    marginBottom: 36, // Increased from 32
    paddingVertical: 8,
  },
  totalTime: {
    fontSize: 56, // Increased from 48 for prominence
    lineHeight: 64,
    fontWeight: '700', // Bolder
    letterSpacing: -1.5,
    color: '#0F172A', // Darker for maximum contrast
    marginBottom: 6, // Increased from 4
  },
  totalTimeLabel: {
    fontSize: 15, // Increased from 14
    lineHeight: 22,
    fontWeight: '500', // Slightly bolder
    color: '#64748B', // Better contrast
  },

  // Bar Chart
  chartContainer: {
    paddingHorizontal: 12, // Increased from 8
    paddingVertical: 8,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180, // Increased from 160 for better visibility
    gap: 6, // Increased from 4
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10, // Increased from 8
  },
  barLabel: {
    fontSize: 11, // Increased from 10
    lineHeight: 14,
    fontWeight: '600', // Bolder for readability
    color: '#475569', // Better contrast
    marginBottom: 6, // Increased from 4
  },
  bar: {
    width: '100%',
    minHeight: 16, // Increased from 12
    backgroundColor: '#8B7AE8', // primary
    borderTopLeftRadius: 6, // Increased from 4
    borderTopRightRadius: 6,
    // Add subtle shadow for depth
    shadowColor: '#8B7AE8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  barEmpty: {
    width: '100%',
    height: 6, // Increased from 4
    backgroundColor: '#E2E8F0', // Better visibility
    borderRadius: 3,
  },
  barTime: {
    fontSize: 11, // Increased from 10
    lineHeight: 14,
    fontWeight: '500', // Bolder
    color: '#64748B', // Better contrast
    marginTop: 6, // Increased from 4
  },

  // Deep Insights Section
  deepInsightsCard: {
    padding: 24, // Increased from 20
    backgroundColor: '#1E293B', // Richer dark color
    borderRadius: 20, // Increased from 16 for modern look
    // Enhanced shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  deepInsightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10, // Increased from 8
    marginBottom: 16, // Increased from 12
  },
  deepInsightsIcon: {
    fontSize: 24, // Increased from 20
  },
  deepInsightsTitle: {
    fontSize: 19, // Increased from 18
    lineHeight: 26,
    fontWeight: '700', // Bolder
    color: '#F8FAFC', // Higher contrast
    flex: 1,
  },
  aiAnalysisBadge: {
    paddingHorizontal: 10, // Increased from 8
    paddingVertical: 5, // Increased from 4
    backgroundColor: 'rgba(139, 122, 232, 0.25)', // Slightly more opaque
    borderRadius: 8, // Increased from 6
  },
  aiAnalysisBadgeText: {
    fontSize: 11, // Increased from 10
    lineHeight: 14,
    fontWeight: '700', // Bolder
    color: '#A78BFA', // Lighter purple for better contrast on dark
  },
  deepInsightsPlaceholder: {
    alignItems: 'center',
    paddingVertical: 20, // Increased from 16
  },
  loadingIndicator: {
    flexDirection: 'row',
    gap: 10, // Increased from 8
    marginBottom: 20, // Increased from 16
  },
  spinnerDot: {
    width: 10, // Increased from 8
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A78BFA', // Lighter purple for visibility
    opacity: 0.4,
  },
  spinnerDotDelay1: {
    opacity: 0.7,
  },
  spinnerDotDelay2: {
    opacity: 1,
  },
  deepInsightsPlaceholderText: {
    fontSize: 15, // Increased from 14
    lineHeight: 22,
    fontWeight: '600', // Bolder
    color: '#CBD5E1', // Better contrast on dark
    marginBottom: 10, // Increased from 8
    textAlign: 'center',
  },
  deepInsightsDescription: {
    fontSize: 14, // Increased from 13
    lineHeight: 20,
    fontWeight: '400',
    color: '#94A3B8', // Better contrast on dark
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // Placeholder Card (for Habit Loops section)
  placeholderCard: {
    padding: 24, // Increased from 20
    backgroundColor: '#FFFFFF', // Pure white for contrast
    borderRadius: 16, // Increased from 12
    borderWidth: 1,
    borderColor: '#E2E8F0', // Better contrast
    // Add shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  placeholderTitle: {
    fontSize: 18, // Increased from 16
    lineHeight: 26,
    fontWeight: '700', // Bolder
    color: '#0F172A', // Darker for contrast
    marginBottom: 6, // Increased from 4
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#64748B', // Better contrast
  },
});
