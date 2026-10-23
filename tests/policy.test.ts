import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPolicyEngine, wrapToolHandler } from 'mcp-policy-kit';
import { activePolicy, policyEngine } from '../apps/gateway/src/policy';
import { TOOL_NAMES } from '@permissionos/shared';

describe('T-18 / Policy Engine: mcp-policy-kit evaluation & contracts', () => {
  it('validates active policy and computes SHA-256 hash', () => {
    assert.equal(activePolicy.version, '2026-10-22.1');
    assert.equal(activePolicy.defaultEffect, 'deny');
    const hash = policyEngine.getHash();
    assert.ok(hash && hash.length === 64, 'Must compute 64-character hex hash');
  });

  it('allows read_order for operator and approver roles', () => {
    const opDecision = policyEngine.evaluate({
      tool: TOOL_NAMES.READ_ORDER,
      actorRole: 'operator',
      args: { orderId: '1042' },
    });
    assert.equal(opDecision.effect, 'allow');
    assert.equal(opDecision.reasonCode, 'READ_ALLOWED');

    const apprDecision = policyEngine.evaluate({
      tool: TOOL_NAMES.READ_ORDER,
      actorRole: 'approver',
      args: { orderId: '1042' },
    });
    assert.equal(apprDecision.effect, 'allow');
  });

  it('requires human approval for update_delivery_address by operator', () => {
    const decision = policyEngine.evaluate({
      tool: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      actorRole: 'operator',
      args: { orderId: '1042', address: '45 Office Park, Jaipur' },
    });
    assert.equal(decision.effect, 'approve');
    assert.equal(decision.reasonCode, 'SENSITIVE_WRITE');
    assert.equal(decision.approvalTtlSeconds, 300);
  });

  it('strictly denies export_all_customers regardless of actor role', () => {
    const opDecision = policyEngine.evaluate({
      tool: TOOL_NAMES.EXPORT_ALL_CUSTOMERS,
      actorRole: 'operator',
    });
    assert.equal(opDecision.effect, 'deny');
    assert.equal(opDecision.reasonCode, 'BULK_EXPORT_BLOCKED');

    const apprDecision = policyEngine.evaluate({
      tool: TOOL_NAMES.EXPORT_ALL_CUSTOMERS,
      actorRole: 'approver',
    });
    assert.equal(apprDecision.effect, 'deny');
  });

  it('defaults to deny for unknown tools or roles', () => {
    const unknownTool = policyEngine.evaluate({
      tool: 'delete_system_database',
      actorRole: 'operator',
    });
    assert.equal(unknownTool.effect, 'deny');

    const unauthorizedRole = policyEngine.evaluate({
      tool: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      actorRole: 'guest',
    });
    assert.equal(unauthorizedRole.effect, 'deny');
  });

  it('fails closed on malformed policy documents', () => {
    assert.throws(() => {
      createPolicyEngine({
        version: 'bad-policy',
        rules: 'not-an-array',
      });
    });
  });

  it('wrapToolHandler never invokes handler when policy denies or requires approval', async () => {
    let handlerCalled = false;
    const mockHandler = async () => {
      handlerCalled = true;
      return { data: 'leaked' };
    };

    const wrapped = wrapToolHandler(mockHandler, policyEngine);

    // 1. Denied call
    const denyResult = await wrapped(
      { tool: TOOL_NAMES.EXPORT_ALL_CUSTOMERS, actorRole: 'operator' },
      {}
    );
    assert.equal(denyResult.executed, false);
    assert.equal(handlerCalled, false, 'Handler must never execute on DENY');

    // 2. Approve call
    const approveResult = await wrapped(
      { tool: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS, actorRole: 'operator' },
      {}
    );
    assert.equal(approveResult.executed, false);
    assert.equal(handlerCalled, false, 'Handler must never execute on APPROVE');
  });
});
