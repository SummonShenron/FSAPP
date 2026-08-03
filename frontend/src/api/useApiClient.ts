import { useAuth } from '@clerk/clerk-react';

export const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '192.168.1.6';

  // 1) Local dev should always prefer the local backend
  if (import.meta.env.DEV && isLocalHost) {
    return 'http://192.168.1.6:8000';
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 3) Final fallback
  return 'https://fsapp-ci88.onrender.com';
};

export const API_BASE_URL = getApiBaseUrl();

export const useApiClient = () => {
  const { getToken } = useAuth();

  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const fullUrl = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    console.log(`[API START] Initiating ${method} -> ${fullUrl}`);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // 🔑 READ FROM STORAGE DIRECTLY: Bulletproof and works instantly anywhere in the app.
    const guestToken = localStorage.getItem('guest_token');
    const isGuest = guestToken === 'guest-sandbox-token';

    if (isGuest) {
      console.log(`[API GUEST MODE] Attaching sandbox token to request headers.`);
      headers['Authorization'] = 'Bearer guest-sandbox-token';
    } else {
      try {
        const token = await getToken({ skipCache: true });
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('No Clerk token acquired:', err);
      }
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