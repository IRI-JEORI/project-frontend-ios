import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import type { RootStackParamList } from '../../../App';
import { nunnunApi } from '../../api';
import { getDemoPoseAnalysisResult } from '../../utils/analyzePose';
import { PhotoAnalysisScreen } from '../PhotoAnalysisScreen';
import { WakeAlarm } from '../../wakeAlarm/WakeAlarm';
import { notifyWakeDataRefresh } from '../../events/wakeDataRefresh';

jest.mock('../../api', () => ({
  ApiError: class ApiError extends Error {},
  nunnunApi: { wake: { uploadProof: jest.fn() } },
}));
jest.mock('../../utils/analyzePose', () => ({
  getDemoPoseAnalysisResult: jest.fn(),
}));
jest.mock('../../wakeAlarm/WakeAlarm', () => ({
  WakeAlarm: { start: jest.fn(), stop: jest.fn() },
}));
jest.mock('../../events/wakeDataRefresh', () => ({
  notifyWakeDataRefresh: jest.fn(),
}));

const realParams: RootStackParamList['PhotoAnalysis'] = {
  photoPath: '/cache/photo.jpg',
  photoUri: 'file:///cache/photo.jpg',
  recipientName: '눈눈',
  photographer: 'jiwoo',
  attempt: 1,
  requestId: 31,
  groupId: 17,
  verificationMode: 'self-verify',
};

const successResult = {
  wake_request_id: 31,
  attempt_no: 1,
  pose_match_score: 95,
  pose_match_result: 'SUCCESS' as const,
  request_status: 'VERIFIED' as const,
  remaining_attempts: 1,
  can_retry: false,
};

const createScreen = async (
  params: RootStackParamList['PhotoAnalysis'] = realParams,
) => {
  const navigation = {
    replace: jest.fn(),
    goBack: jest.fn(),
  };
  const route = { key: 'analysis-test', name: 'PhotoAnalysis', params } as const;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <PhotoAnalysisScreen navigation={navigation as never} route={route as never} />,
    );
  });
  return { navigation, renderer, route };
};

describe('PhotoAnalysisScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    jest.mocked(WakeAlarm.stop).mockResolvedValue(undefined);
  });

  it('uploads a real proof once and preserves success params across a re-render', async () => {
    jest.mocked(nunnunApi.wake.uploadProof).mockResolvedValue(successResult);
    const { navigation, renderer, route } = await createScreen();

    await act(async () => {
      renderer.update(
        <PhotoAnalysisScreen navigation={navigation as never} route={route as never} />,
      );
    });

    expect(nunnunApi.wake.uploadProof).toHaveBeenCalledTimes(1);
    expect(nunnunApi.wake.uploadProof).toHaveBeenCalledWith(31, 'file:///cache/photo.jpg');
    expect(notifyWakeDataRefresh).toHaveBeenCalledWith({
      reason: 'proof-uploaded',
      groupId: 17,
    });
    expect(getDemoPoseAnalysisResult).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith(
      'PhotoAnalysisSuccess',
      expect.objectContaining({
        requestId: 31,
        groupId: 17,
        verificationMode: 'self-verify',
        proofResult: successResult,
      }),
    );
    expect(WakeAlarm.stop).not.toHaveBeenCalled();
  });

  it('routes a real FAIL result with retry data preserved', async () => {
    const failureResult = {
      ...successResult,
      pose_match_score: 30,
      pose_match_result: 'FAIL' as const,
      request_status: 'SENT' as const,
      can_retry: true,
    };
    jest.mocked(nunnunApi.wake.uploadProof).mockResolvedValue(failureResult);
    const { navigation } = await createScreen({
      ...realParams,
      verificationMode: 'wake-proof',
    });

    expect(navigation.replace).toHaveBeenCalledWith(
      'PhotoAnalysisFailure',
      expect.objectContaining({
        attempt: 1,
        requestId: 31,
        groupId: 17,
        verificationMode: 'wake-proof',
        proofResult: failureResult,
      }),
    );
    expect(WakeAlarm.stop).not.toHaveBeenCalled();
  });

  it.each([
    ['SUCCESS', false],
    ['FAIL', false],
  ] as const)('stops a wake-proof alarm for terminal %s', async (result, canRetry) => {
    jest.mocked(nunnunApi.wake.uploadProof).mockResolvedValue({
      ...successResult,
      pose_match_result: result,
      request_status: result === 'SUCCESS' ? 'VERIFIED' : 'NEEDS_HELP',
      can_retry: canRetry,
    });

    await createScreen({ ...realParams, verificationMode: 'wake-proof' });

    expect(WakeAlarm.stop).toHaveBeenCalledWith(31);
  });

  it('shows an API error and returns to PhotoReview only after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(nunnunApi.wake.uploadProof).mockRejectedValue(new Error('network'));
    const { navigation } = await createScreen();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      '인증사진 제출 실패',
      '인증사진을 전송하지 못했어요. 다시 시도해주세요.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0][2];
    buttons?.[0]?.onPress?.();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('keeps the existing timer-based demo analysis without uploading', async () => {
    jest.useFakeTimers();
    jest.mocked(getDemoPoseAnalysisResult).mockReturnValue('success');
    const { navigation } = await createScreen({
      photoPath: '/cache/demo.jpg',
      recipientName: '눈눈',
      photographer: 'jiwoo',
    });

    expect(nunnunApi.wake.uploadProof).not.toHaveBeenCalled();
    await act(async () => {
      jest.runAllTimers();
    });
    expect(getDemoPoseAnalysisResult).toHaveBeenCalledTimes(1);
    expect(navigation.replace).toHaveBeenCalledWith(
      'PhotoAnalysisSuccess',
      expect.objectContaining({ photoPath: '/cache/demo.jpg' }),
    );
  });
});
