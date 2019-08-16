/** Represents the result of a resolved Promise. */
export class ResolvedPromiseResult<T>  {
  public constructor(public readonly value: T) {
  }
}

/** Represents the result of a rejected Promise. */
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

/**
 * Creates a Promise that is resolved with an array of `ResolvedPromiseResult<T>`
 * or `RejectedPromiseResult` when all of the provided Promises resolve or reject.
 * @param values An array of Promises.
 * @returns A new Promise.
 */
export function allSettled<T>(values: (T | PromiseLike<T>)[]) {
  return Promise.all(values.map(settle));
}
