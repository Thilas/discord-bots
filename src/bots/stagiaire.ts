import { Message } from "discord.js";
import { isArray } from "util";
import { loadAndWatch } from "../config";
import stagiaireConfig from "../config/stagiaire.json";
import {
  escapeRegExp,
  formatString,
  Groups,
  locale,
  localeEquals,
  notEmpty,
  roll,
  timeZone,
} from "../utils";
import { Bot } from "./bot";

type Config = Stagiaire["config"];

export class Stagiaire extends Bot {
  private config = loadAndWatch("stagiaire.json", stagiaireConfig, (config) => {
    this.log(`Triggers: rollPlant='${config.triggers.plants.roll}',
      rollPotion='${config.triggers.potions.roll}'`);

    this.config = config;
  });

  constructor(token: string) {
    super(token, (client) => {
      client.on("message", (message) => {
        // Is stagiaire bot mentioned?
        if (
          message.author.id !== this.config.tagBotId &&
          (message.isMentioned(this.config.tagBotId) ||
            this.config.tagBotRoles.some((role) => message.isMentioned(role)))
        ) {
          //#region Is channel supported?
          const channel = this.getChannel(message);
          if (!channel) {
            this.writeError(
              message,
              formatString(this.config.messages.errors.wrongChannel, {
                bot: this.getBotMention(),
                plantChannel: this.getChannelMention(message, "plants"),
                potionChannel: this.getChannelMention(message, "potions"),
              })
            );
            return;
          }
          //#endregion

          //#region Is help trigger?
          const escapedTriggerHelp = escapeRegExp(this.config.triggers.help);
          const regexHelp = new RegExp(
            `\\b(?<trigger>${escapedTriggerHelp})\\b(?: (?<command>.+))?`
          );
          const matchHelp = message.content.match(regexHelp);
          if (matchHelp && matchHelp.groups) {
            if (
              channel.isValidTrigger(
                message,
                this.config.triggers.help,
                matchHelp.groups
              )
            ) {
              this.writeHelp(message, channel, matchHelp.groups.command);
            }
            return;
          }
          //#endregion

          //#region Is list trigger?
          const escapedTriggerList = escapeRegExp(this.config.triggers.list);
          const regexLists = new RegExp(
            `\\b(?<trigger>${escapedTriggerList})\\b(?: (?<difficulty>\\d+))?(?: \\((?<ingredient>.+)\\))?(?: (?<category>.+))?`
          );
          const matchLists = message.content.match(regexLists);
          if (matchLists && matchLists.groups) {
            if (
              channel.isValidTrigger(
                message,
                this.config.triggers.list,
                matchLists.groups
              )
            ) {
              channel.writeList(message, matchLists.groups, this.config);
            }
            return;
          }
          //#endregion

          //#region Is any roll trigger?
          const triggersRolls = [
            this.config.triggers.plants.roll,
            this.config.triggers.potions.roll,
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
                message,
                matchRoll.groups.trigger,
                matchRoll.groups
              )
            ) {
              return;
            }
            const item = channel.getItem(matchRoll.groups.item);
            if (!item) {
              this.writeItemError(message, channel);
              return;
            }

            const data = new InputData(
              matchRoll.groups.perso,
              parseInt(matchRoll.groups.bonus, 10),
              parseInt(matchRoll.groups.semester, 10),
              parseInt(matchRoll.groups.gift, 10),
              () =>
                this.writeError(
                  message,
                  formatString(this.config.messages.errors.wrongGift, {
                    bot: this.getBotMention(),
                  })
                ),
              () =>
                this.writeError(
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
              this.writeError(
                message,
                this.config.messages.errors.bonusNotFound
              );
            }

            const content = this.getResult(roll(100), bonus || 0, item, data);
            this.log(content);
            message.reply(content);
            return;
          }
          //#endregion

          this.writeWrongSyntax(message);
          return;
        }
      });
    });
  }

  //#region Channels
  private getChannel(message: Message) {
    switch (message.channel.id) {
      case this.config.triggers.plants.chanPlayers:
        return new PlantChannel(this);
      case this.config.triggers.potions.chanPlayers:
        return new PotionChannel(this);
    }
  }

  isValidTrigger(
    message: Message,
    channel: Channel,
    trigger: string,
    groups: Groups,
    getWrongChannels?: (config: Config) => Items | Items[] | undefined
  ) {
    if (getWrongChannels) {
      const wrongChannels = getWrongChannels(this.config);
      if (wrongChannels) {
        if (isArray(wrongChannels))
          this.writeWrongChannelCommand(message, channel, ...wrongChannels);
        else this.writeWrongChannelCommand(message, channel, wrongChannels);
      }
      return false;
    }
    switch (trigger) {
      case this.config.triggers.help:
        switch (groups.command) {
          case undefined:
          case this.config.triggers.list:
          case this.config.triggers[channel.kind].roll:
            return true;
          case this.config.triggers.plants.roll:
            this.writeWrongChannelCommand(message, channel, "plants");
            return false;
          case this.config.triggers.potions.roll:
            this.writeWrongChannelCommand(message, channel, "potions");
            return false;
        }
        break;
      case this.config.triggers.list:
      case this.config.triggers[channel.kind].roll:
        return true;
      case this.config.triggers.plants.roll:
        this.writeWrongChannelCommand(message, channel, "plants");
        return false;
      case this.config.triggers.potions.roll:
        this.writeWrongChannelCommand(message, channel, "potions");
        return false;
    }
    this.writeWrongSyntax(message);
    return false;
  }

  private writeWrongChannelCommand(
    message: Message,
    channel: Channel,
    ...kinds: Items[]
  ) {
    this.writeError(
      message,
      formatString(
        this.config.messages.errors.wrongChannelCommand[channel.kind],
        {
          bot: this.getBotMention(),
          channels: kinds
            .map((kind) => this.getChannelMention(message, kind))
            .join(", "),
        }
      )
    );
  }

  private writeHelp(message: Message, channel: Channel, command: string) {
    switch (command) {
      case undefined:
        message.reply(
          formatString(this.config.messages.help[channel.kind].general, {
            bot: this.getBotMention(),
            plantChannel: this.getChannelMention(message, "plants"),
            potionChannel: this.getChannelMention(message, "potions"),
          })
        );
        return;
      case this.config.triggers.list:
        message.reply(
          formatString(this.config.messages.help[channel.kind].commands.list, {
            bot: this.getBotMention(),
          })
        );
        return;
      case this.config.triggers[channel.kind].roll:
        message.reply(
          formatString(this.config.messages.help[channel.kind].commands.roll, {
            bot: this.getBotMention(),
          })
        );
        return;
    }
  }

  getDifficulty(groups: Groups) {
    return groups.difficulty
      ? new Number(groups.difficulty).valueOf()
      : undefined;
  }
  //#endregion

  //#region Items
  getPlant(input: string, onError?: () => void) {
    const plant = this.config.plants.find(
      (item) =>
        localeEquals(item.name, input) ||
        item.key.some((alias) => localeEquals(alias, input))
    );
    if (!plant) {
      if (onError) onError();
      return;
    }
    return new Plant(input, plant.name, plant.level, plant.duration);
  }

  getPotion(input: string, onError?: () => void) {
    const potion = this.config.potions.find(
      (item) =>
        localeEquals(item.name, input) ||
        item.key.some((alias) => localeEquals(alias, input))
    );
    if (!potion) {
      if (onError) onError();
      return;
    }
    return new Potion(
      input,
      potion.name,
      potion.level,
      potion.duration,
      potion.plants.map((id) => this.getPlant(id)).filter(notEmpty)
    );
  }

  private writeItemError(message: Message, channel: Channel) {
    this.writeError(
      message,
      formatString(this.config.messages.errors.wrongItem[channel.kind], {
        bot: this.getBotMention(),
      })
    );
  }

  hasCategory(item: { categories: string[] }, category: string) {
    return item.categories.some((item) => localeEquals(item, category));
  }

  private getBonus(item: Item, data: InputData) {
    const itemBonus = this.config.bonuses[item.kind].find(
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
        case "potions":
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
      case "plants":
        return new Date(
          Date.now() + item.duration * 24 * 60 * 60 * 1000
        ).toLocaleString(locale, options);
      case "potions":
        return new Date(
          Date.now() + item.duration * 60 * 60 * 1000
        ).toLocaleString(locale, options);
    }
  }
  //#endregion

  //#region Utils
  private writeError(message: Message, errorMessage: string) {
    this.log(
      `Reply "${errorMessage}" to "${message.content}" from ${message.author.tag}`
    );
    message.reply(errorMessage);
  }

  private writeWrongSyntax(message: Message) {
    this.writeError(
      message,
      formatString(this.config.messages.errors.wrongSyntax, {
        bot: this.getBotMention(),
      })
    );
  }

  private getBotMention() {
    return `<@${this.config.tagBotId}>`;
  }

  private getChannelMention(message: Message, kind: Items) {
    return message.client.channels.find(
      (channel) => channel.id === this.config.triggers[kind].chanPlayers
    );
  }
  //#endregion
}

