import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContext = Record<string, unknown>;

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContext.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
