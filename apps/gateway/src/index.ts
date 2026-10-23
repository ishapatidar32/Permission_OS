import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router } from './routes';
import { db } from './db';

const PORT = process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT, 10) : 4000;

export function createGatewayApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4000', 'http://127.0.0.1:4000'],
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  // Mount API and MCP routes
  app.use('/api', router);
  app.use('/', router); // mounts /mcp at root level as well

  return app;
}

export const app = createGatewayApp();

export function startGateway(port: number = PORT) {
  // Ensure DB initialized
  console.log('🗄️ Database connected (WAL mode enabled)');

  return app.listen(port, '127.0.0.1', () => {
    console.log(`🛡️ PermissionOS Gateway running at http://127.0.0.1:${port}`);
    console.log(`📡 Governed Streamable HTTP MCP Endpoint: http://127.0.0.1:${port}/mcp`);
    console.log(`📊 REST API Endpoint: http://127.0.0.1:${port}/api/health`);
  });
}

if (require.main === module) {
  startGateway();
}
