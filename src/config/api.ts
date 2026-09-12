import { NativeModules, Platform } from 'react-native';

const DEPLOYED_API_BASE_URL = 'http://1.201.116.185';

const getConfiguredIOSDevelopmentBaseUrl = () => {
  const configuredBaseUrl =
    NativeModules.SettingsManager?.settings?.LocalBackendAPIBaseURL;

  return typeof configuredBaseUrl === 'string' &&
    /^https?:\/\//.test(configuredBaseUrl.trim())
    ? configuredBaseUrl.trim().replace(/\/+$/, '')
    : undefined;
};

const getConfiguredIOSDevelopmentHost = () => {
  const configuredHost =
    NativeModules.SettingsManager?.settings?.LocalBackendHost;

  return typeof configuredHost === 'string' && configuredHost.trim()
    ? configuredHost.trim()
    : undefined;
};

const getIOSDevelopmentApiBaseUrl = () => {
  const configuredBaseUrl = getConfiguredIOSDevelopmentBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const sourceCode = NativeModules.SourceCode;
  const scriptUrl =
    sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;
  const metroHost = scriptUrl?.match(/^https?:\/\/([^/:]+)/)?.[1];
  const backendHost = getConfiguredIOSDevelopmentHost() ?? metroHost;

  return `http://${backendHost ?? 'localhost'}:8080`;
};

export const API_BASE_URL =
  __DEV__ && Platform.OS === 'ios'
    ? getIOSDevelopmentApiBaseUrl()
    : DEPLOYED_API_BASE_URL;

export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
