import fs from 'fs';
import path from 'path';
import { createPolicyEngine, PolicyEngine, Policy } from 'mcp-policy-kit';

const POLICY_PATH =
  process.env.POLICY_FILE_PATH || path.resolve(process.cwd(), 'policies', 'default.json');

export function loadDefaultPolicy(): Policy {
  if (!fs.existsSync(POLICY_PATH)) {
    throw new Error(`Policy file not found at: ${POLICY_PATH}`);
  }
  const content = fs.readFileSync(POLICY_PATH, 'utf8');
  return JSON.parse(content) as Policy;
}

export const activePolicy = loadDefaultPolicy();
export const policyEngine: PolicyEngine = createPolicyEngine(activePolicy);
