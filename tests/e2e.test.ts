import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../apps/gateway/src/index';
import { createUpstreamMcpServer } from '../apps/demo-upstream/src/mcp/server';
import { seedDemoData } from '../scripts/seed-demo';
import { upstreamOrderStore } from '../apps/demo-upstream/src/orders/db';
import { DEMO_ORDERS } from '@permissionos/shared';

describe('T-02, T-04, T-11, T-17 / End-to-End Three User Journeys (ALLOW, APPROVE, DENY)', () => {
  let gatewayServer: http.Server;
  let upstreamServer: http.Server;
  let gatewayPort: number;

  before(async () => {
    await seedDemoData();

    // Start downstream server on 4001
    upstreamServer = createUpstreamMcpServer();
    await new Promise<void>((resolve) => {
      upstreamServer.listen(4001, '127.0.0.1', () => resolve());
    });

    // Start gateway server on random port
    await new Promise<void>((resolve) => {
      gatewayServer = app.listen(0, '127.0.0.1', () => {
        const addr = gatewayServer.address() as any;
        gatewayPort = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
    await new Promise<void>((resolve) => gatewayServer.close(() => resolve()));
  });

  beforeEach(async () => {
    upstreamOrderStore.seedDefaults();
    await seedDemoData();
  });

  it('Journey A (ALLOW): Operator queries "Where is order 1042?" and receives seeded order status', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/demo/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        prompt: 'Where is order 1042?',
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ok, true);
    assert.equal(body.data.selectedTool, 'read_order');

    const mcpResult = body.data.mcpResponse.result;
    assert.equal(mcpResult.order.id, DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(mcpResult.order.status, DEMO_ORDERS.INITIAL_STATUS);
    assert.equal(mcpResult.order.address, DEMO_ORDERS.INITIAL_ADDRESS);
  });

  it('Journey B (REQUIRE APPROVAL): Operator requests address update -> holds -> Approver approves -> applied', async () => {
    // 1. Operator proposes address change
    const intentRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/demo/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        prompt: "Update order 1042's delivery address to 45 Office Park, Jaipur",
      }),
    });

    assert.equal(intentRes.status, 200);
    const intentBody = (await intentRes.json()) as any;
    const mcpResult = intentBody.data.mcpResponse.result;

    assert.equal(mcpResult.status, 'approval_required');
    const approvalId = mcpResult.approvalId;
    assert.ok(approvalId.startsWith('apr_'));

    // Verify address is STILL unchanged
    const orderBefore = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(orderBefore.address, DEMO_ORDERS.INITIAL_ADDRESS);

    // 2. Approver reviews and approves
    const approveRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/approvals/${approvalId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-approver-token',
      },
      body: JSON.stringify({
        decision: 'approve',
      }),
    });

    assert.equal(approveRes.status, 200);
    const approveBody = (await approveRes.json()) as any;
    assert.equal(approveBody.ok, true);
    assert.equal(approveBody.data.status, 'executed');

    // Verify order address in downstream is now the approved address
    const orderAfter = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(orderAfter.address, DEMO_ORDERS.PROPOSED_ADDRESS);
    assert.equal(orderAfter.version, 2);
  });

  it('Journey C (DENY): Operator requests bulk customer export -> Blocked immediately with zero downstream call', async () => {
    const res = await fetch(`http://127.0.0.1:${gatewayPort}/api/demo/intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-operator-token',
      },
      body: JSON.stringify({
        prompt: "Export every customer's name and address",
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    const mcpResult = body.data.mcpResponse.result;

    assert.equal(mcpResult.status, 'denied');
    assert.equal(mcpResult.reasonCode, 'BULK_EXPORT_BLOCKED');
    assert.equal(mcpResult.isError, true);

    // Verify export counter is ZERO
    assert.equal(upstreamOrderStore.exportInvocationCount, 0);
  });
});
