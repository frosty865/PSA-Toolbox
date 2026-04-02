declare module "vitest" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function expect(value: unknown): {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toContain: (expected: unknown) => void;
    toHaveLength: (expected: number) => void;
    toBeDefined: () => void;
    toBeTruthy: () => void;
    toMatch: (expected: RegExp | string) => void;
    toBeGreaterThan: (expected: number) => void;
    toBeGreaterThanOrEqual: (expected: number) => void;
    toBeLessThanOrEqual: (expected: number) => void;
    not: {
      toBe: (expected: unknown) => void;
      toEqual: (expected: unknown) => void;
    };
  };
}
