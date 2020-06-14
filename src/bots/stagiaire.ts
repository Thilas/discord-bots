import { Message } from "discord.js";
import { loadAndWatch } from "../config";
import stagiaireConfig from "../config/stagiaire.json";
import {
  escapeRegExp,
  formatString,
  locale,
  localeEquals,
  notEmpty,
  roll,
  timeZone,
} from "../utils";
import { Bot } from "./bot";

/*
Salon des potions :
  aide-moi [liste|prépare]
  liste
  prépare
  * Syntaxe réservée au salon des plantes => wrongChannelCommand

Salon des plantes :
  aide-moi [liste|cultive]
  liste
  cultive
  * Syntaxe réservée au salon des potions => wrongChannelCommand

Autre salon :
  Erreur : wrongChannel
*/

export class Stagiaire extends Bot {
  public config = loadAndWatch("stagiaire.json", stagiaireConfig, (config) => {
    this.log(`Triggers: rollPlant='${config.triggers.plant.roll}',
      rollPotion='${config.triggers.potion.roll}'`);

    this.config = config;
  });

  constructor(token: string) {
    super(token, (client) => {
      client.on("message", (message) => {
        // Is stagiaire bot mentioned?
        if (
          this.config.tagBot
            .map((data) => message.isMentioned(data))
            .some((mentioned) => mentioned) &&
          message.author.id !== this.config.tagBotId
        ) {
          const channel = this.getChannel(
            message.channel.id,
            this.getOnError(
              message,
              formatString(this.config.messages.errors.wrongChannel, {
                bot: this.getBotMention(),
                plantChannel: this.getPlantChannelMention(message),
                potionChannel: this.getPotionChannelMention(message),
              })
            )
          );
          // Is channel allowed?
          if (!channel) return;

          // Is help trigger?
          const escapedTriggerHelp = escapeRegExp(this.config.triggers.help);
          const regexHelp = new RegExp(
            `\\b(?<trigger>${escapedTriggerHelp})\\b(?: (?<command>.+))?`
          );
          const matchHelp = message.content.match(regexHelp);
          if (matchHelp && matchHelp.groups) {
            if (
              channel.isValidTrigger(
                this.config.triggers.help,
                matchHelp.groups,
                this.getOnError(
                  message,
                  channel.getWrongChannelCommandErrorMessage(message)
                )
              )
            ) {
              channel.writeHelp(message, matchHelp.groups.command);
            }
            return;
          }

          // Is list trigger?
          const escapedTriggerList = escapeRegExp(this.config.triggers.list);
          const regexLists = new RegExp(
            `\\b(?<trigger>${escapedTriggerList})\\b(?: (?<difficulty>\\d+))?(?: \\((?<ingredient>.+)\\))?(?: (?<category>.+))?`
          );
          const matchLists = message.content.match(regexLists);
          if (matchLists && matchLists.groups) {
            if (
              channel.isValidTrigger(
                this.config.triggers.list,
                matchLists.groups,
                this.getOnError(
                  message,
                  channel.getWrongChannelCommandErrorMessage(message)
                )
              )
            ) {
              channel.writeList(message, matchLists.groups);
            }
            return;
          }

          // Is any roll trigger?
          const triggersRolls = [
            this.config.triggers.plant.roll,
            this.config.triggers.potion.roll,
          ];
          const escapedTriggersRolls = triggersRolls
            .map((id) => escapeRegExp(id))
            .join("|");
          const regexRoll = new RegExp(
            `\\b(?<trigger>${escapedTriggersRolls})\\b (?<item>.+) \\((?<perso>.+?) (?:(?<bonus>-?\\d+)|(?<semester>-?\\d+) (?<gift>\\d+))\\)`
          );
          const matchRoll = message.content.match(regexRoll);
          if (matchRoll && matchRoll.groups) {
            if (
              !channel.isValidTrigger(
                matchRoll.groups.trigger,
                matchRoll.groups,
                this.getOnError(
                  message,
                  channel.getWrongChannelCommandErrorMessage(message)
                )
              )
            ) {
              return;
            }
            const item = channel.getItem(
              matchRoll.groups.item,
              this.getOnError(message, channel.getItemErrorMessage())
            );
            if (!item) return;

            const data = new InputData(
              matchRoll.groups.perso,
              parseInt(matchRoll.groups.bonus, 10),
              parseInt(matchRoll.groups.semester, 10),
              parseInt(matchRoll.groups.gift, 10),
              this.getOnError(
                message,
                formatString(this.config.messages.errors.wrongGift, {
                  bot: this.getBotMention(),
                })
              ),
              this.getOnError(
                message,
                formatString(this.config.messages.errors.wrongSemester, {
                  bot: this.getBotMention(),
                })
              )
            );
            if (!data.validated) return;

            const bonus = data.inputBonus
              ? data.bonus
              : this.getBonus(item, data);
            if (!bonus) {
              this.getOnError(
                message,
                this.config.messages.errors.bonusNotFound
              )();
            }

            const content = this.getResult(roll(100), bonus || 0, item, data);
            this.log(content);
            message.reply(content);
            return;
          }
          this.getOnError(
            message,
            formatString(this.config.messages.errors.wrongSyntax, {
              bot: this.getBotMention(),
            })
          )();
          return;
        }
      });
    });
  }

