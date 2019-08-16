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
export function roll(max: number, dices: any = undefined) {
  if (dices == undefined) {
    const result = Math.floor(Math.random() * max) + 1;
    return result;
  }
  else {
    const result = Array(dices).map(() => roll(max));
    return result;
  }
}
