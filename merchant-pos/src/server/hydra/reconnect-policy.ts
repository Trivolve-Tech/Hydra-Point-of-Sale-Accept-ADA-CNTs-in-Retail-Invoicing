export interface HydraReconnectPolicy {
  autoReconnect: boolean;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RECONNECT_POLICY: HydraReconnectPolicy = {
  autoReconnect: true,
  initialDelayMs: 200,
  maxDelayMs: 3000,
  backoffMultiplier: 2,
};

export function delayForAttempt(policy: HydraReconnectPolicy, attempt: number): number {
  let ms = policy.initialDelayMs;
  const cap = policy.maxDelayMs;
  for (let i = 0; i < attempt; i++) {
    const next = ms * policy.backoffMultiplier;
    ms = next > cap ? cap : next;
  }
  return ms;
}
