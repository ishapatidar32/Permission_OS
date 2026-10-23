import http from 'http';
import { Order, TOOL_NAMES } from '@permissionos/shared';

const UPSTREAM_URL = process.env.UPSTREAM_MCP_URL || 'http://127.0.0.1:4001';

export class UpstreamMcpClient {
  private baseUrl: string;

  constructor(baseUrl = UPSTREAM_URL) {
    this.baseUrl = baseUrl;
  }

  private async postJsonRpc(method: string, params?: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL('/mcp', this.baseUrl);
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      });

      const req = http.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 5000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.error) {
                return reject(new Error(parsed.error.message || 'Upstream MCP error'));
              }
              resolve(parsed.result);
            } catch (e) {
              reject(new Error(`Failed to parse response from upstream MCP: ${body}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Upstream MCP call timed out'));
      });

      req.on('error', (err) => {
        reject(new Error(`Upstream MCP connection failure: ${err.message}`));
      });

      req.write(payload);
      req.end();
    });
  }

  public async listTools(): Promise<any> {
    return this.postJsonRpc('tools/list');
  }

  public async readOrder(orderId: string): Promise<Order> {
    const result = await this.postJsonRpc('tools/call', {
      name: TOOL_NAMES.READ_ORDER,
      arguments: { orderId },
    });
    return result.order;
  }

  public async updateDeliveryAddress(
    actionId: string,
    orderId: string,
    address: string,
    expectedVersion?: number | null
  ): Promise<{ order: Order; alreadyApplied: boolean }> {
    const result = await this.postJsonRpc('tools/call', {
      name: TOOL_NAMES.UPDATE_DELIVERY_ADDRESS,
      arguments: { actionId, orderId, address, expectedVersion },
    });
    return result;
  }

  public async exportAllCustomers(format?: 'json' | 'csv'): Promise<any> {
    const result = await this.postJsonRpc('tools/call', {
      name: TOOL_NAMES.EXPORT_ALL_CUSTOMERS,
      arguments: { format },
    });
    return result.data;
  }

  public async getStats(): Promise<{ readInvocations: number; updateInvocations: number; exportInvocations: number }> {
    return new Promise((resolve, reject) => {
      const url = new URL('/stats', this.baseUrl);
      http
        .get(url, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        })
        .on('error', reject);
    });
  }

  public async reset(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL('/reset', this.baseUrl);
      const req = http.request(url, { method: 'POST' }, () => resolve());
      req.on('error', reject);
      req.end();
    });
  }
}

export const upstreamClient = new UpstreamMcpClient();
