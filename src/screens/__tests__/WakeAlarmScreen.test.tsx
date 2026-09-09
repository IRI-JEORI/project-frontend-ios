import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import Button from '../../components/Button';
import { nunnunApi, type WakeRequest } from '../../api';
import WakeAlarmScreen from '../WakeAlarmScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { requestId: 42 } }),
}));

jest.mock('../../api', () => ({
  nunnunApi: {
    wake: {
      getRequest: jest.fn(),
    },
  },
}));

const wakeRequest: WakeRequest = {
  id: 42,
  group_id: 7,
  status: 'SENT',
  sender: { id: 8, nickname: '지우' },
  receiver: { id: 9, nickname: '민수' },
  requested_at: '2026-09-07T07:32:00+09:00',
  pose: {
    date: '2026-09-07',
    code: 'LOW_CROUCH',
    description: '몸을 낮게 웅크려 앉아주세요.',
  },
  attempts_used: 0,
  remaining_attempts: 2,
};

describe('WakeAlarmScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(nunnunApi.wake.getRequest).mockResolvedValue(wakeRequest);
  });

  it('preserves the wake request id when opening the camera', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<WakeAlarmScreen />);
    });

    expect(nunnunApi.wake.getRequest).toHaveBeenCalledWith(42);

    act(() => {
      renderer.root.findByType(Button).props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('CameraCapture', {
      memberName: '지우',
      recipientName: '지우',
      photographer: 'jiwoo',
      requestId: 42,
      groupId: 7,
      verificationMode: 'wake-proof',
    });
  });
});
