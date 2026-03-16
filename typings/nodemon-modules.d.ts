/**
 * Type declarations for nodemon internal modules that have not yet been
 * migrated to TypeScript. These stubs allow the migrated config/*.ts files
 * to import their siblings without type errors while keeping `any` usage
 * confined to the boundary with un-migrated code.
 */

// ---------------------------------------------------------------------------
// lib/rules
// ---------------------------------------------------------------------------
declare module '../rules' {
  interface RuleArray extends Array<string> {
    re?: RegExp;
  }

  interface RuleSet {
    ignore: RuleArray;
    watch: RuleArray;
  }

  interface RuleAccessor {
    test(pattern: string | string[]): void;
    add(pattern: string | string[]): void;
  }

  const rules: {
    reset(): void;
    load(filename: string, callback: (err: Error | null, rules?: RuleSet) => void): void;
    ignore: RuleAccessor;
    watch: RuleAccessor;
    add(rules: RuleSet, type: string, pattern: string): void;
    rules: RuleSet;
  };
  export = rules;
}

// ---------------------------------------------------------------------------
// lib/rules/parse
// ---------------------------------------------------------------------------
declare module '../rules/parse' {
  interface ParseResult {
    ignore?: string[];
    watch?: string[];
    raw?: string[];
  }

  function parse(
    filename: string,
    callback: (err: NodeJS.ErrnoException | null, result?: ParseResult) => void,
  ): void;

  export = parse;
}

// ---------------------------------------------------------------------------
// lib/utils
// ---------------------------------------------------------------------------
declare module '../utils' {
  import { EventEmitter } from 'events';

  interface LogMethods {
    info(msg: string): void;
    status(msg: string): void;
    detail(msg: string): void;
    fail(msg: string): void;
    error(err: string | Error): void;
    debug: boolean;
    useColours: boolean;
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

  const utils: Utils;
  export = utils;
}

// ---------------------------------------------------------------------------
// lib/version
// ---------------------------------------------------------------------------
declare module '../version' {
  interface VersionFn {
    (callback?: (err: Error | null, version?: string) => void): Promise<string>;
    pinned?: string;
  }

  const version: VersionFn & {
    pin(): Promise<void>;
  };
  export = version;

  export function pin(): Promise<void>;
}

// ---------------------------------------------------------------------------
// lib/config/command
// ---------------------------------------------------------------------------
declare module './command' {
  interface CommandResult {
    executable: string;
    args: string[];
  }

  interface CommandSettings {
    execOptions: {
      exec: string;
      script?: string | null;
      scriptPosition?: number | null;
      execArgs?: string[];
      args?: string[];
    };
  }

  function command(settings: CommandSettings): CommandResult;
  export = command;
}

// ---------------------------------------------------------------------------
// lib/config/exec
// ---------------------------------------------------------------------------
declare module './exec' {
  interface ExecInputOptions {
    script?: string | null;
    exec?: string | string[] | null;
    args?: string[];
    scriptPosition?: number | null;
    nodeArgs?: string[];
    execArgs?: string[];
    ext?: string;
    env?: Record<string, string>;
  }

  interface ExecResult {
    script: string | null;
    exec: string;
    args: string[];
    scriptPosition: number | null;
    execArgs: string[];
    nodeArgs: string[];
    ext: string;
    env: Record<string, string>;
  }

  function exec(nodemonOptions: ExecInputOptions, execMap?: Record<string, string>): ExecResult;

  namespace exec {
    function expandScript(script: string, ext?: string): string;
  }

  export = exec;
}

// ---------------------------------------------------------------------------
// lib/monitor/match
// ---------------------------------------------------------------------------
declare module '../monitor/match' {
  interface MatchResult {
    result: string[];
    ignored: number;
    watched: number;
    total: number;
  }

  interface NodemonConfig {
    dirs: string[];
    [key: string]: unknown;
  }

  function match(files: string[], monitor: string[], ext: string): MatchResult;

  namespace match {
    function rulesToMonitor(
      watch: string[] | string | false,
      ignore: string[] | string,
      config: NodemonConfig,
    ): string[];
  }

  export = match;
}
