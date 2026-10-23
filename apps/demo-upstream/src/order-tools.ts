export interface Order {
  id: string;
  customer: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded' | 'cancelled';
  items: Array<{ name: string; quantity: number; price: number }>;
  createdAt: string;
}

const mockOrders: Map<string, Order> = new Map([
  [
    'ord_9981',
    {
      id: 'ord_9981',
      customer: 'acme-corp@example.com',
      amount: 189.5,
      currency: 'USD',
      status: 'completed',
      items: [
        { name: 'Ergonomic Desk Chair', quantity: 1, price: 150.0 },
        { name: 'Desk Mat', quantity: 1, price: 39.5 },
      ],
      createdAt: '2026-10-20T08:30:00Z',
    },
  ],
  [
    'ord_9942',
    {
      id: 'ord_9942',
      customer: 'jane.smith@example.org',
      amount: 45.0,
      currency: 'USD',
      status: 'pending',
      items: [{ name: 'Wireless Mouse', quantity: 1, price: 45.0 }],
      createdAt: '2026-10-21T14:10:00Z',
    },
  ],
  [
    'ord_9910',
    {
      id: 'ord_9910',
      customer: 'dev-team@techcorp.io',
      amount: 1200.0,
      currency: 'USD',
      status: 'completed',
      items: [{ name: '4K Monitor', quantity: 2, price: 600.0 }],
      createdAt: '2026-10-18T10:00:00Z',
    },
  ],
]);

export const orderTools = {
  listOrders: async (params?: { status?: string }): Promise<Order[]> => {
    const all = Array.from(mockOrders.values());
    if (params?.status) {
      return all.filter((o) => o.status === params.status);
    }
    return all;
  },

  getOrder: async (params: { orderId: string }): Promise<Order> => {
    const order = mockOrders.get(params.orderId);
    if (!order) {
      throw new Error(`Order not found with ID: ${params.orderId}`);
    }
    return order;
  },

  createOrder: async (params: {
    customer: string;
    items: Array<{ name: string; quantity: number; price: number }>;
  }): Promise<Order> => {
    const totalAmount = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const newOrder: Order = {
      id: `ord_${Math.floor(1000 + Math.random() * 9000)}`,
      customer: params.customer,
      amount: totalAmount,
      currency: 'USD',
      status: 'pending',
      items: params.items,
      createdAt: new Date().toISOString(),
    };
    mockOrders.set(newOrder.id, newOrder);
    return newOrder;
  },

  refundOrder: async (params: { orderId: string; amount: number; reason?: string }): Promise<Order> => {
    const order = mockOrders.get(params.orderId);
    if (!order) {
      throw new Error(`Order not found with ID: ${params.orderId}`);
    }
    if (order.status === 'refunded') {
      throw new Error(`Order ${params.orderId} is already refunded.`);
    }
    order.status = 'refunded';
    return order;
  },

  cancelOrder: async (params: { orderId: string; reason?: string }): Promise<Order> => {
    const order = mockOrders.get(params.orderId);
    if (!order) {
      throw new Error(`Order not found with ID: ${params.orderId}`);
    }
    order.status = 'cancelled';
    return order;
  },

  purgeDatabase: async (): Promise<{ purged: boolean }> => {
    mockOrders.clear();
    return { purged: true };
  },
};

export const toolSchemas = [
  {
    name: 'orders:list_orders',
    description: 'List recent customer orders with optional status filter',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'completed', 'refunded', 'cancelled'] },
      },
    },
    upstreamServer: 'demo-upstream',
    handler: (params: Record<string, unknown>) => orderTools.listOrders(params as { status?: string }),
  },
  {
    name: 'orders:get_order',
    description: 'Retrieve details for a specific order by ID',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
      },
      required: ['orderId'],
    },
    upstreamServer: 'demo-upstream',
    handler: (params: Record<string, unknown>) => orderTools.getOrder(params as { orderId: string }),
  },
  {
    name: 'orders:refund_order',
    description: 'Issue a partial or full refund for an existing order',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['orderId', 'amount'],
    },
    upstreamServer: 'demo-upstream',
    handler: (params: Record<string, unknown>) =>
      orderTools.refundOrder(params as { orderId: string; amount: number; reason?: string }),
  },
  {
    name: 'orders:cancel_order',
    description: 'Cancel an active pending order',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['orderId'],
    },
    upstreamServer: 'demo-upstream',
    handler: (params: Record<string, unknown>) =>
      orderTools.cancelOrder(params as { orderId: string; reason?: string }),
  },
  {
    name: 'orders:purge_database',
    description: 'Irreversibly delete all orders from database (CRITICAL/RESTRICTED)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    upstreamServer: 'demo-upstream',
    handler: () => orderTools.purgeDatabase(),
  },
];
