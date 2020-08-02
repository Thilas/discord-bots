export type Plants = "plants";
export type Potions = "potions";
type ItemsType = [Plants, Potions];
export type Items = ItemsType[number];
export const Kinds: ItemsType = ["plants", "potions"];

export type Item = Plant | Potion;

export class Plant {
  readonly kind: Plants = "plants";
  constructor(readonly key: string, readonly name: string, readonly level: number, readonly duration: number) {}
}

export class Potion {
  readonly kind: Potions = "potions";
  constructor(
    readonly key: string,
    readonly name: string,
    readonly level: number,
    readonly duration: number,
    readonly plants: Plant[],
    readonly color: string
  ) {}
}

export function getReceiptDate(item: Item): Date {
  // DEBUG:
  return new Date(Date.now() + 30 * 1000);
  switch (item.kind) {
    case "plants":
      return new Date(Date.now() + item.duration * 24 * 60 * 60 * 1000);
    case "potions":
      return new Date(Date.now() + item.duration * 60 * 60 * 1000);
  }
}
