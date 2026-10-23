
## Quick start (one command)

Requirements: Node.js 22+ and npm 10+. After connecting the separate `mcp-policy-kit` GitHub repository as described in `docs/POLICY_KIT_INTEGRATION.md`, install dependencies and seed the demo database:

```bash
npm install
npm run db:seed
npm run dev:all
```

Open **http://localhost:5173**. `dev:all` starts the gateway (4000), demo upstream service (4001), and web UI (5173) from the repository root. Stop all three with Ctrl+C. For separate terminals, use `npm run dev:gateway`, `npm run dev:upstream`, and `npm run dev:web`.

> The policy kit source is intentionally maintained as a separate repository. Replace `REPLACE_WITH_GITHUB_USERNAME` in the root `package.json` with the owner of your new `mcp-policy-kit` GitHub repository before running `npm install`.

# PermissionOS

> **The Human Approval Layer for AI Agents (Model Context Protocol Gateway)**

PermissionOS is a self-hosted Model Context Protocol (MCP) gateway that prevents AI assistants from executing unauthorized tool operations. It intercepts MCP tool calls, authenticates the caller, validates tool arguments against strict schemas, evaluates a deterministic policy via `mcp-policy-kit`, and enforces one of three outcomes: **ALLOW**, **REQUIRE APPROVAL**, or **DENY**.

It also records an attributable, structured audit trail of requests, decisions, approvals, and downstream execution outcomes with persistent SQLite storage and idempotency guarantees.

---

## 🏛️ Architecture Overview

```
                      React Console / Alexa+-style Simulator
                                         │
                                         ▼
                      Server-side Demo Client / Intent Router
                                         │
                                         ▼ MCP Streamable HTTP (2025-11-25)
                          PermissionOS Gateway (Port 4000)
                                         │
         ├── Input Validation (Zod) & Server-Verified Actor Context
         ├── Deterministic Policy Evaluation (mcp-policy-kit)
         └── SQLite Approvals & Audit Trail
                 │
                 ├── [ALLOW]  ──────► Downstream MCP Client ──────► Demo Upstream Order MCP (Port 4001)
                 │                                                          │
                 ├── [APPROVE] ─────► SQLite Pending Approval (5 min TTL)    │
                 │                            │                             │
                 │                            ▼                             │
                 │                     Human Approval UI                    │
                 │                            │                             │
                 │              Atomic Claim + actionId Recheck             │
                 │                            │                             │
                 │                            ▼                             │
                 │                     Downstream MCP Client ───────────────┘
                 │
                 └── [DENY]   ──────► Audit Event + Safe Error (Downstream NEVER Invoked)
```

---

## 📁 Monorepo Structure

```
permissionos/
├── apps/
│   ├── web/                    # React + Vite + Tailwind Console & Approval UI
│   │   └── src/
│   │       ├── pages/          # Console (/), Approvals (/approvals), Audit (/audit), About (/about)
│   │       └── lib/api.ts      # REST API client
│   ├── gateway/                # Core MCP Gateway & REST API (Port 4000)
│   │   └── src/
│   │       ├── approvals/      # Approval lifecycle & atomic claim (PRD Section 9)
│   │       ├── audit/          # Audit event logger & taxonomy (PRD Section 10.1)
│   │       ├── auth/           # Session cookie & bearer token actor verification (PRD Section 11)
│   │       ├── db/             # better-sqlite3 with WAL mode, transactions, migrations
│   │       ├── mcp/            # Gateway MCP Server & Upstream Client
│   │       ├── policy/         # Policy loader initializing mcp-policy-kit
│   │       ├── routes/         # Express REST API routes (/api/* and /mcp)
│   │       └── index.ts        # Gateway application entry point
│   └── demo-upstream/          # Independent Downstream MCP Server (Port 4001)
│       └── src/
│           ├── orders/         # Synthetic order state (Order 1042, versioning, applied_actions)
│           └── mcp/            # Real MCP tool handlers (read_order, update_delivery_address, export)
├── packages/
│   └── shared/                 # Shared domain types, strict Zod schemas, constants
├── policies/
│   └── default.json            # P0 Policy definition (PRD Section 8.1)
├── migrations/
│   └── 001_initial.sql         # SQLite schema: users, orders, approvals, audit_events, etc.
├── scripts/
│   ├── seed-demo.ts            # Seeds 2 operators, 1 approver, 1 admin, orders & API keys
│   └── reset-demo.ts           # Restores known initial demo state
├── tests/                      # Automated test suite (PRD Section 14)
│   ├── policy.test.ts          # T-18: mcp-policy-kit rules, precedence & handler isolation
│   ├── transport.test.ts       # T-01, T-14: 2025-11-25 MCP Streamable HTTP, GET 405, Origin 403
│   ├── approvals.test.ts       # T-03..T-10: Pending creation, atomic claim, self-approval prevention, expiry
│   ├── security.test.ts        # T-11..T-13: Bulk export zero-call guarantee, malformed inputs, auth
│   └── e2e.test.ts             # T-02, T-04, T-11, T-17: End-to-end 3 user journeys
├── .env.example
├── LICENSE
├── README.md
└── package.json
```

