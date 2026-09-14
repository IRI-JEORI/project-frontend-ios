import { NativeModules, Platform } from 'react-native';

const FALLBACK_DEPLOYED_API_BASE_URL = 'http://1.201.116.185';

const normalizeHttpBaseUrl = (value: unknown) =>
  typeof value === 'string' && /^https?:\/\//.test(value.trim())
    ? value.trim().replace(/\/+$/, '')
    : undefined;

const getNativeIOSApiBaseUrl = () =>
  normalizeHttpBaseUrl(NativeModules.APIConfig?.apiBaseURL);

const getConfiguredAPIBaseUrl = () => {
  const configuredBaseUrl = NativeModules.SettingsManager?.settings?.APIBaseURL;

  return normalizeHttpBaseUrl(configuredBaseUrl)?.startsWith('https://')
    ? normalizeHttpBaseUrl(configuredBaseUrl)
    : undefined;
};

const getConfiguredIOSDevelopmentBaseUrl = () => {
  const configuredBaseUrl =
    NativeModules.SettingsManager?.settings?.LocalBackendAPIBaseURL;

  return normalizeHttpBaseUrl(configuredBaseUrl);
};

const getConfiguredIOSDevelopmentHost = () => {
  const configuredHost =
    NativeModules.SettingsManager?.settings?.LocalBackendHost;

  return typeof configuredHost === 'string' && configuredHost.trim()
    ? configuredHost.trim()
    : undefined;
};

const getIOSDevelopmentApiBaseUrl = () => {
  const configuredBaseUrl =
    getNativeIOSApiBaseUrl() ?? getConfiguredIOSDevelopmentBaseUrl();
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
    : Platform.OS === 'ios'
    ? getNativeIOSApiBaseUrl() ??
      getConfiguredAPIBaseUrl() ??
      FALLBACK_DEPLOYED_API_BASE_URL
    : FALLBACK_DEPLOYED_API_BASE_URL;

if (__DEV__) {
  console.info(`[API] Base URL: ${API_BASE_URL}`);
}

export const API_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;
