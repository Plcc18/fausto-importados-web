export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const authFetch = (url: string, options: RequestInit = {}) => 
    fetch(url, {...options, credentials: 'include'});