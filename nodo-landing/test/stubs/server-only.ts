// Test-only stub for the "server-only" package.
//
// Next.js resolves the real "server-only" package via its own webpack
// config (no node_modules install required) — it throws if imported from
// client-bundled code. Vitest uses plain Vite, which has no such built-in
// resolution, so files importing "server-only" (e.g. lib/mail.ts,
// lib/billing/*.ts) fail to load under vitest with "Cannot find package".
//
// This stub is aliased in vitest.config.ts ONLY for the test environment —
// it does not affect the real Next.js build, where the guard still applies.
export {};
