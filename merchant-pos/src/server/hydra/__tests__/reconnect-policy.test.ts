import { DEFAULT_RECONNECT_POLICY, delayForAttempt } from "../reconnect-policy";

describe("delayForAttempt", () => {
  it("returns initial delay for attempt 0", () => {
    expect(delayForAttempt(DEFAULT_RECONNECT_POLICY, 0)).toBe(200);
  });

  it("doubles on each subsequent attempt", () => {
    expect(delayForAttempt(DEFAULT_RECONNECT_POLICY, 1)).toBe(400);
    expect(delayForAttempt(DEFAULT_RECONNECT_POLICY, 2)).toBe(800);
    expect(delayForAttempt(DEFAULT_RECONNECT_POLICY, 3)).toBe(1600);
  });

  it("caps at maxDelayMs", () => {
    expect(delayForAttempt(DEFAULT_RECONNECT_POLICY, 4)).toBe(3000);
    expect(delayForAttempt(DEFAULT_RECONNECT_POLICY, 10)).toBe(3000);
  });

  it("respects custom policy", () => {
    const policy = {
      autoReconnect: true,
      initialDelayMs: 100,
      maxDelayMs: 500,
      backoffMultiplier: 3,
    };
    expect(delayForAttempt(policy, 0)).toBe(100);
    expect(delayForAttempt(policy, 1)).toBe(300);
    expect(delayForAttempt(policy, 2)).toBe(500);
    expect(delayForAttempt(policy, 3)).toBe(500);
  });
});
