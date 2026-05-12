import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface HydraStateStore {
  loadLastSeq(): Promise<number | null>;
  saveLastSeq(seq: number): Promise<void>;
  saveSnapshotHint(json: string): Promise<void>;
  loadSnapshotHint(): Promise<string | null>;
}

export class InMemoryHydraStateStore implements HydraStateStore {
  private seq: number | null = null;
  private hint: string | null = null;

  async loadLastSeq() { return this.seq; }
  async saveLastSeq(seq: number) { this.seq = seq; }
  async saveSnapshotHint(json: string) { this.hint = json; }
  async loadSnapshotHint() { return this.hint; }
}

export class FileHydraStateStore implements HydraStateStore {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(process.cwd(), "data", "hydra-state.json");
  }

  private read(): { seq?: number; snapshotHint?: string } {
    try {
      if (!existsSync(this.filePath)) return {};
      return JSON.parse(readFileSync(this.filePath, "utf-8")) as { seq?: number; snapshotHint?: string };
    } catch {
      return {};
    }
  }

  private write(data: { seq?: number; snapshotHint?: string }) {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async loadLastSeq() { return this.read().seq ?? null; }

  async saveLastSeq(seq: number) {
    const data = this.read();
    data.seq = seq;
    this.write(data);
  }

  async saveSnapshotHint(json: string) {
    const data = this.read();
    data.snapshotHint = json;
    this.write(data);
  }

  async loadSnapshotHint() { return this.read().snapshotHint ?? null; }
}
