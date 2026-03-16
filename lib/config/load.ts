import debug = require('debug');
import fs = require('fs');
import path = require('path');
import utils = require('../utils');
import rules = require('../rules');
import exec = require('./exec');
import defaults = require('./defaults');
import type { NodemonSettings, NodemonConfig, ExecOptions } from './types';

const log = debug('nodemon');

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

const existsSync: (p: string) => boolean = fs.existsSync;

function findAppScript(): string | undefined {
  // nodemon has been run alone, so try to read the package file
  // or try to read the index.js file
  const pkgPath = path.join(process.cwd(), 'package.json');
  let pkg: { main?: string } | false = false;

  if (existsSync(pkgPath)) {
    try {
      pkg = require(pkgPath);
    } catch {
      pkg = false;
    }
  }

  if ((!pkg || pkg.main == undefined) && existsSync('./index.js')) {
    return 'index.js';
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// load – main entry point
// ---------------------------------------------------------------------------

/**
 * Load the nodemon config, first reading the global root/nodemon.json, then
 * the local nodemon.json to the exec and then overwriting using any user
 * specified settings (i.e. from the cli)
 *
 * @param settings  user defined settings
 * @param options   global options
 * @param config    the config object to be updated
 * @param callback  that receives complete config
 */
function load(
  settings: NodemonSettings,
  options: NodemonSettings,
  config: NodemonConfig,
  callback: (options: NodemonSettings) => void,
): void {
  config.loaded = [];
  // first load the root nodemon.json
  loadFile(options, config, utils.home, function (options: NodemonSettings) {
    // then load the user's local configuration file
    if (settings.configFile) {
      options.configFile = path.resolve(settings.configFile);
    }
    loadFile(options, config, process.cwd(), function (options: NodemonSettings) {
      // Then merge over with the user settings (parsed from the cli).
      // Note that merge protects and favours existing values over new values,
      // and thus command line arguments get priority
      options = utils.merge(settings, options) as NodemonSettings;

      // legacy support
      if (!Array.isArray(options.ignore)) {
        options.ignore = [options.ignore as string];
      }

      if (!options.ignoreRoot) {
        options.ignoreRoot = defaults.ignoreRoot;
      }

      // blend the user ignore and the default ignore together
      if (options.ignoreRoot && options.ignore) {
        if (!Array.isArray(options.ignoreRoot)) {
          options.ignoreRoot = [options.ignoreRoot as string];
        }
        options.ignore = (options.ignoreRoot as string[]).concat(options.ignore as string[]);
      } else {
        options.ignore = (defaults.ignore || []).concat(options.ignore as string[]);
      }

      // add in any missing defaults
      options = utils.merge(options, defaults as unknown as Record<string, unknown>) as NodemonSettings;

      if (!options.script && !options.exec) {
        const found = findAppScript();
        if (found) {
          if (!options.args) {
            options.args = [];
          }
          // if the script is found as a result of not being on the command
          // line, then we move any of the pre double-dash args in execArgs
          const n: number =
            options.scriptPosition === null
              ? options.args.length
              : (options.scriptPosition as number);

          options.execArgs = (options.execArgs || []).concat(
            options.args.splice(0, n),
          );
          options.scriptPosition = null;

          options.script = found;
        }
      }

      mutateExecOptions(options);

      if (options.quiet) {
        utils.quiet();
      }

      if (options.verbose) {
        utils.debug = true;
      }

      // simplify the ready callback to be called after the rules are normalised
      // from strings to regexp through the rules lib. Note that this gets
      // created *after* options is overwritten twice in the lines above.
      const ready = function (opts: NodemonSettings): void {
        normaliseRules(opts, callback);
      };

      ready(options);
    });
  });
}

// ---------------------------------------------------------------------------
// normaliseRules
// ---------------------------------------------------------------------------

function normaliseRules(
  options: NodemonSettings,
  ready: (options: NodemonSettings) => void,
): void {
  // convert ignore and watch options to rules/regexp
  rules.watch.add(options.watch as string[]);
  rules.ignore.add(options.ignore as string[]);

  // normalise the watch and ignore arrays
  options.watch = options.watch === false ? false : rules.rules.watch as unknown as string[];
  options.ignore = rules.rules.ignore as unknown as string[];

  ready(options);
}

// ---------------------------------------------------------------------------
// loadFile
// ---------------------------------------------------------------------------

/**
 * Looks for a config in the current working directory, and a config in the
 * user's home directory, merging the two together, giving priority to local
 * config. This can then be overwritten later by command line arguments
 *
 * @param options  current accumulated options
 * @param config   the config singleton
 * @param dir      directory to search for nodemon.json
 * @param ready    callback to pass loaded settings to
 */
function loadFile(
  options: NodemonSettings,
  config: NodemonConfig,
  dir: string | undefined,
  ready?: (options: NodemonSettings) => void,
): void {
  if (!ready) {
    ready = function (): void {};
  }

  const callback = function (settings: NodemonSettings): void {
    // prefer the local nodemon.json and fill in missing items using
    // the global options
    ready!(utils.merge(settings, options) as NodemonSettings);
  };

  if (!dir) {
    return callback({});
  }

  const filename: string = options.configFile || path.join(dir, 'nodemon.json');

  if (config.loaded.indexOf(filename) !== -1) {
    // don't bother re-parsing the same config file
    return callback({});
  }

  fs.readFile(filename, 'utf8', function (err: NodeJS.ErrnoException | null, data: string) {
    if (err) {
      if (err.code === 'ENOENT') {
        if (!options.configFile && dir !== utils.home) {
          // if no specified local config file and local nodemon.json
          // doesn't exist, try the package.json
          return loadPackageJSON(config, callback);
        }
      }
      return callback({});
    }

    let settings: NodemonSettings = {};

    try {
      settings = JSON.parse(data.toString().replace(/^\uFEFF/, ''));
      if (!filename.endsWith('package.json') || (settings as Record<string, unknown>).nodemonConfig) {
        config.loaded.push(filename);
      }
    } catch (e) {
      utils.log.fail('Failed to parse config ' + filename);
      console.error(e);
      process.exit(1);
    }

    // options values will overwrite settings
    callback(settings);
  });
}

// ---------------------------------------------------------------------------
// loadPackageJSON
// ---------------------------------------------------------------------------

function loadPackageJSON(
  config: NodemonConfig,
  ready?: (options: NodemonSettings) => void,
): void {
  if (!ready) {
    ready = (): void => {};
  }

  const dir: string = process.cwd();
  const filename: string = path.join(dir, 'package.json');
  const packageLoadOptions: NodemonSettings = { configFile: filename };
  loadFile(packageLoadOptions, config, dir, (settings: NodemonSettings) => {
    ready!((settings as Record<string, unknown>).nodemonConfig as NodemonSettings || {});
  });
}

// ---------------------------------------------------------------------------
// mutateExecOptions
// ---------------------------------------------------------------------------

/**
 * Computes the final `execOptions` from the merged configuration and
 * mutates `options` in-place: sets `execOptions` and removes the individual
 * top-level keys that have been folded into it.
 */
function mutateExecOptions(options: NodemonSettings): NodemonSettings {
  // work out the execOptions based on the final config we have
  options.execOptions = exec(
    {
      script: options.script as string | undefined,
      exec: options.exec as string | undefined,
      args: options.args,
      scriptPosition: options.scriptPosition as number | undefined,
      nodeArgs: options.nodeArgs,
      execArgs: options.execArgs,
      ext: options.ext,
      env: options.env,
    },
    options.execMap,
  ) as unknown as ExecOptions;

  // clean up values that we don't need at the top level
  delete options.scriptPosition;
  delete options.script;
  delete options.args;
  delete options.ext;

  return options;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

interface LoadFunction {
  (
    settings: NodemonSettings,
    options: NodemonSettings,
    config: NodemonConfig,
    callback: (options: NodemonSettings) => void,
  ): void;
  mutateExecOptions: typeof mutateExecOptions;
}

const loadExport = load as LoadFunction;
loadExport.mutateExecOptions = mutateExecOptions;

export = loadExport;
