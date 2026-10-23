import http from 'http';
import { upstreamOrderStore } from '../orders/db';
import { TOOL_NAMES } from '@permissionos/shared';

export function createUpstreamMcpServer(): http.Server {
  return http.createServer((req, res) => {
    // Only accept local connections
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/stats') {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          readInvocations: upstreamOrderStore.readInvocationCount,
          updateInvocations: upstreamOrderStore.updateInvocationCount,
          exportInvocations: upstreamOrderStore.exportInvocationCount,
        })
      );
      return;
    }

    if (req.method === 'POST' && req.url === '/reset') {
      upstreamOrderStore.seedDefaults();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const rpc = JSON.parse(body);

          if (rpc.method === 'tools/list') {
            res.writeHead(200);
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: rpc.id,
                result: {
                  tools: [
                    {
                      name: TOOL_NAMES.READ_ORDER,
                      description: 'Read order status and details by orderId',
                      inputSchema: {
                        type: 'object',
                        properties: { orderId: { type: 'string' } },
                        required: ['orderId'],
                      },
                    },
                    {
                      name: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
                      description: 'Update the delivery destination address for an order',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          orderId: { type: 'string' },
                          address: { type: 'string' },
                          actionId: { type: 'string' },
                          expectedVersion: { type: 'number' },
                        },
                        required: ['orderId', 'address'],
                      },
                    },
                    {
                      name: TOOL_NAMES.EXPORT_ALL_CUSTOMERS,
                      description: 'Export all customer records and delivery addresses',
                      inputSchema: {
                        type: 'object',
                        properties: { format: { type: 'string', enum: ['json', 'csv'] } },
                      },
                    },
                  ],
                },
              })
            );
            return;
          }

          if (rpc.method === 'tools/call') {
            const toolName = rpc.params?.name;
            const args = rpc.params?.arguments || {};

            if (toolName === TOOL_NAMES.READ_ORDER) {
              const order = upstreamOrderStore.getOrder(args.orderId);
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: rpc.id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify(order),
                      },
                    ],
                    order,
                  },
                })
              );
              return;
            }

            if (toolName === TOOL_NAMES.UPDATE_DELIVERY_ADDRESS) {
              const result = upstreamOrderStore.updateDeliveryAddress(
                args.actionId || `direct_${Date.now()}`,
                args.orderId,
                args.address,
                args.expectedVersion
              );
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: rpc.id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: `Address updated to ${result.order.address} (version ${result.order.version})`,
                      },
                    ],
                    order: result.order,
                    alreadyApplied: result.alreadyApplied,
                  },
                })
              );
              return;
            }

            if (toolName === TOOL_NAMES.EXPORT_ALL_CUSTOMERS) {
              const exportData = upstreamOrderStore.exportCustomers(args.format || 'json');
              res.writeHead(200);
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: rpc.id,
                  result: {
                    content: [
                      {
                        type: 'text',
                        text: typeof exportData === 'string' ? exportData : JSON.stringify(exportData),
                      },
                    ],
                    data: exportData,
                  },
                })
              );
              return;
            }

            res.writeHead(404);
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: rpc.id,
                error: { code: -32601, message: `Unknown tool: ${toolName}` },
              })
            );
            return;
          }

          res.writeHead(400);
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              error: { code: -32600, message: 'Invalid RPC method' },
            })
          );
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          res.writeHead(500);
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: `Upstream error: ${errorMsg}` },
            })
          );
        }
      });
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}
