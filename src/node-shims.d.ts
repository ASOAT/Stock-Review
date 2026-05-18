declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  exitCode?: number;
};

declare const Buffer: {
  byteLength(value: string): number;
};

declare module "node:http" {
  export const createServer: any;
}

declare module "node:fs" {
  export const existsSync: any;
}

declare module "node:fs/promises" {
  export const access: any;
  export const appendFile: any;
  export const mkdir: any;
  export const readFile: any;
}

declare module "node:path" {
  export const extname: any;
  export const join: any;
  export const resolve: any;
}

declare module "node:child_process" {
  export const spawn: any;
}

declare module "node:crypto" {
  export const randomUUID: any;
}
