/**
 * Manages the internal config of nodemon, checking for the state of support
 * with fs.watch, how nodemon can watch files (using find or fs methods).
 *
 * This is *not* the user's config.
 */
import debug = require('debug');
import load = require('./load');
import rules = require('../rules');
import utils = require('../utils');
import version = require('../version');
import command = require('./command');
import match = require('../monitor/match');

import type { NodemonSettings, NodemonConfig, ExecOptions } from './types';

const log = debug('nodemon');
const pinVersion = version.pin;
const rulesToMonitor = match.rulesToMonitor;
const bus = utils.bus;

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

function reset(): void {
  rules.reset();

  config.dirs = [];
  config.options = { ignore: [], watch: [], monitor: [] };
  config.lastStarted = 0;
  config.loaded = [];
}

// ---------------------------------------------------------------------------
// config singleton
// ---------------------------------------------------------------------------

/**
 * The mutable singleton that holds all resolved configuration state for the
 * running nodemon process.
 */
interface Config extends NodemonConfig {
  load(
    settings: NodemonSettings,
    ready: (config: Config) => void,
  ): void;
  reset(): void;
}

const config: Config = {
  run: false,
  system: {
    cwd: process.cwd(),
  },
  required: false,
  dirs: [],
  timeout: 1000,
  options: {},
  loaded: [],

  /**
   * Take user defined settings, then detect the local machine capability, then
   * look for local and global nodemon.json files and merge together the final
   * settings with the config for nodemon.
   *
   * @param settings  user defined settings for nodemon (typically on the cli)
   * @param ready     callback fired once the config is loaded
   */
  load(settings: NodemonSettings, ready: (config: Config) => void): void {
    reset();
    const self = this as Config;
    load(settings, self.options, self, function (options: NodemonSettings) {
      self.options = options;

      if ((options.watch as string[]).length === 0) {
        // this is to catch when the watch is left blank
        (options.watch as string[]).push('*.*');
      }

      if (options['watch_interval']) {
        options.watchInterval = options['watch_interval'] as number;
      }

      self.watchInterval = options.watchInterval || null;
      if (options.signal) {
        self.signal = options.signal;
      }

      const cmd = command({ execOptions: options.execOptions as ExecOptions });
      self.command = {
        raw: cmd,
        string: utils.stringify(cmd.executable, cmd.args),
      };

      // now run automatic checks on system adding to the config object
      options.monitor = rulesToMonitor(
        options.watch as string[],
        options.ignore as string[],
        self as unknown as { dirs: string[]; [key: string]: unknown },
      );

      const cwd: string = process.cwd();
      log('config: dirs', self.dirs);
      if (self.dirs.length === 0) {
        self.dirs.unshift(cwd);
      }

      bus.emit('config:update', self);
      pinVersion()
        .then(function () {
          ready(self);
        })
        .catch((e: Error) => {
          // this doesn't help testing, but does give exposure on syntax errors
          console.error(e.stack);
          setTimeout(() => {
            throw e;
          }, 0);
        });
    });
  },

  reset,
};

export = config;
