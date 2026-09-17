import type { Hex } from "viem";
import type { ContinuityTaskEvent, ContinuityTaskRecord, ContinuityTaskState } from "./types.js";

const transitions: Record<ContinuityTaskState, ContinuityTaskState[]> = {
  QUEUED: ["PRIMARY_SELECTED"],
  PRIMARY_SELECTED: ["ACCEPTED", "PRIMARY_BREACH", "FROZEN"],
  ACCEPTED: [],
  PRIMARY_BREACH: ["BACKUP_SELECTED", "FROZEN"],
  BACKUP_SELECTED: ["RECOVERED", "FROZEN"],
  RECOVERED: [],
  FROZEN: [],
};

export interface ContinuityTaskStore {
  create(record: ContinuityTaskRecord): Promise<void>;
  transition(taskId: Hex, event: ContinuityTaskEvent): Promise<ContinuityTaskRecord>;
  get(taskId: Hex): Promise<ContinuityTaskRecord | undefined>;
  list(): Promise<ContinuityTaskRecord[]>;
}

function clone(record: ContinuityTaskRecord): ContinuityTaskRecord {
  return structuredClone(record);
}

export class MemoryContinuityTaskStore implements ContinuityTaskStore {
  private readonly records = new Map<Hex, ContinuityTaskRecord>();

  async create(record: ContinuityTaskRecord): Promise<void> {
    if (this.records.has(record.taskId)) throw new Error(`Task ${record.taskId} already exists.`);
    if (record.state !== "QUEUED" || record.events.length !== 1 || record.events[0]?.state !== "QUEUED") {
      throw new Error("A continuity task must begin with exactly one QUEUED event.");
    }
    this.records.set(record.taskId, clone(record));
  }

  async transition(taskId: Hex, event: ContinuityTaskEvent): Promise<ContinuityTaskRecord> {
    const current = this.records.get(taskId);
    if (!current) throw new Error(`Unknown continuity task ${taskId}.`);
    if (!transitions[current.state].includes(event.state)) {
      throw new Error(`Invalid continuity transition ${current.state} → ${event.state}.`);
    }
    if (event.at < current.updatedAt) throw new Error("Continuity events must be monotonic.");
    const next: ContinuityTaskRecord = {
      ...current,
      state: event.state,
      updatedAt: event.at,
      primaryProviderId: event.state === "PRIMARY_SELECTED" ? event.providerId : current.primaryProviderId,
      backupProviderId: event.state === "BACKUP_SELECTED" ? event.providerId : current.backupProviderId,
      events: [...current.events, event],
    };
    this.records.set(taskId, next);
    return clone(next);
  }

  async get(taskId: Hex): Promise<ContinuityTaskRecord | undefined> {
    const record = this.records.get(taskId);
    return record ? clone(record) : undefined;
  }

  async list(): Promise<ContinuityTaskRecord[]> {
    return [...this.records.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(clone);
  }
}
