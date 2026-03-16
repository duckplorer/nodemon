import colour = require('./colour');
import bus = require('./bus');

var required: boolean = false;
var useColours: boolean = true;

/** Maps log message types to their terminal colour names. */
interface LogTypeCoding {
  [key: string]: string;
}

/** The payload emitted on the bus for each log event. */
interface LogEventData {
  type: string;
  message: string;
  colour: string;
}

var coding: LogTypeCoding = {
  log: 'black',
  info: 'yellow',
  status: 'green',
  detail: 'yellow',
  fail: 'red',
  error: 'red',
};

function log(type: string, text: string): void {
  var msg: string = '[nodemon] ' + (text || '');

  if (useColours) {
    msg = colour(coding[type], msg);
  }

  // always push the message through our bus, using nextTick
  // to help testing and get _out of_ promises.
  process.nextTick(() => {
    bus.emit('log', { type: type, message: text, colour: msg } as LogEventData);
  });

  // but if we're running on the command line, also echo out
  // question: should we actually just consume our own events?
  if (!required) {
    if (type === 'error') {
      console.error(msg);
    } else {
      console.log(msg || '');
    }
  }
}

/** A log-type method that writes a prefixed, coloured message. */
interface LogMethod {
  (msg: string): void;
}

/** The Logger instance shape after construction, including dynamic log methods. */
interface ILogger {
  debug: boolean;
  useColours: boolean;
  log: LogMethod;
  info: LogMethod;
  status: LogMethod;
  fail: LogMethod;
  error: LogMethod;
  detail(msg: string): void;
  required(val: boolean): void;
  _log(type: string, msg?: string): void;
}

interface LoggerConstructor {
  new (r: boolean): ILogger;
  (r: boolean): ILogger;
  prototype: ILogger;
}

var Logger = function (this: ILogger | void, r: boolean): ILogger {
  if (!(this instanceof (Logger as Function))) {
    return new (Logger as LoggerConstructor)(r);
  }
  (this as ILogger).required(r);
  return this as ILogger;
} as unknown as LoggerConstructor;

Object.keys(coding).forEach(function (type: string): void {
  (Logger.prototype as any)[type] = log.bind(null, type);
});

// detail is for messages that are turned on during debug
Logger.prototype.detail = function (msg: string): void {
  if (this.debug) {
    log('detail', msg);
  }
};

Logger.prototype.required = function (val: boolean): void {
  required = val;
};

Logger.prototype.debug = false;
Logger.prototype._log = function (type: string, msg?: string): void {
  if (required) {
    bus.emit('log', { type: type, message: msg || '', colour: msg || '' } as LogEventData);
  } else if (type === 'error') {
    console.error(msg);
  } else {
    console.log(msg || '');
  }
};

Object.defineProperty(Logger.prototype, 'useColours', {
  set: function (val: boolean): void {
    useColours = val;
  },
  get: function (): boolean {
    return useColours;
  },
});

export = Logger;
