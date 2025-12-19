type Interceptor<T> = (payload: T) => T | Promise<T> | undefined;

export class InterceptorManager<T> {
  private interceptors: Array<Interceptor<T>>;

  constructor(initialInterceptors: Array<Interceptor<T>> = []) {
    this.interceptors = [...initialInterceptors];
  }

  use(interceptor: Interceptor<T>): void {
    if (typeof interceptor !== 'function') {
      throw new TypeError('Interceptor must be a function');
    }

    this.interceptors.push(interceptor);
  }

  clear(): void {
    this.interceptors = [];
  }

  async run(payload: T): Promise<T> {
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

