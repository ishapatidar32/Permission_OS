import http from 'http';
import { createUpstreamMcpServer } from './mcp/server';

const UPSTREAM_PORT = process.env.DEMO_UPSTREAM_PORT ? parseInt(process.env.DEMO_UPSTREAM_PORT, 10) : 4001;

export function startUpstreamServer(port = UPSTREAM_PORT): http.Server {
  const server = createUpstreamMcpServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`📦 Demo Upstream Order MCP Server running at http://127.0.0.1:${port}/mcp`);
  });
  return server;
}

if (require.main === module) {
  startUpstreamServer();
}

export * from './orders/db';
export * from './mcp/server';
