// Ambient shim so these TypeScript examples type-check in isolation, without
// adding `@types/node` to the SDK's own build. A real application gets `process`
// (and the rest of the Node types) automatically from `@types/node` — you do NOT
// need this file in your own project.
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): void;
};
