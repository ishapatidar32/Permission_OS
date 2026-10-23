import { Request, Response, NextFunction } from 'express';
import { dbService } from '../db';
import { ActorContext, UserRole } from '@permissionos/shared';

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
      correlationId?: string;
    }
  }
}

export function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return undefined;
}

export function resolveActor(req: Request): ActorContext | null {
  // 1. Check Bearer token (MCP client / automated callers)
  const token = extractBearerToken(req);
  if (token) {
    const user = dbService.findUserByToken(token);
    if (user) {
      return {
        id: user.id,
        displayName: user.display_name,
        role: user.role,
      };
    }
  }

  // 2. Check Session Cookie (Dashboard browser)
  const sessionUserId = req.cookies?.['permissionos_session_user'];
  if (sessionUserId) {
    const user = dbService.getUserById(sessionUserId);
    if (user && user.active) {
      return {
        id: user.id,
        displayName: user.display_name,
        role: user.role,
      };
    }
  }

  // 3. Fallback for demo header if explicitly configured in non-production
  const devActorHeader = req.headers['x-demo-actor-id'] as string;
  if (devActorHeader && process.env.NODE_ENV !== 'production') {
    const user = dbService.getUserById(devActorHeader);
    if (user && user.active) {
      return {
        id: user.id,
        displayName: user.display_name,
        role: user.role,
      };
    }
  }

  return null;
}

export function requireAuth(allowedRoles?: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const actor = resolveActor(req);
    if (!actor) {
      res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Missing or invalid token/session.',
        },
        correlationId: req.correlationId || 'unknown',
      });
      return;
    }

    if (allowedRoles && !allowedRoles.includes(actor.role)) {
      res.status(403).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED_ROLE',
          message: `Actor role '${actor.role}' is not authorized for this resource.`,
        },
        correlationId: req.correlationId || 'unknown',
      });
      return;
    }

    req.actor = actor;
    next();
  };
}
