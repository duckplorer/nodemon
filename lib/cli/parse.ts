/*

nodemon is a utility for node, and replaces the use of the executable
node. So the user calls `nodemon foo.js` instead.

nodemon can be run in a number of ways:

`nodemon` - tries to use package.json#main property to run
`nodemon` - if no package, looks for index.js
`nodemon app.js` - runs app.js
`nodemon --arg app.js --apparg` - eats arg1, and runs app.js with apparg
`nodemon --apparg` - as above, but passes apparg to package.json#main (or
  index.js)
`nodemon --debug app.js

*/

import * as fs from 'fs';
import * as path from 'path';

/**
 * Callback function that consumes the next argument from the argument array.
 * Returns the consumed argument value, or undefined if no next argument exists.
 */
type EatNextFn = () => string | undefined;

/**
 * Represents the parsed CLI options returned by the `parse` function.
 * This is the raw output from argument parsing before configuration merging.
 * Fields correspond to a subset of `NodemonSettings` from the project's
 * root type definitions (index.d.ts).
 */
export interface ParsedOptions {
  /** Position of the user script in the args array, used to reinsert it later */
  scriptPosition: number | null;
  /** Path to the user script to run, or null if not specified */
  script: string | null;
  /** Remaining arguments to be passed to the user script */
  args: string[];
  /** Help topic or true if --help/-h/-? was passed */
  help?: string | true;
  /** True if --version/-v was passed */
  version?: boolean;
  /** True if --no-update-notifier was passed */
  noUpdateNotifier?: boolean;
  /** True if --spawn was passed */
  spawn?: boolean;
  /** True if --dump was passed */
  dump?: boolean;
  /** True if --verbose/-V was passed */
  verbose?: boolean;
  /** True if --legacy-watch/-L was passed */
  legacyWatch?: boolean;
  /** Polling interval in ms, set by --polling-interval/-P */
  pollingInterval?: number;
  /** @deprecated True if --js was passed (on by default) */
  js?: boolean;
  /** True if --quiet/-q was passed */
  quiet?: boolean;
  /** Config file path, set by --config */
  configFile?: string;
  /** Directories/files to watch, set by --watch/-w */
  watch?: string[];
  /** Directories/files to ignore, set by --ignore/-i */
  ignore?: string[];
  /** True if --exitcrash was passed */
  exitCrash?: boolean;
  /** Delay in milliseconds before restarting, set by --delay/-d */
  delay?: number;
  /** Executable to use, set by --exec/-x */
  exec?: string;
  /** False if --no-stdin/-I was passed */
  stdin?: false;
  /** True if --on-change-only/-C was passed */
  runOnChangeOnly?: boolean;
  /** File extensions to watch, set by --ext/-e */
  ext?: string;
  /** False if --no-colours/--no-colors was passed */
  colours?: false;
  /** Signal to send for restart, set by --signal/-s */
  signal?: string;
  /** Working directory, set by --cwd */
  cwd?: string;
}

const existsSync: (filePath: string) => boolean = fs.existsSync;

/**
 * Parses the command line arguments `process.argv` and returns the
 * nodemon options, the user script and the executable script.
 *
 * @param argv - full process arguments, including `node` leading arg
 * @returns parsed nodemon options including script, args, and CLI flags
 */
function parse(argv: string[] | string): ParsedOptions {
  if (typeof argv === 'string') {
    argv = argv.split(' ');
  }

  const eat = function (i: number, args: string[]): string | undefined {
    if (i <= args.length) {
      return args.splice(i + 1, 1).pop();
    }
  };

  const args: string[] = argv.slice(2);
  let script: string | null = null;
  const nodemonOptions: ParsedOptions = {
    scriptPosition: null,
    script: null,
    args: [],
  };

  const nodemonOpt = nodemonOption.bind(null, nodemonOptions);
  let lookForArgs = true;

  // move forward through the arguments
  for (let i = 0; i < args.length; i++) {
    // if the argument looks like a file, then stop eating
    if (!script) {
      if (args[i] === '.' || existsSync(args[i])) {
        script = args.splice(i, 1).pop() ?? null;

        // we capture the position of the script because we'll reinsert it in
        // the right place in run.js:command (though I'm not sure we should even
        // take it out of the array in the first place, but this solves passing
        // arguments to the exec process for now).
        nodemonOptions.scriptPosition = i;
        i--;
        continue;
      }
    }

    if (lookForArgs) {
      // respect the standard way of saying: hereafter belongs to my script
      if (args[i] === '--') {
        args.splice(i, 1);
        nodemonOptions.scriptPosition = i;
        // cycle back one argument, as we just ate this one up
        i--;

        // ignore all further nodemon arguments
        lookForArgs = false;

        // move to the next iteration
        continue;
      }

      if (nodemonOpt(args[i], eat.bind(null, i, args)) !== false) {
        args.splice(i, 1);
        // cycle back one argument, as we just ate this one up
        i--;
      }
    }
  }

  nodemonOptions.script = script;
  nodemonOptions.args = args;

  return nodemonOptions;
}

