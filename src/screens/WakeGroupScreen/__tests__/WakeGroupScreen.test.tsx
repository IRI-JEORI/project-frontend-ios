import React from 'react';
import { Alert, Image, Text, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { nunnunApi } from '../../../api';
import type { WakeGroupDetail } from '../../../api/types';
import NavHeader from '../../../components/NavHeader';
import Clipboard from '@react-native-clipboard/clipboard';
import WakeGroupScreen from '../index';
import { openWakeRequest } from '../../../notifications/messaging';

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  popTo: jest.fn(),
};
const mockRoute = { params: { groupId: 7 } };

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useFocusEffect: (callback: () => void | (() => void)) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('../../../api', () => ({
  ApiError: class ApiError extends Error {},
  nunnunApi: {
    group: {
      detail: jest.fn(),
      getPendingWakeSuccess: jest.fn(),
      leave: jest.fn(),
    },
    wake: {
      wakeMember: jest.fn(),
      acknowledgeSuccess: jest.fn(),
      getPendingRequest: jest.fn(),
    },
  },
}));

jest.mock('../../../notifications/messaging', () => ({
  openWakeRequest: jest.fn(),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}));

const detail: WakeGroupDetail = {
  id: 7,
  name: '아침 야호',
  invite_code: '8G3FE2',
  capacity: 4,
  current_members: 2,
  members: [
    {
      user_id: 11,
      nickname: '나',
      avatar_url: null,
      is_me: true,
      target_wake_time: '07:30',
      next_target_at: null,
      remaining_to_target: null,
      state: 'NORMAL',
      actual_wake_time: null,
      proof_image_url: null,
      proof_expires_at: null,
      can_wake: false,
      block_reason: null,
      wake_available_at: null,
    },
    {
      user_id: 22,
      nickname: '상대 멤버',
      avatar_url: null,
      is_me: false,
      target_wake_time: '08:00',
      next_target_at: null,
      remaining_to_target: { value: 1, unit: 'HOUR' },
      state: 'NORMAL',
      actual_wake_time: null,
      proof_image_url: null,
      proof_expires_at: null,
      can_wake: true,
      block_reason: null,
      wake_available_at: null,
    },
  ],
};

const screenRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

const renderScreen = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<WakeGroupScreen />);
  });
  screenRenderers.push(renderer);
  return renderer;
};

const buttonWithText = (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) =>
  renderer.root
    .findAllByType(TouchableOpacity)
    .find(button =>
      button.findAllByType(Text).some(text => text.props.children === label),
    );

const press = async (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) => {
  await act(async () => {
    await buttonWithText(renderer, label)?.props.onPress();
  });
};

