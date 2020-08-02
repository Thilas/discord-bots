export class MiddlewareManager<T> {
  private middlewares = Array<new (next: IMiddleware<T>) => IMiddleware<T>>();

  use(m: new (next: IMiddleware<T>) => IMiddleware<T>) {
    this.middlewares.push(m);
    return this;
  }

  invoke(context: T, last?: (context: T) => Promise<void>) {
    let initial: IMiddleware<T> = { invoke: last ?? (() => Promise.resolve()) };
    const middleware = this.middlewares.reduceRight((previous, middleware) => new middleware(previous), initial);
    return middleware.invoke(context);
  }
}

export interface IMiddleware<T> {
  invoke(context: T): Promise<void>;
}

export abstract class Middleware<T> implements IMiddleware<T> {
  constructor(protected readonly next: Middleware<T>) {}

  abstract invoke(context: T): Promise<void>;
}