//#region Channels
type Channel = PlantChannel | PotionChannel;

class PlantChannel {
  readonly kind: Plants = "plants";
  constructor(readonly stagiaire: Stagiaire) {}

  isValidTrigger(message: Message, trigger: string, groups: Groups) {
    return this.stagiaire.isValidTrigger(
      message,
      this,
      trigger,
      groups,
      (config) => {
        if (trigger === config.triggers.list && groups.ingredient)
          return "plants";
      }
    );
  }

  writeList(message: Message, groups: Groups, config: Config) {
    const difficulty = this.stagiaire.getDifficulty(groups);
    const items = config.plants.filter((item) => {
      if (difficulty && item.level !== difficulty) return false;
      return (
        !groups.category || this.stagiaire.hasCategory(item, groups.category)
      );
    });
    if (!items.length) {
      message.reply(config.messages.list.plants.notFound);
      return;
    }
    items.forEach((item) => {
      message.channel.send(
        `**${item.name}** | Niveau : ${item.level} | Durée : ${
          item.duration
        } jours
        Catégories :
            ${item.categories.join("\n            ") || "aucune"}
        Autres syntaxes acceptées :
            ${item.key.join("\n              ") || "aucune"}
        Usages :
            ${item.usages.join("\n              ")}`
      );
    });
  }

