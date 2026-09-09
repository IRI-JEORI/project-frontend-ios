import type { WakeProofResult } from '../api';

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Permission: undefined;
  Home: undefined;
  PersonalGroup: undefined;
  Settings: undefined;
  WakeTargets: undefined;
  DndWindows: undefined;
  FixedSchedules: undefined;
  Stats: undefined;
  RewardList: undefined;
  InviteCode: undefined;
  AddGroupName: { groupType: 'wake' | 'roommate' };
  WaitingForMembers: { groupId: number; groupType: 'wake'; groupName?: string };
  WakeGroupDetail: { groupId: number };
  WakeAlarm: { requestId: number };
  WakeNotification: { requestId: number } | undefined;
  SelfWakeVerification: {
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    groupId?: number;
    groupName?: string;
  };
  CameraCapture: {
    memberName?: string;
    onComplete?: (photoUri: string) => void;
    recipientName?: string;
    photographer?: 'jiwoo' | 'minju';
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
  };
  PhotoReview: {
    photoUri: string;
    memberName: string;
    recipientName?: string;
    photographer?: 'jiwoo' | 'minju';
    onComplete?: (photoUri: string) => void;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
  };
  PhotoAnalysis: {
    photoPath: string;
    photoUri?: string;
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    attempt?: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
  };
  PhotoAnalysisSuccess: {
    photoPath: string;
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
    proofResult?: WakeProofResult;
  };
  PhotoAnalysisFailure: {
    recipientName: string;
    photographer: 'jiwoo' | 'minju';
    attempt: number;
    requestId?: number;
    groupId?: number;
    verificationMode?: 'wake-proof' | 'self-verify';
    proofResult?: WakeProofResult;
  };
};