describe('WakeGroupScreen wake confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(nunnunApi.group.detail).mockResolvedValue(detail);
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue(null);
    jest.mocked(nunnunApi.group.leave).mockResolvedValue(undefined);
    jest.mocked(nunnunApi.wake.acknowledgeSuccess).mockResolvedValue(undefined);
    jest.mocked(nunnunApi.wake.wakeMember).mockResolvedValue({
      wake_request_id: 31,
      status: 'SENT',
      requested_at: '2026-08-20T09:00:00+09:00',
    });
    jest.mocked(nunnunApi.wake.getPendingRequest).mockResolvedValue(null);
    jest.mocked(openWakeRequest).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => {
      screenRenderers.splice(0).forEach(renderer => renderer.unmount());
    });
    jest.useRealTimers();
  });

  it('shows the real member confirmation without immediately waking', async () => {
    const renderer = await renderScreen();
    await press(renderer, '깨우기');

    const texts = renderer.root.findAllByType(Text).map(node => node.props.children);
    const caution = renderer.root
      .findAllByType(Image)
      .find(node => node.props.accessibilityLabel === '주의');

    expect(nunnunApi.wake.wakeMember).not.toHaveBeenCalled();
    expect(texts).toContain('상대 멤버님을 깨울까요?');
    expect(caution).toBeDefined();
  });

  it('opens a newly detected wake request only once while focused', async () => {
    jest.useFakeTimers();
    jest.mocked(nunnunApi.wake.getPendingRequest).mockResolvedValue({
      id: 901,
      group_id: 7,
      status: 'SENT',
      sender: { id: 22, nickname: '상대 멤버' },
      receiver: { id: 11, nickname: '나' },
      requested_at: '2026-08-20T09:00:00+09:00',
      pose: { date: '2026-08-20', code: 'HEART', description: '하트' },
      attempts_used: 0,
      remaining_attempts: 2,
    });

    await renderScreen();
    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(openWakeRequest).toHaveBeenCalledTimes(1);
    expect(openWakeRequest).toHaveBeenCalledWith(901);
  });

  it('shows and copies the invite code alongside the leave action', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const renderer = await renderScreen();

    renderer.root.findByType(NavHeader).props.onPressRight();

    const menuButtons = alert.mock.calls[0][2];
    expect(alert).toHaveBeenCalledWith(
      detail.name,
      `초대 코드: ${detail.invite_code}`,
      expect.any(Array),
    );
    expect(menuButtons?.map(button => button.text)).toEqual([
      '닫기',
      '초대 코드 복사',
      '그룹 나가기',
    ]);
    expect(menuButtons?.some(button => button.text === '그룹 관리')).toBe(false);

    menuButtons?.find(button => button.text === '초대 코드 복사')?.onPress?.();
    expect(Clipboard.setString).toHaveBeenCalledWith(detail.invite_code);
    expect(alert).toHaveBeenLastCalledWith(
      '복사 완료',
      '초대 코드가 복사됐어요.',
    );
    alert.mockRestore();
  });

  it('shows the wake cooldown beside the verified wake time', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-20T09:10:01+09:00'));
    jest.mocked(nunnunApi.group.detail).mockResolvedValue({
      ...detail,
      members: [
        detail.members[0],
        {
          ...detail.members[1],
          state: 'AWAKE',
          actual_wake_time: '09:00',
          proof_image_url: 'https://signed.example/proof.jpg',
          can_wake: false,
          block_reason: 'COOLDOWN',
          wake_available_at: '2026-08-20T09:30:00+09:00',
        },
      ],
    });

    const renderer = await renderScreen();
    const texts = renderer.root.findAllByType(Text).map(node => node.props.children);

    expect(texts).toContain('09:00');
    expect(texts).toContain('19:59');
    expect(texts).toContain('쿨다운');
  });

  it('leaves the group after confirmation and returns home', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const renderer = await renderScreen();

    renderer.root.findByType(NavHeader).props.onPressRight();
    alert.mock.calls[0][2]?.find(button => button.text === '그룹 나가기')?.onPress?.();
    await act(async () => {
      await alert.mock.calls[1][2]?.find(button => button.text === '나가기')?.onPress?.();
    });

    expect(nunnunApi.group.leave).toHaveBeenCalledWith(7);
    expect(mockNavigation.popTo).toHaveBeenCalledWith('Home');
    alert.mockRestore();
  });

  it('cancels without calling the wake API', async () => {
    const renderer = await renderScreen();
    await press(renderer, '깨우기');
    await press(renderer, '안 깨울래요');

    expect(nunnunApi.wake.wakeMember).not.toHaveBeenCalled();
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).not.toContain('상대 멤버님을 깨울까요?');
  });

  it('wakes once, refreshes detail, and closes after success', async () => {
    const renderer = await renderScreen();
    await press(renderer, '깨우기');
    const confirm = buttonWithText(renderer, '깨울게요');

    await act(async () => {
      const first = confirm?.props.onPress();
      const second = confirm?.props.onPress();
      await Promise.all([first, second]);
    });

    expect(nunnunApi.wake.wakeMember).toHaveBeenCalledTimes(1);
    expect(nunnunApi.wake.wakeMember).toHaveBeenCalledWith(7, 22);
    expect(nunnunApi.group.detail).toHaveBeenCalledTimes(2);
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).not.toContain('상대 멤버님을 깨울까요?');
  });

  it('keeps the modal after failure and permits a later retry', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.wake.wakeMember).mockRejectedValueOnce(new Error('failed'));
    const renderer = await renderScreen();
    await press(renderer, '깨우기');
    await press(renderer, '깨울게요');

    expect(alert).toHaveBeenCalledWith(
      '깨우기 실패',
      '깨우기 요청을 보내지 못했어요.',
    );
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).toContain('상대 멤버님을 깨울까요?');

    await press(renderer, '깨울게요');
    expect(nunnunApi.wake.wakeMember).toHaveBeenCalledTimes(2);
    alert.mockRestore();
  });

  it('shows a pending success once with the real receiver and clock asset', async () => {
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();

    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).toContain('상대 멤버님 깨우기 성공!');
    expect(
      renderer.root
        .findAllByType(Image)
        .find(node => node.props.accessibilityLabel === '깨우기 성공'),
    ).toBeDefined();
  });

  it('acknowledges Later and closes without navigating', async () => {
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();
    await press(renderer, '나중에');

    expect(nunnunApi.wake.acknowledgeSuccess).toHaveBeenCalledWith(64);
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('RewardList');
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).not.toContain('상대 멤버님 깨우기 성공!');
  });

  it('acknowledges Send and opens RewardList', async () => {
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();
    await press(renderer, '보내기');

    expect(nunnunApi.wake.acknowledgeSuccess).toHaveBeenCalledWith(64);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RewardList');
  });

  it('keeps the success modal after an acknowledgement failure', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    jest.mocked(nunnunApi.wake.acknowledgeSuccess).mockRejectedValue(new Error('failed'));
    const renderer = await renderScreen();
    await press(renderer, '나중에');

    expect(alert).toHaveBeenCalledWith(
      '알림 처리 실패',
      '깨우기 성공 알림을 처리하지 못했어요.',
    );
    expect(
      renderer.root.findAllByType(Text).map(node => node.props.children),
    ).toContain('상대 멤버님 깨우기 성공!');
    alert.mockRestore();
  });

  it('does not repoll while the same success is displayed and clears polling on unmount', async () => {
    jest.useFakeTimers();
    jest.mocked(nunnunApi.group.getPendingWakeSuccess).mockResolvedValue({
      wake_request_id: 64,
      group_id: 7,
      receiver: { id: 22, nickname: '상대 멤버' },
      verified_at: '2026-08-20T09:03:00+09:00',
    });
    const renderer = await renderScreen();
    expect(nunnunApi.group.getPendingWakeSuccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(12000);
    });
    expect(nunnunApi.group.getPendingWakeSuccess).toHaveBeenCalledTimes(1);

    await act(async () => renderer.unmount());
    screenRenderers.splice(screenRenderers.indexOf(renderer), 1);
    await act(async () => {
      jest.advanceTimersByTime(8000);
    });
    expect(nunnunApi.group.getPendingWakeSuccess).toHaveBeenCalledTimes(1);
  });
});
