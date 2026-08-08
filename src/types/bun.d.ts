declare module 'bun:test' {
  export const expect: any;
  export const test: (name: string, fn: () => any) => void;
  export const describe: (name: string, fn: () => any) => void;
  export const beforeEach: (fn: () => any) => void;
  export const afterEach: (fn: () => any) => void;
  export const beforeAll: (fn: () => any) => void;
  export const afterAll: (fn: () => any) => void;
}
