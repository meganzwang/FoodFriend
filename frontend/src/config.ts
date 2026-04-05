import { NativeModules, Platform } from "react-native";

const DEV_BACKEND_PORT = 3001;

const getDevHostIp = (): string | null => {
  const scriptUrl = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptUrl) {
    return null;
  }

  const match = scriptUrl.match(/^https?:\/\/([^/:]+)(?::\d+)?/i);
  return match?.[1] ?? null;
};

const getApiUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  if (__DEV__) {
    const hostIp = getDevHostIp();
    if (hostIp) {
      return `http://${hostIp}:${DEV_BACKEND_PORT}`;
    }

    if (Platform.OS === "android") {
      return `http://10.0.2.2:${DEV_BACKEND_PORT}`;
    }

    return `http://localhost:${DEV_BACKEND_PORT}`;
  }

  return `http://localhost:${DEV_BACKEND_PORT}`;
};

export const CONFIG = {
  API_URL: getApiUrl(),
  TIMEOUT_MS: 10000,
};
