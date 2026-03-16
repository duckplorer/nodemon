import path = require('path');
import semver = require('semver');
import os = require('os');
import clone = require('./clone');
import merge = require('./merge');
import bus = require('./bus');
import Logger = require('./log');

const noop = function (): void {};

const version: string[] = process.versions.node.split('.') || [null as unknown as string, null as unknown as string, null as unknown as string];

/** Represents the parsed Node.js version */
interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
}

/** Log method names that can be replaced with noop or restored */
type LogMethodName = 'log' | 'info' | 'status' | 'detail' | 'fail' | 'error' | '_log';

/** The Logger instance type returned by the Logger constructor */
interface ILogger {
  log(text: string): void;
  info(text: string): void;
  status(text: string): void;
  detail(text: string): void;
  fail(text: string): void;
  error(text: string): void;
  required(val: boolean): void;
  _log(type: string, msg?: string): void;
  debug: boolean;
  useColours: boolean;
  [key: string]: unknown;
}

/** The main utils object interface */
interface Utils {
  semver: typeof semver;
  satisfies(test: string): boolean;
  version: NodeVersion;
  clone: typeof clone;
  merge: typeof merge;
  bus: typeof bus;
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
  log: ILogger;
  debug: boolean;
  colours: boolean;
}

const utils: Utils = {
  semver: semver,
  satisfies: (test: string): boolean => semver.satisfies(process.versions.node, test),
  version: {
    major: parseInt(version[0] || '0', 10),
    minor: parseInt(version[1] || '0', 10),
    patch: parseInt(version[2] || '0', 10),
  },
  clone: clone,
  merge: merge,
  bus: bus,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  isIBMi: os.type() === 'OS400',
  isRequired: (function (): boolean {
    var p = module.parent;
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
      const log = utils.log as ILogger;
      for (const method in log) {
        if (typeof log[method] === 'function') {
          (log as Record<string, unknown>)[method] = noop;
        }
      }
    }
  },
  reset: function (this: Utils): void {
    if (!this.debug) {
      const log = utils.log as ILogger;
      for (const method in log) {
        if (typeof log[method] === 'function') {
          delete (log as Record<string, unknown>)[method];
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
} as Utils;

utils.log = Logger(utils.isRequired) as unknown as ILogger;

Object.defineProperty(utils, 'debug', {
  set: function (this: Utils, value: boolean): void {
    this.log.debug = value;
  },
  get: function (this: Utils): boolean {
    return this.log.debug;
  },
});

Object.defineProperty(utils, 'colours', {
  set: function (this: Utils, value: boolean): void {
    this.log.useColours = value;
  },
  get: function (this: Utils): boolean {
    return this.log.useColours;
  },
});

export = utils;
