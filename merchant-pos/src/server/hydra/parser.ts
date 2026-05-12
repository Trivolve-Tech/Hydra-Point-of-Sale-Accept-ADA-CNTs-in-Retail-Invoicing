import type { HydraInboundMessage } from "./types";

export function parseHydraMessage(text: string): HydraInboundMessage {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    return { tag: "Raw", json: { value: text } };
  }

  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return { tag: "Raw", json: { value: decoded } };
  }

  const m = decoded as Record<string, unknown>;

  if (isInvalidInput(m)) {
    return {
      tag: "InvalidInput",
      reason: m.reason as string,
      input: m.input as string,
    };
  }

  if (isGreetings(m)) {
    return { tag: "Greetings", json: m };
  }

  const msgTag = m.tag;
  const seqRaw = m.seq;
  const seq = typeof seqRaw === "number" ? Math.trunc(seqRaw) : null;

  if (typeof msgTag === "string" && seq !== null) {
    const ts = (m.timestamp as string) ?? null;
    switch (msgTag) {
      case "TxValid":
        return { tag: "TxValid", seq, timestamp: ts, json: m };
      case "TxInvalid":
        return { tag: "TxInvalid", seq, timestamp: ts, json: m };
      case "Snapshot":
        return { tag: "Snapshot", seq, timestamp: ts, json: m };
      default:
        return { tag: "TimedServerOutput", outputTag: msgTag, seq, timestamp: ts, json: m };
    }
  }

  return { tag: "Raw", json: m };
}

function isInvalidInput(m: Record<string, unknown>): boolean {
  return "reason" in m && "input" in m && m.tag === undefined;
}

function isGreetings(m: Record<string, unknown>): boolean {
  if (m.tag === "Greetings") return true;
  return (
    "headStatus" in m &&
    "hydraNodeVersion" in m &&
    "me" in m &&
    m.seq === undefined
  );
}
