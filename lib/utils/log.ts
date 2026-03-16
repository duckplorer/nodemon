import colour = require('./colour');
import bus = require('./bus');

/** The supported log level types */
type LogType = 'log' | 'info' | 'status' | 'detail' | 'fail' | 'error';

/** Colour names corresponding to each log type */
type ColourName = 'black' | 'yellow' | 'green' | 'red';

/** The event payload emitted on the bus for log events */
interface LogEvent {
  type: LogType;
  message: string;
  colour: string;
}

/** Mapping from log type to its display colour */
const coding: Record<LogType, ColourName> = {
  log: 'black',
  info: 'yellow',
  status: 'green',
  detail: 'yellow',
  fail: 'red',
  error: 'red',
};

let required: boolean = false;
let useColours: boolean = true;

function log(type: LogType, text: string): void {
  let msg: string = '[nodemon] ' + (text || '');

  if (useColours) {
    msg = colour(coding[type], msg);
  }

  // always push the message through our bus, using nextTick
  // to help testing and get _out of_ promises.
  process.nextTick(() => {
    bus.emit('log', { type: type, message: text, colour: msg } as LogEvent);
  });

  // but if we're running on the command line, also echo out
  if (!required) {
    if (type === 'error') {
      console.error(msg);
    } else {
      console.log(msg || '');
    }
  }
}

/** The Logger interface describing all available methods and properties */
interface ILogger {
  log(text: string): void;
  info(text: string): void;
  status(text: string): void;
  detail(text: string): void;
  fail(text: string): void;
  error(text: string): void;
  required(val: boolean): void;
  _log(type: LogType, msg?: string): void;
  debug: boolean;
  useColours: boolean;
}

/** Logger constructor type that supports both `new Logger(r)` and `Logger(r)` */
interface LoggerConstructor {
  new (r: boolean): ILogger;
  (r: boolean): ILogger;
  prototype: ILogger;
}

const Logger = function (this: ILogger | void, r: boolean): ILogger {
  if (!(this instanceof (Logger as unknown as LoggerConstructor))) {
    return new (Logger as unknown as LoggerConstructor)(r);
  }
  (this as ILogger).required(r);
  return this as ILogger;
} as unknown as LoggerConstructor;

(Object.keys(coding) as LogType[]).forEach(function (type: LogType): void {
  Logger.prototype[type] = log.bind(null, type);
});

// detail is for messages that are turned on during debug
Logger.prototype.detail = function (this: ILogger, msg: string): void {
  if (this.debug) {
    log('detail', msg);
  }
};

Logger.prototype.required = function (_val: boolean): void {
  required = _val;
};

Logger.prototype.debug = false;

Logger.prototype._log = function (type: LogType, msg?: string): void {
  if (required) {
    bus.emit('log', {
      type: type,
      message: msg || '',
      colour: msg || '',
    } as LogEvent);
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
