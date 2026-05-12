import { parseHydraMessage } from "../parser";

describe("parseHydraMessage", () => {
  it("parses Greetings with tag", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        tag: "Greetings",
        me: { vkey: "abc" },
        headStatus: "Idle",
        hydraNodeVersion: "2.0.0",
      }),
    );
    expect(msg.tag).toBe("Greetings");
    if (msg.tag === "Greetings") {
      expect(msg.json.headStatus).toBe("Idle");
    }
  });

  it("parses Greetings without tag but with headStatus/me/version", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        headStatus: "Open",
        hydraNodeVersion: "2.0.0",
        me: { vkey: "xyz" },
      }),
    );
    expect(msg.tag).toBe("Greetings");
  });

  it("parses TxValid", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        tag: "TxValid",
        seq: 5,
        timestamp: "2025-01-01T00:00:00Z",
        transactionId: "abc123",
      }),
    );
    expect(msg.tag).toBe("TxValid");
    if (msg.tag === "TxValid") {
      expect(msg.seq).toBe(5);
      expect(msg.json.transactionId).toBe("abc123");
    }
  });

  it("parses TxInvalid", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        tag: "TxInvalid",
        seq: 6,
        timestamp: "2025-01-01T00:00:01Z",
        validationError: "insufficient funds",
      }),
    );
    expect(msg.tag).toBe("TxInvalid");
    if (msg.tag === "TxInvalid") {
      expect(msg.json.validationError).toBe("insufficient funds");
    }
  });

  it("parses Snapshot", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        tag: "Snapshot",
        seq: 10,
        timestamp: "2025-01-01T00:00:02Z",
        snapshot: { confirmed: true },
      }),
    );
    expect(msg.tag).toBe("Snapshot");
    if (msg.tag === "Snapshot") {
      expect(msg.seq).toBe(10);
    }
  });

  it("parses unknown timed output as TimedServerOutput", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        tag: "HeadInitialized",
        seq: 1,
        timestamp: "2025-01-01T00:00:00Z",
      }),
    );
    expect(msg.tag).toBe("TimedServerOutput");
    if (msg.tag === "TimedServerOutput") {
      expect(msg.outputTag).toBe("HeadInitialized");
      expect(msg.seq).toBe(1);
    }
  });

  it("parses InvalidInput", () => {
    const msg = parseHydraMessage(
      JSON.stringify({
        reason: "not enough input",
        input: "garbage",
      }),
    );
    expect(msg.tag).toBe("InvalidInput");
    if (msg.tag === "InvalidInput") {
      expect(msg.reason).toBe("not enough input");
    }
  });

  it("parses unknown JSON as Raw", () => {
    const msg = parseHydraMessage(JSON.stringify({ foo: "bar" }));
    expect(msg.tag).toBe("Raw");
  });

  it("handles non-JSON as Raw", () => {
    const msg = parseHydraMessage("not json");
    expect(msg.tag).toBe("Raw");
  });
});
