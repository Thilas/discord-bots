export function roll(upperBound: number): number;
export function roll(upperBound: number, dices: number): number[];
export function roll(upperBound: any, dices: any = undefined): any {
  if (dices == undefined) {
    return Math.floor(Math.random() * upperBound) + 1;
  }

  else {
    let values: number[] = [];

    for (let i = 0; i < dices; i++) {

      values[i] = roll(upperBound);
    }

    return values;
  }
}
