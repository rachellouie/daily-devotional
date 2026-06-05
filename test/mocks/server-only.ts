// Empty module — server-only throws in plain Node.js context (its "default"
// conditional export). Vitest runs in Node so we swap it for this no-op.
export {};
