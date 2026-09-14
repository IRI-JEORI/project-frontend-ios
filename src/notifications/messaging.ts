import {
  Alert,
  PermissionsAndroid,
  Platform,
  type PermissionStatus,
} from 'react-native';
import {
  AuthorizationStatus,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { nunnunApi } from '../api/nunnunApi';
import { tokenStorage } from '../api/tokenStorage';
import { openWakeNotification } from '../navigation/rootNavigation';
import { parseWakeRequestPayload } from './wakeRequestPayload';
import { WakeAlarm } from '../wakeAlarm/WakeAlarm';
import { notifyWakeDataRefresh } from '../events/wakeDataRefresh';

const notificationPermissionGranted = async () => {
  if (Platform.OS === 'ios') {
    const status = await requestPermission(getMessaging());
    return (
      status === AuthorizationStatus.AUTHORIZED ||
      status === AuthorizationStatus.PROVISIONAL
    );
  }

  if (Platform.OS !== 'android') {
    return false;
  }

  if (Platform.Version < 33) {
    return true;
  }

  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) {
    return true;
  }

  const status: PermissionStatus = await PermissionsAndroid.request(permission);
  return status === PermissionsAndroid.RESULTS.GRANTED;
};

const registerToken = async (token: string) => {
  if (!(await tokenStorage.getAccessToken())) {
    return;
  }

  await nunnunApi.device.register(token);
};

export const registerDeviceAfterLogin = async () => {
  try {
    if (!(await notificationPermissionGranted())) {
      return;
    }

    const messaging = getMessaging();
    await registerDeviceForRemoteMessages(messaging);
    await registerToken(await getToken(messaging));
  } catch {
    // Push registration must not turn a successful login into a login failure.
  }
};

export const openWakeRequest = async (requestId: number) => {
  if (!(await tokenStorage.getAccessToken())) {
    return;
  }
  await WakeAlarm.start(requestId);
  openWakeNotification(requestId);
};

const openWakeRequestFromMessage = async (message: RemoteMessage | null) => {
  const params = parseWakeRequestPayload(message?.data);
  if (params) {
    await openWakeRequest(params.requestId);
  }
};

export const registerBackgroundMessageHandler = () => {
  if (Platform.OS !== 'android') {
    return;
  }

  const messaging = getMessaging();
  setBackgroundMessageHandler(messaging, async message => {
    const params = parseWakeRequestPayload(message.data);
    if (!params || !(await tokenStorage.getAccessToken())) {
      return;
    }
    await WakeAlarm.start(params.requestId);
  });
};

export const startForegroundMessaging = () => {
  let messaging: ReturnType<typeof getMessaging>;
  try {
    messaging = getMessaging();
  } catch {
    // Firebase may not be configured yet in a local iOS build. Push support
    // should not prevent the rest of the app from rendering.
    return () => undefined;
  }

  let unsubscribeTokenRefresh: () => void = () => undefined;
  let unsubscribeForeground: () => void = () => undefined;
  let unsubscribeOpened: () => void = () => undefined;

  try {
    unsubscribeTokenRefresh = onTokenRefresh(messaging, token => {
      registerToken(token).catch(() => undefined);
    });

    unsubscribeForeground = onMessage(messaging, async message => {
      const params = parseWakeRequestPayload(message.data);
      if (!params) {
        return;
      }
      if (!(await tokenStorage.getAccessToken())) {
        return;
      }
      notifyWakeDataRefresh({ reason: 'foreground-message' });
      await WakeAlarm.start(params.requestId);

      Alert.alert(
        message.notification?.title ?? '깨우기 요청이 왔어요',
        message.notification?.body ?? '깨우기 요청을 확인해주세요.',
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '확인',
            onPress: () => {
              openWakeRequest(params.requestId).catch(() => undefined);
            },
          },
        ],
      );
    });

    unsubscribeOpened = onNotificationOpenedApp(
      messaging,
      openWakeRequestFromMessage,
    );

    getInitialNotification(messaging)
      .then(openWakeRequestFromMessage)
      .catch(() => undefined);
  } catch {
    unsubscribeTokenRefresh();
    unsubscribeForeground();
    unsubscribeOpened();
    return () => undefined;
  }

  return () => {
    unsubscribeTokenRefresh();
    unsubscribeForeground();
    unsubscribeOpened();
  };
};
