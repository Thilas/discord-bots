export class ResolvedPromiseResult<T>  {
  public constructor(public readonly value: T) {
  }
}

export class RejectedPromiseResult {
  public constructor(public readonly reason: any) {
  }
}

async function settle<T>(promise: T | PromiseLike<T>) {
  try {
    return new ResolvedPromiseResult(await promise);
  }
  catch (reason) {
    return new RejectedPromiseResult(reason);
  }
}

export function allSettled<T>(values: (T | PromiseLike<T>)[]) {
  return Promise.all(values.map(settle));
}
