/**
 * PhotoViewer — modal fullscreen image viewer with horizontal swipe.
 *
 * Pure RN — no extra dependency. Each image fills the screen with
 * resizeMode='contain'. Swipe left/right to switch images, tap the
 * close button or backdrop to dismiss. Pinch-to-zoom is intentionally
 * NOT implemented to avoid pulling in react-native-image-zoom-viewer
 * for one screen; a future improvement.
 *
 * Props:
 *   visible: boolean
 *   images: { uri: string; title?: string }[]
 *   index: starting index
 *   onClose: () => void
 */
import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type PhotoViewerImage = {
  uri: string;
  title?: string;
  caption?: string;
};

type Props = {
  visible: boolean;
  images: PhotoViewerImage[];
  index?: number;
  onClose: () => void;
};

export function PhotoViewer({ visible, images, index = 0, onClose }: Props) {
  const listRef = useRef<FlatList>(null);
  const [currentIdx, setCurrentIdx] = React.useState(index);

  useEffect(() => {
    if (visible) {
      setCurrentIdx(index);
      // scrollToIndex sometimes fires before layout — use a tick
      setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ index, animated: false });
        } catch {}
      }, 50);
    }
  }, [visible, index]);

  if (!images || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.backdrop}>
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="닫기">
          <Feather name="x" size={26} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {currentIdx + 1} / {images.length}
            </Text>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(_, i) => `pv-${i}`}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({
            length: SCREEN_W,
            offset: SCREEN_W * i,
            index: i,
          })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrentIdx(i);
          }}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Image
                source={{ uri: item.uri }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* Caption */}
        {(images[currentIdx]?.title || images[currentIdx]?.caption) && (
          <View style={styles.caption}>
            {!!images[currentIdx]?.title && (
              <Text style={styles.captionTitle} numberOfLines={1}>
                {images[currentIdx].title}
              </Text>
            )}
            {!!images[currentIdx]?.caption && (
              <Text style={styles.captionText} numberOfLines={3}>
                {images[currentIdx].caption}
              </Text>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    zIndex: 9,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  counterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.85,
  },
  caption: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 56 : 36,
    left: 20,
    right: 20,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  captionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  captionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 18,
  },
});
