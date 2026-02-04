declare module "miio";
declare module "node-hue-api";
declare module "multicast-dns";

declare module "better-sqlite3" {
  export default class Database {
    constructor(path: string);
    prepare: (sql: string) => any;
    exec: (sql: string) => void;
    close: () => void;
    open: boolean;
  }
}

