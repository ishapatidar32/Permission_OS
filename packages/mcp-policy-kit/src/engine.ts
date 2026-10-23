import crypto from 'crypto';
import { validatePolicy } from './schema';
import { Policy, ActionContext, PolicyDecision, PolicyEngine, PolicyRule } from './types';

export function createPolicyEngine(rawPolicy: unknown): PolicyEngine {
  const policy: Policy = validatePolicy(rawPolicy);
  const canonicalJson = JSON.stringify(policy);
  const hash = crypto.createHash('sha256').update(canonicalJson).digest('hex');

  return {
    getPolicy: () => policy,
    getHash: () => hash,
    evaluate: (context: ActionContext): PolicyDecision => {
      // 1. Filter matching rules
      const matches: PolicyRule[] = policy.rules.filter((rule) => {
        // Exact tool match
        if (rule.tool !== context.tool) {
          return false;
        }

        // Role check: if rule specifies roles, actor's role must be listed
        if (rule.roles && rule.roles.length > 0) {
          if (!rule.roles.includes(context.actorRole)) {
            return false;
          }
        }

        // Resource scope check (optional)
        if (rule.resourceScope && context.resource) {
          if (rule.resourceScope !== context.resource) {
            return false;
          }
        }

        return true;
      });

      // 2. Default deny if no matching rules found
      if (matches.length === 0) {
        return {
          effect: policy.defaultEffect || 'deny',
          reasonCode: 'DEFAULT_POLICY_DECISION',
          policyVersion: policy.version,
        };
      }

      // 3. Unambiguous precedence: DENY > APPROVE > ALLOW
      const denyMatch = matches.find((m) => m.effect === 'deny');
      if (denyMatch) {
        return {
          effect: 'deny',
          reasonCode: denyMatch.reasonCode,
          ruleMatched: denyMatch,
          policyVersion: policy.version,
        };
      }

      const approveMatch = matches.find((m) => m.effect === 'approve');
      if (approveMatch) {
        return {
          effect: 'approve',
          reasonCode: approveMatch.reasonCode,
          ruleMatched: approveMatch,
          approvalTtlSeconds: approveMatch.approvalTtlSeconds ?? 300,
          policyVersion: policy.version,
        };
      }

      const allowMatch = matches.find((m) => m.effect === 'allow');
      if (allowMatch) {
        return {
          effect: 'allow',
          reasonCode: allowMatch.reasonCode,
          ruleMatched: allowMatch,
          policyVersion: policy.version,
        };
      }

      return {
        effect: 'deny',
        reasonCode: 'UNRESOLVED_CONFLICT_DENIED',
        policyVersion: policy.version,
      };
    },
  };
}
