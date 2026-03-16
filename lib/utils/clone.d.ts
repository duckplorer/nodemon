/**
 * Deep clones an object, array, or Date.
 * Handles nested structures recursively.
 *
 * @param obj - the value to clone
 * @returns a deep copy of the input
 */
declare function clone<T>(obj: T): T;
export = clone;
