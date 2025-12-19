import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage();

export function runWithRequestContext(context, fn) {
  return requestContext.run(context, fn);
}

export function getRequestContext() {
  return requestContext.getStore();
}
