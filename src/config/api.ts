import { Platform } from 'react-native';

const DEPLOYED_API_BASE_URL = 'http://1.201.116.185';
const IOS_SIMULATOR_API_BASE_URL = 'http://localhost:8080';

export const API_BASE_URL =
  __DEV__ && Platform.OS === 'ios'
    ? IOS_SIMULATOR_API_BASE_URL
    : DEPLOYED_API_BASE_URL;

export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
