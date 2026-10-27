import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  I18nManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { Cairo_400Regular, Cairo_600SemiBold, Cairo_700Bold } from '@expo-google-fonts/cairo';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// Force RTL for Persian
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH * 0.72, 300);
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Colors - Islamic-inspired modern palette
const COLORS = {
  primary: '#0F766E',       // Deep teal-green
  primaryLight: '#14B8A6',  // Bright teal
  primaryDark: '#115E59',
  accent: '#D4A017',        // Soft gold
  accentLight: '#F5D76E',
  background: '#F0FDFA',    // Soft mint cream
  backgroundDark: '#0F172A',
  card: '#FFFFFF',
  cardDark: '#1E293B',
  text: '#134E4A',
  textLight: '#5EEAD4',
  textMuted: '#64748B',
  white: '#FFFFFF',
  danger: '#DC2626',
  success: '#059669',
};

const STORAGE_KEYS = {
  COUNT: '@salawat_count',
  TARGET: '@salawat_target',
  TOTAL: '@salawat_total',
  DAILY: '@salawat_daily',
  LAST_DATE: '@salawat_last_date',
  HAPTIC: '@salawat_haptic',
  HISTORY: '@salawat_history',
};

interface HistoryItem {
  date: string;
  count: number;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [tempTarget, setTempTarget] = useState('100');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isPressed, setIsPressed] = useState(false);

  const scale = useSharedValue(1);
  const progress = useSharedValue(0);
  const lastTap = useRef(0);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Update progress animation
  useEffect(() => {
    const p = target > 0 ? Math.min(count / target, 1) : 0;
    progress.value = withTiming(p, { duration: 400 });
  }, [count, target]);

  const loadData = async () => {
    try {
      const [
        savedCount,
        savedTarget,
        savedTotal,
        savedDaily,
        lastDate,
        savedHaptic,
        savedHistory,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.TARGET),
        AsyncStorage.getItem(STORAGE_KEYS.TOTAL),
        AsyncStorage.getItem(STORAGE_KEYS.DAILY),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_DATE),
        AsyncStorage.getItem(STORAGE_KEYS.HAPTIC),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
      ]);

      const today = new Date().toDateString();
      if (lastDate !== today) {
        // New day - reset daily
        setDailyCount(0);
        await AsyncStorage.setItem(STORAGE_KEYS.DAILY, '0');
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_DATE, today);
        if (savedDaily && parseInt(savedDaily) > 0) {
          // Save previous day to history
          const prevHistory: HistoryItem[] = savedHistory
            ? JSON.parse(savedHistory)
            : [];
          const updated = [
            { date: lastDate || today, count: parseInt(savedDaily) },
            ...prevHistory,
          ].slice(0, 30);
          setHistory(updated);
          await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
        }
      } else {
        setDailyCount(savedDaily ? parseInt(savedDaily) : 0);
        if (savedHistory) setHistory(JSON.parse(savedHistory));
      }

      setCount(savedCount ? parseInt(savedCount) : 0);
      setTarget(savedTarget ? parseInt(savedTarget) : 100);
      setTotalCount(savedTotal ? parseInt(savedTotal) : 0);
      setHapticEnabled(savedHaptic !== 'false');
    } catch (e) {
      console.warn('Load error', e);
    }
  };

  const saveCount = async (newCount: number, newDaily: number, newTotal: number) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.COUNT, String(newCount)),
        AsyncStorage.setItem(STORAGE_KEYS.DAILY, String(newDaily)),
        AsyncStorage.setItem(STORAGE_KEYS.TOTAL, String(newTotal)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_DATE, new Date().toDateString()),
      ]);
    } catch (e) {
      console.warn('Save error', e);
    }
  };

  const triggerHaptic = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [hapticEnabled]);

  const increment = useCallback(
    (amount = 1) => {
      const now = Date.now();
      // Prevent double-tap spam slightly
      if (now - lastTap.current < 80) return;
      lastTap.current = now;

      setCount((prev) => {
        const next = prev + amount;
        setDailyCount((d) => {
          const newDaily = d + amount;
          setTotalCount((t) => {
            const newTotal = t + amount;
            saveCount(next, newDaily, newTotal);
            return newTotal;
          });
          return newDaily;
        });
        return next;
      });

      scale.value = withSpring(0.92, { damping: 12, stiffness: 300 }, () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
      });

      triggerHaptic();
    },
    [triggerHaptic]
  );

  const resetSession = async () => {
    setCount(0);
    await AsyncStorage.setItem(STORAGE_KEYS.COUNT, '0');
    if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const setNewTarget = async () => {
    const val = parseInt(tempTarget);
    if (!isNaN(val) && val > 0 && val <= 100000) {
      setTarget(val);
      await AsyncStorage.setItem(STORAGE_KEYS.TARGET, String(val));
      setShowTargetModal(false);
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const toggleHaptic = async (value: boolean) => {
    setHapticEnabled(value);
    await AsyncStorage.setItem(STORAGE_KEYS.HAPTIC, String(value));
  };

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  const animatedScaleStyle = {
    transform: [{ scale: scale }],
  };

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: COLORS.primary }}>در حال بارگذاری...</Text>
      </View>
    );
  }

  const progressPercent = target > 0 ? Math.min(Math.round((count / target) * 100), 100) : 0;
  const remaining = Math.max(target - count, 0);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#ECFDF5', '#F0FDFA', '#CCFBF1']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>صلوات شمار</Text>
        <Text style={styles.headerSubtitle}>اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَآلِ مُحَمَّدٍ</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>امروز</Text>
          <Text style={styles.statValue}>{dailyCount.toLocaleString('fa-IR')}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlight]}>
          <Text style={[styles.statLabel, { color: COLORS.primaryDark }]}>هدف جلسه</Text>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>
            {target.toLocaleString('fa-IR')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>کل</Text>
          <Text style={styles.statValue}>{totalCount.toLocaleString('fa-IR')}</Text>
        </View>
      </View>

      {/* Main Counter Circle */}
      <View style={styles.counterWrapper}>
        <Animated.View style={[styles.circleContainer, animatedScaleStyle]}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Defs>
              <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={COLORS.primaryLight} />
                <Stop offset="100%" stopColor={COLORS.primary} />
              </SvgGradient>
            </Defs>
            {/* Background circle */}
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="#CCFBF1"
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            {/* Progress circle */}
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="url(#grad)"
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={animatedProps}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />
          </Svg>

          <Pressable
            onPress={() => increment(1)}
            onLongPress={() => increment(10)}
            delayLongPress={400}
            onPressIn={() => setIsPressed(true)}
            onPressOut={() => setIsPressed(false)}
            style={styles.innerCircle}
          >
            <Text style={styles.countNumber}>{count.toLocaleString('fa-IR')}</Text>
            <Text style={styles.countLabel}>صلوات</Text>
            <Text style={styles.remainingText}>
              {remaining > 0
                ? `${remaining.toLocaleString('fa-IR')} باقی‌مانده`
                : 'هدف تکمیل شد ✨'}
            </Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.hintText}>لمس کنید برای شمارش • نگه دارید برای +۱۰</Text>
      </View>

      {/* Progress percent */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}٪</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={resetSession}
        >
          <Text style={styles.actionBtnText}>شروع مجدد</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnPrimary,
            pressed && styles.actionBtnPressed,
          ]}
          onPress={() => {
            setTempTarget(String(target));
            setShowTargetModal(true);
          }}
        >
          <Text style={[styles.actionBtnText, { color: COLORS.white }]}>تنظیم هدف</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.actionBtnText}>تنظیمات</Text>
        </Pressable>
      </View>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تنظیمات</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>لرزش (Haptic)</Text>
              <Switch
                value={hapticEnabled}
                onValueChange={toggleHaptic}
                trackColor={{ false: '#CBD5E1', true: COLORS.primaryLight }}
                thumbColor={hapticEnabled ? COLORS.primary : '#f4f3f4'}
              />
            </View>

            <Text style={styles.sectionTitle}>تاریخچه ۳۰ روز اخیر</Text>
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {history.length === 0 ? (
                <Text style={styles.emptyHistory}>هنوز تاریخی ثبت نشده</Text>
              ) : (
                history.map((item, idx) => (
                  <View key={idx} style={styles.historyItem}>
                    <Text style={styles.historyDate}>{item.date}</Text>
                    <Text style={styles.historyCount}>
                      {item.count.toLocaleString('fa-IR')} صلوات
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <Pressable
              style={styles.closeBtn}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeBtnText}>بستن</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Target Modal */}
      <Modal visible={showTargetModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>تنظیم هدف جلسه</Text>
            <Text style={styles.modalDesc}>تعداد صلوات مورد نظر خود را وارد کنید</Text>

            <TextInput
              style={styles.input}
              value={tempTarget}
              onChangeText={setTempTarget}
              keyboardType="number-pad"
              placeholder="مثلاً ۱۰۰"
              placeholderTextColor={COLORS.textMuted}
              textAlign="center"
            />

            <View style={styles.quickTargets}>
              {[33, 100, 300, 1000].map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.quickTargetBtn,
                    tempTarget === String(t) && styles.quickTargetActive,
                  ]}
                  onPress={() => setTempTarget(String(t))}
                >
                  <Text
                    style={[
                      styles.quickTargetText,
                      tempTarget === String(t) && { color: COLORS.white },
                    ]}
                  >
                    {t.toLocaleString('fa-IR')}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowTargetModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>انصراف</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={setNewTarget}>
                <Text style={styles.modalBtnConfirmText}>تأیید</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 28,
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontFamily: 'Amiri_700Bold',
    fontSize: 18,
    color: COLORS.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  statCardHighlight: {
    backgroundColor: '#CCFBF1',
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  statLabel: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 18,
    color: COLORS.text,
  },
  counterWrapper: {
    alignItems: 'center',
    marginTop: 24,
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    position: 'absolute',
    width: CIRCLE_SIZE - STROKE_WIDTH * 2 - 20,
    height: CIRCLE_SIZE - STROKE_WIDTH * 2 - 20,
    borderRadius: (CIRCLE_SIZE - STROKE_WIDTH * 2 - 20) / 2,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  countNumber: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 56,
    color: COLORS.primaryDark,
    includeFontPadding: false,
  },
  countLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: COLORS.primary,
    marginTop: -4,
  },
  remainingText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  hintText: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 16,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 20,
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#CCFBF1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: COLORS.primary,
    minWidth: 40,
    textAlign: 'left',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 28,
    gap: 12,
  },
  actionBtn: {
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  actionBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  actionBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: COLORS.primaryDark,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 22,
    color: COLORS.primaryDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDesc: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  settingLabel: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: COLORS.text,
  },
  sectionTitle: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: COLORS.primaryDark,
    marginTop: 20,
    marginBottom: 12,
  },
  historyList: {
    maxHeight: 180,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyDate: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
  },
  historyCount: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 13,
    color: COLORS.primary,
  },
  emptyHistory: {
    fontFamily: 'Cairo_400Regular',
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  closeBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 16,
    color: COLORS.white,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 24,
    fontFamily: 'Cairo_700Bold',
    color: COLORS.primaryDark,
    marginBottom: 16,
  },
  quickTargets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  quickTargetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    alignItems: 'center',
  },
  quickTargetActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickTargetText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 14,
    color: COLORS.primaryDark,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalBtnConfirm: {
    backgroundColor: COLORS.primary,
  },
  modalBtnCancelText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: COLORS.textMuted,
  },
  modalBtnConfirmText: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 15,
    color: COLORS.white,
  },
});
