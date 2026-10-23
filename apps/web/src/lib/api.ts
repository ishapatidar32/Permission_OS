export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  const body = await res.json();
  if (!res.ok || body.ok === false) {
    const errorMsg = body?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }

  return body.data;
}

export const api = {
  getHealth: () => apiRequest('/api/health'),
  getMe: () => apiRequest('/api/me'),
  loginAs: (role: 'operator' | 'approver' | 'admin') =>
    apiRequest('/api/demo/login-as', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),
  sendIntent: (prompt: string) =>
    apiRequest('/api/demo/intent', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  getOrder1042: () => apiRequest('/api/orders/1042'),
  getApprovals: (status = 'pending') => apiRequest(`/api/approvals?status=${status}`),
  resolveApproval: (id: string, decision: 'approve' | 'reject') =>
    apiRequest(`/api/approvals/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  getAuditLogs: (limit = 50) => apiRequest(`/api/audit?limit=${limit}`),
  getCurrentPolicies: () => apiRequest('/api/policies/current'),
  resetDemo: () =>
    apiRequest('/api/admin/reset-demo', {
      method: 'POST',
    }),
};
