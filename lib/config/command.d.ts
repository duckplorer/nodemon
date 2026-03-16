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

declare function command(settings: CommandSettings): CommandResult;
export = command;
