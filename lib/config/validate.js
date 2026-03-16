var utils = require('../utils');

// Known valid keys for nodemon.json configuration and their expected types.
// A value can be a single type string or an array of acceptable type strings.
// 'array' is used for Array values (since typeof [] === 'object').
var knownKeys = {
  restartable: ['string', 'boolean'],
  colours: 'boolean',
  colors: 'boolean',
  execMap: 'object',
  ignoreRoot: 'array',
  watch: ['array', 'boolean'],
  stdin: 'boolean',
  runOnChangeOnly: 'boolean',
  verbose: 'boolean',
  signal: 'string',
  stdout: 'boolean',
  watchOptions: 'object',
  ignore: ['array', 'string'],
  delay: ['number', 'string'],
  exec: ['string', 'array'],
  ext: 'string',
  script: 'string',
  args: 'array',
  nodeArgs: 'array',
  execArgs: 'array',
  env: 'object',
  cwd: 'string',
  legacyWatch: 'boolean',
  pollingInterval: 'number',
  spawn: 'boolean',
  quiet: 'boolean',
  dump: 'boolean',
  exitCrash: 'boolean',
  events: 'object',
  watch_interval: 'number',
  watchInterval: 'number',
  js: 'boolean',
  noUpdateNotifier: 'boolean',
  configFile: 'string',
  nodemonConfig: 'object',
};

function getType(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

/**
 * Validates a parsed config object from nodemon.json (or package.json
 * nodemonConfig). Emits warnings via utils.log for unknown keys and
 * mismatched value types.
 *
 * @param {Object} settings  the parsed JSON object
 * @param {String} filename  path to the config file (for log messages)
 */
function validate(settings, filename) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return;
  }

  var keys = Object.keys(settings);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = settings[key];

    if (!knownKeys.hasOwnProperty(key)) {
      utils.log.fail(
        'unknown config key "' + key + '" in ' + filename
      );
      continue;
    }

    var expected = knownKeys[key];
    var actual = getType(value);

    if (Array.isArray(expected)) {
      if (expected.indexOf(actual) === -1) {
        utils.log.fail(
          'invalid value type for "' + key + '" in ' + filename +
          ': expected ' + expected.join(' or ') + ', got ' + actual
        );
      }
    } else {
      if (actual !== expected) {
        utils.log.fail(
          'invalid value type for "' + key + '" in ' + filename +
          ': expected ' + expected + ', got ' + actual
        );
      }
    }
  }
}

module.exports = validate;
