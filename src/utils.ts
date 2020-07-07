export const locale = "fr-FR";
export const timeZone = "Europe/Paris";

export interface Args {
  [key: string]: any;
}
export interface Groups {
  [key: string]: string;
}

/**
 * Rolls a dice between 1 and `max`.
 * @param max Max value of the dice to roll.
 * @returns A pseudorandom number.
 */
export function roll(max: number): number;
/**
 * Rolls `dices` dices between 1 and `max`.
 * @param max Max value of the dice to roll.
 * @param dices Number of dices to roll.
 * @returns An array of pseudorandom numbers.
 */
export function roll(max: number, dices: number): number[];
export function roll(max: number, dices?: number) {
  if (dices == undefined) {
    const result = Math.floor(Math.random() * max) + 1;
    return result;
  } else {
    const result = Array(dices).map(() => roll(max));
    return result;
  }
}

export function getRandom<T>(items: T[]) {
  return items[roll(items.length) - 1];
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function formatString(format: string, args: Args) {
  return format.replace(/{{|}}|{(\w+)}/g, function (match, name) {
    if (name) {
      const value = args[name];
      return `${value}`;
    } else {
      switch (match) {
        case "{{":
          return "{";
        case "}}":
          return "}";
      }
    }
    return match;
  });
}

export function localeEquals(left: string, right: string) {
  return (
    left.localeCompare(right, locale, {
      sensitivity: "base",
    }) === 0
  );
}

export function omit<T, K extends keyof T>(o: T, p: K): Omit<T, K> {
  const result = {} as Omit<T, K>;
  Object.keys(o)
    .filter((k) => p !== k)
    .forEach((k) => {
      const m = <keyof Omit<T, K>>k;
      result[m] = o[m];
    });
  return result;
}
