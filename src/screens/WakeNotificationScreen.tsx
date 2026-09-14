import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../App';
import { Colors } from '../constants/Colors';
import WakeTimerTrack from '../assets/images/wake-timer-track.svg';
import WakeTimerProgress from '../assets/images/wake-timer-progress.svg';
import { ApiError, nunnunApi, type WakeRequest } from '../api';
import { createWakeProofCompletionState } from '../navigation/selfVerifyNavigation';
import { poseImageForCode } from '../utils/poseImage';
import { WakeAlarm } from '../wakeAlarm/WakeAlarm';
import { subscribeWakeDataRefresh } from '../events/wakeDataRefresh';

const DESIGN_WIDTH = 402;
const MAX_CONTENT_WIDTH = 430;

type Props = NativeStackScreenProps<RootStackParamList, 'WakeNotification'>;

const formatRequestedTime = (requestedAt: string) => {
  const date = new Date(requestedAt);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
};

const requestErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '데모 사용자를 다시 선택해주세요.';
    }
    if (error.status === 403) {
      return '이 깨우기 요청을 확인할 권한이 없어요.';
    }
    if (error.status === 404) {
      return '깨우기 요청을 찾을 수 없어요.';
    }
  }

  return '깨우기 요청 정보를 불러오지 못했어요.';
};

