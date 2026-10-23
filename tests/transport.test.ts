import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../apps/gateway/src/index';

describe('T-01 & T-14 / Transport: MCP Streamable HTTP, Protocol & Origin Validation', () => {
  let server: http.Server;
  let port: number;

  before(async () => {
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

  it('T-01: MCP initialize returns 2025-11-25 protocol version', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.result.protocolVersion, '2025-11-25');
    assert.equal(body.result.serverInfo.name, 'permissionos-gateway');
  });

  it('T-01: lists 4 discoverable tools via tools/list', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    const tools = body.result.tools;
    assert.equal(tools.length, 4);
    const names = tools.map((t: any) => t.name);
    assert.ok(names.includes('read_order'));
    assert.ok(names.includes('update_delivery_address'));
    assert.ok(names.includes('export_all_customers'));
    assert.ok(names.includes('get_action_status'));
  });

  it('PRD 7.1: GET /mcp returns HTTP 405 Method Not Allowed when SSE not offered', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'GET',
    });
    assert.equal(res.status, 405);
  });

  it('T-14: Invalid Origin returns HTTP 403 before tool execution', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-attacker-site.com',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
      }),
    });

    assert.equal(res.status, 403);
  });
});
