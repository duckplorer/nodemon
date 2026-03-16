import path = require('path');
import semver = require('semver');
import os = require('os');

/** Semantic version components of the running Node.js process. */
interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
}

/** A callable log method on the Logger instance. */
interface LogMethod {
  (msg: string): void;
}

/** The Logger instance returned by the log module factory. */
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

/** The full utilities object exported by this module. */
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

var noop: () => void = function (): void { };
var version: string[] = process.versions.node.split('.') || [null as unknown as string, null as unknown as string, null as unknown as string];

var utils: Utils = (module.exports = {
  semver: semver,
  satisfies: function (test: string): boolean {
    return semver.satisfies(process.versions.node, test);
  },
  version: {
    major: parseInt(version[0] || '0', 10),
    minor: parseInt(version[1] || '0', 10),
    patch: parseInt(version[2] || '0', 10),
  },
  clone: require('./clone'),
  merge: require('./merge'),
  bus: require('./bus'),
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  isIBMi: os.type() === 'OS400',
  isRequired: (function (): boolean {
    var p: NodeModule | null | undefined = module.parent;
    while (p) {
      // in electron.js engine it happens
      if (!p.filename) {
        return true;
      }
      if (p.filename.indexOf('bin' + path.sep + 'nodemon.js') !== -1) {
        return false;
      }
      p = p.parent;
    }

    return true;
  })(),
  home: process.env.HOME || process.env.HOMEPATH,
  quiet: function (this: Utils): void {
    // nukes the logging
    if (!this.debug) {
      for (var method in utils.log) {
        if (typeof (utils.log as any)[method] === 'function') {
          (utils.log as any)[method] = noop;
        }
      }
    }
  },
  reset: function (this: Utils): void {
    if (!this.debug) {
      for (var method in utils.log) {
        if (typeof (utils.log as any)[method] === 'function') {
          delete (utils.log as any)[method];
        }
      }
    }
    this.debug = false;
  },
  regexpToText: function (t: string): string {
    return t
      .replace(/\.\*\\./g, '*.')
      .replace(/\\{2}/g, '^^')
      .replace(/\\/g, '')
      .replace(/\^\^/g, '\\');
  },
  stringify: function (exec: string, args?: string[]): string {
    // serializes an executable string and array of arguments into a string
    args = args || [];

    return [exec]
      .concat(
      args.map(function (arg: string): string {
        // if an argument contains a space, we want to show it with quotes
        // around it to indicate that it is a single argument
        if (arg.length > 0 && arg.indexOf(' ') === -1) {
          return arg;
        }
        // this should correctly escape nested quotes
        return JSON.stringify(arg);
      })
      )
      .join(' ')
      .trim();
  },
} as Utils);

utils.log = require('./log')(utils.isRequired);

Object.defineProperty(utils, 'debug', {
  set: function (value: boolean): void {
    this.log.debug = value;
  },
  get: function (): boolean {
    return this.log.debug;
  },
});

Object.defineProperty(utils, 'colours', {
  set: function (value: boolean): void {
    this.log.useColours = value;
  },
  get: function (): boolean {
    return this.log.useColours;
  },
});

export = utils;
