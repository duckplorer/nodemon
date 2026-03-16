declare module 'pstree.remy' {
  interface PsTree {
    (pid: number, callback: (err: Error | null, pids: number[]) => void): void;
    hasPS: boolean;
  }
  const psTree: PsTree;
  export = psTree;
}
