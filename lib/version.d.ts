interface VersionFn {
  (callback?: (err: Error | null, version?: string) => void): Promise<string>;
  pinned?: string;
  pin(): Promise<void>;
}

declare const version: VersionFn;
export = version;
