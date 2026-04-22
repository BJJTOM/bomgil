import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';
import { getColors } from '../theme/colors';
import { useT } from '../i18n';

const { width, height } = Dimensions.get('window');

const ONBOARDING_KEY = '@moru_onboarding_complete';
const PREFERENCES_KEY = '@moru_user_preferences';

// --- Country chips data ---
const COUNTRIES = [
  { code: 'KR', flag: '\uD83C\uDDF0\uD83C\uDDF7', label: '\uD55C\uAD6D' },
  { code: 'JP', flag: '\uD83C\uDDEF\uD83C\uDDF5', label: '\uC77C\uBCF8' },
  { code: 'TW', flag: '\uD83C\uDDF9\uD83C\uDDFC', label: '\uB300\uB9CC' },
  { code: 'TH', flag: '\uD83C\uDDF9\uD83C\uDDED', label: '\uD0DC\uAD6D' },
  { code: 'US', flag: '\uD83C\uDDFA\uD83C\uDDF8', label: '\uBBF8\uAD6D' },
  { code: 'GB', flag: '\uD83C\uDDEC\uD83C\uDDE7', label: '\uC601\uAD6D' },
  { code: 'FR', flag: '\uD83C\uDDEB\uD83C\uDDF7', label: '\uD504\uB791\uC2A4' },
  { code: 'ES', flag: '\uD83C\uDDEA\uD83C\uDDF8', label: '\uC2A4\uD398\uC778' },
];

// --- Style options ---
type StyleKey = 'urban' | 'nature' | 'coastal' | 'cultural';
const STYLE_OPTIONS: { key: StyleKey; icon: string }[] = [
  { key: 'urban', icon: 'map' },
  { key: 'nature', icon: 'sun' },
  { key: 'coastal', icon: 'wind' },
  { key: 'cultural', icon: 'book-open' },
];

// --- Difficulty options ---
type DifficultyKey = 'easy' | 'moderate' | 'hard';
const DIFFICULTY_OPTIONS: DifficultyKey[] = ['easy', 'moderate', 'hard'];

const TOTAL_PAGES = 3;

// ---------- Animated Dot Component ----------
function AnimatedDot({ index, scrollX, primaryColor, inactiveColor }: {
  index: number;
  scrollX: SharedValue<number>;
  primaryColor: string;
  inactiveColor: string;
}) {
  const animStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const dotWidth = interpolate(scrollX.value, inputRange, [8, 28, 8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP);
    return { width: dotWidth, opacity };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: primaryColor },
        animStyle,
      ]}
    />
  );
}

// ---------- Feature Card ----------
function FeatureCard({
  icon,
  title,
  desc,
  delay,
  primaryColor,
  textColor,
  subtextColor,
  cardBg,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
  primaryColor: string;
  textColor: string;
  subtextColor: string;
  cardBg: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500).springify()}
      style={[styles.featureCard, { backgroundColor: cardBg }]}
    >
      <View style={[styles.featureIconCircle, { backgroundColor: primaryColor + '18' }]}>
        <Feather name={icon} size={22} color={primaryColor} />
      </View>
      <View style={styles.featureTextArea}>
        <Text style={[styles.featureTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.featureDesc, { color: subtextColor }]}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

