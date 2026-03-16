/**
 * A deep merge of the source based on the target.
 * Missing values in source are filled from target.
 * Empty strings and empty arrays in source are replaced by target values.
 *
 * @param source - the primary object
 * @param target - the fallback object to merge from
 * @param result - optional pre-cloned result object
 * @returns the merged object
 */
declare function merge<
  S extends Record<string, unknown>,
  T extends Record<string, unknown>
>(source: S, target: T, result?: Record<string, unknown>): S & T;
export = merge;
