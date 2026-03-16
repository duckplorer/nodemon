import { EventEmitter } from 'events';

/**
 * The central event bus used for decoupled communication between
 * all nodemon subsystems. Extends EventEmitter.
 */
declare const bus: EventEmitter;
export = bus;
