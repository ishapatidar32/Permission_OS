import http from 'http';
import { toolSchemas } from './order-tools';

const UPSTREAM_PORT = process.env.DEMO_UPSTREAM_PORT ? parseInt(process.env.DEMO_UPSTREAM_PORT, 10) : 4001;

export function createUpstreamServer(): http.Server {
  return http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/mcp') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const rpc = JSON.parse(body);

          if (rpc.method === 'tools/list') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: rpc.id,
                result: {
                  tools: toolSchemas.map(({ name, description, inputSchema }) => ({
                    name,
                    description,
                    inputSchema,
                  })),
                },
              })
            );
            return;
          }

          if (rpc.method === 'tools/call') {
            const tool = toolSchemas.find((t) => t.name === rpc.params?.name);
            if (!tool) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: rpc.id,
                  error: { code: -32601, message: `Tool not found: ${rpc.params?.name}` },
                })
              );
              return;
            }

            const result = await tool.handler(rpc.params?.arguments || {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id: rpc.id,
                result,
              })
            );
            return;
          }

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              error: { code: -32600, message: 'Invalid or unsupported RPC method' },
            })
          );
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
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

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream MCP endpoint is at /mcp' }));
  });
}

export function startUpstreamServer(port: number = UPSTREAM_PORT): http.Server {
  const server = createUpstreamServer();
  server.listen(port, () => {
    console.log(`📦 Demo Upstream MCP Server running at http://localhost:${port}/mcp`);
  });
  return server;
}

if (require.main === module) {
  startUpstreamServer();
}
