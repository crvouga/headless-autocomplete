export type ItemsStore<T> = {
  getById: (id: string) => Promise<T | undefined>;
  getIndex: (id: string) => Promise<number>;
  search: (searchQuery: string) => Generator<T>;
};
