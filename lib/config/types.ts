/**
 * Shared TypeScript interfaces for the nodemon config module.
 *
 * These types are extracted into their own file so that both the migrated
 * config/*.ts files and future consumers can import them without running
 * into the TS2309 restriction (export assignment + named exports).
 */

// ---------------------------------------------------------------------------
// ExecMap
// ---------------------------------------------------------------------------

/**
 * Maps file extensions (without leading dot) to the executable command
 * used to run scripts of that type.
 */
export interface ExecMap {
  [extension: string]: string | undefined;
  py?: string;
  rb?: string;
  ts?: string;
}

// ---------------------------------------------------------------------------
// WatchOptions
// ---------------------------------------------------------------------------

/**
 * Watch-related options that can be passed through to chokidar.
 */
export interface WatchOptions {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// DefaultOptions
// ---------------------------------------------------------------------------

/**
 * The default nodemon options that serve as the baseline configuration.
 * User-supplied and file-loaded options are merged on top of these.
 */
export interface DefaultOptions {
  restartable: string;
  colours: boolean;
  execMap: ExecMap;
  ignoreRoot: string[];
  watch: string[];
  stdin: boolean;
  runOnChangeOnly: boolean;
  verbose: boolean;
  signal: string;
  stdout: boolean;
  watchOptions: WatchOptions;
  /** Present in the type for completeness, but only populated after merge. */
  ignore?: string[];
}

// ---------------------------------------------------------------------------
// ExecOptions
// ---------------------------------------------------------------------------

/**
 * The resolved execution options produced by the exec module.
 */
export interface ExecOptions {
  exec: string;
  script?: string | null;
  scriptPosition?: number | null;
  args?: string[];
  execArgs?: string[];
  nodeArgs?: string[];
  ext?: string;
  env?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// NodemonSettings
// ---------------------------------------------------------------------------

/**
 * Represents the user-supplied settings object that arrives from the CLI
 * parser or from programmatic usage. All fields are optional because they
 * originate from user input.
 */
export interface NodemonSettings {
  script?: string | null;
  exec?: string | string[] | null;
  args?: string[];
  scriptPosition?: number | null;
  nodeArgs?: string[];
  execArgs?: string[];
  ext?: string;
  env?: Record<string, string>;
  configFile?: string;
  watch?: string[] | false;
  ignore?: string[] | string;
  ignoreRoot?: string[] | string;
  monitor?: string[];
  quiet?: boolean;
  verbose?: boolean;
  restartable?: string | false;
  colours?: boolean;
  execMap?: Record<string, string>;
  stdin?: boolean;
  runOnChangeOnly?: boolean;
  signal?: string;
  stdout?: boolean;
  watchOptions?: Record<string, unknown>;
  watch_interval?: number;
  watchInterval?: number | null;
  delay?: number;
  legacyWatch?: boolean;
  pollingInterval?: number;
  spawn?: boolean;
  dump?: boolean;
  exitCrash?: boolean;
  events?: Record<string, string>;
  execOptions?: ExecOptions;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// NodemonConfig
// ---------------------------------------------------------------------------

/**
 * The internal config singleton that tracks runtime state.
 */
export interface NodemonConfig {
  run: boolean;
  system: { cwd: string };
  required: boolean;
  dirs: string[];
  timeout: number;
  options: NodemonSettings;
  lastStarted?: number;
  loaded: string[];
  watchInterval?: number | null;
  signal?: string;
  command?: {
    raw: { executable: string; args: string[] };
    string: string;
  };
  load?(
    settings: NodemonSettings,
    ready: (config: NodemonConfig) => void,
  ): void;
  reset?(): void;
}
