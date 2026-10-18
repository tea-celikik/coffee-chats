// Backend URL; can be overridden with VITE_API_URL in frontend/.env
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface PublicSlot {
  id: string;
  startsAt: string; // ISO string in UTC, converted to local time when displayed
  durationMinutes: number;
  isBooked: boolean;
}

export interface BookingResult {
  id: string;
  name: string;
  startsAt: string;
  durationMinutes: number;
  confirmationMessage?: string; // added in step 7 (AI)
}

// Error that keeps the HTTP status, so the UI can react differently to 409 vs 400
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, hostKey?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hostKey) headers['x-host-key'] = hostKey;

  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers });
  } catch {
    // fetch only throws on network failure (server down, CORS, offline)
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }

  if (res.status === 204) return undefined as T; // no body to parse
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // NestJS validation errors come as an array of messages
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, msg ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  listSlots: () => request<PublicSlot[]>('/slots'),
  book: (slotId: string, data: { name: string; email: string; note?: string }) =>
    request<BookingResult>(`/slots/${slotId}/bookings`, { method: 'POST', body: JSON.stringify(data) }),
};
