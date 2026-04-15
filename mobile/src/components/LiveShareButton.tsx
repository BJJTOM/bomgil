/**
 * LiveShareButton — top-bar button for starting/showing a live walk share.
 *
 * Dumb component: all session state is owned by the `useLiveShare` hook
 * in WalkScreen. This just renders a compact icon button plus a modal
 * with the share URL and a native Share sheet trigger.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '../theme/colors';
import type { LiveSession } from '../utils/liveShare';

interface Props {
  active: boolean;
  starting: boolean;
  session: LiveSession | null;
  onStart: () => void | Promise<unknown>;
  onStop: () => void | Promise<unknown>;
}

export default function LiveShareButton({
  active,
  starting,
  session,
  onStart,
  onStop,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const handlePress = () => {
    if (active) {
      setShowModal(true);
    } else {
      Promise.resolve(onStart()).then(() => setShowModal(true));
    }
  };

  const handleShareUrl = async () => {
    if (!session?.share_url) return;
    try {
      await Share.share({
        message: `내 걷기 실시간으로 보기\n${session.share_url}`,
        url: session.share_url,
      });
    } catch {
      // user cancelled
    }
  };

  const handleStopPress = async () => {
    await onStop();
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, active && styles.btnActive]}
        onPress={handlePress}
        disabled={starting}
        activeOpacity={0.7}>
        {starting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather
            name={active ? 'radio' : 'share-2'}
            size={14}
            color="#fff"
          />
        )}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
        statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Feather name="radio" size={28} color="#DC2626" />
            </View>
            <Text style={styles.title}>
              {active ? '라이브 공유 중' : '라이브 공유'}
            </Text>
            <Text style={styles.desc}>
              {active
                ? '아래 링크를 지인에게 보내면\n실시간 위치를 볼 수 있어요.'
                : '걷기가 끝나면 공유가 자동 종료돼요.'}
            </Text>

            {active && session && (
              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={1}>
                  {session.share_url}
                </Text>
              </View>
            )}

            {active ? (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleShareUrl}
                  activeOpacity={0.85}>
                  <Feather
                    name="share-2"
                    size={16}
                    color="#fff"
                    style={styles.primaryBtnIcon}
                  />
                  <Text style={styles.primaryBtnText}>링크 공유</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={handleStopPress}
                  activeOpacity={0.7}>
                  <Text style={styles.stopBtnText}>라이브 공유 중지</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  Promise.resolve(onStart());
                }}
                activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>공유 시작</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowModal(false)}
              activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: '#DC2626',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  urlBox: {
    alignSelf: 'stretch',
    backgroundColor: '#F5F5F4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  urlText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: 'Menlo',
  },
  primaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  primaryBtnIcon: {
    marginRight: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stopBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  stopBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  closeBtnText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
});
