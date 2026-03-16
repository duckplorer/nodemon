import { EventEmitter } from 'events';

interface LogMethods {
  info(msg: string): void;
  status(msg: string): void;
  detail(msg: string): void;
  fail(msg: string): void;
  error(err: string | Error): void;
  log(msg: string): void;
  debug: boolean;
  useColours: boolean;
  _log(type: string, msg: string): void;
  required(val: boolean): void;
  [key: string]: ((...args: unknown[]) => void) | boolean;
}

interface Utils {
  semver: typeof import('semver');
  satisfies(test: string): boolean;
  version: { major: number; minor: number; patch: number };
  clone<T>(obj: T): T;
  merge(src: object, target: object, result?: object): object;
  bus: EventEmitter;
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
  log: LogMethods;
  debug: boolean;
  colours: boolean;
}

declare const utils: Utils;
export = utils;
