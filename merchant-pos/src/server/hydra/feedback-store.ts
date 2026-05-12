import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

export interface FeedbackEntry {
  id: string;
  merchant_id?: string;
  rating: number;
  comments: string;
  timestamp: string;
}

const FEEDBACK_PATH = join(process.cwd(), "data", "hydra-feedback.json");

function load(): FeedbackEntry[] {
  try {
    if (existsSync(FEEDBACK_PATH)) {
      return JSON.parse(readFileSync(FEEDBACK_PATH, "utf-8")) as FeedbackEntry[];
    }
  } catch { /* ignore */ }
  return [];
}

function save(entries: FeedbackEntry[]) {
  const dir = dirname(FEEDBACK_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(FEEDBACK_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

export function addFeedback(rating: number, comments: string, merchantId?: string): FeedbackEntry {
  const entries = load();
  const entry: FeedbackEntry = {
    id: randomUUID(),
    merchant_id: merchantId,
    rating,
    comments,
    timestamp: new Date().toISOString(),
  };
  entries.push(entry);
  save(entries);
  return entry;
}

export function listFeedback(): FeedbackEntry[] {
  return load();
}
