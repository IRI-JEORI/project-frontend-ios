import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/Button';
import type { RootStackParamList } from '../../../App';
import { nunnunApi } from '../../api';
import type { WakeRequest } from '../../api';
import { colors } from '../../theme/tokens';

const TIME_TOP_SPACING = 297;
const BUTTON_BOTTOM_SPACING = 52;
const BUTTON_HORIZONTAL_MARGIN = 28;

const WakeAlarmScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'WakeAlarm'>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'WakeAlarm'>>();
  const [wakeRequest, setWakeRequest] = useState<WakeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;

    nunnunApi.wake
      .getRequest(params.requestId)
      .then(request => {
        if (active) {
          setWakeRequest(request);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
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
  }, [params.requestId]);

  const openCamera = () => {
    if (!wakeRequest) {
      return;
    }

    navigation.navigate('CameraCapture', {
      memberName: wakeRequest.sender.nickname,
      recipientName: wakeRequest.sender.nickname,
      photographer: 'jiwoo',
      requestId: wakeRequest.id,
      groupId: wakeRequest.group_id,
      verificationMode: 'wake-proof',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.time}>07:32</Text>
        <Text style={styles.wakerMessage}>
          {wakeRequest?.sender.nickname ?? '친구'}님이 깨웠어요
        </Text>
        <Text style={styles.description}>
          일어났다면 인증사진을 찍어주세요{'\n'}사진은 8시간 후 사라져요
        </Text>
      </View>
      <View style={styles.buttonWrapper}>
        <Button
          label={loadFailed ? '요청 정보를 불러오지 못했어요' : '인증사진 찍기'}
          variant="secondary"
          disabled={loading || !wakeRequest}
          onPress={openCamera}
        />
        {loading && <ActivityIndicator style={styles.loading} color={colors.white} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brown,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: TIME_TOP_SPACING,
  },
  time: {
    fontSize: 64,
    fontFamily: 'PretendardBold',
    color: colors.white,
  },
  wakerMessage: {
    fontSize: 16,
    fontFamily: 'PretendardMedium',
    color: colors.folderGray,
    marginTop: 18,
  },
  description: {
    fontSize: 16,
    fontFamily: 'PretendardMedium',
    color: colors.folderGray,
    textAlign: 'center',
    marginTop: 33,
  },
  buttonWrapper: {
    width: '100%',
    paddingHorizontal: BUTTON_HORIZONTAL_MARGIN,
    paddingBottom: BUTTON_BOTTOM_SPACING,
  },
  loading: {
    position: 'absolute',
    alignSelf: 'center',
    top: 20,
  },
});

export default WakeAlarmScreen;
