interface RuleArray extends Array<string> {
  re?: RegExp;
}

interface RuleSet {
  ignore: RuleArray;
  watch: RuleArray;
}

interface RuleAccessor {
  test(pattern: string | string[]): void;
  add(pattern: string | string[]): void;
}

interface Rules {
  reset(): void;
  load(filename: string, callback: (err: Error | null, rules?: RuleSet) => void): void;
  ignore: RuleAccessor;
  watch: RuleAccessor;
  add(rules: RuleSet, type: string, pattern: string): void;
  rules: RuleSet;
}

declare const rules: Rules;
export = rules;
