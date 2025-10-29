export class InterceptorManager {
  constructor(initialInterceptors = []) {
    this.interceptors = [...initialInterceptors];
  }

  use(interceptor) {
    if (typeof interceptor !== 'function') {
      throw new TypeError('Interceptor must be a function');
    }

    this.interceptors.push(interceptor);
  }

  clear() {
    this.interceptors = [];
  }

  async run(payload) {
    let current = payload;
    for (const interceptor of this.interceptors) {
      const result = await interceptor(current);
      if (result !== undefined) {
        current = result;
      }
    }
    return current;
  }
}
