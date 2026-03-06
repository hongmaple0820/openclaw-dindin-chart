/**
 * Module type declarations for CommonJS imports
 */

declare module 'axios' {
  interface AxiosResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  }
  
  interface AxiosInstance {
    get<T = unknown>(url: string, config?: object): Promise<AxiosResponse<T>>;
    post<T = unknown>(url: string, data?: unknown, config?: object): Promise<AxiosResponse<T>>;
    put<T = unknown>(url: string, data?: unknown, config?: object): Promise<AxiosResponse<T>>;
    delete<T = unknown>(url: string, config?: object): Promise<AxiosResponse<T>>;
  }
  
  const axios: AxiosInstance & {
    create(config?: object): AxiosInstance;
  };
  export = axios;
}

declare module 'better-sqlite3' {
  interface Statement<T = unknown> {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    get(...params: unknown[]): T | undefined;
    all(...params: unknown[]): T[];
  }
  
  interface Database {
    exec(sql: string): void;
    prepare<T = unknown>(sql: string): Statement<T>;
    transaction(fn: () => void): () => void;
    close(): void;
  }
  
  function Database(filename: string): Database;
  export = Database;
}

declare module 'uuid' {
  export function v4(): string;
  export function v4(options: object, buffer: Buffer, offset: number): Buffer;
}

declare module 'events' {
  class EventEmitter {
    on(event: string, listener: (...args: unknown[]) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;
    emit(event: string, ...args: unknown[]): boolean;
    removeListener(event: string, listener: (...args: unknown[]) => void): this;
    removeAllListeners(event?: string): this;
  }
  export = EventEmitter;
}

declare module 'crypto' {
  interface Hash {
    update(data: string | Buffer): Hash;
    digest(encoding: string): string;
  }
  
  interface RandomBytes {
    toString(encoding: string): string;
  }
  
  export function createHash(algorithm: string): Hash;
  export function randomBytes(size: number): Buffer;
  export function randomBytes(size: number, callback: (err: Error | null, buf: Buffer) => void): void;
}