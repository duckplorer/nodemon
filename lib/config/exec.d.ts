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

declare function exec(nodemonOptions: ExecInputOptions, execMap?: Record<string, string>): ExecResult;

declare namespace exec {
  function expandScript(script: string, ext?: string): string;
}

export = exec;
