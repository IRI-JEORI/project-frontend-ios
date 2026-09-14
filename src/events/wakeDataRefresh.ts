export type WakeDataRefreshReason =
  | 'proof-uploaded'
  | 'foreground-message'
  | 'app-active';

type WakeDataRefreshEvent = {
  reason: WakeDataRefreshReason;
  groupId?: number;
};

type WakeDataRefreshListener = (event: WakeDataRefreshEvent) => void;

const listeners = new Set<WakeDataRefreshListener>();
const presentedWakeRequestIds = new Set<number>();

export const notifyWakeDataRefresh = (event: WakeDataRefreshEvent) => {
  listeners.forEach(listener => listener(event));
};

export const subscribeWakeDataRefresh = (
  listener: WakeDataRefreshListener,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const claimWakeRequestPresentation = (requestId: number) => {
  if (presentedWakeRequestIds.has(requestId)) {
    return false;
  }

  presentedWakeRequestIds.add(requestId);
  return true;
};
