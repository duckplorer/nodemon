interface ConfigOptions {
  ignore: string[];
  watch: string[] | false;
  monitor: string[];
  restartable?: false | string;
  stdout?: boolean;
  stdin?: boolean | undefined;
  spawn?: boolean;
  legacyWatch?: boolean;
  pollingInterval?: number;
  watchOptions?: Record<string, unknown>;
  verbose?: boolean;
  delay?: number;
  signal?: string;
  runOnChangeOnly?: boolean;
  execOptions?: {
    script?: string;
    ext?: string;
    env?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface RawCommand {
  executable: string;
  args: string[];
}

interface Config {
  run: boolean;
  system: {
    cwd: string;
  };
  required: boolean;
  dirs: string[];
  timeout: number;
  options: ConfigOptions;
  lastStarted: number;
  loaded: string[];
  signal: string;
  command: {
    raw: RawCommand;
    string: string;
  };
  load: (settings: Record<string, unknown>, ready: (config: Config) => void) => void;
  reset: () => void;
}

declare const config: Config;
export = config;
