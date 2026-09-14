import React from 'react';
import { Alert, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { nunnunApi, type WakeRequest } from '../../api';
import { WakeNotificationScreen } from '../WakeNotificationScreen';
import { WakeAlarm } from '../../wakeAlarm/WakeAlarm';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));

jest.mock('../../api', () => ({
  ApiError: class ApiError extends Error {},
  nunnunApi: {
    wake: {
      getRequest: jest.fn(),
      decline: jest.fn(),
    },
  },
}));

jest.mock('../../wakeAlarm/WakeAlarm', () => ({
  WakeAlarm: { start: jest.fn(), stop: jest.fn() },
}));

jest.mock('../../assets/images/wake-timer-track.svg', () => 'WakeTimerTrack');
jest.mock('../../assets/images/wake-timer-progress.svg', () => 'WakeTimerProgress');

const externalRequest: WakeRequest = {
  id: 42,
  group_id: 7,
  status: 'SENT',
  sender: { id: 8, nickname: '지우' },
  receiver: { id: 9, nickname: '민수' },
  requested_at: '2026-08-20T19:00:00+09:00',
  pose: {
    date: '2026-08-20',
    code: 'LOW_CROUCH',
    description: '몸을 낮게 웅크려 앉아주세요.',
  },
  attempts_used: 0,
  remaining_attempts: 2,
};

const createScreen = async (request: WakeRequest = externalRequest) => {
  jest.mocked(nunnunApi.wake.getRequest).mockResolvedValue(request);
  const navigation = { reset: jest.fn(), replace: jest.fn() };
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <WakeNotificationScreen
        navigation={navigation as never}
        route={{
          key: 'wake-notification-test',
          name: 'WakeNotification',
          params: { requestId: request.id },
        } as never}
      />,
    );
  });
  return { navigation, renderer };
};

describe('WakeNotificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(nunnunApi.wake.decline).mockResolvedValue(undefined);
    jest.mocked(WakeAlarm.stop).mockResolvedValue(undefined);
  });

  it('renders an external sender and keeps the existing camera flow', async () => {
    const { navigation, renderer } = await createScreen();

    expect(renderer.root.findAllByType(Text).some(node =>
      Array.isArray(node.props.children) && node.props.children.join('') === '지우님이 깨웠어요',
    )).toBe(true);
    expect(renderer.root.findAllByType(Text).some(node =>
      node.props.children === '몸을 낮게 웅크려 앉아주세요.',
    )).toBe(true);
    expect(renderer.root.findByProps({ accessibilityLabel: '인증 포즈 참고 이미지' }).props.source)
      .toBe(require('../../assets/images/pose-low-crouch.png'));
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '인증사진 찍기' }).props.onPress();
    });
    expect(navigation.replace).toHaveBeenCalledWith('CameraCapture', {
      recipientName: '지우',
      photographer: 'jiwoo',
      requestId: 42,
      groupId: 7,
      verificationMode: 'wake-proof',
    });
  });

  it('never renders a self wake message and safely exits to its group', async () => {
    const { navigation, renderer } = await createScreen({
      ...externalRequest,
      sender: { id: 9, nickname: '민수' },
    });

    expect(renderer.root.findAllByType(Text).some(node =>
      Array.isArray(node.props.children) && node.props.children.join('') === '민수님이 깨웠어요',
    )).toBe(false);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'WakeGroupDetail', params: { groupId: 7 } },
      ],
    });
  });

  it('does not call decline when confirmation is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { renderer } = await createScreen();
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '인증하지 않을래요' }).props.onPress();
    });
    const buttons = alert.mock.calls[0][2];
    act(() => buttons?.[0]?.onPress?.());
    expect(nunnunApi.wake.decline).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('declines only once on double press and resets below the group detail', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { navigation, renderer } = await createScreen();
    const decline = renderer.root.findByProps({ accessibilityLabel: '인증하지 않을래요' });
    act(() => {
      decline.props.onPress();
      decline.props.onPress();
    });
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });

    expect(nunnunApi.wake.decline).toHaveBeenCalledTimes(1);
    expect(nunnunApi.wake.decline).toHaveBeenCalledWith(42);
    expect(WakeAlarm.stop).toHaveBeenCalledWith(42);
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'WakeGroupDetail', params: { groupId: 7 } },
      ],
    });
    alert.mockRestore();
  });

  it('keeps the screen available for retry when decline fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.wake.decline).mockRejectedValue(new Error('failed'));
    const { navigation, renderer } = await createScreen();
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: '인증하지 않을래요' }).props.onPress();
    });
    const buttons = alert.mock.calls[0][2];
    await act(async () => {
      await buttons?.[1]?.onPress?.();
    });

    expect(navigation.reset).not.toHaveBeenCalled();
    expect(WakeAlarm.stop).not.toHaveBeenCalled();
    expect(alert).toHaveBeenLastCalledWith(
      '알림',
      '인증 거부에 실패했어요. 다시 시도해주세요.',
    );
    expect(renderer.root.findByProps({ accessibilityLabel: '인증하지 않을래요' }).props.disabled)
      .toBe(false);
    alert.mockRestore();
  });
});