// ---------- Chip (multi-select) ----------
function Chip({
  label,
  selected,
  onPress,
  primaryColor,
  textColor,
  borderColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  primaryColor: string;
  textColor: string;
  borderColor: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { borderColor: selected ? primaryColor : borderColor },
        selected && { backgroundColor: primaryColor + '14' },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? primaryColor : textColor },
          selected && { fontWeight: '600' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------- Single-select pill ----------
function Pill({
  label,
  selected,
  onPress,
  primaryColor,
  textColor,
  borderColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  primaryColor: string;
  textColor: string;
  borderColor: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        { borderColor: selected ? primaryColor : borderColor },
        selected && { backgroundColor: primaryColor, borderColor: primaryColor },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.pillText,
          { color: selected ? '#FFFFFF' : textColor },
          selected && { fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ==========================================================
// MAIN COMPONENT
// ==========================================================
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isDark } = useThemeStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const c = getColors(isDark);
  const t = useT();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  // Preferences state
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleKey | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyKey | null>(null);

  const styleLabels: Record<StyleKey, string> = useMemo(() => ({
    urban: t.onboarding.styleUrban,
    nature: t.onboarding.styleNature,
    coastal: t.onboarding.styleCoastal,
    cultural: t.onboarding.styleCultural,
  }), [t]);

  const diffLabels: Record<DifficultyKey, string> = useMemo(() => ({
    easy: t.onboarding.diffEasy,
    moderate: t.onboarding.diffModerate,
    hard: t.onboarding.diffHard,
  }), [t]);

  // --- handlers ---
  const toggleCountry = useCallback((code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const savePreferences = useCallback(async () => {
    const prefs = {
      countries: selectedCountries,
      style: selectedStyle,
      difficulty: selectedDifficulty,
    };
    try {
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    } catch {}
  }, [selectedCountries, selectedStyle, selectedDifficulty]);

  const handleComplete = useCallback(async () => {
    await savePreferences();
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    navigation.replace('Main');
  }, [navigation, savePreferences]);

  const handleNext = useCallback(() => {
    if (currentIndex < TOTAL_PAGES - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  }, [currentIndex, handleComplete]);

  const handleSkip = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    navigation.replace('Main');
  }, [navigation]);

  // --- dynamic colors ---
  const bgColor = isDark ? '#0a0a0a' : '#FFFFFF';
  const textPrimary = c.textPrimary;
  const textSecondary = c.textSecondary;
  const textTertiary = c.textTertiary;
  const primary = c.primary;
  const borderDefault = c.borderDefault;
  const cardBg = isDark ? '#1a1a1a' : '#F7F8FA';

  // --- gradient background for page 1 ---
  const page1GradientTop = isDark ? '#0f1f10' : '#EBF5EB';
  const page1GradientBottom = bgColor;

  const isLastPage = currentIndex === TOTAL_PAGES - 1;

  // ---------- Render Pages ----------
  const renderPage = useCallback(({ item, index }: { item: number; index: number }) => {
    if (index === 0) {
      // PAGE 1: Value Prop
      return (
        <View style={[styles.page, { width }]}>
          {/* Green gradient background */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: page1GradientTop }]}>
            <View style={[styles.gradientOverlay, { backgroundColor: page1GradientBottom }]} />
          </View>
          <View style={styles.page1Content}>
            <Animated.View
              entering={FadeIn.duration(800)}
              style={[styles.heroIconContainer, { backgroundColor: primary + '14' }]}
            >
              <Feather name="compass" size={56} color={primary} />
            </Animated.View>
            <Animated.Text
              entering={FadeInUp.delay(200).duration(600)}
              style={[styles.heroTitle, { color: textPrimary }]}
            >
              {t.onboarding.page1Title}
            </Animated.Text>
            <Animated.Text
              entering={FadeInUp.delay(400).duration(600)}
              style={[styles.heroSubtitle, { color: textSecondary }]}
            >
              {t.onboarding.page1Subtitle}
            </Animated.Text>
          </View>
        </View>
      );
    }

    if (index === 1) {
      // PAGE 2: Features
      return (
        <View style={[styles.page, { width, backgroundColor: bgColor }]}>
          <View style={styles.page2Content}>
            <Animated.Text
              entering={FadeInUp.duration(500)}
              style={[styles.page2Title, { color: textPrimary }]}
            >
              {t.onboarding.page2Title}
            </Animated.Text>

            <View style={styles.featuresContainer}>
              <FeatureCard
                icon="navigation"
                title={t.onboarding.feature1Title}
                desc={t.onboarding.feature1Desc}
                delay={100}
                primaryColor={primary}
                textColor={textPrimary}
                subtextColor={textSecondary}
                cardBg={cardBg}
              />
              <FeatureCard
                icon="users"
                title={t.onboarding.feature2Title}
                desc={t.onboarding.feature2Desc}
                delay={250}
                primaryColor={primary}
                textColor={textPrimary}
                subtextColor={textSecondary}
                cardBg={cardBg}
              />
              <FeatureCard
                icon="award"
                title={t.onboarding.feature3Title}
                desc={t.onboarding.feature3Desc}
                delay={400}
                primaryColor={primary}
                textColor={textPrimary}
                subtextColor={textSecondary}
                cardBg={cardBg}
              />
            </View>
          </View>
        </View>
      );
    }

    // PAGE 3: Preferences
    return (
      <View style={[styles.page, { width, backgroundColor: bgColor }]}>
        <ScrollView
          style={styles.page3Scroll}
          contentContainerStyle={[styles.page3Content, { paddingBottom: 180 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.Text
            entering={FadeInUp.duration(500)}
            style={[styles.page3Title, { color: textPrimary }]}
          >
            {t.onboarding.page3Title}
          </Animated.Text>
          <Animated.Text
            entering={FadeInUp.delay(150).duration(500)}
            style={[styles.page3Subtitle, { color: textSecondary }]}
          >
            {t.onboarding.page3Subtitle}
          </Animated.Text>

          {/* Country chips */}
          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
            <Text style={[styles.prefLabel, { color: textPrimary }]}>
              {t.onboarding.prefCountryLabel}
            </Text>
            <View style={styles.chipsRow}>
              {COUNTRIES.map((c) => (
                <Chip
                  key={c.code}
                  label={`${c.flag} ${c.label}`}
                  selected={selectedCountries.includes(c.code)}
                  onPress={() => toggleCountry(c.code)}
                  primaryColor={primary}
                  textColor={textSecondary}
                  borderColor={borderDefault}
                />
              ))}
            </View>
          </Animated.View>

          {/* Walking style */}
          <Animated.View entering={FadeInUp.delay(350).duration(500)}>
            <Text style={[styles.prefLabel, { color: textPrimary }]}>
              {t.onboarding.prefStyleLabel}
            </Text>
            <View style={styles.pillsRow}>
              {STYLE_OPTIONS.map((opt) => (
                <Pill
                  key={opt.key}
                  label={styleLabels[opt.key]}
                  selected={selectedStyle === opt.key}
                  onPress={() => setSelectedStyle(selectedStyle === opt.key ? null : opt.key)}
                  primaryColor={primary}
                  textColor={textSecondary}
                  borderColor={borderDefault}
                />
              ))}
            </View>
          </Animated.View>

          {/* Difficulty */}
          <Animated.View entering={FadeInUp.delay(500).duration(500)}>
            <Text style={[styles.prefLabel, { color: textPrimary }]}>
              {t.onboarding.prefDifficultyLabel}
            </Text>
            <View style={styles.pillsRow}>
              {DIFFICULTY_OPTIONS.map((key) => (
                <Pill
                  key={key}
                  label={diffLabels[key]}
                  selected={selectedDifficulty === key}
                  onPress={() => setSelectedDifficulty(selectedDifficulty === key ? null : key)}
                  primaryColor={primary}
                  textColor={textSecondary}
                  borderColor={borderDefault}
                />
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }, [
    bgColor, textPrimary, textSecondary, primary, cardBg, borderDefault,
    page1GradientTop, page1GradientBottom,
    selectedCountries, selectedStyle, selectedDifficulty,
    styleLabels, diffLabels, toggleCountry, t,
  ]);

  // Button animated style for last page width transition
  const buttonAnimStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [(TOTAL_PAGES - 2) * width, (TOTAL_PAGES - 1) * width],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const btnWidth = interpolate(progress, [0, 1], [56, width - 48], Extrapolation.CLAMP);
    const btnRadius = interpolate(progress, [0, 1], [28, 16], Extrapolation.CLAMP);
    return {
      width: btnWidth,
      borderRadius: btnRadius,
    };
  });

  // Label opacity for the "start" text inside button
  const startLabelStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [(TOTAL_PAGES - 2) * width, (TOTAL_PAGES - 1) * width],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: progress };
  });

  // Arrow opacity (inverse)
  const arrowStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollX.value,
      [(TOTAL_PAGES - 2) * width, (TOTAL_PAGES - 1) * width],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity: progress };
  });

  const pages = [0, 1, 2]; // Simple data array for FlatList

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip button */}
      {!isLastPage && (
        <TouchableOpacity
          style={[styles.skipBtn, { top: insets.top + 12 }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: textTertiary }]}>
            {t.onboarding.skip}
          </Text>
        </TouchableOpacity>
      )}

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderPage}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Bottom area */}
      <View style={[styles.bottomArea, { backgroundColor: bgColor }]}>
        {/* Animated dot indicators */}
        <View style={styles.dotsRow}>
          {pages.map((_, index) => (
            <AnimatedDot
              key={index}
              index={index}
              scrollX={scrollX}
              primaryColor={primary}
              inactiveColor={borderDefault}
            />
          ))}
        </View>

        {/* Action button */}
        <TouchableOpacity onPress={handleNext} activeOpacity={0.85}>
          <Animated.View
            style={[
              styles.actionBtn,
              { backgroundColor: primary },
              buttonAnimStyle,
            ]}
          >
            {/* Arrow icon (visible on pages 1-2) */}
            <Animated.View style={[styles.btnContentCenter, arrowStyle]}>
              <Feather name="arrow-right" size={22} color="#FFFFFF" />
            </Animated.View>
            {/* Start text (visible on page 3) */}
            <Animated.View style={[styles.btnContentCenter, startLabelStyle]}>
              <Text style={styles.actionBtnText}>
                {t.onboarding.start}
              </Text>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ==========================================================
// STYLES
// ==========================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // --- Pages ---
  page: {
    flex: 1,
  },

  // Page 1 - Value Prop
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  page1Content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  heroIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Page 2 - Features
  page2Content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  page2Title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 32,
  },
  featuresContainer: {
    gap: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 16,
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextArea: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 19,
  },

  // Page 3 - Preferences
  page3Scroll: {
    flex: 1,
  },
  page3Content: {
    paddingHorizontal: 28,
    paddingTop: 80,
  },
  page3Title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 10,
  },
  page3Subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  prefLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 14,
  },

  // --- Bottom ---
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    alignItems: 'center',
    gap: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnContentCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
