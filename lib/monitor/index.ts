import run = require('./run');

/** The watch function type. */
type WatchFunction = () => Promise<string[]> | undefined;

/** The monitor module, providing run and watch functionality. */
interface MonitorModule {
  run: typeof run;
  watch: WatchFunction;
}

const watchModule: { watch: WatchFunction } = require('./watch');

const monitor: MonitorModule = {
  run: run,
  watch: watchModule.watch,
};

export = monitor;
