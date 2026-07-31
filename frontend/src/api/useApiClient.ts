import { useAuth } from '@clerk/clerk-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useApiClient = () => {
  const { getToken } = useAuth();

  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';

    console.log(`[API START] Initiating ${method} -> ${fullUrl}`);

    let token: string | null = null;
    try {
      token = await getToken();
      console.log(`[API AUTH] Token status: ${token ? 'Acquired' : 'No token returned'}`);
    } catch (err) {
      console.error(`[API AUTH ERROR] Failed to get Clerk token:`, err);
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    console.log(`[API REQUEST DETAILS] Method: ${method} | URL: ${fullUrl}`);
    console.log(`[API HEADERS]`, headers);
    if (options.body) console.log(`[API BODY]`, options.body);

    try {
      const response = await fetch(fullUrl, { ...options, headers });

      console.log(`[API RESPONSE STATUS] ${response.status} ${response.statusText} for ${endpoint}`);

      if (response.status === 401) {
        console.error(`[API ERROR 401] Unauthorized request to ${endpoint}`);
        throw new Error('Unauthorized: Please log in again.');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API ERROR ${response.status}] Message: ${errorText}`);
        throw new Error(`API Error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[API SUCCESS] Received data from ${endpoint}:`, data);
      return data;
    } catch (error) {
      console.error(`[API FETCH FAILED] Error executing ${method} ${fullUrl}:`, error);
      throw error;
    }
  };

  return { apiFetch };
};