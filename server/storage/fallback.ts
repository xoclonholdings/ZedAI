class FallbackStorage {
  private store_: Map<string, any> = new Map();

  async store(key: string, value: any): Promise<void> {
    this.store_.set(key, value);
  }

  async retrieve(key: string): Promise<any> {
    return this.store_.get(key);
  }

  async delete(key: string): Promise<void> {
    this.store_.delete(key);
  }

  async clear(): Promise<void> {
    this.store_.clear();
  }

  size(): number {
    return this.store_.size;
  }
}

export const fallbackStorage = new FallbackStorage();