/**
 * Given an argument (ie. from process.argv), sets nodemon
 * options and can eat up the argument value
 *
 * @param options - object that will be updated with parsed option values
 * @param arg - current argument from argv
 * @param eatNext - callback to consume the next argument in argv
 * @returns false if the argument was not a recognized nodemon option
 */
function nodemonOption(
  options: ParsedOptions,
  arg: string,
  eatNext: EatNextFn
): false | void {
  // line separation on purpose to help legibility
  if (arg === '--help' || arg === '-h' || arg === '-?') {
    const help: string | undefined = eatNext();
    options.help = help ? help : true;
  } else

  if (arg === '--version' || arg === '-v') {
    options.version = true;
  } else

  if (arg === '--no-update-notifier') {
    options.noUpdateNotifier = true;
  } else

  if (arg === '--spawn') {
    options.spawn = true;
  } else

  if (arg === '--dump') {
    options.dump = true;
  } else

  if (arg === '--verbose' || arg === '-V') {
    options.verbose = true;
  } else

  if (arg === '--legacy-watch' || arg === '-L') {
    options.legacyWatch = true;
  } else

  if (arg === '--polling-interval' || arg === '-P') {
    options.pollingInterval = parseInt(eatNext() as string, 10);
  } else

  // Deprecated as this is "on" by default
  if (arg === '--js') {
    options.js = true;
  } else

  if (arg === '--quiet' || arg === '-q') {
    options.quiet = true;
  } else

  if (arg === '--config') {
    options.configFile = eatNext();
  } else

  if (arg === '--watch' || arg === '-w') {
    if (!options.watch) { options.watch = []; }
    options.watch.push(eatNext() as string);
  } else

  if (arg === '--ignore' || arg === '-i') {
    if (!options.ignore) { options.ignore = []; }
    options.ignore.push(eatNext() as string);
  } else

  if (arg === '--exitcrash') {
    options.exitCrash = true;
  } else

  if (arg === '--delay' || arg === '-d') {
    options.delay = parseDelay(eatNext() as string);
  } else

  if (arg === '--exec' || arg === '-x') {
    options.exec = eatNext();
  } else

  if (arg === '--no-stdin' || arg === '-I') {
    options.stdin = false;
  } else

  if (arg === '--on-change-only' || arg === '-C') {
    options.runOnChangeOnly = true;
  } else

  if (arg === '--ext' || arg === '-e') {
    options.ext = eatNext();
  } else

  if (arg === '--no-colours' || arg === '--no-colors') {
    options.colours = false;
  } else

  if (arg === '--signal' || arg === '-s') {
    options.signal = eatNext();
  } else

  if (arg === '--cwd') {
    options.cwd = eatNext();

    // go ahead and change directory. This is primarily for nodemon tools like
    // grunt-nodemon - we're doing this early because it will affect where the
    // user script is searched for.
    process.chdir(path.resolve(options.cwd as string));
  } else {

    // this means we didn't match
    return false;
  }
}

/**
 * Given an argument (ie. from nodemonOption()), will parse and return the
 * equivalent millisecond value or 0 if the argument cannot be parsed
 *
 * @param value - argument value given to the --delay option
 * @returns millisecond equivalent of the argument
 */
function parseDelay(value: string): number {
  const millisPerSecond = 1000;
  let millis = 0;

  if (value.match(/^\d*ms$/)) {
    // Explicitly parse for milliseconds when using ms time specifier
    millis = parseInt(value, 10);
  } else {
    // Otherwise, parse for seconds, with or without time specifier then convert
    millis = parseFloat(value) * millisPerSecond;
  }

  return isNaN(millis) ? 0 : millis;
}

export default parse;
export type { EatNextFn };
