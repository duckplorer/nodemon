import { minimatch } from 'minimatch';
import path = require('path');
import fs = require('fs');
import debugModule = require('debug');
import utils = require('../utils');

const debug: debugModule.Debugger = debugModule('nodemon:match');

/** Configuration object passed to rulesToMonitor; must have a mutable dirs array. */
interface MatchConfig {
  dirs: string[];
  [key: string]: unknown;
}

/** The result returned by the match function. */
interface MatchResult {
  result: string[];
  ignored: number;
  watched: number;
  total: number;
}

/** Options passed to minimatch for file matching. */
interface MinimatchOptions {
  dot: boolean;
  nocase?: boolean;
  windowsPathsNoEscape?: boolean;
}

function tryBaseDir(dir: string): string | false {
  var stat: fs.Stats;
  if (/[?*\{\[]+/.test(dir)) {
    // if this is pattern, then try to find the base
    try {
      var base: string = path.dirname(dir.replace(/([?*\{\[]+.*$)/, 'foo'));
      stat = fs.statSync(base);
      if (stat.isDirectory()) {
        return base;
      }
    } catch (error) {
      // console.log(error);
    }
  } else {
    try {
      stat = fs.statSync(dir);
      // if this path is actually a single file that exists, then just monitor
      // that, *specifically*.
      if (stat.isFile() || stat.isDirectory()) {
        return dir;
      }
    } catch (e) { }
  }

  return false;
}

function match(files: string[], monitor: string[], ext: string): MatchResult {
  // sort the rules by highest specificity (based on number of slashes)
  // ignore rules (!) get sorted highest as they take precedent
  const cwd: string = process.cwd();
  var rules: string[] = monitor
    .sort(function (a: string, b: string): number {
      var r: number = b.split(path.sep).length - a.split(path.sep).length;
      var aIsIgnore: boolean = a.slice(0, 1) === '!';
      var bIsIgnore: boolean = b.slice(0, 1) === '!';

      if (aIsIgnore || bIsIgnore) {
        if (aIsIgnore) {
          return -1;
        }

        return 1;
      }

      if (r === 0) {
        return b.length - a.length;
      }
      return r;
    })
    .map(function (s: string): string {
      var prefix: string = s.slice(0, 1);

      if (prefix === '!') {
        if (s.indexOf('!' + cwd) === 0) {
          return s;
        }

        // if it starts with a period, then let's get the relative path
        if (s.indexOf('!.') === 0) {
          return '!' + path.resolve(cwd, s.substring(1));
        }

        return '!**' + ((prefix as string) !== path.sep ? path.sep : '') + s.slice(1);
      }

      // if it starts with a period, then let's get the relative path
      if (s.indexOf('.') === 0) {
        return path.resolve(cwd, s);
      }

      if (s.indexOf(cwd) === 0) {
        return s;
      }

      return '**' + (prefix !== path.sep ? path.sep : '') + s;
    });

  debug('rules', rules);

  var good: string[] = [];
  var whitelist: string[] = []; // files that we won't check against the extension
  var ignored: number = 0;
  var watched: number = 0;
  var usedRules: string[] = [];
  var minimatchOpts: MinimatchOptions = {
    dot: true,
  };

  // enable case-insensitivity on Windows
  if (utils.isWindows) {
    minimatchOpts.nocase = true;
    minimatchOpts.windowsPathsNoEscape = true;
  }

  files.forEach(function (file: string): void {
    file = path.resolve(cwd, file);

    var matched: boolean = false;
    for (var i: number = 0; i < rules.length; i++) {
      if (rules[i].slice(0, 1) === '!') {
        if (!minimatch(file, rules[i], minimatchOpts)) {
          debug('ignored', file, 'rule:', rules[i]);
          ignored++;
          matched = true;
          break;
        }
      } else {
        debug('matched', file, 'rule:', rules[i]);
        if (minimatch(file, rules[i], minimatchOpts)) {
          watched++;

          // don't repeat the output if a rule is matched
          if (usedRules.indexOf(rules[i]) === -1) {
            usedRules.push(rules[i]);
            utils.log.detail('matched rule: ' + rules[i]);
          }

          // if the rule doesn't match the WATCH EVERYTHING
          // but *does* match a rule that ends with *.*, then
          // white list it - in that we don't run it through
          // the extension check too.
          if (
            rules[i] !== '**' + path.sep + '*.*' &&
            rules[i].slice(-3) === '*.*'
          ) {
            whitelist.push(file);
          } else if (path.basename(file) === path.basename(rules[i])) {
            // if the file matches the actual rule, then it's put on whitelist
            whitelist.push(file);
          } else {
            good.push(file);
          }
          matched = true;
        } else {
          // utils.log.detail('no match: ' + rules[i], file);
        }
      }
    }
    if (!matched) {
      ignored++;
    }
  });

  // finally check the good files against the extensions that we're monitoring
  if (ext) {
    if (ext.indexOf(',') === -1) {
      ext = '**/*.' + ext;
    } else {
      ext = '**/*.{' + ext + '}';
    }

    good = good.filter(function (file: string): boolean {
      // only compare the filename to the extension test
      return minimatch(path.basename(file), ext, minimatchOpts);
    });
    debug('good (filtered by ext)', good);
  } else {
    // else assume *.*
    debug('good', good);
  }

  if (whitelist.length) debug('whitelist', whitelist);

  var result: string[] = good.concat(whitelist);

  if (utils.isWindows) {
    // fix for windows testing - I *think* this is okay to do
    result = result.map(function (file: string): string {
      return file.slice(0, 1).toLowerCase() + file.slice(1);
    });
  }

  return {
    result: result,
    ignored: ignored,
    watched: watched,
    total: files.length,
  };
}

namespace match {
  export function rulesToMonitor(
    watch: string | string[] | false,
    ignore: string | string[],
    config: MatchConfig
  ): string[] {
    var monitor: string[] = [];

    if (!Array.isArray(ignore)) {
      if (ignore) {
        ignore = [ignore];
      } else {
        ignore = [];
      }
    }

    if (!Array.isArray(watch)) {
      if (watch) {
        watch = [watch];
      } else {
        watch = [];
      }
    }

    if (watch && watch.length) {
      monitor = utils.clone(watch);
    }

    if (ignore) {
      Array.prototype.push.apply(
        monitor,
        (ignore || []).map(function (rule: string): string {
          return '!' + rule;
        })
      );
    }

    var cwd: string = process.cwd();

    // next check if the monitored paths are actual directories
    // or just patterns - and expand the rule to include *.*
    monitor = monitor.map(function (rule: string): string {
      var not: boolean = rule.slice(0, 1) === '!';

      if (not) {
        rule = rule.slice(1);
      }

      if (rule === '.' || rule === '.*') {
        rule = '*.*';
      }

      var dir: string = path.resolve(cwd, rule);

      try {
        var stat: fs.Stats = fs.statSync(dir);
        if (stat.isDirectory()) {
          rule = dir;
          if (rule.slice(-1) !== '/') {
            rule += '/';
          }
          rule += '**/*';

          // `!not` ... sorry.
          if (!not) {
            config.dirs.push(dir);
          }
        } else {
          // ensures we end up in the check that tries to get a base directory
          // and then adds it to the watch list
          throw new Error();
        }
      } catch (e) {
        var base: string | false = tryBaseDir(dir);
        if (!not && base) {
          if (config.dirs.indexOf(base) === -1) {
            config.dirs.push(base);
          }
        }
      }

      if (rule.slice(-1) === '/') {
        // just slap on a * anyway
        rule += '*';
      }

      // if the url ends with * but not **/* and not *.*
      // then convert to **/* - somehow it was missed :-\
      if (
        rule.slice(-4) !== '**/*' &&
        rule.slice(-1) === '*' &&
        rule.indexOf('*.') === -1
      ) {
        if (rule.slice(-2) !== '**') {
          rule += '*/*';
        }
      }

      return (not ? '!' : '') + rule;
    });

    return monitor;
  }
}

export = match;