---

## 🚀 Quickstart & Commands

1. Use Node.js 22+ and npm 10+.
2. Connect the separate `mcp-policy-kit` repository first. Follow [`docs/POLICY_KIT_INTEGRATION.md`](docs/POLICY_KIT_INTEGRATION.md) and replace the placeholder Git URL in `package.json`.
3. From the PermissionOS repository root run:

```bash
npm install
npm run db:seed
npm run dev:all
```

Open **http://localhost:5173**. The root `dev:all` command starts all three services together: web UI (5173), gateway/API (4000), and demo upstream (4001). Press Ctrl+C to stop them.

Useful commands:
- `npm run dev:web` — UI only (gateway and upstream must already be running).
- `npm run dev:gateway` — gateway/API only.
- `npm run dev:upstream` — demo downstream service only.
- `npm test` — PermissionOS automated tests.
- `npm run db:reset` — reset the demo database.

## 🎯 Three Core Demo Journeys

1. **Journey A — Immediate Read (ALLOW):**
   - Operator queries: `"Where is order 1042?"`
   - Gateway policy evaluates `read_order` as `allow`. Calls downstream MCP service.
   - Returns seeded status `"Out for delivery"` and starting address `"12 Market Road, Jaipur"`.

2. **Journey B — Sensitive Mutation (REQUIRE APPROVAL):**
   - Operator requests: `"Update order 1042's delivery address to 45 Office Park, Jaipur"`
   - Gateway policy evaluates `update_delivery_address` as `approve`.
   - Creates a pending approval with immutable SHA-256 argument hash, actor identity, and 5-minute TTL.
   - Downstream order is **not** modified while pending.
   - Human Approver logs in, reviews diff, and clicks **Approve**.
   - Gateway atomically claims ticket and executes mutation with stable `actionId`. Idempotency protects against replay attacks.

3. **Journey C — Prohibited Operation (DENY):**
   - Operator requests: `"Export every customer's name and address"`
   - Gateway policy evaluates `export_all_customers` as `deny`.
   - Request is blocked immediately with reason `BULK_EXPORT_BLOCKED`.
   - The downstream export handler is **never** invoked (invocation count strictly remains 0).

---

## 📦 Open Source Package: `mcp-policy-kit`

`mcp-policy-kit` is maintained in a separate repository and integrated as a Git dependency. See `docs/POLICY_KIT_INTEGRATION.md`.
- Zod-validated versioned policy schema.
- Unambiguous precedence algorithm (`DENY` > `APPROVE` > `ALLOW`).
- `wrapToolHandler`: Higher-order function that guarantees denied or pending handlers are never executed.

---

## 📄 License
[MIT](LICENSE)
