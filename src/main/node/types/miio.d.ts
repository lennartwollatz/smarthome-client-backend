declare module "miio" {
  interface BrowseOptions {
    cacheTime?: number;
  }

  interface Browser extends NodeJS.EventEmitter {
    on(event: "available", listener: (device: Record<string, unknown>) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "unavailable", listener: () => void): this;
  }

  interface MiioApi {
    browse(options?: BrowseOptions): Browser;
    device(options: { address: string; port?: number; token?: string }): Promise<unknown>;
    devices(options?: unknown): Promise<unknown[]>;
    models: unknown;
    infoFromHostname(hostname: string): unknown;
  }

  const miio: MiioApi;
  export = miio;
}
