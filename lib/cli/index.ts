import parse from './parse';
import type { ParsedOptions } from './parse';

/**
 * Converts a string to command line args, in particular
 * groups together quoted values.
 * This is a utility function to allow calling nodemon as a required
 * library, but with the CLI args passed in (instead of an object).
 *
 * @param str - the command line string to split into arguments
 * @returns array of argument strings with quoted groups preserved
 */
function stringToArgs(str: string): string[] {
  const args: string[] = [];

  const parts: string[] = str.split(' ');
  const length: number = parts.length;
  let i = 0;
  let open: string | false = false;
  let grouped = '';
  let lead = '';

  for (; i < length; i++) {
    lead = parts[i].substring(0, 1);
    if (lead === '"' || lead === '\'') {
      open = lead;
      grouped = parts[i].substring(1);
    } else if (open && parts[i].slice(-1) === open) {
      open = false;
      grouped += ' ' + parts[i].slice(0, -1);
      args.push(grouped);
    } else if (open) {
      grouped += ' ' + parts[i];
    } else {
      args.push(parts[i]);
    }
  }

  return args;
}

/** The CLI module interface providing the parse function */
export interface CliModule {
  parse: (argv: string[] | string) => ParsedOptions;
}

const cli: CliModule = {
  parse: function (argv: string[] | string): ParsedOptions {
    if (typeof argv === 'string') {
      argv = stringToArgs(argv);
    }

    return parse(argv);
  },
};

export default cli;
export type { ParsedOptions };
