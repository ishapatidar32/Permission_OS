import { DEMO_ORDERS, Order } from '@permissionos/shared';

export interface AppliedActionRecord {
  actionId: string;
  orderId: string;
  resultVersion: number;
  executedAt: string;
}

export class UpstreamOrderStore {
  private orders: Map<string, Order> = new Map();
  private appliedActions: Map<string, AppliedActionRecord> = new Map();
  public readInvocationCount = 0;
  public updateInvocationCount = 0;
  public exportInvocationCount = 0;

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults() {
    this.orders.clear();
    this.appliedActions.clear();
    this.readInvocationCount = 0;
    this.updateInvocationCount = 0;
    this.exportInvocationCount = 0;

    const now = new Date().toISOString();

    this.orders.set(DEMO_ORDERS.PRIMARY_ORDER_ID, {
      id: DEMO_ORDERS.PRIMARY_ORDER_ID,
      customer_name: 'Aarav Sharma',
      address: DEMO_ORDERS.INITIAL_ADDRESS,
      status: DEMO_ORDERS.INITIAL_STATUS,
      version: 1,
      updated_at: now,
    });

    this.orders.set('1043', {
      id: '1043',
      customer_name: 'Priya Patel',
      address: '88 Tech City, Bengaluru',
      status: 'Processing',
      version: 1,
      updated_at: now,
    });

    this.orders.set('1044', {
      id: '1044',
      customer_name: 'Rohan Verma',
      address: '19 Civil Lines, Delhi',
      status: 'Delivered',
      version: 1,
      updated_at: now,
    });
  }

  public getOrder(orderId: string): Order {
    this.readInvocationCount++;
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }
    return { ...order };
  }

  public updateDeliveryAddress(
    actionId: string,
    orderId: string,
    newAddress: string,
    expectedVersion?: number | null
  ): { order: Order; alreadyApplied: boolean } {
    // 1. Idempotency check: duplicate actionId must never double-mutate
    if (this.appliedActions.has(actionId)) {
      const existing = this.orders.get(orderId)!;
      return { order: { ...existing }, alreadyApplied: true };
    }

    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    // 2. Optimistic Concurrency check
    if (expectedVersion !== undefined && expectedVersion !== null && order.version !== expectedVersion) {
      throw new Error(
        `Version conflict: expected order version ${expectedVersion}, but found version ${order.version}`
      );
    }

    // 3. Apply mutation
    order.address = newAddress;
    order.version += 1;
    order.updated_at = new Date().toISOString();

    this.appliedActions.set(actionId, {
      actionId,
      orderId,
      resultVersion: order.version,
      executedAt: order.updated_at,
    });

    this.updateInvocationCount++;

    return { order: { ...order }, alreadyApplied: false };
  }

  public exportCustomers(format: 'json' | 'csv' = 'json') {
    this.exportInvocationCount++;
    const customers = Array.from(this.orders.values()).map((o) => ({
      customerName: o.customer_name,
      orderId: o.id,
      address: o.address,
    }));

    if (format === 'csv') {
      const header = 'customerName,orderId,address\n';
      const rows = customers.map((c) => `"${c.customerName}","${c.orderId}","${c.address}"`).join('\n');
      return header + rows;
    }
    return customers;
  }
}

export const upstreamOrderStore = new UpstreamOrderStore();
