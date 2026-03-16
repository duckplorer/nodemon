/** Supported colour names */
type ColourName = 'red' | 'yellow' | 'green' | 'black';

/**
 * Encodes a string in a colour for terminal output.
 * @param c - colour to highlight in
 * @param str - the string to encode
 * @returns coloured string for terminal printing
 */
interface ColourFunction {
  (c: ColourName, str: string): string;
  red: string;
  yellow: string;
  green: string;
  black: string;
  strip(str: string): string;
}

declare const colour: ColourFunction;
export = colour;
