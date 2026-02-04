export interface Repository<T> {
  save(id: string, object: T): T;
  findById(id: string): T | null;
  findAll(): T[];
  deleteById(id: string): boolean;
  existsById(id: string): boolean;
  count(): number;
}

