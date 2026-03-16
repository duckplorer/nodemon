interface SignalMap {
  SIGHUP: number;
  SIGINT: number;
  SIGQUIT: number;
  SIGILL: number;
  SIGTRAP: number;
  SIGABRT: number;
  SIGBUS: number;
  SIGFPE: number;
  SIGKILL: number;
  SIGUSR1: number;
  SIGSEGV: number;
  SIGUSR2: number;
  SIGPIPE: number;
  SIGALRM: number;
  SIGTERM: number;
  SIGSTKFLT: number;
  SIGCHLD: number;
  SIGCONT: number;
  SIGSTOP: number;
  SIGTSTP: number;
  SIGTTIN: number;
  SIGTTOU: number;
  SIGURG: number;
  SIGXCPU: number;
  SIGXFSZ: number;
  SIGVTALRM: number;
  SIGPROF: number;
  SIGWINCH: number;
  SIGIO: number;
  SIGPWR: number;
  SIGSYS: number;
  SIGRTMIN: number;
  [key: string]: number;
}

declare const signals: SignalMap;
export = signals;
