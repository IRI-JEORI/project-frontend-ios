import { NativeModules, Platform } from 'react-native';

const DEPLOYED_API_BASE_URL = 'http://1.201.116.185';

const getIOSDevelopmentApiBaseUrl = () => {
  const sourceCode = NativeModules.SourceCode;
  const scriptUrl =
    sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;
  const metroHost = scriptUrl?.match(/^https?:\/\/([^/:]+)/)?.[1];

  return `http://${metroHost ?? 'localhost'}:8080`;
};

export const API_BASE_URL =
  __DEV__ && Platform.OS === 'ios'
    ? getIOSDevelopmentApiBaseUrl()
    : DEPLOYED_API_BASE_URL;

export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
