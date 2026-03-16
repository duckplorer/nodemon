import semver = require('semver');

interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
}

interface LogMethod {
  (msg: string): void;
}

interface Logger {
  debug: boolean;
  useColours: boolean;
  log: LogMethod;
  info: LogMethod;
  status: LogMethod;
  fail: LogMethod;
  error: LogMethod;
  detail(msg: string): void;
  required(val: boolean): void;
  _log(type: string, msg?: string): void;
}

interface Utils {
  semver: typeof semver;
  satisfies(test: string): boolean;
  version: NodeVersion;
  clone: <T>(obj: T) => T;
  merge: (source: Record<string, any>, target: Record<string, any>, result?: Record<string, any>) => Record<string, any>;
  bus: NodeJS.EventEmitter;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  isIBMi: boolean;
  isRequired: boolean;
  home: string | undefined;
  quiet(): void;
  reset(): void;
  regexpToText(t: string): string;
  stringify(exec: string, args?: string[]): string;
  log: Logger;
  debug: boolean;
  colours: boolean;
}

declare const utils: Utils;
export = utils;
