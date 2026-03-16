'use strict';

var utils = require('../utils');
var add = require('./add');
var parse = require('./parse');

import type { Rules, RuleCategory } from './add';

// exported
var rules: Rules = { ignore: [], watch: [] };

/**
 * Callback signature for the `parse` function.
 * When parsing a raw (plain-text) config file, `result` contains a `raw` array.
 * When parsing a JSON config file, `result` contains `ignore` and `watch` arrays.
 */
interface ParseResultRaw {
  raw: string[];
  ignore?: undefined;
  watch?: undefined;
}

interface ParseResultJSON {
  raw?: undefined;
  ignore: string[];
  watch: string[];
}

type ParseResult = ParseResultRaw | ParseResultJSON;

type ParseCallback = (err: NodeJS.ErrnoException | null, result?: ParseResult) => void;

/**
 * Callback signature for the `load` function.
 */
type LoadCallback = (err: NodeJS.ErrnoException | null, rules?: Rules) => void;

/**
 * A bound version of `add` that only requires the `rule` argument.
 */
type BoundAdd = (rule: string | RegExp | string[]) => void;

/** The shape of the rules module export. */
interface RulesModule {
  reset: () => void;
  load: (filename: string, callback: LoadCallback) => void;
  ignore: {
    test: BoundAdd;
    add: BoundAdd;
  };
  watch: {
    test: BoundAdd;
    add: BoundAdd;
  };
  add: (which: RuleCategory, rule: string | RegExp | string[]) => void;
  rules: Rules;
}

/**
 * Loads a nodemon config file and populates the ignore
 * and watch rules with its contents, and calls callback
 * with the new rules
 *
 * @param filename  path to the config file
 * @param callback  called with (err, rules) when loading is complete
 */
function load(filename: string, callback: LoadCallback): void {
  parse(filename, function (err: NodeJS.ErrnoException | null, result: ParseResult) {
    if (err) {
      // we should have bombed already, but
      utils.log.error(err);
      callback(err);
    }

    if (result.raw) {
      result.raw.forEach(add.bind(null, rules, 'ignore'));
    } else {
      result.ignore.forEach(add.bind(null, rules, 'ignore'));
      result.watch.forEach(add.bind(null, rules, 'watch'));
    }

    callback(null, rules);
  });
}

var rulesModule: RulesModule = {
  reset: function (): void { // just used for testing
    rules.ignore.length = rules.watch.length = 0;
    delete rules.ignore.re;
    delete rules.watch.re;
  },
  load: load,
  ignore: {
    test: add.bind(null, rules, 'ignore') as BoundAdd,
    add: add.bind(null, rules, 'ignore') as BoundAdd,
  },
  watch: {
    test: add.bind(null, rules, 'watch') as BoundAdd,
    add: add.bind(null, rules, 'watch') as BoundAdd,
  },
  add: add.bind(null, rules) as (which: RuleCategory, rule: string | RegExp | string[]) => void,
  rules: rules,
};

module.exports = rulesModule;
export default rulesModule;
export type { Rules, RuleCategory, ParseResult, ParseResultRaw, ParseResultJSON, LoadCallback, BoundAdd, RulesModule };