export const WakeNotificationScreen = ({ navigation, route }: Props) => {
  const requestId = route.params?.requestId;
  const [wakeRequest, setWakeRequest] = useState<WakeRequest | null>(null);
  const [loading, setLoading] = useState(requestId !== undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const declineInFlight = useRef(false);
  const { width: viewportWidth } = useWindowDimensions();
  const contentWidth = Math.min(viewportWidth, MAX_CONTENT_WIDTH);
  const scale = Math.min(contentWidth / DESIGN_WIDTH, 1);

  const loadRequest = useCallback(() => {
    if (requestId === undefined) {
      setWakeRequest(null);
      setLoading(false);
      setErrorMessage(null);
      return () => undefined;
    }

    let active = true;
    setLoading(true);
    setErrorMessage(null);

    nunnunApi.wake
      .getRequest(requestId)
      .then(request => {
        if (active) {
          if (request.sender.id === request.receiver.id) {
            navigation.reset(createWakeProofCompletionState(request.group_id));
            return;
          }
          setWakeRequest(request);
        }
      })
      .catch(error => {
        if (active) {
          setErrorMessage(requestErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [navigation, requestId]);

  useFocusEffect(loadRequest);

  useEffect(
    () => {
      let cancelRefresh: () => void = () => undefined;
      const unsubscribe = subscribeWakeDataRefresh(() => {
        cancelRefresh();
        cancelRefresh = loadRequest();
      });

      return () => {
        cancelRefresh();
        unsubscribe();
      };
    },
    [loadRequest],
  );

  const declineRequest = () => {
    if (!wakeRequest || declineInFlight.current) {
      return;
    }
    declineInFlight.current = true;
    Alert.alert(
      '인증을 하지 않을까요?',
      '인증하지 않으면 그룹원에게 도움이 필요한 상태로 표시돼요.',
      [
        {
          text: '취소',
          style: 'cancel',
          onPress: () => {
            declineInFlight.current = false;
          },
        },
        {
          text: '인증하지 않기',
          style: 'destructive',
          onPress: async () => {
            setDeclining(true);
            try {
              await nunnunApi.wake.decline(wakeRequest.id);
              await WakeAlarm.stop(wakeRequest.id);
              navigation.reset(
                createWakeProofCompletionState(wakeRequest.group_id),
              );
            } catch {
              Alert.alert('알림', '인증 거부에 실패했어요. 다시 시도해주세요.');
              declineInFlight.current = false;
              setDeclining(false);
            }
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          declineInFlight.current = false;
        },
      },
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          backgroundColor={Colors.background}
          barStyle="dark-content"
        />
        <View style={styles.feedbackContainer}>
          <ActivityIndicator color={Colors.textBlack} />
          <Text style={styles.feedbackText}>
            깨우기 요청을 불러오고 있어요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          backgroundColor={Colors.background}
          barStyle="dark-content"
        />
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>{errorMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const senderNickname = wakeRequest?.sender.nickname ?? '지우';
  const requestedTime = wakeRequest
    ? formatRequestedTime(wakeRequest.requested_at)
    : '07:32';
  const poseDescription =
    wakeRequest?.pose.description ?? '00분 내에 오늘의 포즈를 따라해주세요';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={Colors.background} barStyle="dark-content" />
      <View style={[styles.container, { width: contentWidth }]}>
        <View
          style={[
            styles.notificationCard,
            {
              left: 34 * scale,
              top: 29 * scale,
              width: 334 * scale,
              height: 340 * scale,
              borderRadius: 16 * scale,
            },
          ]}
        >
          <Text style={[styles.groupName, { top: 42 * scale }]}>
            {wakeRequest ? '깨우기 요청' : '아침야호'}
          </Text>
          <Text style={[styles.notificationTitle, { top: 64 * scale }]}>
            {senderNickname}님이 깨웠어요
          </Text>

          <WakeTimerTrack
            width={268.102 * scale}
            height={135 * scale}
            style={[styles.timerTrack, { left: 33 * scale, top: 134 * scale }]}
          />
          <WakeTimerProgress
            width={107.484 * scale}
            height={127.427 * scale}
            style={[
              styles.timerProgress,
              { left: 193 * scale, top: 141.57 * scale },
            ]}
          />
          <Image
            accessibilityLabel="깨우기 알림"
            source={require('../assets/images/wake-bomb.png')}
            resizeMode="contain"
            style={[
              styles.bombIcon,
              {
                left: 167 * scale,
                top: 111 * scale,
                width: 72 * scale,
                height: 72 * scale,
              },
            ]}
          />
          <Text style={[styles.wakeTime, { top: 221 * scale }]}>
            {requestedTime}
          </Text>
        </View>

        <Text style={[styles.poseDescription, { top: 400 * scale }]}>
          {poseDescription}
        </Text>

        <Image
          accessibilityLabel={
            wakeRequest ? '인증 포즈 참고 이미지' : '오늘의 인증 포즈'
          }
          source={poseImageForCode(wakeRequest?.pose.code)}
          resizeMode="cover"
          style={[
            styles.poseImage,
            {
              left: 34 * scale,
              top: 428 * scale,
              width: 334 * scale,
              height: 368 * scale,
              borderRadius: 16 * scale,
            },
          ]}
        />

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="인증사진 찍기"
          activeOpacity={0.8}
          onPress={() =>
            navigation.replace('CameraCapture', {
              recipientName: senderNickname,
              photographer: 'jiwoo',
              requestId,
              groupId: wakeRequest?.group_id,
              verificationMode: 'wake-proof',
            })
          }
          style={[
            styles.cameraButton,
            {
              bottom: 18 * scale,
              width: 346 * scale,
              height: 65 * scale,
              borderRadius: 16 * scale,
            },
          ]}
        >
          <Text style={styles.cameraButtonText}>인증사진 찍기</Text>
        </TouchableOpacity>
        {wakeRequest ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="인증하지 않을래요"
            disabled={declining}
            onPress={declineRequest}
            style={[styles.declineButton, { bottom: 91 * scale }]}
          >
            {declining ? (
              <ActivityIndicator color={Colors.textGray} />
            ) : (
              <Text style={styles.declineButtonText}>인증하지 않을래요</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  feedbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  feedbackText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  notificationCard: {
    position: 'absolute',
    backgroundColor: Colors.background,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  groupName: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  notificationTitle: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 24,
    lineHeight: 29,
  },
  timerTrack: {
    position: 'absolute',
  },
  timerProgress: {
    position: 'absolute',
  },
  bombIcon: {
    position: 'absolute',
    zIndex: 1,
  },
  wakeTime: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textBlack,
    fontFamily: 'PretendardBold',
    fontSize: 40,
    lineHeight: 48,
  },
  poseDescription: {
    position: 'absolute',
    alignSelf: 'center',
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 16,
    lineHeight: 19,
  },
  poseImage: {
    position: 'absolute',
    overflow: 'hidden',
  },
  cameraButton: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202224',
  },
  cameraButtonText: {
    color: Colors.textWhite,
    fontFamily: 'PretendardSemiBold',
    fontSize: 18,
    lineHeight: 23,
  },
  declineButton: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  declineButtonText: {
    color: Colors.textGray,
    fontFamily: 'PretendardMedium',
    fontSize: 15,
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
});
