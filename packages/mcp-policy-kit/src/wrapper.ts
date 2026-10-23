import { ActionContext, ApprovalHandler, PolicyDecision, PolicyEngine, ToolHandler } from './types';

export interface WrappedToolResult<T = any> {
  executed: boolean;
  decision: PolicyDecision;
  result?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function wrapToolHandler<TArgs = any, TResult = any>(
  handler: ToolHandler<TArgs, TResult>,
  engine: PolicyEngine,
  onApprovalRequired?: ApprovalHandler<TArgs>
) {
  return async (
    context: ActionContext,
    args: TArgs
  ): Promise<WrappedToolResult<TResult>> => {
    const decision = engine.evaluate(context);

    if (decision.effect === 'deny') {
      return {
        executed: false,
        decision,
        error: {
          code: decision.reasonCode,
          message: `Tool invocation denied by policy rule [${decision.reasonCode}]`,
        },
      };
    }

    if (decision.effect === 'approve') {
      let approvalResult: any = undefined;
      if (onApprovalRequired) {
        approvalResult = await onApprovalRequired(context, decision);
      }
      return {
        executed: false,
        decision,
        result: approvalResult,
      };
    }

    // Only allow actually executes the handler!
    const result = await handler(args);
    return {
      executed: true,
      decision,
      result,
    };
  };
}
