import debugModule = require('debug');
import { statSync } from 'fs';
import utils = require('../utils');
import childProcess = require('child_process');
import config = require('../config');
import path = require('path');
import signals = require('./signals');
import undefsafe = require('undefsafe');
import psTree = require('pstree.remy');
import os = require('os');

const debug: debugModule.Debugger = debugModule('nodemon:run');
var bus: NodeJS.EventEmitter = utils.bus;
var spawn: typeof childProcess.spawn = childProcess.spawn;
var exec: typeof childProcess.exec = childProcess.exec;
var execSync: typeof childProcess.execSync = childProcess.execSync;
var fork: typeof childProcess.fork = childProcess.fork;
var watchFn: () => Promise<string[]> = require('./watch').watch;

const osRelease: number = parseInt(os.release().split('.')[0], 10);

/** The stdio configuration for the child process. */
type StdioOption = Array<'pipe' | 'ipc' | NodeJS.Process['stdin'] | NodeJS.Process['stdout'] | NodeJS.Process['stderr']>;

/** The options object passed to the run function. */
interface RunOptions {
  runOnChangeOnly?: boolean;
  stdin?: boolean;
  exitCrash?: boolean;
  exitcrash?: boolean;
  execOptions: {
    env: Record<string, string | undefined>;
    script?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Parsed command structure from config. */
interface RawCommand {
  executable: string;
  args: string[];
}

/** Options for spawning the child process. */
interface SpawnOptions {
  env: Record<string, string | undefined>;
  stdio: StdioOption;
  windowsVerbatimArguments?: boolean;
  windowsHide?: boolean;
}

/** Options for forking the child process. */
interface ForkOptions {
  env: Record<string, string | undefined>;
  stdio: StdioOption;
  silent: boolean;
  windowsHide?: boolean;
}

/** Signal name to numeric value lookup. */
interface SignalMap {
  [key: string]: number;
}

var child: childProcess.ChildProcess | null = null;
var killedAfterChange: boolean = false;
var noop: () => void = () => {};
var restart: (() => void) | null = null;

/** The run function with attached kill/restart/options properties. */
interface RunFunction {
  (options: RunOptions): void;
  kill: (noRestart?: boolean | (() => void), callback?: () => void) => void;
  restart: () => void;
  options: RunOptions;
}

function run(options: RunOptions): void {
  var cmd: RawCommand = config.command.raw;
  // moved up
  // we need restart function below in the global scope for run.kill
  /*jshint validthis:true*/
  restart = (run as RunFunction).bind(undefined, options);
  (run as RunFunction).restart = restart;

  // binding options with instance of run
  // so that we can use it in run.kill
  (run as RunFunction).options = options;

  var runCmd: boolean = !options.runOnChangeOnly || config.lastStarted !== 0;
  if (runCmd) {
    utils.log.status('starting `' + config.command.string + '`');
  } else {
    // should just watch file if command is not to be run
    // had another alternate approach
    // to stop process being forked/spawned in the below code
    // but this approach does early exit and makes code cleaner
    debug('start watch on: %s', config.options.watch);
    if (config.options.watch !== false) {
      watchFn();
      return;
    }
  }

  config.lastStarted = Date.now();

  var stdio: StdioOption = ['pipe', 'pipe', 'pipe'];

  if (config.options.stdout) {
    stdio = ['pipe', process.stdout, process.stderr];
  }

  if (config.options.stdin === false) {
    stdio = [process.stdin, process.stdout, process.stderr];
  }

  var sh: string = 'sh';
  var shFlag: string = '-c';

  const binPath: string = process.cwd() + '/node_modules/.bin';

  const spawnOptions: SpawnOptions = {
    env: Object.assign({}, options.execOptions.env, process.env, {
      PATH:
        binPath +
        path.delimiter +
        (undefsafe(options, '.execOptions.env.PATH') || process.env.PATH),
    }),
    stdio: stdio,
  };

  var executable: string = cmd.executable;

  if (utils.isWindows) {
    // if the exec includes a forward slash, reverse it for windows compat
    // but *only* apply to the first command, and none of the arguments.
    // ref #1251 and #1236
    if (executable.indexOf('/') !== -1) {
      executable = executable
        .split(' ')
        .map((e: string, i: number): string => {
          if (i === 0) {
            return path.normalize(e);
          }
          return e;
        })
        .join(' ');
    }
    // taken from npm's cli: https://git.io/vNFD4
    sh = process.env.comspec || 'cmd';
    shFlag = '/d /s /c';
    spawnOptions.windowsVerbatimArguments = true;
    spawnOptions.windowsHide = true;
  }

  var args: string = runCmd ? utils.stringify(executable, cmd.args) : ':';
  var spawnArgs: [string, string[], SpawnOptions] = [sh, [shFlag, args], spawnOptions];

  const firstArg: string = cmd.args[0] || '';

  var inBinPath: boolean = false;
  try {
    inBinPath = statSync(`${binPath}/${executable}`).isFile();
  } catch (e) {}

  // hasStdio allows us to correctly handle stdin piping
  // see: https://git.io/vNtX3
  const hasStdio: boolean = utils.satisfies('>= 6.4.0 || < 5');

  // forking helps with sub-process handling and tends to clean up better
  // than spawning, but it should only be used under specific conditions
  const shouldFork: boolean =
    !config.options.spawn &&
    !inBinPath &&
    !(firstArg.indexOf('-') === 0) && // don't fork if there's a node exec arg
    firstArg !== 'inspect' && // don't fork it's `inspect` debugger
    executable === 'node' && // only fork if node
    utils.version.major > 4; // only fork if node version > 4

  if (shouldFork) {
    // this assumes the first argument is the script and slices it out, since
    // we're forking
    var forkArgs: string[] = cmd.args.slice(1);
    var env: Record<string, string | undefined> = utils.merge(options.execOptions.env, process.env);
    stdio.push('ipc');
    const forkOptions: ForkOptions = {
      env: env,
      stdio: stdio,
      silent: !hasStdio,
    };
    if (utils.isWindows) {
      forkOptions.windowsHide = true;
    }
    child = fork(options.execOptions.script!, forkArgs, forkOptions);
    utils.log.detail('forking');
    debug('fork', sh, shFlag, args);
  } else {
    utils.log.detail('spawning');
    child = spawn.apply(null, spawnArgs);
    debug('spawn', sh, shFlag, args);
  }

  if (config.required) {
    var emit = {
      stdout: function (data: Buffer): void {
        bus.emit('stdout', data);
      },
      stderr: function (data: Buffer): void {
        bus.emit('stderr', data);
      },
    };

    // now work out what to bind to...
    if (config.options.stdout) {
      child.on('stdout', emit.stdout).on('stderr', emit.stderr);
    } else {
      child.stdout!.on('data', emit.stdout);
      child.stderr!.on('data', emit.stderr);

      (bus as any).stdout = child.stdout;
      (bus as any).stderr = child.stderr;
    }

    if (shouldFork) {
      child.on('message', function (message: unknown, sendHandle: unknown): void {
        bus.emit('message', message, sendHandle);
      });
    }
  }

  bus.emit('start');

  utils.log.detail('child pid: ' + child.pid);

  child.on('error', function (error: NodeJS.ErrnoException): void {
    bus.emit('error', error);
    if (error.code === 'ENOENT') {
      utils.log.error('unable to run executable: "' + cmd.executable + '"');
      process.exit(1);
    } else {
      utils.log.error('failed to start child process: ' + error.code);
      throw error;
    }
  });

  child.on('exit', function (code: number | null, signal: string | null): void {
    if (child && child.stdin) {
      process.stdin.unpipe(child.stdin);
    }

    if (code === 127) {
      utils.log.error(
        'failed to start process, "' + cmd.executable + '" exec not found'
      );
      bus.emit('error', code);
      process.exit();
    }

    // If the command failed with code 2, it may or may not be a syntax error
    // See: http://git.io/fNOAR
    // We will only assume a parse error, if the child failed quickly
    if (code === 2 && Date.now() < config.lastStarted + 500) {
      utils.log.error('process failed, unhandled exit code (2)');
      utils.log.error('');
      utils.log.error('Either the command has a syntax error,');
      utils.log.error('or it is exiting with reserved code 2.');
      utils.log.error('');
      utils.log.error('To keep nodemon running even after a code 2,');
      utils.log.error('add this to the end of your command: || exit 1');
      utils.log.error('');
      utils.log.error('Read more here: https://git.io/fNOAG');
      utils.log.error('');
      utils.log.error('nodemon will stop now so that you can fix the command.');
      utils.log.error('');
      bus.emit('error', code);
      process.exit();
    }

    // In case we killed the app ourselves, set the signal thusly
    if (killedAfterChange) {
      killedAfterChange = false;
      signal = config.signal;
    }
    // this is nasty, but it gives it windows support
    if (utils.isWindows && signal === 'SIGTERM') {
      signal = config.signal;
    }

    if (signal === config.signal || code === 0) {
      // this was a clean exit, so emit exit, rather than crash
      debug('bus.emit(exit) via ' + config.signal);
      bus.emit('exit', signal);

      // exit the monitor, but do it gracefully
      if (signal === config.signal) {
        return restart!();
      }

      if (code === 0) {
        // clean exit - wait until file change to restart
        if (runCmd) {
          utils.log.status('clean exit - waiting for changes before restart');
        }
        child = null;
      }
    } else {
      bus.emit('crash');

      // support the old syntax of `exitcrash` - 2024-12-13
      if (options.exitcrash) {
        options.exitCrash = true;
        delete options.exitcrash;
      }

      if (options.exitCrash) {
        utils.log.fail('app crashed');
        if (!config.required) {
          process.exit(1);
        }
      } else {
        utils.log.fail(
          'app crashed - waiting for file changes before' + ' starting...'
        );
        child = null;
      }
    }

    if (config.options.restartable) {
      // stdin needs to kick in again to be able to listen to the
      // restart command
      process.stdin.resume();
    }
  });

  // moved the run.kill outside to handle both the cases
  // intial start
  // no start

  // connect stdin to the child process (options.stdin is on by default)
  if (options.stdin) {
    process.stdin.resume();
    // FIXME decide whether or not we need to decide the encoding
    // process.stdin.setEncoding('utf8');

    // swallow the stdin error if it happens
    // ref: https://github.com/remy/nodemon/issues/1195
    if (hasStdio) {
      child.stdin!.on('error', () => {});
      process.stdin.pipe(child.stdin!);
    } else {
      if (child.stdout) {
        child.stdout.pipe(process.stdout);
      } else {
        utils.log.error(
          'running an unsupported version of node ' + process.version
        );
        utils.log.error(
          'nodemon may not work as expected - ' +
            'please consider upgrading to LTS'
        );
      }
    }

    bus.once('exit', function (): void {
      if (child && process.stdin.unpipe) {
        // node > 0.8
        process.stdin.unpipe(child.stdin!);
      }
    });
  }

  debug('start watch on: %s', config.options.watch);
  if (config.options.watch !== false) {
    watchFn();
  }
}

function waitForSubProcesses(pid: number, callback: () => void): void {
  debug('checking ps tree for pids of ' + pid);
  psTree(pid, (err: Error | null, pids: number[]) => {
    if (!pids.length) {
      return callback();
    }

    utils.log.status(
      `still waiting for ${pids.length} sub-process${
        pids.length > 2 ? 'es' : ''
      } to finish...`
    );
    setTimeout(() => waitForSubProcesses(pid, callback), 1000);
  });
}

function kill(
  child: childProcess.ChildProcess,
  signal: string,
  callback?: () => void
): void {
  if (!callback) {
    callback = noop;
  }

  if (utils.isWindows) {
    const taskKill = (): void => {
      try {
        exec('taskkill /pid ' + child.pid + ' /T /F');
      } catch (e) {
        utils.log.error('Could not shutdown sub process cleanly');
      }
    };

    // We are handling a 'SIGKILL' , 'SIGUSR2' and 'SIGUSR1' POSIX signal under Windows the
    // same way it is handled on a UNIX system: We are performing
    // a hard shutdown without waiting for the process to clean-up.
    if (
      signal === 'SIGKILL' ||
      osRelease < 10 ||
      signal === 'SIGUSR2' ||
      signal === 'SIGUSR1'
    ) {
      debug('terminating process group by force: %s', child.pid);

      taskKill();
      callback();
      return;
    }

    try {
      const resultBuffer: Buffer = execSync(
        `wmic process where (ParentProcessId=${child.pid}) get ProcessId 2> nul`
      );
      const result: RegExpMatchArray | null = resultBuffer.toString().match(/^[0-9]+/m);

      const processId: string | number = Array.isArray(result) ? result[0] : child.pid!;

      debug('sending kill signal SIGINT to process: %s', processId);

      const windowsKill: string = path.normalize(
        `${__dirname}/../../bin/windows-kill.exe`
      );

      execSync(
        `start "windows-kill" /min /wait "${windowsKill}" -SIGINT ${processId}`
      );
    } catch (e) {
      taskKill();
    }
    callback();
  } else {
    let sig: string | number = signal.replace('SIG', '');

    psTree(child.pid!, function (err: Error | null, pids: number[]): void {
      if (!(psTree as any).hasPS) {
        sig = (signals as SignalMap)[signal];
      }

      debug('sending kill signal to ' + pids.join(', '));

      child.kill(signal as NodeJS.Signals);

      pids.sort().forEach((pid: number) => exec(`kill -${sig} ${pid}`, noop));

      waitForSubProcesses(child.pid!, () => {
        exec(`kill -${sig} ${child.pid}`, callback!);
      });
    });
  }
}

(run as RunFunction).kill = function (
  noRestart?: boolean | (() => void),
  callback?: () => void
): void {
  if (typeof noRestart === 'function') {
    callback = noRestart;
    noRestart = false;
  }

  if (!callback) {
    callback = noop;
  }

  if (child !== null) {
    if ((run as RunFunction).options.stdin) {
      process.stdin.unpipe(child.stdin!);
    }

    if (!noRestart) {
      killedAfterChange = true;
    }

    var oldPid: number | undefined = child.pid;
    if (child) {
      kill(child, config.signal, function (): void {
        if (child && (run as RunFunction).options.stdin && child.stdin && oldPid === child.pid) {
          child.stdin.end();
        }
        callback!();
      });
    }
  } else if (!noRestart) {
    bus.once('start', callback);
    (run as RunFunction).restart();
  } else {
    callback();
  }
};

(run as RunFunction).restart = noop;

bus.on('quit', function onQuit(code?: number): void {
  if (code === undefined) {
    code = 0;
  }

  var exitTimer: ReturnType<typeof setTimeout> | null = null;
  var exit: () => void = function (): void {
    clearTimeout(exitTimer!);
    exit = noop; // null out in case of race condition
    child = null;
    if (!config.required) {
      bus.listeners('quit').forEach(function (listener: (...args: unknown[]) => void): void {
        if (listener !== onQuit) {
          listener();
        }
      });
      process.exit(code);
    } else {
      bus.emit('exit');
    }
  };

  if (config.run === false) {
    return exit();
  }

  config.run = false;

  if (child) {
    exitTimer = setTimeout(exit, 10 * 1000);
    child.removeAllListeners('exit');
    child.once('exit', exit);

    kill(child, 'SIGINT');
  } else {
    exit();
  }
});

bus.on('restart', function (): void {
  (run as RunFunction).kill();
});

process.on('exit', function (): void {
  utils.log.detail('exiting');
  if (child) {
    child.kill();
  }
});

if (!utils.isWindows) {
  bus.once('boot', () => {
    process.once('SIGINT', () => bus.emit('quit', 130));
    process.once('SIGTERM', () => {
      bus.emit('quit', 143);
      if (child) {
        child.kill('SIGTERM');
      }
    });
  });
}

export = run;
