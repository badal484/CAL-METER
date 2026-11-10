import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput as RNTextInput,
  Alert,
} from 'react-native';
import {
  ScreenContainer,
  Card,
  Button,
  IconButton,
  LoadingIndicator,
  EmptyState,
  ErrorState,
} from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Lightbulb,
  Utensils,
  RotateCcw,
  Check,
  AlertCircle,
  Info,
  Trash2,
} from 'lucide-react-native';
import { defaultCoachApiClient, CoachApiClient } from '../../services/coachApi';
import type {
  CoachMessageDto,
  PersonalizedInsightDto,
  MealRecommendationDto,
} from '@calmeter/contracts';
import { MealType, InsightCategory } from '@calmeter/shared';

export interface CoachScreenProps {
  coachApiClient?: CoachApiClient;
  initialTab?: 'chat' | 'insights' | 'meals';
}

type CoachTab = 'chat' | 'insights' | 'meals';

const DEFAULT_PROMPTS = [
  'What should I eat for dinner?',
  'How is my protein intake today?',
  'Suggest a high-protein snack',
  'How am I doing on my calorie target?',
];

export const CoachScreen: React.FC<CoachScreenProps> = ({
  coachApiClient = defaultCoachApiClient,
  initialTab = 'chat',
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [activeTab, setActiveTab] = useState<CoachTab>(initialTab);

  // Chat state
  const [messages, setMessages] = useState<CoachMessageDto[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [sendingMessage, setSendingMessage] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(DEFAULT_PROMPTS);

  // Insights state
  const [insights, setInsights] = useState<PersonalizedInsightDto[]>([]);
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsDisclaimer, setInsightsDisclaimer] = useState<string>('');

  // Meal recommendations state
  const [mealRecommendations, setMealRecommendations] = useState<MealRecommendationDto[]>([]);
  const [remainingCalories, setRemainingCalories] = useState<number>(0);
  const [remainingProtein, setRemainingProtein] = useState<number>(0);
  const [selectedMealFilter, setSelectedMealFilter] = useState<MealType | 'ALL'>('ALL');
  const [loadingMeals, setLoadingMeals] = useState<boolean>(false);
  const [mealsError, setMealsError] = useState<string | null>(null);
  const [loggedMealNotice, setLoggedMealNotice] = useState<string | null>(null);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setChatError(null);
      const res = await coachApiClient.getHistory(50);
      setMessages(res.messages || []);
    } catch (err: any) {
      setChatError(err.message || 'Failed to load conversation history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [coachApiClient]);

  const loadInsights = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoadingInsights(true);
        setInsightsError(null);
        const res = await coachApiClient.getInsights(forceRefresh);
        setInsights(res.insights || []);
        setInsightsDisclaimer(res.disclaimer || '');
      } catch (err: any) {
        setInsightsError(err.message || 'Failed to load personalized insights.');
      } finally {
        setLoadingInsights(false);
      }
    },
    [coachApiClient],
  );

  const loadMealRecommendations = useCallback(
    async (mealType?: MealType) => {
      try {
        setLoadingMeals(true);
        setMealsError(null);
        const query = mealType ? { mealType } : undefined;
        const res = await coachApiClient.getMealRecommendations(query);
        setMealRecommendations(res.recommendations || []);
        setRemainingCalories(res.remainingCalories || 0);
        setRemainingProtein(res.remainingProtein || 0);
      } catch (err: any) {
        setMealsError(err.message || 'Failed to load meal recommendations.');
      } finally {
        setLoadingMeals(false);
      }
    },
    [coachApiClient],
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (activeTab === 'insights' && insights.length === 0) {
      loadInsights();
    } else if (activeTab === 'meals' && mealRecommendations.length === 0) {
      loadMealRecommendations();
    }
  }, [
    activeTab,
    insights.length,
    mealRecommendations.length,
    loadInsights,
    loadMealRecommendations,
  ]);

  // ==========================================================================
  // CHAT HANDLERS
  // ==========================================================================

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || sendingMessage) return;

    setInputText('');
    setSendingMessage(true);
    setChatError(null);

    // Optimistically add user message
    const tempUserMsg: CoachMessageDto = {
      id: `temp-${Date.now()}`,
      userId: 'current-user',
      role: 'USER' as any,
      content: query,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await coachApiClient.sendMessage(query);
      const assistantMsg: CoachMessageDto = {
        id: res.messageId,
        userId: 'coach',
        role: 'ASSISTANT' as any,
        content: res.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (res.suggestedPrompts && res.suggestedPrompts.length > 0) {
        setSuggestedPrompts(res.suggestedPrompts);
      }
    } catch (err: any) {
      setChatError(err.message || 'Failed to receive coach response.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to delete your conversation history with the AI Coach? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await coachApiClient.clearHistory();
              setMessages([]);
              setSuggestedPrompts(DEFAULT_PROMPTS);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear conversation history.');
            }
          },
        },
      ],
    );
  };

  const handleSelectMealFilter = (mealType: MealType | 'ALL') => {
    setSelectedMealFilter(mealType);
    if (mealType === 'ALL') {
      loadMealRecommendations();
    } else {
      loadMealRecommendations(mealType);
    }
  };

  const handleLogRecommendedMeal = (meal: MealRecommendationDto) => {
    setLoggedMealNotice(`Logged "${meal.title}" (${meal.totalCalories} kcal) to your diary.`);
    setTimeout(() => {
      setLoggedMealNotice(null);
    }, 4000);
  };

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  const getCategoryBadgeStyle = (category: InsightCategory) => {
    switch (category) {
      case InsightCategory.CELEBRATION:
        return {
          bg: colors.surfaceElevated,
          border: colors.borderFocus,
          label: 'CELEBRATION',
        };
      case InsightCategory.CAUTION:
        return {
          bg: colors.surfaceElevated,
          border: colors.error,
          label: 'CAUTION',
        };
      case InsightCategory.RECOMMENDATION:
        return {
          bg: colors.surfaceElevated,
          border: colors.primary,
          label: 'RECOMMENDATION',
        };
      case InsightCategory.OBSERVATION:
      default:
        return {
          bg: colors.surfaceElevated,
          border: colors.borderSubtle,
          label: 'OBSERVATION',
        };
    }
  };

  return (
    <ScreenContainer>
      {/* 1. Header */}
      <View style={[styles.header, { marginBottom: spacing.md }]}>
        <View style={styles.headerTitleRow}>
          <Sparkles size={24} color={colors.primary} />
          <Text
            style={[typography.titleLarge, { color: colors.textPrimary, marginLeft: spacing.sm }]}
          >
            AI Nutrition Coach
          </Text>
        </View>
        <Text
          style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xxs }]}
        >
          Context-aware guidance based on your authentic logged nutrition.
        </Text>
      </View>

      {/* 2. Educational Non-Clinical Disclaimer Banner */}
      <View
        style={[
          styles.disclaimerBanner,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderSubtle,
            borderRadius: radii.md,
            padding: spacing.sm,
            marginBottom: spacing.md,
          },
        ]}
      >
        <Info size={16} color={colors.textSecondary} style={{ marginRight: spacing.xs }} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
          Educational guidance only. Not medical diagnosis or therapeutic prescription.
        </Text>
      </View>

      {/* 3. Segmented Navigation Tabs */}
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radii.full,
            padding: spacing.xxs,
            marginBottom: spacing.lg,
          },
        ]}
      >
        <Pressable
          testID="coach-tab-chat"
          onPress={() => setActiveTab('chat')}
          style={[
            styles.tabButton,
            activeTab === 'chat' && {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radii.full,
            },
          ]}
        >
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'chat' ? colors.textPrimary : colors.textSecondary },
            ]}
          >
            Coach Chat
          </Text>
        </Pressable>

        <Pressable
          testID="coach-tab-insights"
          onPress={() => setActiveTab('insights')}
          style={[
            styles.tabButton,
            activeTab === 'insights' && {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radii.full,
            },
          ]}
        >
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'insights' ? colors.textPrimary : colors.textSecondary },
            ]}
          >
            Insights
          </Text>
        </Pressable>

        <Pressable
          testID="coach-tab-meals"
          onPress={() => setActiveTab('meals')}
          style={[
            styles.tabButton,
            activeTab === 'meals' && {
              backgroundColor: colors.surfaceElevated,
              borderRadius: radii.full,
            },
          ]}
        >
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'meals' ? colors.textPrimary : colors.textSecondary },
            ]}
          >
            Meal Ideas
          </Text>
        </Pressable>
      </View>

      {/* ================================================================== */}
      {/* TAB 1: COACH CHAT */}
      {/* ================================================================== */}
      {activeTab === 'chat' && (
        <View style={styles.tabContent}>
          {/* Header Action: Clear History */}
          {messages.length > 0 && (
            <View style={styles.chatActionRow}>
              <Pressable
                testID="coach-clear-history-button"
                onPress={handleClearHistory}
                style={[
                  styles.clearButton,
                  { borderColor: colors.borderSubtle, borderRadius: radii.full },
                ]}
              >
                <Trash2 size={14} color={colors.textSecondary} />
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary, marginLeft: spacing.xxs },
                  ]}
                >
                  Clear History
                </Text>
              </Pressable>
            </View>
          )}

          {/* Loading History */}
          {loadingHistory ? (
            <LoadingIndicator message="Loading coach conversation..." />
          ) : chatError && messages.length === 0 ? (
            <ErrorState title="Failed to Load History" message={chatError} onRetry={loadHistory} />
          ) : (
            <ScrollView
              style={styles.chatScroll}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
              showsVerticalScrollIndicator={false}
            >
              {/* Empty State / Welcome */}
              {messages.length === 0 ? (
                <Card variant="muted" style={{ marginBottom: spacing.md }}>
                  <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                    <Bot size={36} color={colors.primary} />
                    <Text
                      style={[
                        typography.titleSmall,
                        { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' },
                      ]}
                    >
                      Hello! I'm your AI Nutrition Coach.
                    </Text>
                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
                      ]}
                    >
                      Ask me anything about your daily calorie pacing, macronutrient distribution,
                      meal ideas, or hydration. I use your authentic food logs to give tailored
                      advice.
                    </Text>
                  </View>
                </Card>
              ) : (
                messages.map(msg => {
                  const isUser = msg.role === 'USER';
                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.messageRow,
                        isUser ? styles.messageRowUser : styles.messageRowAssistant,
                      ]}
                    >
                      {!isUser && (
                        <View
                          style={[
                            styles.avatarIcon,
                            { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
                          ]}
                        >
                          <Bot size={16} color={colors.primary} />
                        </View>
                      )}
                      <View
                        style={[
                          styles.bubble,
                          isUser
                            ? [
                                styles.userBubble,
                                {
                                  backgroundColor: colors.primary,
                                  borderRadius: radii.lg,
                                },
                              ]
                            : [
                                styles.assistantBubble,
                                {
                                  backgroundColor: colors.surfaceElevated,
                                  borderColor: colors.borderSubtle,
                                  borderRadius: radii.lg,
                                },
                              ],
                        ]}
                      >
                        <Text
                          style={[
                            typography.bodyMedium,
                            {
                              color: isUser ? colors.primaryText : colors.textPrimary,
                              lineHeight: 22,
                            },
                          ]}
                        >
                          {msg.content}
                        </Text>
                      </View>
                      {isUser && (
                        <View
                          style={[
                            styles.avatarIcon,
                            { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
                          ]}
                        >
                          <User size={16} color={colors.textSecondary} />
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {/* Sending indicator */}
              {sendingMessage && (
                <View style={[styles.messageRow, styles.messageRowAssistant]}>
                  <View
                    style={[
                      styles.avatarIcon,
                      { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
                    ]}
                  >
                    <Bot size={16} color={colors.primary} />
                  </View>
                  <View
                    style={[
                      styles.bubble,
                      styles.assistantBubble,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.borderSubtle,
                        borderRadius: radii.lg,
                        paddingVertical: spacing.sm,
                      },
                    ]}
                  >
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      Coach is analyzing your nutrition logs...
                    </Text>
                  </View>
                </View>
              )}

              {chatError && messages.length > 0 && (
                <View
                  style={[
                    styles.chatErrorBanner,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.error,
                      borderRadius: radii.md,
                      padding: spacing.sm,
                      marginTop: spacing.sm,
                    },
                  ]}
                >
                  <AlertCircle size={16} color={colors.error} style={{ marginRight: spacing.xs }} />
                  <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
                    {chatError}
                  </Text>
                </View>
              )}

              {/* Suggested Prompt Chips */}
              <View style={[styles.promptsSection, { marginTop: spacing.md }]}>
                <Text
                  style={[
                    typography.labelSmall,
                    { color: colors.textSecondary, marginBottom: spacing.xs },
                  ]}
                >
                  SUGGESTED QUESTIONS
                </Text>
                <View style={styles.promptsGrid}>
                  {suggestedPrompts.map((prompt, idx) => (
                    <Pressable
                      key={idx}
                      testID={`coach-prompt-chip-${idx}`}
                      onPress={() => handleSendMessage(prompt)}
                      disabled={sendingMessage}
                      style={[
                        styles.promptChip,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.border,
                          borderRadius: radii.full,
                          paddingVertical: spacing.xs,
                          paddingHorizontal: spacing.md,
                        },
                      ]}
                    >
                      <Sparkles
                        size={12}
                        color={colors.primary}
                        style={{ marginRight: spacing.xxs }}
                      />
                      <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>
                        {prompt}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          )}

          {/* Bottom Chat Input */}
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: radii.xl,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <RNTextInput
              testID="coach-chat-input"
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask coach about meals, goals, macros..."
              placeholderTextColor={colors.textTertiary}
              style={[typography.bodyMedium, styles.textInput, { color: colors.textPrimary }]}
              editable={!sendingMessage}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
            />
            <IconButton
              variant="filled"
              size="sm"
              icon={<Send size={16} color={colors.primaryText} />}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || sendingMessage}
              accessibilityLabel="Send message to AI coach"
              style={{ backgroundColor: inputText.trim() ? colors.primary : colors.surfaceMuted }}
            />
          </View>
        </View>
      )}

      {/* ================================================================== */}
      {/* TAB 2: DETERMINISTIC INSIGHTS */}
      {/* ================================================================== */}
      {activeTab === 'insights' && (
        <View style={styles.tabContent}>
          <View style={styles.subHeaderRow}>
            <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
              Today's Evaluated Insights
            </Text>
            <Pressable
              testID="coach-refresh-insights-button"
              onPress={() => loadInsights(true)}
              style={styles.refreshButton}
            >
              <RotateCcw size={16} color={colors.textSecondary} />
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginLeft: spacing.xxs },
                ]}
              >
                Refresh
              </Text>
            </Pressable>
          </View>

          {loadingInsights ? (
            <LoadingIndicator message="Evaluating nutrition metrics..." />
          ) : insightsError ? (
            <ErrorState
              title="Unable to Calculate Insights"
              message={insightsError}
              onRetry={() => loadInsights(true)}
            />
          ) : insights.length === 0 ? (
            <EmptyState
              icon={<Lightbulb size={36} color={colors.textSecondary} />}
              title="No Insights Available Yet"
              description="Log your daily meals, water, and weight to generate deterministic insights into your nutrition patterns."
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.xxl }}
            >
              {insights.map((insight, idx) => {
                const badge = getCategoryBadgeStyle(insight.category as InsightCategory);
                return (
                  <Card key={idx} variant="elevated" style={{ marginBottom: spacing.md }}>
                    <View style={styles.insightHeaderRow}>
                      <View
                        style={[
                          styles.badge,
                          {
                            borderColor: badge.border,
                            borderRadius: radii.full,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xxs,
                          },
                        ]}
                      >
                        <Text style={[typography.labelSmall, { color: colors.textPrimary }]}>
                          {badge.label}
                        </Text>
                      </View>
                      <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                        {insight.periodAnalyzed}
                      </Text>
                    </View>

                    <Text
                      style={[
                        typography.titleMedium,
                        { color: colors.textPrimary, marginTop: spacing.sm },
                      ]}
                    >
                      {insight.title}
                    </Text>

                    <Text
                      style={[
                        typography.bodyMedium,
                        { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 22 },
                      ]}
                    >
                      {insight.message}
                    </Text>

                    {/* Metric Data Pill */}
                    {insight.metricData && (
                      <View
                        style={[
                          styles.metricDataBox,
                          {
                            backgroundColor: colors.surfaceMuted,
                            borderRadius: radii.md,
                            padding: spacing.sm,
                            marginTop: spacing.md,
                          },
                        ]}
                      >
                        <View style={styles.metricDataRow}>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                            Current Progress:
                          </Text>
                          <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>
                            {insight.metricData.current} / {insight.metricData.target}{' '}
                            {insight.metricData.unit}
                            {insight.metricData.percentage !== undefined
                              ? ` (${insight.metricData.percentage}%)`
                              : ''}
                          </Text>
                        </View>
                        {insight.metricData.delta !== undefined && (
                          <View style={[styles.metricDataRow, { marginTop: spacing.xxs }]}>
                            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                              Net Change:
                            </Text>
                            <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>
                              {insight.metricData.delta > 0 ? '+' : ''}
                              {insight.metricData.delta} {insight.metricData.unit}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Actionable Tip Callout */}
                    {insight.actionableTip && (
                      <View
                        style={[
                          styles.tipCallout,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.borderSubtle,
                            borderRadius: radii.md,
                            padding: spacing.md,
                            marginTop: spacing.md,
                          },
                        ]}
                      >
                        <Lightbulb
                          size={16}
                          color={colors.primary}
                          style={{ marginRight: spacing.xs }}
                        />
                        <Text
                          style={[
                            typography.bodySmall,
                            { color: colors.textPrimary, flex: 1, lineHeight: 18 },
                          ]}
                        >
                          <Text style={{ fontWeight: '600' }}>Coach Action: </Text>
                          {insight.actionableTip}
                        </Text>
                      </View>
                    )}
                  </Card>
                );
              })}

              {insightsDisclaimer ? (
                <Text
                  style={[
                    typography.bodySmall,
                    {
                      color: colors.textTertiary,
                      textAlign: 'center',
                      marginTop: spacing.md,
                      paddingHorizontal: spacing.lg,
                    },
                  ]}
                >
                  {insightsDisclaimer}
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      )}

      {/* ================================================================== */}
      {/* TAB 3: TAILORED MEAL RECOMMENDATIONS */}
      {/* ================================================================== */}
      {activeTab === 'meals' && (
        <View style={styles.tabContent}>
          {/* Remaining Budget Summary Banner */}
          <Card variant="muted" style={{ marginBottom: spacing.md }}>
            <View style={styles.budgetBannerRow}>
              <View>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Remaining Daily Budget
                </Text>
                <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>
                  {remainingCalories} kcal
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Remaining Protein
                </Text>
                <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                  {remainingProtein}g
                </Text>
              </View>
            </View>
          </Card>

          {/* Feedback banner when meal is logged */}
          {loggedMealNotice && (
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderFocus,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Check size={16} color={colors.primary} style={{ marginRight: spacing.xs }} />
              <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]}>
                {loggedMealNotice}
              </Text>
            </View>
          )}

          {/* Meal Type Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.md }}
          >
            {(
              ['ALL', MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACK] as const
            ).map(filter => {
              const isSelected = selectedMealFilter === filter;
              return (
                <Pressable
                  key={filter}
                  testID={`meal-filter-${filter.toLowerCase()}`}
                  onPress={() => handleSelectMealFilter(filter)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radii.full,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.md,
                      marginRight: spacing.xs,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: isSelected ? colors.primaryText : colors.textPrimary },
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loadingMeals ? (
            <LoadingIndicator message="Finding tailored meal options..." />
          ) : mealsError ? (
            <ErrorState
              title="Unable to Load Meals"
              message={mealsError}
              onRetry={() => loadMealRecommendations()}
            />
          ) : mealRecommendations.length === 0 ? (
            <EmptyState
              icon={<Utensils size={36} color={colors.textSecondary} />}
              title="No Meal Recommendations"
              description="Try selecting a different meal type or adjust your dietary preferences in your profile."
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.xxl }}
            >
              {mealRecommendations.map(meal => (
                <Card key={meal.id} variant="elevated" style={{ marginBottom: spacing.md }}>
                  <View style={styles.mealHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                        {meal.title}
                      </Text>
                      <Text
                        style={[
                          typography.bodySmall,
                          { color: colors.textSecondary, marginTop: spacing.xxs },
                        ]}
                      >
                        {meal.cuisine} • {meal.mealType}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                        {meal.totalCalories} kcal
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        {meal.totalProtein}g protein
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      typography.bodyMedium,
                      { color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 },
                    ]}
                  >
                    {meal.description}
                  </Text>

                  {/* Dietary Tags */}
                  <View style={[styles.tagsRow, { marginTop: spacing.sm }]}>
                    {meal.dietaryTags.map((tag, tIdx) => (
                      <View
                        key={tIdx}
                        style={[
                          styles.tagPill,
                          {
                            backgroundColor: colors.surfaceMuted,
                            borderRadius: radii.full,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: 2,
                            marginRight: spacing.xxs,
                          },
                        ]}
                      >
                        <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Food Item Breakdown */}
                  <View
                    style={[
                      styles.itemsContainer,
                      {
                        backgroundColor: colors.surface,
                        borderRadius: radii.md,
                        padding: spacing.sm,
                        marginTop: spacing.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: colors.textSecondary, marginBottom: spacing.xs },
                      ]}
                    >
                      INCLUDED INGREDIENTS
                    </Text>
                    {meal.items.map((item, iIdx) => (
                      <View key={iIdx} style={styles.itemRow}>
                        <Text
                          style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]}
                        >
                          {item.foodName} ({item.portionAmount} {item.servingUnit},{' '}
                          {item.gramWeight}g)
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                          {item.calories} kcal | {item.protein}g P
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Log Meal Action */}
                  <View style={{ marginTop: spacing.md }}>
                    <Button
                      title="Log This Meal"
                      size="sm"
                      variant="outline"
                      onPress={() => handleLogRecommendedMeal(meal)}
                      testID={`log-meal-${meal.id}`}
                    />
                  </View>
                </Card>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {},
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flex: 1,
  },
  chatActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  chatScroll: {
    flex: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {},
  assistantBubble: {
    borderWidth: 1,
  },
  chatErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  promptsSection: {},
  promptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 8,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
  },
  metricDataBox: {},
  metricDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  budgetBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  filterPill: {
    borderWidth: 1,
  },
  mealHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagPill: {},
  itemsContainer: {},
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
});
