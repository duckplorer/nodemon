'use strict';
/*global describe, it, afterEach, beforeEach */
var assert = require('assert');
var validate = require('../../lib/config/validate');
var utils = require('../../lib/utils');

describe('config validate', function () {
  var messages = [];
  var originalFail;

  beforeEach(function () {
    messages = [];
    originalFail = utils.log.fail;
    utils.log.fail = function (msg) {
      messages.push(msg);
    };
  });

  afterEach(function () {
    utils.log.fail = originalFail;
  });

  it('should warn on unknown config keys', function () {
    validate({ watc: ['*.js'], fooBar: true }, 'nodemon.json');
    assert.equal(messages.length, 2);
    assert(messages[0].indexOf('unknown config key "watc"') !== -1);
    assert(messages[1].indexOf('unknown config key "fooBar"') !== -1);
  });

  it('should not warn on valid config keys', function () {
    validate({ watch: ['*.js'], ignore: ['node_modules'], verbose: true }, 'nodemon.json');
    assert.equal(messages.length, 0);
  });

  it('should warn on invalid value types', function () {
    validate({ verbose: 'yes' }, 'nodemon.json');
    assert.equal(messages.length, 1);
    assert(messages[0].indexOf('invalid value type for "verbose"') !== -1);
    assert(messages[0].indexOf('expected boolean but got string') !== -1);
  });

  it('should accept multi-type keys', function () {
    validate({ delay: 500 }, 'nodemon.json');
    assert.equal(messages.length, 0);
    validate({ delay: '500ms' }, 'nodemon.json');
    assert.equal(messages.length, 0);
  });

  it('should warn when multi-type key gets wrong type', function () {
    validate({ delay: true }, 'nodemon.json');
    assert.equal(messages.length, 1);
    assert(messages[0].indexOf('expected number or string') !== -1);
  });

  it('should not warn on null or undefined values', function () {
    validate({ verbose: null, delay: undefined }, 'nodemon.json');
    assert.equal(messages.length, 0);
  });

  it('should return early for non-object settings', function () {
    validate(null, 'nodemon.json');
    validate(undefined, 'nodemon.json');
    validate('string', 'nodemon.json');
    validate([1, 2], 'nodemon.json');
    assert.equal(messages.length, 0);
  });

  it('should detect array vs object type correctly', function () {
    validate({ watch: { dir: 'src' } }, 'nodemon.json');
    assert.equal(messages.length, 1);
    assert(messages[0].indexOf('expected array or boolean but got object') !== -1);
  });

  it('should accept watch: false (boolean)', function () {
    validate({ watch: false }, 'nodemon.json');
    assert.equal(messages.length, 0);
  });

  it('should warn on nodemonConfig key in standalone nodemon.json', function () {
    validate({ nodemonConfig: { watch: ['src'] } }, 'nodemon.json');
    assert.equal(messages.length, 1);
    assert(messages[0].indexOf('unknown config key "nodemonConfig"') !== -1);
  });

  it('should include config file path in warning messages', function () {
    validate({ unknownKey: true }, '/path/to/nodemon.json');
    assert.equal(messages.length, 1);
    assert(messages[0].indexOf('/path/to/nodemon.json') !== -1);
  });
});
