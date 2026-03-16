declare module 'undefsafe' {
  function undefsafe(obj: unknown, path: string, value?: unknown): any;
  export = undefsafe;
}
