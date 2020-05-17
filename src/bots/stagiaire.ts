import { loadAndWatch } from "../config";
import stagiaireConfig from "../config/stagiaire.json";
import { escapeRegExp, formatString, notEmpty, roll } from "../utils";
import { Bot } from "./bot";

export class Stagiaire extends Bot {
  private config = loadAndWatch("stagiaire.json", stagiaireConfig, (config) => {
    this.log(`Triggers: rollPlant='${config.triggers.rollPlant}',
      rollPotion='${config.triggers.rollPotion}'`);

    // const plants = config.plants;
    // const potions = config.potions;
    // const errorMessages = config.messages.errors;
    // const confirmationMessages = config.messages.confirmation;

    this.config = config;
  });

  constructor(token: string) {
    super(token, (client) => {
      client.on("message", (message) => {
        if (
          this.config.tagBot
            .map((data) => message.isMentioned(data))
            .some((mentioned) => mentioned)
        ) {
          const triggers = [
            this.config.triggers.rollPlant,
            this.config.triggers.rollPotion,
          ];

          const escapedTriggers = triggers
            .map((id) => escapeRegExp(id))
            .join("|");

          const regex = new RegExp(
            "\\b(?<trigger>" +
              escapedTriggers +
              ") (?<item>.+) \\((?<perso>.+?) (?:(?<bonus>-?\\d+)|(?<semester>-?\\d+) (?<gift>\\d+))\\)"
          );
          const matches = message.content.match(regex);

          if (!matches || !matches.groups) {
            const wrongSyntax = this.config.messages.errors.wrongSyntax;
            this.log(
              `Reply "${wrongSyntax}" to "${message.content}" from ${message.author.tag}`
            );
            message.reply(wrongSyntax);
            return;
          }

          const item = this.getItem(
            matches.groups.trigger,
            matches.groups.item,
            () => {
              const wrongPlant = this.config.messages.errors.wrongPlant;
              this.log(
                `Reply "${wrongPlant}" to "${message.content}" from ${message.author.tag}`
              );
              message.reply(wrongPlant);
            },
            () => {
              const wrongPotion = this.config.messages.errors.wrongPotion;
              this.log(
                `Reply "${wrongPotion}" to "${message.content}" from ${message.author.tag}`
              );
              message.reply(wrongPotion);
            }
          );
          if (!item) {
            return;
          }

          const data = new InputData(
            matches.groups.perso,
            parseInt(matches.groups.bonus, 10),
            parseInt(matches.groups.semester, 10),
            parseInt(matches.groups.gift, 10),
            () => {
              const wrongGift = this.config.messages.errors.wrongGift;
              this.log(
                `Reply "${wrongGift}" to "${message.content}" from ${message.author.tag}`
              );
              message.reply(wrongGift);
            },
            () => {
              const wrongSemester = this.config.messages.errors.wrongSemester;
              this.log(
                `Reply "${wrongSemester}" to "${message.content}" from ${message.author.tag}`
              );
              message.reply(wrongSemester);
            }
          );
          if (!data.validated) {
            return;
          }

          const bonus = data.inputBonus
            ? data.bonus
            : this.getBonus(item, data);
          if (bonus === undefined) {
            const bonusNotFound = this.config.messages.errors.bonusNotFound;
            this.log(
              `Reply "${bonusNotFound}" to "${message.content}" from ${message.author.tag}`
            );
            message.reply(bonusNotFound);
          }

          this.getResult(roll(100), bonus || 0, item, data, (content) => {
            this.log(content);
            message.reply(content);
          });
        }
      });
    });
  }

  private getItem(
    trigger: string,
    item: string,
    onPlantError: () => void,
    onPotionError: () => void
  ) {
    switch (trigger) {
      case this.config.triggers.rollPlant:
        return this.getPlant(item, onPlantError);
      case this.config.triggers.rollPotion:
        return this.getPotion(item, onPotionError);
    }
  }

  private getPlant(inputPlant: string, onError: () => void = function () {}) {
    let plant = this.config.plants.find(
      (id) => id.key.toUpperCase() === inputPlant.toUpperCase()
    );
    if (!plant) {
      plant = this.config.plants.find(
        (id) => id.name.toUpperCase() === inputPlant.toUpperCase()
      );
      if (!plant) {
        onError();
        return;
      }
    }
    const result: Plant = {
      kind: "plant",
      key: inputPlant,
      name: plant.name,
      level: plant.level,
      duration: plant.duration,
    };
    return result;
  }

