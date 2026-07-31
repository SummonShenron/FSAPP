// src/api/client.ts
import { useAuth } from '@clerk/clerk-react';

export const useApiClient = () => {
  const { getToken } = useAuth();
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    if (!token) {
      throw new Error('No active authentication token');
    }
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(endpoint, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }
    return response.json();
  };
  return { apiFetch };
};