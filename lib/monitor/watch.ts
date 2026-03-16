import debugModule = require('debug');
import chokidar = require('chokidar');
import undefsafe = require('undefsafe');
import config = require('../config');
import path = require('path');
import utils = require('../utils');
import match = require('./match');

const debug: debugModule.Debugger = debugModule('nodemon:watch');
const debugRoot: debugModule.Debugger = debugModule('nodemon');

var bus: NodeJS.EventEmitter = utils.bus;
var watchers: chokidar.FSWatcher[] = [];
var debouncedBus: ((...args: unknown[]) => void) | undefined;

/** The result returned by the match function. */
interface MatchResult {
  result: string[];
  ignored?: number;
  watched?: number;
  total: number;
}

/** Watch options passed to chokidar. */
interface WatchOptions {
  ignorePermissionErrors: boolean;
  ignored: (string | RegExp)[];
  persistent: boolean;
  usePolling: boolean;
  interval?: number;
  disableGlobbing?: boolean;
  useFsEvents?: boolean;
}

/** Extended FSWatcher with a ready flag. */
interface ExtendedWatcher extends chokidar.FSWatcher {
  ready: boolean;
}

bus.on('reset', resetWatchers);

function resetWatchers(): void {
  debugRoot('resetting watchers');
  watchers.forEach(function (watcher: chokidar.FSWatcher): void {
    watcher.close();
  });
  watchers = [];
}

function watch(): Promise<string[]> | undefined {
  if (watchers.length) {
    debug('early exit on watch, still watching (%s)', watchers.length);
    return;
  }

  var dirs: string[] = [].slice.call(config.dirs);

  debugRoot('start watch on: %s', dirs.join(', '));
  const rootIgnored: string[] = config.options.ignore;
  debugRoot('ignored', rootIgnored);

  var watchedFiles: string[] = [];

  const promise: Promise<number> = new Promise(function (resolve: (total: number) => void): void {
    const dotFilePattern: RegExp = /[/\\]\./;
    var ignored: (string | RegExp)[] = match.rulesToMonitor(
      [], // not needed
      Array.from(rootIgnored),
      config as unknown as { dirs: string[]; [key: string]: unknown }
    ).map((pattern: string) => pattern.slice(1));

    const addDotFile: string[] = dirs.filter((dir: string) => dir.match(dotFilePattern));

    // don't ignore dotfiles if explicitly watched.
    if (addDotFile.length === 0) {
      ignored.push(dotFilePattern);
    }

    var watchOptions: WatchOptions = {
      ignorePermissionErrors: true,
      ignored: ignored,
      persistent: true,
      usePolling: config.options.legacyWatch || false,
      interval: config.options.pollingInterval,
      // note to future developer: I've gone back and forth on adding `cwd`
      // to the props and in some cases it fixes bugs but typically it causes
      // bugs elsewhere (since nodemon is used is so many ways). the final
      // decision is to *not* use it at all and work around it
      // cwd: ...
    };

    if (utils.isWindows) {
      watchOptions.disableGlobbing = true;
    }

    if (utils.isIBMi) {
      watchOptions.usePolling = true;
    }

    if (process.env.TEST) {
      watchOptions.useFsEvents = false;
    }

    var watcher: ExtendedWatcher = chokidar.watch(
      dirs,
      Object.assign({}, watchOptions, config.options.watchOptions || {})
    ) as ExtendedWatcher;

    watcher.ready = false;

    var total: number = 0;

    watcher.on('change', filterAndRestart);
    watcher.on('unlink', filterAndRestart);
    watcher.on('add', function (file: string): void {
      if (watcher.ready) {
        return filterAndRestart(file);
      }

      watchedFiles.push(file);
      bus.emit('watching', file);
      debug('chokidar watching: %s', file);
    });
    watcher.on('ready', function (): void {
      watchedFiles = Array.from(new Set(watchedFiles)); // ensure no dupes
      total = watchedFiles.length;
      watcher.ready = true;
      resolve(total);
      debugRoot('watch is complete');
    });

    watcher.on('error', function (error: NodeJS.ErrnoException): void {
      if (error.code === 'EINVAL') {
        utils.log.error(
          'Internal watch failed. Likely cause: too many ' +
          'files being watched (perhaps from the root of a drive?\n' +
          'See https://github.com/paulmillr/chokidar/issues/229 for details'
        );
      } else {
        utils.log.error('Internal watch failed: ' + error.message);
        process.exit(1);
      }
    });

    watchers.push(watcher);
  });

  return promise.catch((e: Error) => {
    // this is a core error and it should break nodemon - so I have to break
    // out of a promise using the setTimeout
    setTimeout(() => {
      throw e;
    });
  }).then(function (): string[] {
    utils.log.detail(`watching ${watchedFiles.length} file${
      watchedFiles.length === 1 ? '' : 's'}`);
    return watchedFiles;
  });
}

