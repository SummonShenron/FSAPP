import { useAuth } from '@clerk/clerk-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://192.168.1.6:8000';

export const useApiClient = () => {
  const { getToken } = useAuth();

  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Ensures endpoints like '/api/cards' become 'http://192.168.1.6:8000/api/cards'
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    return response;
  };

  return { apiFetch };
};