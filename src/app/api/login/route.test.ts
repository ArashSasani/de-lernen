import { NextRequest } from 'next/server';
import { signToken } from '../../../lib/auth';
import { failedLoginRateLimiter } from '../../../lib/auth-security';
import { POST } from './route';

jest.mock('../../../lib/auth', () => ({
  signToken: jest.fn(),
}));

jest.mock('../../../lib/auth-security', () => ({
  failedLoginRateLimiter: {
    retryAfter: jest.fn(),
    recordFailure: jest.fn(),
    reset: jest.fn(),
  },
}));

const mockedSignToken = jest.mocked(signToken);
const mockedLimiter = jest.mocked(failedLoginRateLimiter);

function loginRequest(password: string): NextRequest {
  return new NextRequest('https://example.test/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.0.2.1',
    },
    body: JSON.stringify({ password }),
  });
}

describe('POST /api/login', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.APP_PASSWORD = 'correct-password';
    mockedLimiter.retryAfter.mockResolvedValue(null);
    mockedLimiter.recordFailure.mockResolvedValue(null);
    mockedLimiter.reset.mockResolvedValue();
    mockedSignToken.mockResolvedValue('signed-token');
  });

  it('rejects a client whose failure window is already exhausted', async () => {
    mockedLimiter.retryAfter.mockResolvedValue(120);

    const response = await POST(loginRequest('correct-password'));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(mockedLimiter.recordFailure).not.toHaveBeenCalled();
    expect(mockedSignToken).not.toHaveBeenCalled();
  });

  it('returns 401 while failed attempts remain below the limit', async () => {
    const request = loginRequest('wrong-password');
    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(mockedLimiter.recordFailure).toHaveBeenCalledWith(request.headers);
  });

  it('returns 429 with Retry-After when a failure reaches the limit', async () => {
    mockedLimiter.recordFailure.mockResolvedValue(900);

    const response = await POST(loginRequest('wrong-password'));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('900');
  });

  it('clears failures and signs a token after a successful login', async () => {
    const request = loginRequest('correct-password');
    const response = await POST(request);

    await expect(response.json()).resolves.toEqual({ token: 'signed-token' });
    expect(mockedLimiter.reset).toHaveBeenCalledWith(request.headers);
    expect(mockedSignToken).toHaveBeenCalledTimes(1);
  });
});