function filterAndRestart(this: { options?: { cwd?: string } } | void, files: string | string[]): void {
  if (!Array.isArray(files)) {
    files = [files];
  }

  if (files.length) {
    var cwd: string = process.cwd();
    if (this && (this as { options?: { cwd?: string } }).options && (this as { options: { cwd?: string } }).options.cwd) {
      cwd = (this as { options: { cwd: string } }).options.cwd;
    }

    utils.log.detail(
      'files triggering change check: ' +
      files
        .map((file: string): string => {
          const res: string = path.relative(cwd, file);
          return res;
        })
        .join(', ')
    );

    // make sure the path is right and drop an empty
    // filenames (sometimes on windows)
    files = files.filter(Boolean).map((file: string): string => {
      return path.relative(process.cwd(), path.relative(cwd, file));
    });

    if (utils.isWindows) {
      // ensure the drive letter is in uppercase (c:\foo -> C:\foo)
      files = files.map((f: string): string => {
        if (f.indexOf(':') === -1) { return f; }
        return f[0].toUpperCase() + f.slice(1);
      });
    }


    debug('filterAndRestart on', files);

    var matched: MatchResult = match(
      files,
      config.options.monitor,
      undefsafe(config, 'options.execOptions.ext')
    );

    debug('matched?', JSON.stringify(matched));

    // if there's no matches, then test to see if the changed file is the
    // running script, if so, let's allow a restart
    if (config.options.execOptions && config.options.execOptions.script) {
      const script: string = path.resolve(config.options.execOptions.script);
      if (matched.result.length === 0 && script) {
        const length: number = script.length;
        files.find((file: string): boolean | undefined => {
          if (file.substr(-length, length) === script) {
            matched = {
              result: [file],
              total: 1,
            };
            return true;
          }
          return undefined;
        });
      }
    }

    utils.log.detail(
      'changes after filters (before/after): ' +
      [files.length, matched.result.length].join('/')
    );

    // reset the last check so we're only looking at recently modified files
    config.lastStarted = Date.now();

    if (matched.result.length) {
      if (config.options.delay && config.options.delay > 0) {
        utils.log.detail('delaying restart for ' + config.options.delay + 'ms');
        if (debouncedBus === undefined) {
          debouncedBus = debounce(restartBus as (...args: unknown[]) => void, config.options.delay);
        }
        debouncedBus(matched);
      } else {
        return restartBus(matched);
      }
    }
  }
}

function restartBus(matched: MatchResult): void {
  utils.log.status('restarting due to changes...');
  matched.result.map((file: string): void => {
    utils.log.detail(path.relative(process.cwd(), file));
  });

  if (config.options.verbose) {
    utils.log._log('');
  }

  bus.emit('restart', matched.result);
}

function debounce(fn: (...args: unknown[]) => void, delay: number): (...args: unknown[]) => void {
  var timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown): void {
    const context: unknown = this;
    const args: IArguments = arguments;
    clearTimeout(timer!);
    timer = setTimeout(() => fn.apply(context, Array.from(args as ArrayLike<unknown>)), delay);
  };
}

export = { watch, resetWatchers };
