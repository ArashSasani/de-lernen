import {
  shouldRegisterServiceWorker,
  registerServiceWorker,
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

  it('does nothing when ineligible', () => {
    const register = jest.fn();
    setNavigator({ serviceWorker: { register } });
    setNodeEnv('test');
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
});
