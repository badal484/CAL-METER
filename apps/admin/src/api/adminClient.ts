import {
  AdminRole,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketCategory,
} from '@calmeter/shared';
import type {
  AdminDashboardOverview,
  CreateSupportTicketInput,
  UpdateSupportTicketInput,
  CreateNotificationCampaignInput,
  CreateRecipeInput,
  UpdateRecipeInput,
  ProvisionAdminInput,
} from '@calmeter/contracts';

const TOKEN_KEY = 'calmeter_admin_token';

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAdminToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/v1/admin${endpoint}`, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = body?.error?.message || response.statusText || 'Admin API Request Failed';
    throw new ApiError(errorMsg, response.status, body?.error?.code, body?.error?.details);
  }

  return body.data as T;
}

export const adminClient = {
  // Current admin identity
  getMe: () =>
    request<{
      id: string;
      email: string;
      name: string;
      role: AdminRole;
      isActive: boolean;
    }>('/me'),

  // 1. Overview Dashboard
  getDashboardOverview: () =>
    request<
      AdminDashboardOverview & {
        trendSeries?: Array<{ date: string; signups: number; scans: number; meals: number }>;
      }
    >('/dashboard/overview'),

  // 2. Users
  listUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    tier?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.tier) query.set('tier', params.tier);
    return fetch(`/api/v1/admin/users?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  getUserDetails: (userId: string) => request<any>(`/users/${userId}`),

  suspendUser: (userId: string, reason: string) =>
    request<any>(`/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  reactivateUser: (userId: string, reason?: string) =>
    request<any>(`/users/${userId}/reactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // 3. Food Database
  listFoods: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    cuisine?: string;
    isVerified?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.cuisine) query.set('cuisine', params.cuisine);
    if (params?.isVerified !== undefined) query.set('isVerified', String(params.isVerified));
    return fetch(`/api/v1/admin/foods?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  getFoodDetails: (foodId: string) => request<any>(`/foods/${foodId}`),

  createFood: (data: any) =>
    request<any>('/foods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFood: (foodId: string, data: any) =>
    request<any>(`/foods/${foodId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteFood: (foodId: string) =>
    request<any>(`/foods/${foodId}`, {
      method: 'DELETE',
    }),

  // 4. Scans
  listScans: (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    return fetch(`/api/v1/admin/scans?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  getScanDetails: (scanId: string) => request<any>(`/scans/${scanId}`),

  retryScan: (scanId: string) =>
    request<any>(`/scans/${scanId}/retry`, {
      method: 'POST',
    }),

  // 5. AI Telemetry
  getAiTelemetry: () => request<any>('/ai/telemetry'),

  // 6. Subscriptions
  listSubscriptions: (params?: { page?: number; limit?: number; tier?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.tier) query.set('tier', params.tier);
    return fetch(`/api/v1/admin/subscriptions?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  listWebhooks: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return fetch(`/api/v1/admin/subscriptions/webhooks?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  reconcileSubscription: (subscriptionId: string) =>
    request<any>(`/subscriptions/${subscriptionId}/reconcile`, {
      method: 'POST',
    }),

  // 7. Recipes
  listRecipes: (params?: { page?: number; limit?: number; search?: string; cuisine?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.cuisine) query.set('cuisine', params.cuisine);
    return fetch(`/api/v1/admin/recipes?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  getRecipe: (recipeId: string) => request<any>(`/recipes/${recipeId}`),

  createRecipe: (data: CreateRecipeInput) =>
    request<any>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRecipe: (recipeId: string, data: UpdateRecipeInput) =>
    request<any>(`/recipes/${recipeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRecipe: (recipeId: string) =>
    request<any>(`/recipes/${recipeId}`, {
      method: 'DELETE',
    }),

  // 8. Campaigns
  listCampaigns: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return fetch(`/api/v1/admin/campaigns?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  createCampaign: (data: CreateNotificationCampaignInput) =>
    request<any>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  dispatchCampaign: (campaignId: string) =>
    request<any>(`/campaigns/${campaignId}/dispatch`, {
      method: 'POST',
    }),

  testNotification: (data: { title: string; body: string; token?: string }) =>
    request<any>('/campaigns/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 9. Tickets
  listTickets: (params?: {
    page?: number;
    limit?: number;
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.category) query.set('category', params.category);
    return fetch(`/api/v1/admin/tickets?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  getTicketDetails: (ticketId: string) => request<any>(`/tickets/${ticketId}`),

  createTicket: (data: CreateSupportTicketInput) =>
    request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTicket: (ticketId: string, data: UpdateSupportTicketInput) =>
    request<any>(`/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  addTicketNote: (ticketId: string, note: string) =>
    request<any>(`/tickets/${ticketId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  // 10. Admins (SUPER_ADMIN)
  listAdmins: () => request<any[]>('/admins'),

  provisionAdmin: (data: ProvisionAdminInput) =>
    request<any>('/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAdminRole: (adminId: string, role: AdminRole) =>
    request<any>(`/admins/${adminId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  toggleAdminStatus: (adminId: string, isActive: boolean) =>
    request<any>(`/admins/${adminId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  // 11. Audit Logs
  listAuditLogs: (params?: {
    page?: number;
    limit?: number;
    action?: string;
    adminId?: string;
    targetResource?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.action) query.set('action', params.action);
    if (params?.adminId) query.set('adminId', params.adminId);
    if (params?.targetResource) query.set('targetResource', params.targetResource);
    return fetch(`/api/v1/admin/audit-logs?${query.toString()}`, {
      headers: { Authorization: `Bearer ${getStoredAdminToken()}` },
    }).then(res => res.json());
  },

  // 12. System Health
  getSystemHealth: () => request<any>('/system/health'),
};
