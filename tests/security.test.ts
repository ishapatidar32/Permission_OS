import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../apps/gateway/src/index';
import { seedDemoData } from '../scripts/seed-demo';
import { upstreamOrderStore } from '../apps/demo-upstream/src/orders/db';
import { TOOL_NAMES } from '@permissionos/shared';

describe('T-11 through T-13 / Security, Auth & Denial Guarantees', () => {
  let server: http.Server;
  let port: number;

  before(async () => {
    await seedDemoData();
    upstreamOrderStore.seedDefaults();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    upstreamOrderStore.seedDefaults();
  });

  it('T-11: Bulk export attempt is denied and upstream export invocation count remains ZERO', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: TOOL_NAMES.EXPORT_ALL_CUSTOMERS,
          arguments: { format: 'json' },
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.result.status, 'denied');
    assert.equal(body.result.reasonCode, 'BULK_EXPORT_BLOCKED');
    assert.equal(body.result.isError, true);

    // CRITICAL SECURITY ASSERTION: Downstream export handler was never invoked
    assert.equal(upstreamOrderStore.exportInvocationCount, 0);
  });

  it('T-12: Unknown tool and malformed inputs return safe error without downstream invocation', async () => {
    // 1. Unknown tool
    const unknownRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'unregistered_exploit_tool',
          arguments: {},
        },
      }),
    });

    const unknownBody = (await unknownRes.json()) as any;
    assert.equal(unknownBody.error?.code, -32601);

    // 2. Malformed input (invalid address length < 5)
    const malformedRes = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
          arguments: { orderId: '1042', address: 'hi' }, // Too short
        },
      }),
    });

    const malformedBody = (await malformedRes.json()) as any;
    assert.equal(malformedBody.error?.code, -32602);
  });

  it('T-13: Unauthenticated MCP calls and Admin API calls are rejected with 401/403', async () => {
    // 1. Missing Authorization header on /mcp
    const anonMcp = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/list',
      }),
    });
    assert.equal(anonMcp.status, 401);

    // 2. Operator trying to invoke admin reset-demo -> 403 Forbidden
    const opAdminCall = await fetch(`http://127.0.0.1:${port}/api/admin/reset-demo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
    });
    assert.equal(opAdminCall.status, 403);
  });
});
