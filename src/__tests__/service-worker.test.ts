import {
  shouldRegisterServiceWorker,
  registerServiceWorker,
  unregisterServiceWorker,
} from '@/lib/service-worker';

const origNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const origEnv = process.env.NODE_ENV;

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
  });
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string>).NODE_ENV = value;
}

afterEach(() => {
  if (origNavigator)
    Object.defineProperty(globalThis, 'navigator', origNavigator);
  else setNavigator(undefined);
  setNodeEnv(origEnv ?? 'test');
});

describe('shouldRegisterServiceWorker', () => {
  it('is false when service workers are unsupported', () => {
    setNavigator({});
    setNodeEnv('production');
    expect(shouldRegisterServiceWorker()).toBe(false);
  });

  it('is false outside production even when supported', () => {
    setNavigator({ serviceWorker: { register: jest.fn() } });
    setNodeEnv('development');
    expect(shouldRegisterServiceWorker()).toBe(false);
  });

  it('is true in production with service-worker support', () => {
    setNavigator({ serviceWorker: { register: jest.fn() } });
    setNodeEnv('production');
    expect(shouldRegisterServiceWorker()).toBe(true);
  });
});

describe('registerServiceWorker', () => {
  it('registers /sw.js when eligible', () => {
    const register = jest.fn().mockResolvedValue(undefined);
    setNavigator({ serviceWorker: { register } });
    setNodeEnv('production');
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does not register when ineligible', () => {
    const register = jest.fn();
    setNavigator({
      serviceWorker: { register, getRegistrations: jest.fn(async () => []) },
    });
    setNodeEnv('test');
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
});

describe('unregisterServiceWorker', () => {
  const setCaches = (value: unknown) => {
    Object.defineProperty(globalThis, 'caches', {
      value,
      configurable: true,
      writable: true,
    });
  };

  afterEach(() => setCaches(undefined));

  it('tears down a worker a production run left on the same origin', async () => {
    const unregister = jest.fn().mockResolvedValue(true);
    setNavigator({
      serviceWorker: {
        getRegistrations: jest.fn(async () => [{ unregister }]),
      },
    });
    const del = jest.fn().mockResolvedValue(true);
    setCaches({ keys: jest.fn(async () => ['de-lernen-v3']), delete: del });

    await unregisterServiceWorker();

    expect(unregister).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith('de-lernen-v3');
  });

  it('leaves caches belonging to other apps on the origin alone', async () => {
    setNavigator({
      serviceWorker: { getRegistrations: jest.fn(async () => []) },
    });
    const del = jest.fn().mockResolvedValue(true);
    setCaches({
      keys: jest.fn(async () => ['de-lernen-v3', 'some-other-app-v1']),
      delete: del,
    });

    await unregisterServiceWorker();

    expect(del).toHaveBeenCalledWith('de-lernen-v3');
    expect(del).not.toHaveBeenCalledWith('some-other-app-v1');
  });

  it('is a no-op where service workers are unsupported', async () => {
    setNavigator({});
    await expect(unregisterServiceWorker()).resolves.toBeUndefined();
  });
});
