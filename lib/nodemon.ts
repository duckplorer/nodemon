import debug = require('debug');
import path = require('path');
import util = require('util');

const debugLog: debug.Debugger = debug('nodemon');
const monitor: Monitor = require('./monitor');
const cli: Cli = require('./cli');
const version: VersionModule = require('./version');
const utils: Utils = require('./utils');
const bus: NodeJS.EventEmitter = utils.bus;
const help: (item?: string | boolean) => string = require('./help');
const config: NodemonConfig = require('./config');
const spawnCommand: (command: string | string[], config: NodemonConfig, eventArgs: string[]) => void = require('./spawn');
const defaults: Defaults = require('./config/defaults');

// ──────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────

/** A callable log method on the Logger instance. */
interface LogMethod {
  (msg: string): void;
}

/** The Logger instance used by utils.log. */
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

/** Node version info. */
interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
}

/** The full utilities object. */
interface Utils {
  semver: typeof import('semver');
  satisfies(test: string): boolean;
  version: NodeVersion;
  clone: <T>(obj: T) => T;
  merge: (source: Record<string, unknown>, target: Record<string, unknown>, result?: Record<string, unknown>) => Record<string, unknown>;
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

/** Exec options attached to config.options. */
interface ExecOptions {
  script: string;
  scriptPosition?: number;
  args?: string[];
  ext?: string;
  exec?: string;
  execArgs?: string[];
  nodeArgs?: string[];
  env?: Record<string, string>;
}

/** The resolved options on config.options. */
interface NodemonOptions {
  restartable?: false | string;
  colours?: boolean;
  execMap?: Record<string, string>;
  ignoreRoot?: string[];
  watch?: string[];
  ignore?: string[];
  stdin?: boolean;
  runOnChangeOnly?: boolean;
  verbose?: boolean;
  signal?: string;
  stdout?: boolean;
  watchOptions?: Record<string, unknown>;
  help?: string;
  version?: boolean;
  cwd?: string;
  dump?: boolean;
  delay?: number;
  monitor?: string[];
  spawn?: boolean;
  noUpdateNotifier?: boolean;
  legacyWatch?: boolean;
  pollingInterval?: number;
  quiet?: boolean;
  configFile?: string;
  exitCrash?: boolean;
  execOptions?: ExecOptions;
  events?: Record<string, string>;
  env?: Record<string, string>;
}

/** The raw command structure produced by config.load. */
interface RawCommand {
  executable: string;
  args: string[];
}

/** The command object attached to config after load. */
interface ConfigCommand {
  raw: RawCommand;
  string: string;
}

/** The run function exported by the monitor module (with kill/restart/options). */
interface RunFunction {
  (options: NodemonOptions): void;
  kill: (noRestart: boolean | (() => void), callback?: () => void) => void;
  restart: () => void;
  options: NodemonOptions;
}

/** The monitor module shape. */
interface Monitor {
  run: RunFunction;
  watch: () => void;
}

/** The CLI module shape. */
interface Cli {
  parse: (argv: string | string[]) => NodemonOptions;
}

/** The version module shape (a callable that returns a promise, plus pin/pinned). */
interface VersionModule {
  (callback?: (err: Error | null, version: string) => void): Promise<string>;
  pin: () => Promise<void>;
  pinned: string;
}

/** The full nodemon config singleton. */
interface NodemonConfig {
  run: boolean;
  system: {
    cwd: string;
  };
  required: boolean;
  dirs: string[];
  timeout: number;
  options: NodemonOptions;
  lastStarted: number;
  loaded: string[];
  load: (settings: NodemonOptions, ready: (config: NodemonConfig) => void) => void;
  reset: () => void;
  command: ConfigCommand;
  watchInterval: number | null;
  signal: string;
}

/** Default config values shape. */
interface Defaults {
  restartable: string;
  colours: boolean;
  execMap: Record<string, string | undefined>;
  ignoreRoot: string[];
  watch: string[];
  stdin: boolean;
  runOnChangeOnly: boolean;
  verbose: boolean;
  signal: string;
  stdout: boolean;
  watchOptions: Record<string, unknown>;
}

/** Event handler type: a function that can receive any arguments from the bus. */
type EventHandler = (...args: unknown[]) => void;

/** Map of event names to their registered handlers. */
interface EventHandlerMap {
  [event: string]: EventHandler[];
}

/** The nodemon function interface — both callable and has methods/properties. */
interface NodemonFunction {
  (settings: NodemonOptions | string): NodemonFunction | void;
  restart: () => NodemonFunction;
  addListener: (event: string, handler: EventHandler) => NodemonFunction;
  on: (event: string, handler: EventHandler) => NodemonFunction;
  once: (event: string, handler: EventHandler) => NodemonFunction;
  emit: (...args: unknown[]) => NodemonFunction;
  removeAllListeners: (event?: string) => NodemonFunction;
  reset: (done?: () => void) => void;
  config: NodemonConfig;
  stdout?: NodeJS.ReadableStream;
  stderr?: NodeJS.ReadableStream;
}

// ──────────────────────────────────────────────
// Module state
// ──────────────────────────────────────────────

var eventHandlers: EventHandlerMap = {};

// this is fairly dirty, but theoretically sound since it's part of the
// stable module API
config.required = utils.isRequired;

// ──────────────────────────────────────────────
// Core nodemon function
// ──────────────────────────────────────────────

/**
 * Main entry point for nodemon. Accepts either a settings object or a CLI-style string.
 *
 * @param settings - User-defined settings or a CLI command string.
 * @returns The nodemon function for chaining, or void if --version is requested.
 */
function nodemon(settings: NodemonOptions | string): NodemonFunction | void {
  bus.emit('boot');
  nodemonExport.reset();

  let options: NodemonOptions;

  // allow the cli string as the argument to nodemon, and allow for
  // `node nodemon -V app.js` or just `-V app.js`
  if (typeof settings === 'string') {
    settings = settings.trim();
    if (settings.indexOf('node') !== 0) {
      if (settings.indexOf('nodemon') !== 0) {
        settings = 'nodemon ' + settings;
      }
      settings = 'node ' + settings;
    }
    options = cli.parse(settings);
  } else {
    options = settings;
  }

  // set the debug flag as early as possible to get all the detailed logging
  if (options.verbose) {
    utils.debug = true;
  }

  if (options.help) {
    if (process.stdout.isTTY) {
      (process.stdout as any)._handle.setBlocking(true); // nodejs/node#6456
    }
    console.log(help(options.help));
    if (!config.required) {
      process.exit(0);
    }
  }

  if (options.version) {
    version().then(function (v: string): void {
      console.log(v);
      if (!config.required) {
        process.exit(0);
      }
    });
    return;
  }

  // nodemon tools like grunt-nodemon. This affects where
  // the script is being run from, and will affect where
  // nodemon looks for the nodemon.json files
  if (options.cwd) {
    // this is protection to make sure we haven't done the chdir already...
    // say like in cli/parse.js (which is where we do this once already!)
    if (process.cwd() !== path.resolve(config.system.cwd, options.cwd)) {
      process.chdir(options.cwd);
    }
  }

  config.load(options, function (config: NodemonConfig): void {
    if (!config.options.dump && !config.options.execOptions!.script &&
      config.options.execOptions!.exec === 'node') {
      if (!config.required) {
        console.log(help('usage'));
        process.exit();
      }
      return;
    }

    // before we print anything, update the colour setting on logging
    utils.colours = config.options.colours!;

    // always echo out the current version
    utils.log.info(version.pinned);

    const cwd: string = process.cwd();

    if (config.options.cwd) {
      utils.log.detail('process root: ' + cwd);
    }

    config.loaded.map((file: string): string => file.replace(cwd, '.')).forEach((file: string): void => {
      utils.log.detail('reading config ' + file);
    });

    if (config.options.stdin && config.options.restartable) {
      // allow nodemon to restart when the user types 'rs\n'
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (data: Buffer | string): void => {
        const str: string = data.toString().trim().toLowerCase();

        // if the keys entered match the restartable value, then restart!
        if (str === config.options.restartable) {
          bus.emit('restart');
        } else if (data.toString().charCodeAt(0) === 12) { // ctrl+l
          console.clear();
        }
      });
    } else if (config.options.stdin) {
      // so let's make sure we don't eat the key presses
      // but also, since we're wrapping, watch out for
      // special keys, like ctrl+c x 2 or '.exit' or ctrl+d or ctrl+l
      var ctrlC: boolean = false;
      var buffer: string = '';

      process.stdin.on('data', function (data: Buffer | string): void {
        data = data.toString();
        buffer += data;
        const chr: number = data.charCodeAt(0);

        // if restartable, echo back
        if (chr === 3) {
          if (ctrlC) {
            process.exit(0);
          }

          ctrlC = true;
          return;
        } else if (buffer === '.exit' || chr === 4) { // ctrl+d
          process.exit();
        } else if (chr === 13 || chr === 10) { // enter / carriage return
          buffer = '';
        } else if (chr === 12) { // ctrl+l
          console.clear();
          buffer = '';
        }
        ctrlC = false;
      });
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
    }

    if (config.options.restartable) {
      utils.log.info('to restart at any time, enter `' +
        config.options.restartable + '`');
    }

    if (!config.required) {
      const restartSignal: string = config.options.signal === 'SIGUSR2' ? 'SIGHUP' : 'SIGUSR2';
      process.on(restartSignal as NodeJS.Signals, nodemonExport.restart);
      utils.bus.on('error', (): void => {
        utils.log.fail((new Error().stack!));
      });
      utils.log.detail((config.options.restartable ? 'or ' : '') + 'send ' +
        restartSignal + ' to ' + process.pid + ' to restart');
    }

    const ignoring: string = config.options.monitor!.map(function (rule: string): string | false {
      if (rule.slice(0, 1) !== '!') {
        return false;
      }

      rule = rule.slice(1);

      // don't notify of default ignores
      if (defaults.ignoreRoot.indexOf(rule) !== -1) {
        return false;
      }

      if (rule.startsWith(cwd)) {
        return rule.replace(cwd, '.');
      }

      return rule;
    }).filter(Boolean).join(' ');
    if (ignoring) utils.log.detail('ignoring: ' + ignoring);

    utils.log.info('watching path(s): ' + config.options.monitor!.map(function (rule: string): string | false {
      if (rule.slice(0, 1) !== '!') {
        try {
          rule = path.relative(process.cwd(), rule);
        } catch (e) { /* intentionally empty */ }

        return rule;
      }

      return false;
    }).filter(Boolean).join(' '));

    utils.log.info('watching extensions: ' + (config.options.execOptions!.ext || '(all)'));

    if (config.options.dump) {
      utils.log._log('log', '--------------');
      utils.log._log('log', 'node: ' + process.version);
      utils.log._log('log', 'nodemon: ' + version.pinned);
      utils.log._log('log', 'command: ' + process.argv.join(' '));
      utils.log._log('log', 'cwd: ' + cwd);
      utils.log._log('log', ['OS:', process.platform, process.arch].join(' '));
      utils.log._log('log', '--------------');
      utils.log._log('log', util.inspect(config, { depth: null }));
      utils.log._log('log', '--------------');
      if (!config.required) {
        process.exit();
      }

      return;
    }

    config.run = true;

    if (config.options.stdout === false) {
      nodemonExport.on('start', function (): void {
        nodemonExport.stdout = (bus as any).stdout;
        nodemonExport.stderr = (bus as any).stderr;

        bus.emit('readable');
      });
    }

    if (config.options.events && Object.keys(config.options.events).length) {
      Object.keys(config.options.events).forEach(function (key: string): void {
        utils.log.detail('bind ' + key + ' -> `' +
          config.options.events![key] + '`');
        nodemonExport.on(key, function (): void {
          if (config.options && config.options.events) {
            spawnCommand(config.options.events[key], config,
              [].slice.apply(arguments));
          }
        });
      });
    }

    monitor.run(config.options);

  });

