interface MatchResult {
  result: string[];
  ignored: number;
  watched: number;
  total: number;
}

interface MatchConfig {
  dirs: string[];
  [key: string]: unknown;
}

declare function match(files: string[], monitor: string[], ext: string): MatchResult;

declare namespace match {
  function rulesToMonitor(
    watch: string[] | string | false,
    ignore: string[] | string,
    config: MatchConfig,
  ): string[];
}

export = match;