  private getChannel(channel: string, onError: () => void) {
    switch (channel) {
      case this.config.triggers.plant.chanPlayers:
        return new PlantChannel(this);
      case this.config.triggers.potion.chanPlayers:
        return new PotionChannel(this);
    }
    onError();
  }

  private getTime(item: Item): string {
    const options = {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone,
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

  public getBotMention() {
    return `<@${this.config.tagBotId}>`;
  }

  private getOnError(message: Message, errorMessage: string) {
    return () => {
      this.log(
        `Reply "${errorMessage}" to "${message.content}" from ${message.author.tag}`
      );
      message.reply(errorMessage);
    };
  }

  public getPlantChannelMention(message: Message) {
    return message.client.channels.find(
      (chan) => chan.id === this.config.triggers.plant.chanPlayers
    );
  }

  public getPotionChannelMention(message: Message) {
    return message.client.channels.find(
      (chan) => chan.id === this.config.triggers.potion.chanPlayers
    );
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

  private getResult(roll: number, bonus: number, item: Item, data: InputData) {
    let total = roll + bonus;
    let quantity = 0;

    let content = new Array<string>();
    try {
      switch (roll) {
        case 100:
        case 99:
          quantity += 1;
          break;
        case 1:
          content.push(
            formatString(
              this.config.messages.results.failure1[item.kind].result,
              {
                time: this.getTime(item),
                perso: data.perso,
                item: item.name,
              }
            )
          );
          content.push(
            this.config.messages.results.failure1[item.kind].consequence
          );
          return;
        case 2:
          content.push(
            formatString(
              this.config.messages.results.failure2[item.kind].result,
              {
                time: this.getTime(item),
                perso: data.perso,
                item: item.name,
              }
            )
          );
          content.push(
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
        content.push(
          formatString(this.config.messages.results.missed[item.kind], {
            time: this.getTime(item),
            perso: data.perso,
            item: item.name,
          })
        );
        return;
      }

      content.push(
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
          content.push(
            formatString(this.config.messages.results.logs[item.kind], {
              roll: roll,
              bonus: bonus,
              ingredients:
                item.plants.map((plant) => plant.name).join(", ") || "aucun",
            })
          );
          break;
        default:
          content.push(
            formatString(this.config.messages.results.logs[item.kind], {
              roll: roll,
              bonus: bonus,
            })
          );
          break;
      }
      return content.join("\n");
    }
  }

  public getPlant(input: string, onError?: () => void) {
    let plant = this.config.plants.find((plant) =>
      plant.key.some((id) => localeEquals(id, input))
    );
    if (!plant) {
      plant = this.config.plants.find((id) => localeEquals(id.name, input));
      if (!plant) {
        if (onError) onError();
        return;
      }
    }
    const result: Plant = {
      kind: "plant",
      key: input,
      name: plant.name,
      level: plant.level,
      duration: plant.duration,
    };
    return result;
  }

  public getPotion(input: string, onError: () => void) {
    let potion = this.config.potions.find((potion) =>
      potion.key.some((id) => localeEquals(id, input))
    );
    if (!potion) {
      potion = this.config.potions.find((id) => localeEquals(id.name, input));
      if (!potion) {
        onError();
        return;
      }
    }
    const result: Potion = {
      kind: "potion",
      key: input,
      name: potion.name,
      level: potion.level,
      duration: potion.duration,
      plants: potion.plants.map((id) => this.getPlant(id)).filter(notEmpty),
    };
    return result;
  }
}

interface Groups {
  [key: string]: string;
}

abstract class Channel {
  protected constructor(
    protected readonly stagiaire: Stagiaire,
    private readonly rollTrigger: string
  ) {}

  protected isValidTriggerInternal(
    trigger: string,
    groups: Groups,
    onError: () => void,
    predicate?: () => boolean
  ) {
    if (!predicate || predicate()) {
      switch (trigger) {
        case this.stagiaire.config.triggers.help:
          switch (groups.command) {
            case undefined:
            case this.stagiaire.config.triggers.list:
            case this.rollTrigger:
              return true;
          }
          break;
        case this.stagiaire.config.triggers.list:
        case this.rollTrigger:
          return true;
      }
    }
    onError();
    return false;
  }

  abstract isValidTrigger(
    trigger: string,
    groups: Groups,
    onError: () => void
  ): boolean;
  abstract writeHelp(message: Message, command: string): void;
  abstract writeList(message: Message, groups: Groups): void;
  abstract getItem(input: string, onError: () => void): Item | undefined;
  abstract getItemErrorMessage(): string;
  abstract getWrongChannelCommandErrorMessage(message: Message): string;
}

class PlantChannel extends Channel {
  constructor(stagiaire: Stagiaire) {
    super(stagiaire, stagiaire.config.triggers.plant.roll);
  }

  isValidTrigger(trigger: string, groups: Groups, onError: () => void) {
    return this.isValidTriggerInternal(trigger, groups, onError, () => {
      switch (trigger) {
        case this.stagiaire.config.triggers.list:
          if (groups.ingredient) return false;
          break;
      }
      return true;
    });
  }

  writeHelp(message: Message, command: string) {
    switch (command) {
      case undefined:
        message.reply(
          formatString(this.stagiaire.config.messages.help.plants.general, {
            bot: this.stagiaire.getBotMention(),
            plantChan: this.stagiaire.getPlantChannelMention(message),
            potionChan: this.stagiaire.getPotionChannelMention(message),
          })
        );
        return;
      case this.stagiaire.config.triggers.list:
        message.reply(
          formatString(
            this.stagiaire.config.messages.help.plants.commands.list,
            {
              bot: this.stagiaire.getBotMention(),
            }
          )
        );
        return;
      case this.stagiaire.config.triggers.plant.roll:
        message.reply(
          formatString(
            this.stagiaire.config.messages.help.plants.commands.roll,
            {
              bot: this.stagiaire.getBotMention(),
            }
          )
        );
        return;
    }
  }

  writeList(message: Message, groups: Groups) {
    const difficulty = groups.difficulty
      ? new Number(groups.difficulty).valueOf()
      : undefined;
    const plants = this.stagiaire.config.plants.filter((plant) => {
      if (difficulty && plant.level !== difficulty) return false;
      if (
        groups.category &&
        !plant.categories.some((category) =>
          localeEquals(category, groups.category)
        )
      )
        return false;
      return true;
    });
    if (!plants.length) {
      // No plant found
      message.reply("No plant");
      return;
    }
    plants.forEach((plant) => {
      message.channel.send(
        `**${plant.name}** | Niveau : ${plant.level} | Durée : ${
          plant.duration
        } jours
          Catégories :
              ${plant.categories.join("\n              ") || "aucune"}
          Autres syntaxes acceptées :
              ${plant.key.join("\n              ") || "aucune"}
          Usages :
              ${plant.usages.join("\n              ")}`
      );
    });
  }

  getItem(input: string, onError: () => void) {
    return this.stagiaire.getPlant(input, onError);
  }

  getItemErrorMessage() {
    return formatString(this.stagiaire.config.messages.errors.wrongPlant, {
      bot: this.stagiaire.getBotMention(),
    });
  }

  getWrongChannelCommandErrorMessage(message: Message) {
    return formatString(
      this.stagiaire.config.messages.errors.wrongChannelCommand.plant,
      {
        bot: this.stagiaire.getBotMention(),
        potionChan: this.stagiaire.getPotionChannelMention(message),
      }
    );
  }
}

class PotionChannel extends Channel {
  constructor(stagiaire: Stagiaire) {
    super(stagiaire, stagiaire.config.triggers.potion.roll);
  }

  isValidTrigger(trigger: string, groups: Groups, onError: () => void) {
    return this.isValidTriggerInternal(trigger, groups, onError);
  }

  writeHelp(message: Message, command: string) {
    switch (command) {
      case undefined:
        message.reply(
          formatString(this.stagiaire.config.messages.help.potions.general, {
            bot: this.stagiaire.getBotMention(),
            plantChan: this.stagiaire.getPlantChannelMention(message),
            potionChan: this.stagiaire.getPotionChannelMention(message),
          })
        );
        return;
      case this.stagiaire.config.triggers.list:
        message.reply(
          formatString(
            this.stagiaire.config.messages.help.potions.commands.list,
            {
              bot: this.stagiaire.getBotMention(),
            }
          )
        );
        return;
      case this.stagiaire.config.triggers.potion.roll:
        message.reply(
          formatString(
            this.stagiaire.config.messages.help.potions.commands.roll,
            {
              bot: this.stagiaire.getBotMention(),
            }
          )
        );
        return;
    }
  }

  writeList(message: Message, groups: Groups) {
    const difficulty = groups.difficulty
      ? new Number(groups.difficulty).valueOf()
      : undefined;
    const plant = groups.ingredient
      ? this.stagiaire.getPlant(groups.ingredient)
      : undefined;
    const ingredient = plant ? plant.name : groups.ingredient;
    const potions = this.stagiaire.config.potions.filter((potion) => {
      if (difficulty && potion.level !== difficulty) return false;
      if (ingredient) {
        if (localeEquals("aucun", ingredient)) {
          if (potion.plants.length) return false;
        } else if (
          !potion.plants.some((plant) => localeEquals(plant, ingredient))
        ) {
          return false;
        }
      }
      if (
        groups.category &&
        !potion.categories.some((category) =>
          localeEquals(category, groups.category)
        )
      )
        return false;

      return true;
    });
    if (!potions.length) {
      // No potion found
      message.reply("No potion");
      return;
    }
    potions.forEach((potion) => {
      message.channel.send(
        `**${potion.name}** | Niveau : ${potion.level} | Durée : ${
          potion.duration
        } heures
          *${potion.description}*
          Catégories :
              ${potion.categories.join("\n              ") || "aucune"}
          Autres syntaxes acceptées :
              ${potion.key.join("\n              ") || "aucune"}
          Ingrédients :
              ${potion.plants.join("\n              ") || "aucun"}`
      );
    });
  }

  getItem(input: string, onError: () => void) {
    return this.stagiaire.getPotion(input, onError);
  }

  getItemErrorMessage() {
    return formatString(this.stagiaire.config.messages.errors.wrongPotion, {
      bot: this.stagiaire.getBotMention(),
    });
  }

  getWrongChannelCommandErrorMessage(message: Message) {
    return formatString(
      this.stagiaire.config.messages.errors.wrongChannelCommand.potion,
      {
        bot: this.stagiaire.getBotMention(),
        plantChan: this.stagiaire.getPlantChannelMention(message),
      }
    );
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