  getItem(input: string) {
    return this.stagiaire.getPlant(input);
  }
}

class PotionChannel {
  readonly kind: Potions = "potions";
  constructor(readonly stagiaire: Stagiaire) {}

  isValidTrigger(message: Message, trigger: string, groups: Groups) {
    return this.stagiaire.isValidTrigger(message, this, trigger, groups);
  }

  writeList(message: Message, groups: Groups, config: Config) {
    const difficulty = this.stagiaire.getDifficulty(groups);
    const plant = groups.ingredient
      ? this.stagiaire.getPlant(groups.ingredient)
      : undefined;
    const ingredient = plant ? plant.name : groups.ingredient;
    const items = config.potions.filter((item) => {
      if (difficulty && item.level !== difficulty) return false;
      if (ingredient) {
        if (localeEquals("aucun", ingredient)) {
          if (item.plants.length) return false;
        } else if (
          !item.plants.some((plant) => localeEquals(plant, ingredient))
        ) {
          return false;
        }
      }
      return (
        !groups.category || this.stagiaire.hasCategory(item, groups.category)
      );
    });
    if (!items.length) {
      message.reply(config.messages.list.potions.notFound);
      return;
    }
    items.forEach((item) => {
      message.channel.send(
        `**${item.name}** | Niveau : ${item.level} | Durée : ${
          item.duration
        } heures
        *${item.description}*
        Catégories :
            ${item.categories.join("\n            ") || "aucune"}
        Autres syntaxes acceptées :
            ${item.key.join("\n            ") || "aucune"}
        Ingrédients :
            ${item.plants.join("\n            ") || "aucun"}`
      );
    });
  }

  getItem(input: string) {
    return this.stagiaire.getPotion(input);
  }
}
//#endregion

//#region Items
type Items = Plants | Potions;
type Plants = "plants";
type Potions = "potions";

type Item = Plant | Potion;

class Plant {
  readonly kind: Plants = "plants";
  constructor(
    readonly key: string,
    readonly name: string,
    readonly level: number,
    readonly duration: number
  ) {}
}

class Potion {
  readonly kind: Potions = "potions";
  constructor(
    readonly key: string,
    readonly name: string,
    readonly level: number,
    readonly duration: number,
    readonly plants: Plant[]
  ) {}
}
//#endregion

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
