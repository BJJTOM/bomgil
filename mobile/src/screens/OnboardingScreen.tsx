import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';

const { width, height } = Dimensions.get('window');

const PRIMARY = '#2D4A2E';

interface OnboardingPage {
  icon: string;
  title: string;
  description: string;
}

const PAGES: OnboardingPage[] = [
  {
    icon: 'compass',
    title: '\uAC78\uC73C\uBA74 \uBCF4\uC774\uB294 \uAC83\uB4E4',
    description: '\uCF54\uC2A4\uB97C \uD0D0\uC0C9\uD558\uACE0 \uC0C8\uB85C\uC6B4 \uAE38\uC744 \uBC1C\uACAC\uD558\uC138\uC694',
  },
  {
    icon: 'activity',
    title: '\uAC77\uAE30\uB97C \uAE30\uB85D\uD558\uC138\uC694',
    description: 'GPS\uB85C \uACBD\uB85C, \uAC70\uB9AC, \uAC78\uC74C\uC218\uB97C \uC790\uB3D9 \uAE30\uB85D',
  },
  {
    icon: 'users',
    title: '\uD568\uAED8 \uAC78\uC5B4\uC694',
    description: '\uCEE4\uBBA4\uB2C8\uD2F0\uC5D0\uC11C \uACBD\uD5D8\uC744 \uB098\uB204\uC138\uC694',
  },
];

const ONBOARDING_KEY = '@moru_onboarding_complete';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    navigation.replace('Main');
  };

  const handleNext = () => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    navigation.replace('Main');
  };

  const renderPage = useCallback(({ item }: { item: OnboardingPage }) => (
    <View style={styles.page}>
      <View style={styles.iconCircle}>
        <Feather name={item.icon} size={48} color={PRIMARY} />
      </View>
      <Text style={styles.pageTitle}>{item.title}</Text>
      <Text style={styles.pageDescription}>{item.description}</Text>
    </View>
  ), []);

  const isLastPage = currentIndex === PAGES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Skip button */}
      {!isLastPage && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>{'\uAC74\uB108\uB6F0\uAE30'}</Text>
        </TouchableOpacity>
      )}

      {/* Pages */}
      <FlatList
        ref={flatListRef}
        data={PAGES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => String(index)}
        renderItem={renderPage}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Bottom area */}
      <View style={styles.bottomArea}>
        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {PAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={[styles.actionBtn, isLastPage && styles.actionBtnLast]}
          onPress={handleNext}
          activeOpacity={0.85}>
          {isLastPage ? (
            <Text style={styles.actionBtnText}>{'\uC2DC\uC791\uD558\uAE30'}</Text>
          ) : (
            <Feather name="arrow-right" size={22} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999',
  },
  page: {
    width: width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(45,74,46,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  pageDescription: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    width: 24,
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLast: {
    width: width - 48,
    borderRadius: 16,
    height: 54,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
