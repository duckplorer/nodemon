import path = require('path');
import { ChildProcess, spawn } from 'child_process';

const utils = require('./utils');
const merge: (source: Record<string, unknown>, target: Record<string, unknown>, result?: Record<string, unknown>) => Record<string, unknown> = utils.merge;
const bus: NodeJS.EventEmitter = utils.bus;

/** Options controlling how the child process stdio streams are handled. */
type StdioConfig = Array<'pipe' | NodeJS.WriteStream | NodeJS.ReadStream>;

/** Exec-related options that may include environment variables. */
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

/** The config.options shape relevant to the spawn module. */
interface SpawnConfigOptions {
  stdout: boolean;
  execOptions: ExecOptions;
}

/** The config object passed into spawnCommand. */
interface SpawnConfig {
  required: boolean;
  options: SpawnConfigOptions;
}

/** Options passed to child_process.spawn. */
interface SpawnOptions {
  env: Record<string, unknown>;
  stdio: StdioConfig;
  windowsVerbatimArguments?: boolean;
  windowsHide?: boolean;
}

/** Event emitter functions for piping child process output to the bus. */
interface EmitHandlers {
  stdout: (data: Buffer) => void;
  stderr: (data: Buffer) => void;
}

/**
 * Spawns a shell command (typically bound to a nodemon event).
 *
 * @param command - The command string(s) to execute.
 * @param config - The nodemon config object.
 * @param eventArgs - Arguments from the triggering event; the first element is the changed filename.
 */
function spawnCommand(command: string | string[], config: SpawnConfig, eventArgs: string[]): void {
  var stdio: StdioConfig = ['pipe', 'pipe', 'pipe'];

  if (config.options.stdout) {
    stdio = ['pipe', process.stdout, process.stderr];
  }

  const env: Record<string, unknown> = merge(process.env as unknown as Record<string, unknown>, { FILENAME: eventArgs[0] });

  var sh: string = 'sh';
  var shFlag: string = '-c';
  var spawnOptions: SpawnOptions = {
    env: merge(config.options.execOptions.env as unknown as Record<string, unknown> || {}, env),
    stdio: stdio,
  };

  if (!Array.isArray(command)) {
    command = [command];
  }

  if (utils.isWindows) {
    // if the exec includes a forward slash, reverse it for windows compat
    // but *only* apply to the first command, and none of the arguments.
    // ref #1251 and #1236
    command = command.map((executable: string): string => {
      if (executable.indexOf('/') === -1) {
        return executable;
      }

      return executable.split(' ').map((e: string, i: number): string => {
        if (i === 0) {
          return path.normalize(e);
        }
        return e;
      }).join(' ');
    });
    // taken from npm's cli: https://git.io/vNFD4
    sh = process.env.comspec || 'cmd';
    shFlag = '/d /s /c';
    spawnOptions.windowsVerbatimArguments = true;
    spawnOptions.windowsHide = true;
  }

  const args: string = command.join(' ');
  const child: ChildProcess = spawn(sh, [shFlag, args], spawnOptions as object as import('child_process').SpawnOptions);

  if (config.required) {
    var emit: EmitHandlers = {
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
  }
}

export = spawnCommand;
