import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { approvalService } from '../apps/gateway/src/approvals';
import { seedDemoData } from '../scripts/seed-demo';
import { dbService } from '../apps/gateway/src/db';
import { upstreamOrderStore } from '../apps/demo-upstream/src/orders/db';
import { DEMO_ORDERS, TOOL_NAMES } from '@permissionos/shared';

describe('T-03 through T-10 / Human Approval Lifecycle & Idempotency', () => {
  beforeEach(async () => {
    await seedDemoData();
    upstreamOrderStore.seedDefaults();
  });

  it('T-03: Update request creates pending approval and leaves database unchanged', () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      ttlSeconds: 300,
      correlationId: 'test_corr_01',
    });

    assert.equal(approval.status, 'pending');
    assert.ok(approval.id.startsWith('apr_'));
    assert.ok(approval.action_id.startsWith('act_'));

    // Verify synthetic order is UNCHANGED in upstream store
    const currentOrder = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(currentOrder.address, DEMO_ORDERS.INITIAL_ADDRESS);
    assert.equal(currentOrder.version, 1);
  });

  it('T-04: Authenticated separate approver accepts -> address updated and marked executed', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      correlationId: 'test_corr_02',
    });

    const resolution = await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'usr_approver_sarah',
        decidedByRole: 'approver',
        correlationId: 'test_corr_02_res',
      },
      async (actionId, toolName, args, version) => {
        return upstreamOrderStore.updateDeliveryAddress(actionId, args.orderId, args.address, version);
      }
    );

    assert.equal(resolution.status, 'executed');

    // Verify order address in upstream store is now the proposed address
    const updated = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(updated.address, DEMO_ORDERS.PROPOSED_ADDRESS);
    assert.equal(updated.version, 2);

    // Verify approval record updated in DB
    const dbRecord = approvalService.getApproval(approval.id);
    assert.equal(dbRecord?.status, 'executed');
    assert.equal(dbRecord?.decided_by, 'usr_approver_sarah');
  });

  it('T-05: Replaying the same approval or duplicate execution is idempotent', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      correlationId: 'test_corr_03',
    });

    // First execution
    await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'usr_approver_sarah',
        decidedByRole: 'approver',
        correlationId: 'test_corr_03',
      },
      async (actionId, toolName, args, version) => {
        return upstreamOrderStore.updateDeliveryAddress(actionId, args.orderId, args.address, version);
      }
    );

    // Second resolution attempt on same approvalId
    const secondResolution = await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'usr_approver_sarah',
        decidedByRole: 'approver',
        correlationId: 'test_corr_03_replay',
      },
      async (actionId, toolName, args, version) => {
        return upstreamOrderStore.updateDeliveryAddress(actionId, args.orderId, args.address, version);
      }
    );

    assert.equal(secondResolution.status, 'invalid_state');

    // And direct invocation with same actionId does not double mutate
    const directReplay = upstreamOrderStore.updateDeliveryAddress(
      approval.action_id,
      DEMO_ORDERS.PRIMARY_ORDER_ID,
      DEMO_ORDERS.PROPOSED_ADDRESS
    );
    assert.equal(directReplay.alreadyApplied, true);
    assert.equal(directReplay.order.version, 2, 'Version must not increment twice');
  });

  it('T-07: Operator trying to self-approve is prohibited (403/Forbidden)', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      correlationId: 'test_corr_04',
    });

    const resolution = await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'usr_op_alexa', // Self-approval!
        decidedByRole: 'approver', // Attempting to use approver role with own ID
        correlationId: 'test_corr_04',
      },
      async () => {
        throw new Error('Should not be called');
      }
    );

    assert.equal(resolution.status, 'forbidden');
    const order = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(order.address, DEMO_ORDERS.INITIAL_ADDRESS);
  });

  it('T-08: Rejecting an approval leaves database unchanged and sets status to rejected', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      correlationId: 'test_corr_05',
    });

    const resolution = await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'reject',
        decidedBy: 'usr_approver_sarah',
        decidedByRole: 'approver',
        correlationId: 'test_corr_05',
      },
      async () => {
        throw new Error('Should not execute on rejection');
      }
    );

    assert.equal(resolution.status, 'rejected');
    const order = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(order.address, DEMO_ORDERS.INITIAL_ADDRESS);
  });

  it('T-09: Expired approval (> 5 min TTL) cannot execute', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      ttlSeconds: -10, // Expired in past!
      correlationId: 'test_corr_06',
    });

    const resolution = await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'usr_approver_sarah',
        decidedByRole: 'approver',
        correlationId: 'test_corr_06',
      },
      async () => {
        throw new Error('Should not execute on expired approval');
      }
    );

    assert.equal(resolution.status, 'expired');
    const order = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(order.address, DEMO_ORDERS.INITIAL_ADDRESS);
  });

  it('T-10: Stale order version causes conflict and prevents overwrite', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1, // Created when version was 1
      reasonCode: 'SENSITIVE_WRITE',
      correlationId: 'test_corr_07',
    });

    // In the meantime, another change happened upstream bumping version to 2
    upstreamOrderStore.updateDeliveryAddress('concurrent_act_99', DEMO_ORDERS.PRIMARY_ORDER_ID, '99 Interim Way');

    const resolution = await approvalService.resolveApproval(
      {
        approvalId: approval.id,
        decision: 'approve',
        decidedBy: 'usr_approver_sarah',
        decidedByRole: 'approver',
        correlationId: 'test_corr_07',
      },
      async (actionId, toolName, args, version) => {
        return upstreamOrderStore.updateDeliveryAddress(actionId, args.orderId, args.address, version);
      }
    );

    assert.equal(resolution.status, 'conflicted');
    const finalOrder = upstreamOrderStore.getOrder(DEMO_ORDERS.PRIMARY_ORDER_ID);
    assert.equal(finalOrder.address, '99 Interim Way', 'Must not overwrite newer version');
  });

  it('T-06: Two concurrent approvals -> Only one transition from pending to executing', async () => {
    const approval = approvalService.createPendingApproval({
      actorId: 'usr_op_alexa',
      toolName: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      args: { orderId: DEMO_ORDERS.PRIMARY_ORDER_ID, address: DEMO_ORDERS.PROPOSED_ADDRESS },
      policyVersion: '2026-10-22.1',
      resourceVersion: 1,
      reasonCode: 'SENSITIVE_WRITE',
      correlationId: 'test_corr_08',
    });

    const [res1, res2] = await Promise.all([
      approvalService.resolveApproval(
        {
          approvalId: approval.id,
          decision: 'approve',
          decidedBy: 'usr_approver_sarah',
          decidedByRole: 'approver',
          correlationId: 'test_corr_08_a',
        },
        async (actionId, toolName, args, version) => {
          return upstreamOrderStore.updateDeliveryAddress(actionId, args.orderId, args.address, version);
        }
      ),
      approvalService.resolveApproval(
        {
          approvalId: approval.id,
          decision: 'approve',
          decidedBy: 'usr_approver_sarah',
          decidedByRole: 'approver',
          correlationId: 'test_corr_08_b',
        },
        async (actionId, toolName, args, version) => {
          return upstreamOrderStore.updateDeliveryAddress(actionId, args.orderId, args.address, version);
        }
      ),
    ]);

    const statuses = [res1.status, res2.status];
    assert.ok(statuses.includes('executed'), 'One call must succeed and transition to executed');
    assert.ok(
      statuses.includes('conflict') || statuses.includes('invalid_state'),
      'The concurrent caller must be rejected due to atomic status claim'
    );
  });
});
