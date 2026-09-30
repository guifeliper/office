/**
 * Refcounted sheet cache. A key stays alive while at least one holder claims it.
 * `pump` builds one missing sheet per call so a crowd does not compose in one frame.
 */
export class DollCache<T> {
  private readonly entries = new Map<string, { refs: number; value: T | null }>();
  private queue: string[] = [];

  claim(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      entry.refs += 1;
      return;
    }
    this.entries.set(key, { refs: 1, value: null });
    this.queue.push(key);
  }

  release(key: string, destroy: (value: T) => void): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs > 0) return;
    if (entry.value) destroy(entry.value);
    this.entries.delete(key);
    this.queue = this.queue.filter((item) => item !== key);
  }

  peek(key: string): T | null {
    return this.entries.get(key)?.value ?? null;
  }

  /** Builds at most one queued sheet. Returns false when the queue is idle. */
  pump(create: (key: string) => T): boolean {
    while (this.queue.length > 0) {
      const key = this.queue.shift();
      if (!key) return false;
      const entry = this.entries.get(key);
      if (!entry || entry.value) continue;
      entry.value = create(key);
      return true;
    }
    return false;
  }

  destroyAll(destroy: (value: T) => void): void {
    for (const entry of this.entries.values()) {
      if (entry.value) destroy(entry.value);
    }
    this.entries.clear();
    this.queue = [];
  }

  get size(): number {
    return this.entries.size;
  }
}