  return nodemonExport;
}

// ──────────────────────────────────────────────
// Nodemon methods
// ──────────────────────────────────────────────

/**
 * The exported nodemon object, combining the main function with event-handling methods.
 */
const nodemonExport: NodemonFunction = Object.assign(nodemon, {
  restart: function (): NodemonFunction {
    utils.log.status('restarting child process');
    bus.emit('restart');
    return nodemonExport;
  },

  addListener: function (event: string, handler: EventHandler): NodemonFunction {
    if (!eventHandlers[event]) { eventHandlers[event] = []; }
    eventHandlers[event].push(handler);
    bus.on(event, handler);
    return nodemonExport;
  },

  on: function (event: string, handler: EventHandler): NodemonFunction {
    if (!eventHandlers[event]) { eventHandlers[event] = []; }
    eventHandlers[event].push(handler);
    bus.on(event, handler);
    return nodemonExport;
  },

  once: function (event: string, handler: EventHandler): NodemonFunction {
    if (!eventHandlers[event]) { eventHandlers[event] = []; }
    eventHandlers[event].push(handler);
    bus.once(event, function (this: NodeJS.EventEmitter): void {
      debugLog('bus.once(%s)', event);
      eventHandlers[event].splice(eventHandlers[event].indexOf(handler), 1);
      handler.apply(this, arguments as unknown as unknown[]);
    });
    return nodemonExport;
  },

  emit: function (...args: unknown[]): NodemonFunction {
    bus.emit.apply(bus, args as [string | symbol, ...unknown[]]);
    return nodemonExport;
  },

  removeAllListeners: function (event?: string): NodemonFunction {
    // unbind only the `nodemon.on` event handlers
    Object.keys(eventHandlers).filter(function (e: string): boolean {
      return event ? e === event : true;
    }).forEach(function (event: string): void {
      eventHandlers[event].forEach(function (handler: EventHandler): void {
        bus.removeListener(event, handler);
        eventHandlers[event].splice(eventHandlers[event].indexOf(handler), 1);
      });
    });

    return nodemonExport;
  },

  reset: function (done?: () => void): void {
    bus.emit('reset', done);
  },

  config: config,
}) as NodemonFunction;

// ──────────────────────────────────────────────
// Bus event handlers
// ──────────────────────────────────────────────

bus.on('reset', function (done?: () => void): void {
  debugLog('reset');
  nodemonExport.removeAllListeners();
  monitor.run.kill(true, function (): void {
    utils.reset();
    config.reset();
    config.run = false;
    if (done) {
      done();
    }
  });
});

// expose the full config
nodemonExport.config = config;

export = nodemonExport;
