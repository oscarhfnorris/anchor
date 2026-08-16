/**
 * An in-memory `NfcReader` for tests, the night simulator, and running on a simulator.
 *
 * The iOS simulator has no NFC radio, so without this the entire Phase 1 flow — register a tag,
 * scan it, clear the alarm — could not be exercised at all before the paid account arrives. That is
 * a large part of why the seam exists.
 *
 * It proves the logic around the reader, never the reader. Whether Core NFC yields a UID on a real
 * device is build step 4's job, and no fake can answer it.
 */
import type { NfcReader, ScanFailure, ScanResult } from './types';

export class FakeNfcReader implements NfcReader {
  private queue: ScanResult[] = [];
  private available: boolean;
  readonly calls: string[] = [];

  constructor(options: { available?: boolean } = {}) {
    this.available = options.available ?? true;
  }

  /** Queue what the next scan (or scans) will return, in order. */
  willReturn(...results: ScanResult[]): this {
    this.queue.push(...results);
    return this;
  }

  /** Convenience: the next scan reads this tag. */
  willRead(uid: string): this {
    return this.willReturn({ ok: true, uid });
  }

  /** Convenience: the next scan fails this way. */
  willFail(reason: ScanFailure): this {
    return this.willReturn({ ok: false, reason });
  }

  async isAvailable(): Promise<boolean> {
    this.calls.push('isAvailable');
    return this.available;
  }

  async scan(): Promise<ScanResult> {
    this.calls.push('scan');
    if (!this.available) return { ok: false, reason: 'unavailable' };
    // An empty queue means "a tag was presented and yielded nothing", which is the honest default:
    // it is the failure a test forgets to configure, and it must never look like a success.
    return this.queue.shift() ?? { ok: false, reason: 'unreadable' };
  }

  async cancel(): Promise<void> {
    this.calls.push('cancel');
  }
}
