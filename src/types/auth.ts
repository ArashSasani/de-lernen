export interface LoginResult {
  ok: boolean;
  token?: string;
  error?: string;
  retryAfter?: number;
}
