export enum HydraConnectionState {
  disconnected = "disconnected",
  connecting = "connecting",
  connected = "connected",
  reconnecting = "reconnecting",
}

export type HydraGreetings = {
  tag: "Greetings";
  json: Record<string, unknown>;
};

export type HydraTxValid = {
  tag: "TxValid";
  seq: number;
  timestamp: string | null;
  json: Record<string, unknown>;
};

export type HydraTxInvalid = {
  tag: "TxInvalid";
  seq: number;
  timestamp: string | null;
  json: Record<string, unknown>;
};

export type HydraServerSnapshot = {
  tag: "Snapshot";
  seq: number;
  timestamp: string | null;
  json: Record<string, unknown>;
};

export type HydraTimedServerOutput = {
  tag: "TimedServerOutput";
  outputTag: string;
  seq: number;
  timestamp: string | null;
  json: Record<string, unknown>;
};

export type HydraInvalidInput = {
  tag: "InvalidInput";
  reason: string;
  input: string;
};

export type HydraRawMessage = {
  tag: "Raw";
  json: Record<string, unknown>;
};

export type HydraInboundMessage =
  | HydraGreetings
  | HydraTxValid
  | HydraTxInvalid
  | HydraServerSnapshot
  | HydraTimedServerOutput
  | HydraInvalidInput
  | HydraRawMessage;

export function seqOf(m: HydraInboundMessage): number | null {
  switch (m.tag) {
    case "TxValid":
    case "TxInvalid":
    case "Snapshot":
    case "TimedServerOutput":
      return m.seq;
    default:
      return null;
  }
}