  private getPotion(inputPotion: string, onError: () => void = function () {}) {
    let potion = this.config.potions.find(
      (id) => id.key.toUpperCase() === inputPotion.toUpperCase()
    );
    if (!potion) {
      potion = this.config.potions.find(
        (id) => id.name.toUpperCase() === inputPotion.toUpperCase()
      );
      if (!potion) {
        onError();
        return;
      }
    }
    const result: Potion = {
      kind: "potion",
      key: inputPotion,
      name: potion.name,
      level: potion.level,
      duration: potion.duration,
      plants: potion.plants.map((id) => this.getPlant(id)).filter(notEmpty),
    };
    return result;
  }

  private getBonus(item: Item, data: InputData) {
    const itemBonus = this.config.bonus[item.kind].find(
      (id) => id.level === item.level && id.semester === data.semester
    );
    if (!itemBonus) {
      return;
    }
    const giftBonus = data.gift ? 15 : 0;
    return itemBonus.bonus + giftBonus;
  }

  private getResult(
    roll: number,
    bonus: number,
    item: Item,
    data: InputData,
    onMessage: (content: string) => void
  ) {
    let total = roll + bonus;
    let quantity = 0;

    try {
      switch (roll) {
        case 100:
        case 99:
          quantity += 1;
          break;
        case 1:
          onMessage(
            formatString(
              this.config.messages.results.failure1[item.kind].result,
              {
                time: this.getTime(item),
                perso: data.perso,
                item: item.name,
              }
            )
          );
          onMessage(
            this.config.messages.results.failure1[item.kind].consequence
          );
          return;
        case 2:
          onMessage(
            formatString(
              this.config.messages.results.failure2[item.kind].result,
              {
                time: this.getTime(item),
                perso: data.perso,
                item: item.name,
              }
            )
          );
          onMessage(
            this.config.messages.results.failure2[item.kind].consequence
          );
          return;
      }

      if (total >= 120) {
        quantity += 4;
      } else if (total >= 100) {
        quantity += 3;
      } else if (total >= 50) {
        quantity += 2;
      } else {
        onMessage(
          formatString(this.config.messages.results.missed[item.kind], {
            time: this.getTime(item),
            perso: data.perso,
            item: item.name,
          })
        );
        return;
      }

      onMessage(
        formatString(this.config.messages.results.success[item.kind], {
          time: this.getTime(item),
          perso: data.perso,
          quantity: quantity,
          item: item.name,
        })
      );
    } finally {
      switch (item.kind) {
        case "potion":
          onMessage(
            formatString(this.config.messages.results.logs[item.kind], {
              roll: roll,
              bonus: bonus,
              ingredients:
                item.plants.map((plant) => plant.name).join(", ") || "aucun",
            })
          );
          break;
        default:
          onMessage(
            formatString(this.config.messages.results.logs[item.kind], {
              roll: roll,
              bonus: bonus,
            })
          );
          break;
      }
    }
  }

  private getTime(item: Item): string {
    const locale = "fr-FR";
    const options = {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    };
    switch (item.kind) {
      case "plant":
        return new Date(
          Date.now() + item.duration * 24 * 60 * 60 * 1000
        ).toLocaleString(locale, options);
      case "potion":
        return new Date(
          Date.now() + item.duration * 60 * 60 * 1000
        ).toLocaleString(locale, options);
    }
  }
}

type Item = Plant | Potion;

interface Plant {
  readonly kind: "plant";
  readonly key: string;
  readonly name: string;
  readonly level: number;
  readonly duration: number;
}

interface Potion {
  readonly kind: "potion";
  readonly key: string;
  readonly name: string;
  readonly level: number;
  readonly duration: number;
  readonly plants: Plant[];
}

class InputData {
  readonly validated: boolean = true;
  readonly inputBonus: boolean = true;

  constructor(
    readonly perso: string,
    readonly bonus: number,
    readonly semester: number,
    readonly gift: number,
    onGiftError: () => void,
    onSemesterError: () => void
  ) {
    if (isNaN(this.bonus)) {
      if (
        !this.validateSemester(this.semester, onSemesterError) ||
        !this.validateGift(this.gift, onGiftError)
      ) {
        this.validated = false;
      }
      this.inputBonus = false;
    }
  }

  private validateGift(gift: number, onError: () => void) {
    switch (gift) {
      case 0:
      case 1:
        return true;
      default:
        onError();
        return false;
    }
  }

  private validateSemester(semester: number, onError: () => void) {
    switch (semester) {
      case 1:
      case 2:
      case 3:
      case -1:
        return true;
      default:
        onError();
        return false;
    }
  }
}
