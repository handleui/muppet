# Database Migration Evaluation Plan

## Tasks Overview
Evaluating database options for migrating Nosis conversation/message CRUD from Tauri/Rust/SQLite desktop app to Cloudflare Workers.

## Task A: Database Comparison
Compare 5 options across 7 criteria:
1. Cloudflare D1 — SQLite-compatible, native binding
2. Neon — Serverless Postgres, HTTP client
3. PlanetScale — MySQL serverless (check current status: free tier shutdown, layoffs)
4. Convex — Reactive BaaS with real-time sync
5. Turso — SQLite/libSQL edge distribution

Evaluation Criteria:
- **Latency from Workers**: Native binding vs HTTP round-trip?
- **Schema Compatibility**: SQLite (TEXT PKs, datetime('now'), CHECK, FK CASCADE) → target
- **Transaction Support**: Atomic UPDATE + INSERT (save_message operation)
- **Migration Tooling**: Schema version management
- **Pricing**: Free tier adequacy for single-user app
- **Complexity**: SDK setup, connection pooling, cold starts
- **Vendor Lock-in**: Switching costs

## Task B: D1 Plan Validation (if D1 recommended)
1. **Hono Framework**
   - bodyLimit middleware per-route override
   - CORS allowMethods config
   - HTTPException usage pattern

2. **Cloudflare D1 API**
   - db.batch() transaction semantics
   - db.prepare().bind().run() return type (meta.changes?)
   - RETURNING clause support
   - FK enforcement (PRAGMA foreign_keys)

3. **Wrangler D1**
   - Migration directory structure
   - wrangler d1 migrations create syntax
   - d1_databases binding format in wrangler.jsonc

4. **crypto.randomUUID()**
   - Available in Workers runtime?

## Research Strategy
1. Use Context7 MCP (resolve-library-id → query-docs) for official documentation
2. Check GitHub repositories for implementation patterns
3. Verify PlanetScale current status
4. Check Cloudflare D1 and Wrangler documentation directly

## Status
Ready to execute research.
