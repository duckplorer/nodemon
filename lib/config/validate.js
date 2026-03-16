var utils = require('../utils');

module.exports = validateConfig;

// Known valid keys for nodemon.json / nodemonConfig in package.json.
// Derived from NodemonSettings in index.d.ts, CLI parse options, and defaults.
var knownKeys = [
  // from NodemonConfig
  'restartable',
  'colours',
  'execMap',
  'ignoreRoot',
  'watch',
  'ignore',
  'stdin',
  'runOnChangeOnly',
  'verbose',
  'signal',
  'stdout',
  'watchOptions',
  'help',
  'version',
  'cwd',
  'dump',
  'delay',
  'monitor',
  'spawn',
  'noUpdateNotifier',
  'legacyWatch',
  'pollingInterval',
  'js',
  'quiet',
  'configFile',
  'exitCrash',
  'execOptions',
  // from NodemonExecOptions
  'script',
  'scriptPosition',
  'args',
  'ext',
  'exec',
  'execArgs',
  'nodeArgs',
  // from NodemonSettings
  'events',
  'env',
  // legacy/undocumented but used internally
  'watch_interval',
  'watchInterval',
];

// Expected types for keys that have a specific type requirement.
// Values can be a string (single type) or an array of strings (multiple valid types).
var expectedTypes = {
  restartable: ['string', 'boolean'],
  colours: 'boolean',
  execMap: 'object',
  ignoreRoot: 'array',
  watch: ['array', 'boolean'],
  ignore: ['array', 'string'],
  stdin: 'boolean',
  runOnChangeOnly: 'boolean',
  verbose: 'boolean',
  signal: 'string',
  stdout: 'boolean',
  watchOptions: 'object',
  delay: ['number', 'string'],
  spawn: 'boolean',
  noUpdateNotifier: 'boolean',
  legacyWatch: 'boolean',
  pollingInterval: 'number',
  js: 'boolean',
  quiet: 'boolean',
  configFile: 'string',
  exitCrash: 'boolean',
  script: 'string',
  ext: 'string',
  exec: ['string', 'array'],
  execArgs: 'array',
  nodeArgs: 'array',
  events: 'object',
  env: 'object',
  cwd: 'string',
  args: 'array',
};

/**
 * Validates a parsed config object from nodemon.json or package.json nodemonConfig.
 * Logs warnings for unknown keys and invalid value types.
 *
 * @param {Object} settings - the parsed config object
 * @param {string} configFile - path to the config file (for log messages)
 */
function validateConfig(settings, configFile) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return;
  }

  var keys = Object.keys(settings);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = settings[key];

    // Check for unknown keys
    if (knownKeys.indexOf(key) === -1) {
      utils.log.fail(
        'unknown config key "' + key + '" in ' + configFile
      );
      continue;
    }

    // Check value types for keys that have type expectations
    if (expectedTypes[key] !== undefined && value !== null && value !== undefined) {
      var expected = expectedTypes[key];
      var actualType = Array.isArray(value) ? 'array' : typeof value;

      var valid;
      if (Array.isArray(expected)) {
        valid = expected.indexOf(actualType) !== -1;
      } else {
        valid = actualType === expected;
      }

      if (!valid) {
        var expectedStr = Array.isArray(expected) ? expected.join(' or ') : expected;
        utils.log.fail(
          'invalid value type for "' + key + '" in ' + configFile +
          ', expected ' + expectedStr + ' but got ' + actualType
        );
      }
    }
  }
}
