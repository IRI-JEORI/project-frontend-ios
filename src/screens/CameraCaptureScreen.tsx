import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../../App';

const DESIGN_WIDTH = 402;
const MAX_CONTENT_WIDTH = 430;

type Props = NativeStackScreenProps<RootStackParamList, 'CameraCapture'>;

export const CameraCaptureScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg' });
  const isFocused = useIsFocused();
  const { width: viewportWidth } = useWindowDimensions();
  const contentWidth = Math.min(viewportWidth, MAX_CONTENT_WIDTH);
  const scale = Math.min(contentWidth / DESIGN_WIDTH, 1);
  const recipientName =
    route.params.memberName ?? route.params.recipientName ?? '사용자';
  const photographer = route.params.photographer ?? 'jiwoo';

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch(() => undefined);
    }
  }, [hasPermission, requestPermission]);

  const takePhoto = async () => {
    if (isTakingPhoto) {
      return;
    }

    setIsTakingPhoto(true);
    try {
      const photo = await photoOutput.capturePhotoToFile(
        { flashMode: flashEnabled && device?.hasFlash ? 'on' : 'off' },
        {},
      );
      const photoPath = photo.filePath.replace(/^file:\/\//, '');
      navigation.navigate('PhotoReview', {
        photoPath,
        photoUri: `file://${photoPath}`,
        memberName: recipientName,
        recipientName,
        photographer,
        onComplete: route.params.onComplete,
        attempt: route.params.attempt ?? 1,
        requestId: route.params.requestId,
        groupId: route.params.groupId,
        verificationMode: route.params.verificationMode,
      });
    } finally {
      setIsTakingPhoto(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />
      <View style={[styles.container, { width: contentWidth }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="카메라 닫기"
          activeOpacity={0.7}
          hitSlop={12}
          onPress={() => navigation.goBack()}
          style={[
            styles.closeButton,
            { left: 24 * scale, top: insets.top + 22 * scale },
          ]}
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={flashEnabled ? '플래시 끄기' : '플래시 켜기'}
          activeOpacity={0.7}
          hitSlop={12}
          onPress={() => setFlashEnabled(enabled => !enabled)}
          style={[
            styles.flashButton,
            { right: 25 * scale, top: insets.top + 24 * scale },
          ]}
        >
          <Text style={[styles.flashIcon, flashEnabled && styles.flashActive]}>
            ϟ
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.previewFrame,
            {
              left: 25 * scale,
              top: 87 * scale,
              width: 352 * scale,
              height: 546 * scale,
              borderRadius: 22 * scale,
            },
          ]}
        >
          {hasPermission && device ? (
            <Camera
              device={device}
              isActive={isFocused}
              outputs={[photoOutput]}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.previewFallback}>
              {!hasPermission ? (
                <Text style={styles.previewMessage}>
                  카메라 권한을 허용해주세요
                </Text>
              ) : device === undefined ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : null}
            </View>
          )}
        </View>

        <Text style={[styles.helperText, { top: 660 * scale }]}>
          {recipientName}님에게 보여줄 인증사진이에요
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="사진 촬영"
          activeOpacity={0.8}
          disabled={!hasPermission || !device || isTakingPhoto}
          onPress={() => takePhoto().catch(() => undefined)}
          style={[
            styles.shutterOuter,
            {
              top: 704 * scale,
              width: 94 * scale,
              height: 94 * scale,
              borderRadius: 47 * scale,
            },
          ]}
        >
          <View
            style={[
              styles.shutterInner,
              {
                width: 76 * scale,
                height: 76 * scale,
                borderRadius: 38 * scale,
              },
            ]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  closeButton: {
    position: 'absolute',
    zIndex: 2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontFamily: 'PretendardLight',
    fontSize: 42,
    lineHeight: 42,
  },
  flashButton: {
    position: 'absolute',
    zIndex: 2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashIcon: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 40,
  },
  flashActive: {
    color: '#FFE65B',
  },
  previewFrame: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#333333',
    backgroundColor: '#000000',
  },
  previewFallback: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMessage: {
    color: '#666666',
    fontFamily: 'PretendardSemiBold',
    fontSize: 14,
  },
  helperText: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#A4A4A4',
    fontFamily: 'PretendardSemiBold',
    fontSize: 14,
    lineHeight: 18,
  },
  shutterOuter: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  shutterInner: {
    backgroundColor: '#FFFFFF',
  },
});
