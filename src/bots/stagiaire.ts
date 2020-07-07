import { Client, Message, Role, TextChannel, User } from "discord.js";
import fs from "fs";
import Cron from "node-cron";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { configName, loadAndWatch } from "../config";
import stagiaireConfig from "../config/stagiaire.json";
import {
  Args,
  formatString,
  getRandom,
  Groups,
  locale,
  localeEquals,
  notEmpty,
  omit,
  roll,
  timeZone,
} from "../utils";
import { Bot } from "./bot";

type Config = Stagiaire["config"];

export class Stagiaire extends Bot {
  private config = loadAndWatch("stagiaire.json", stagiaireConfig, (config) => {
    this.log(
      `Bot: id='${config.tagBotId}', roles='${config.tagBotRoles.join(", ")}'`
    );
    this.log(`Plants: #=${config.plants.length},
      trigger='${config.triggers.plants.roll}',
      chanPlayers='${config.triggers.plants.chanPlayers}',
      chanMJ='${config.triggers.plants.chanMJ}',
      MJ='${config.triggers.plants.MJ.join(", ")}'`);
    this.log(`Potions: #=${config.potions.length},
      trigger='${config.triggers.potions.roll}',
      chanPlayers='${config.triggers.potions.chanPlayers}',
      chanMJ='${config.triggers.potions.chanMJ}',
      MJ='${config.triggers.potions.MJ.join(", ")}'`);
    this.log(`Categories: ${config.categories.join(", ")}`);
    this.log(`Max Roll: ${config.maxRoll ?? "<default>"}`);
    this.log(`Summary: cron='${config.summary.cron}'`);
    this.config = config;
    if (!this.setDisplayTransactionsCron(true))
      this.error("Invalid summary cron");
  });

  private summaryCron: Cron.ScheduledTask;

  constructor(token: string) {
    super(token, (client) => {
      client.on("message", async (message) => {
        // #region Is stagiaire bot mentioned?
        const botIds = [
          client.users.cache.get(this.config.tagBotId),
          ...this.config.tagBotRoles.map((id) =>
            message.guild?.roles.cache.get(id)
          ),
        ].filter(notEmpty);
        const isMentioned = (data: User | Role) =>
          message.mentions.has(data, { ignoreEveryone: true });
        if (
          message.author.id !== this.config.tagBotId &&
          botIds.some(isMentioned)
        ) {
          //#endregion
          //#region Is channel supported?
          const channel = this.getItemChannel(message);
          if (!channel) {
            await this.writeError(
              message,
              formatString(this.config.messages.errors.wrongChannel, {
                plantChannel: this.getDiscordChannel(client, "plants"),
                potionChannel: this.getDiscordChannel(client, "potions"),
              })
            );
            return;
          }
          //#endregion
          //#region Is help trigger?
          const matchHelp = message.content.match(
            /(?<trigger>[A-zÀ-ú-]+)(?: *(?<command>[A-zÀ-ú-]+))?/
          );
          if (
            matchHelp?.groups &&
            localeEquals(matchHelp.groups.trigger, this.config.triggers.help)
          ) {
            if (
              await channel.isValidTrigger(
                message,
                this.config.triggers.help,
                matchHelp.groups
              )
            ) {
              await this.writeHelp(message, channel, matchHelp.groups.command);
            }
            return;
          }
          //#endregion
          //#region Is list trigger?
          const matchLists = message.content.match(
            /(?<trigger>[A-zÀ-ú-]+)(?: *(?<difficulty>\d+)\b)?(?: *(?<category>[^() ]+))?(?: *\( *(?<ingredient>.+?)? *\))?/
          );
          if (
            matchLists?.groups &&
            localeEquals(matchLists.groups.trigger, this.config.triggers.list)
          ) {
            if (
              await channel.isValidTrigger(
                message,
                this.config.triggers.list,
                matchLists.groups
              )
            ) {
              await channel.writeList(message, matchLists.groups, this.config);
            }
            return;
          }
          //#endregion
          //#region Is roll trigger?
          const matchRoll = message.content.match(
            /(?<trigger>[A-zÀ-ú-]+) +(?<item>.+?) *\( *(?<perso>.+?) +(?:(?<bonus>-?\d+)|(?<semester>\d+|x) +(?<gift>\d+)) *\)/
          );
          if (
            matchRoll?.groups &&
            (localeEquals(
              matchRoll.groups.trigger,
              this.config.triggers.plants.roll
            ) ||
              localeEquals(
                matchRoll.groups.trigger,
                this.config.triggers.potions.roll
              ))
          ) {
            if (
              await channel.isValidTrigger(
                message,
                this.config.triggers[channel.kind].roll,
                matchRoll.groups
              )
            ) {
              await this.processRoll(message, channel, matchRoll.groups);
            }
            return;
          }
          //#endregion

          await this.writeError(
            message,
            this.config.messages.errors.wrongSyntax
          );
          return;
        }
      });
      this.setDisplayTransactionsCron();
      // DEBUG:
      // this.displayTransactions(client);
      this.resetMissingTransactionsTimers(client);
    });
  }

  private async writeHelp(message: Message, channel: Channel, command: string) {
    if (!command) {
      return this.sendMessage(
        message,
        formatString(this.config.messages.help[channel.kind].general, {
          plantChannel: this.getDiscordChannel(message, "plants"),
          potionChannel: this.getDiscordChannel(message, "potions"),
        }),
        false,
        true
      );
    } else if (localeEquals(command, this.config.triggers.list)) {
      return this.sendMessage(
        message,
        formatString(this.config.messages.help[channel.kind].commands.list, {
          plantChannel: this.getDiscordChannel(message, "plants"),
        }),
        false,
        true
      );
    } else if (localeEquals(command, this.config.triggers[channel.kind].roll)) {
      return this.sendMessage(
        message,
        this.config.messages.help[channel.kind].commands.roll,
        false,
        true
      );
    }
  }

  //#region Requests
  private addTransaction(
    message: Message,
    roll: number,
    bonus: number,
    item: Item,
    data: InputData,
    quantity: number
  ) {
    const transaction: Transaction = {
      id: uuidv4(),
      roll: roll,
      bonus: bonus,
      requestDate: new Date(),
      receiptDate: this.getTime(item),
      kind: item.kind,
      name: item.name,
      quantity: quantity,
      toBeStored:
        quantity > 0 || (item.kind === "potions" && item.plants.length > 0),
    };
    let storage = this.getStorage();
    if (!storage)
      storage = {
        players: {},
      } as Storage;
    let player = storage.players[message.author.id];
    if (!player) {
      player = storage.players[message.author.id] = {} as Player;
    }
    let perso = player[data.perso];
    if (!perso) {
      perso = player[data.perso] = {
        transactions: [],
      } as Character;
    }
    perso.transactions.push(transaction);
    this.setStorage(storage);
    this.setRequestTimer(
      message,
      transaction,
      item,
      message.author.id,
      data.perso
    );
    return { player: message.author.id, perso: data.perso, transaction };
  }

  // TODO: how about concurrency?
  private updateTransaction(
    playerId: string,
    persoId: string,
    transaction: Transaction
  ) {
    const storage = this.getStorage();
    if (!storage) return;
    const perso = storage.players?.[playerId]?.[persoId];
    if (!perso) return;
    const index = perso.transactions.findIndex((t) => t.id === transaction.id);
    if (index < 0) return;
    perso.transactions[index] = transaction;
    this.setStorage(storage);
  }

  private setRequestTimer(
    object: Client | Message,
    transaction: Transaction,
    item: Item,
    player: string,
    perso: string
  ) {
    const channel =
      "channel" in object
        ? object.channel
        : this.getDiscordChannel(object, item.kind);

    const next = new Date(transaction.receiptDate).getTime() - Date.now();
    setTimeout(async () => {
      const content = [
        this.getRollResult(transaction, item, perso),
        formatString(this.config.messages.results.logs[item.kind], {
          roll: transaction.roll,
          bonus: transaction.bonus,
          ingredients:
            item.kind === "potions"
              ? item.plants.map((plant) => plant.name).join(", ") || "aucun"
              : undefined,
        }),
      ];
      const playerDiscord = channel.client.users.cache.get(player);
      const ping = playerDiscord ? `${playerDiscord}, ` : "";
      await channel.send(`${ping}${content.join("\n")}`);
      transaction.received = true;
      this.updateTransaction(player, perso, transaction);
    }, Math.max(next, 1));
  }
  //#endregion
  //#region Transactions Summary
  private setDisplayTransactionsCron(reload?: boolean) {
    if (!Cron.validate(this.config.summary.cron)) return false;
    this.summaryCron?.destroy();
    if (!reload || this.summaryCron) {
      this.summaryCron = Cron.schedule(
        this.config.summary.cron,
        () => this.displayTransactions(this.client),
        { timezone: timeZone }
      );
    }
    return true;
  }

  private async displayTransactions(client: Client) {
    const storage = this.getStorage();
    if (!storage) return;

    const plantChannel = this.getDiscordChannel(client, "plants", "chanMJ");
    const potionChannel = this.getDiscordChannel(client, "potions", "chanMJ");
    const mjPlant = this.config.triggers.plants.MJ.map((id) =>
      client.users.cache.get(id)
    ).filter(notEmpty);
    const mjPotion = this.config.triggers.potions.MJ.map((id) =>
      client.users.cache.get(id)
    ).filter(notEmpty);

    let pingMjPlant = false;
    let pingMJpotion = false;
    for (const playerId of Object.keys(storage.players)) {
      const playerContent = storage.players[playerId];
      const playerDiscord = client.users.cache.get(playerId);
      if (!playerDiscord) continue;

      for (const persoId of Object.keys(playerContent)) {
        const persoContent = playerContent[persoId];

        let contentPlant = persoContent.transactions
          .filter(
            (t) =>
              t.kind === "plants" &&
              t.toBeStored &&
              !t.storedInInventory &&
              t.received
          )
          .map((t) => {
            t.storedInInventory = true;
            return `${t.name} : +${t.quantity} (${this.formatTime(
              t.receiptDate
            )})`;
          });

        if (contentPlant.length) {
          contentPlant = [
            `${playerDiscord}\n\`\`\`md\n# ${persoId}`,
            ...contentPlant,
            "```\n\n",
          ];
          await plantChannel.send(contentPlant.join("\n"));
          pingMjPlant = true;
        }

        let contentPotion: string[] = [];
        persoContent.transactions
          .filter(
            (t) =>
              t.kind === "potions" &&
              t.toBeStored &&
              !t.storedInInventory &&
              t.received
          )
          .forEach((t) => {
            t.storedInInventory = true;
            contentPotion.push(
              `${t.name} : +${t.quantity} (${this.formatTime(t.receiptDate)})`
            );
            const item = this.getPotion(t.name);
            item?.plants?.forEach((p) =>
              contentPotion.push(`    ${p.name} : -1`)
            );
          });

        if (contentPotion.length) {
          contentPotion = [
            `${playerDiscord}\n\`\`\`md\n# ${persoId}`,
            ...contentPotion,
            "```\n\n",
          ];
          await potionChannel.send(contentPotion.join("\n"));
          pingMJpotion = true;
        }
      }
    }
    if (pingMjPlant) {
      plantChannel.send(`\n\n${mjPlant.join(", ")}`);
    }
    if (pingMJpotion) {
      potionChannel.send(`\n\n${mjPotion.join(", ")}`);
    }
    this.setStorage(storage);
  }

  private resetMissingTransactionsTimers(client: Client) {
    const storage = this.getStorage();
    if (!storage) return;

    for (const playerId of Object.keys(storage.players)) {
      const playerContent = storage.players[playerId];
      for (const persoId of Object.keys(playerContent)) {
        const persoContent = playerContent[persoId];
        persoContent.transactions
          .filter((t) => !t.received)
          .forEach((t) => {
            const item = this.getItem(t);
            if (item) {
              this.setRequestTimer(client, t, item, playerId, persoId);
            }
          });
      }
    }
  }
  //#endregion
  //#region Item Channels
  private getItemChannel(message: Message) {
    switch (message.channel.id) {
      case this.config.triggers.plants.chanPlayers:
        return new PlantChannel(this);
      case this.config.triggers.potions.chanPlayers:
        return new PotionChannel(this);
    }
  }

  async isValidTrigger(
    message: Message,
    channel: Channel,
    trigger: string,
    groups: Groups,
    getWrongChannels?: (config: Config) => Items | Items[] | undefined
  ) {
    if (getWrongChannels) {
      const wrongChannels = getWrongChannels(this.config);
      if (wrongChannels) {
        if (Array.isArray(wrongChannels)) {
          await this.writeErrorWrongChannelCommand(
            message,
            channel,
            ...wrongChannels
          );
        } else {
          await this.writeErrorWrongChannelCommand(
            message,
            channel,
            wrongChannels
          );
        }
        return false;
      }
    }
    switch (trigger) {
      case this.config.triggers.help:
        if (
          !groups.command ||
          localeEquals(groups.command, this.config.triggers.list) ||
          localeEquals(groups.command, this.config.triggers[channel.kind].roll)
        ) {
          return true;
        } else if (
          localeEquals(groups.command, this.config.triggers.plants.roll)
        ) {
          await this.writeErrorWrongChannelCommand(message, channel, "plants");
          return false;
        } else if (
          localeEquals(groups.command, this.config.triggers.potions.roll)
        ) {
          await this.writeErrorWrongChannelCommand(message, channel, "potions");
          return false;
        }
        break;
      case this.config.triggers.list:
      case this.config.triggers[channel.kind].roll:
        return true;
      case this.config.triggers.plants.roll:
        await this.writeErrorWrongChannelCommand(message, channel, "plants");
        return false;
      case this.config.triggers.potions.roll:
        await this.writeErrorWrongChannelCommand(message, channel, "potions");
        return false;
    }
    await this.writeError(message, this.config.messages.errors.wrongSyntax);
    return false;
  }

  getDifficulty(groups: Groups) {
    return groups.difficulty
      ? new Number(groups.difficulty).valueOf()
      : undefined;
  }
  hasCategory(item: { categories: string[] }, category: string) {
    return item.categories.some((item) => localeEquals(item, category));
  }
  //#endregion
  //#region Items
  getPlant(input: string) {
    const plant = this.config.plants.find(
      (item) =>
        localeEquals(item.name, input) ||
        item.key.some((alias) => localeEquals(alias, input))
    );
    if (!plant) return null;
    return new Plant(input, plant.name, plant.level, plant.duration);
  }

  getPotion(input: string) {
    const potion = this.config.potions.find(
      (item) =>
        localeEquals(item.name, input) ||
        item.key.some((alias) => localeEquals(alias, input))
    );
    if (!potion) return null;
    return new Potion(
      input,
      potion.name,
      potion.level,
      potion.duration,
      potion.plants.map((id) => this.getPlant(id)).filter(notEmpty),
      potion.color
    );
  }

  private getItem(transaction: Transaction): Item | null {
    switch (transaction.kind) {
      case "plants":
        return this.getPlant(transaction.name);
      case "potions":
        return this.getPotion(transaction.name);
    }
  }

  private getBonus(item: Item, data: InputData) {
    const itemBonus = this.config.bonuses[item.kind].find(
      (id) => id.level === item.level && id.semester === data.semester
    );
    if (!itemBonus) return;
    const giftBonus = data.gift ? 15 : 0;
    return itemBonus.bonus + giftBonus;
  }

  private async processRoll(
    message: Message,
    channel: Channel,
    groups: Groups
  ) {
    const item = channel.getItem(groups.item);
    if (!item) {
      await this.writeError(
        message,
        this.config.messages.errors.wrongItem[channel.kind]
      );
      return;
    }

    const data = await InputData.create(
      groups.perso,
      parseInt(groups.bonus, 10),
      groups.semester,
      parseInt(groups.gift, 10),
      () =>
        this.writeError(
          message,
          formatString(this.config.messages.errors.wrongGift, {
            triggerItem: this.config.triggers[item.kind].roll,
          })
        ),
      () =>
        this.writeError(
          message,
          formatString(this.config.messages.errors.wrongSemester, {
            triggerItem: this.config.triggers[item.kind].roll,
          })
        )
    );
    if (!data.validated) return;

    const bonus = data.inputBonus ? data.bonus : this.getBonus(item, data);
    if (bonus === undefined) {
      await this.writeError(message, this.config.messages.errors.bonusNotFound);
      return;
    }

    // Send Roll Request
    const request = roll(this.config.maxRoll ?? 100);
    const { perso, transaction } = this.computeRoll(
      message,
      request,
      bonus,
      item,
      data
    );
    const content = formatString(this.config.messages.confirmation[item.kind], {
      time: this.formatTime(transaction.receiptDate),
      perso: perso,
    });
    await this.sendMessage(message, content, false, true);
  }

  private computeRoll(
    message: Message,
    roll: number,
    bonus: number,
    item: Item,
    data: InputData
  ) {
    let quantity = 0;
    switch (roll) {
      case 1:
      case 2:
        return this.addTransaction(message, roll, bonus, item, data, quantity);
      case 99:
      case 100:
        quantity += 1;
        break;
    }

    const total = roll + bonus;
    if (total >= 120) {
      quantity += 4;
    } else if (total >= 100) {
      quantity += 3;
    } else if (total >= 50) {
      quantity += 2;
    }
    return this.addTransaction(message, roll, bonus, item, data, quantity);
  }

  private getRollResult(transaction: Transaction, item: Item, perso: string) {
    switch (transaction.roll) {
      case 1:
      case 2:
        return this.getFailureResult(transaction.roll, item, perso);
    }
    if (!transaction.quantity) {
      return this.formatResult(
        this.config.messages.results.missed[transaction.kind],
        item,
        perso
      );
    }
    return this.formatResult(
      this.config.messages.results.success[transaction.kind],
      item,
      perso,
      { quantity: transaction.quantity }
    );
  }

  private getFailureResult(no: 1 | 2, item: Item, perso: string) {
    const failure = this.config.messages.results.failures[no][item.kind];
    if (typeof failure === "string") {
      return this.formatResult(failure, item, perso);
    }

    const level = failure.find((i) => i.level === item.level);
    if (!level) {
      throw `Unknown failure level "${item.level}" in "${item.name}"`;
    }

    const message = getRandom(level.messages);
    if (typeof message === "string") {
      return this.formatResult(message, item, perso);
    }

    const extraArgs = omit(message, "message");
    return this.formatResult(message.message, item, perso, extraArgs);
  }

  private formatResult(
    message: string,
    item: Item,
    perso: string,
    extraArgs?: Args
  ) {
    let args: Args = {
      time: this.getTime(item),
      perso: perso,
      item: item.name,
    };
    if ("color" in item) {
      args.color = item.color;
    }
    if ("duration" in item) {
      args.duration = item.duration;
    }
    if (extraArgs) {
      Object.entries(extraArgs).forEach(([key, value]) => {
        args[key] = Array.isArray(value) ? getRandom(value) : value;
      });
    }
    return formatString(message, args);
  }

  private getTime(item: Item): Date {
    // DEBUG:
    // return new Date(Date.now() + 30 * 1000);
    switch (item.kind) {
      case "plants":
        return new Date(Date.now() + item.duration * 24 * 60 * 60 * 1000);
      case "potions":
        return new Date(Date.now() + item.duration * 60 * 60 * 1000);
    }
  }
  //#endregion
  //#region Error Messages
  private async writeError(message: Message, errorMessage: string) {
    this.log(
      `Reply "${errorMessage}" to "${message.content}" from ${message.author.tag}`
    );
    return this.sendMessage(message, errorMessage, true, true);
  }

  private async writeErrorWrongChannelCommand(
    message: Message,
    channel: Channel,
    ...kinds: Items[]
  ) {
    return this.writeError(
      message,
      formatString(
        this.config.messages.errors.wrongChannelCommand[channel.kind],
        {
          channels: kinds
            .map((kind) => this.getDiscordChannel(message, kind))
            .join(", "),
        }
      )
    );
  }
  //#endregion
  //#region Utils
  private getStorageFile() {
    const file = path.resolve(
      __dirname,
      "..",
      "config",
      configName,
      "storage.json"
    );
    const exists = fs.existsSync(file);
    return { path: file, exists };
  }

  private getStorage() {
    const file = this.getStorageFile();
    if (!file.exists) return;
    const data = fs.readFileSync(file.path);
    const storage: Storage = JSON.parse(data.toString());
    return storage;
  }

  private setStorage(storage: Storage) {
    const file = this.getStorageFile();
    const data = JSON.stringify(storage);
    fs.writeFileSync(file.path, data);
  }

  private formatTime(time: string | number | Date): string {
    return new Date(time).toLocaleString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone,
    });
  }

  async sendMessage(
    message: Message,
    content: string,
    error: boolean,
    ping: boolean
  ) {
    const finalContent = [content];
    if (ping) finalContent.push(`${message.author}`);
    await message.channel.send(finalContent.join("\n"));
    await message.react(error ? "💩" : "👌");
  }

  private getDiscordChannel(
    object: Client | Message,
    kind: Items,
    type: ChannelType = "chanPlayers"
  ) {
    const client = "client" in object ? object.client : object;
    return <TextChannel>(
      client.channels.cache.get(this.config.triggers[kind][type])
    );
  }
  //#endregion
}

//#region Item Channels Classes
type Channel = PlantChannel | PotionChannel;
type ChannelType = "chanPlayers" | "chanMJ";

class PlantChannel {
  readonly kind: Plants = "plants";
  constructor(readonly stagiaire: Stagiaire) {}

  async isValidTrigger(message: Message, trigger: string, groups: Groups) {
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

  async writeList(message: Message, groups: Groups, config: Config) {
    const difficulty = this.stagiaire.getDifficulty(groups);
    const items = config.plants.filter((item) => {
      if (difficulty && item.level !== difficulty) return false;
      return (
        !groups.category || this.stagiaire.hasCategory(item, groups.category)
      );
    });
    if (!items.length) {
      return this.stagiaire.sendMessage(
        message,
        config.messages.errors.listResultsNotFound.plants,
        true,
        true
      );
    }
    let n = 1;
    await this.stagiaire.sendMessage(
      message,
      `${items.length} plante(s) trouvée(s)`,
      false,
      true
    );
    for (const item of items) {
      await message.channel.send(
        `\`\`\`md
[${item.name}](Niveau ${item.level} | ${item.duration} jours)
Autres syntaxes : ${item.key.join(", ") || "aucune"}
Usages :
     ${item.usages.join("\n     ")}
> ${n}/${items.length}
\`\`\`
`
      );
      n++;
    }
  }

  getItem(input: string) {
    return this.stagiaire.getPlant(input);
  }
}

class PotionChannel {
  readonly kind: Potions = "potions";
  constructor(readonly stagiaire: Stagiaire) {}

  async isValidTrigger(message: Message, trigger: string, groups: Groups) {
    return this.stagiaire.isValidTrigger(message, this, trigger, groups);
  }

  async writeList(message: Message, groups: Groups, config: Config) {
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
      return this.stagiaire.sendMessage(
        message,
        config.messages.errors.listResultsNotFound.potions,
        true,
        true
      );
    }
    let n = 1;
    await this.stagiaire.sendMessage(
      message,
      `${items.length} potion(s) trouvée(s)`,
      false,
      true
    );
    for (const item of items) {
      await message.channel.send(
        `\`\`\`md
[${item.name}](Niveau ${item.level} | ${item.duration} heures)
> ${item.description}
Autres syntaxes : ${item.key.join(", ") || "aucune"}
Ingrédients : ${item.plants.join(", ") || "aucun"}
> ${n}/${items.length}
\`\`\`
`
      );
      n++;
    }
  }

  getItem(input: string) {
    return this.stagiaire.getPotion(input);
  }
}
//#endregion
//#region Items Classes
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
    readonly plants: Plant[],
    readonly color: string
  ) {}
}

type Semester = number | string;

class InputData {
  private constructor(
    readonly perso: string,
    readonly bonus: number,
    readonly semester: Semester,
    readonly gift: number,
    readonly validated: boolean = true,
    readonly inputBonus: boolean = true
  ) {}

  static async create(
    perso: string,
    bonus: number,
    rawSemester: string,
    gift: number,
    onGiftError: () => Promise<void>,
    onSemesterError: () => Promise<void>
  ) {
    let semester: Semester = parseInt(rawSemester, 10);
    if (isNaN(semester)) semester = rawSemester;
    let validated = true;
    let inputBonus = true;
    if (isNaN(bonus)) {
      if (
        !(await InputData.validateSemester(semester, onSemesterError)) ||
        !(await InputData.validateGift(gift, onGiftError))
      ) {
        validated = false;
      }
      inputBonus = false;
    }
    return new InputData(perso, bonus, semester, gift, validated, inputBonus);
  }

  private static async validateGift(
    gift: number,
    onError: () => Promise<void>
  ) {
    switch (gift) {
      case 0:
      case 1:
        return true;
      default:
        await onError();
        return false;
    }
  }

  private static async validateSemester(
    semester: Semester,
    onError: () => Promise<void>
  ) {
    switch (semester) {
      case 1:
      case 2:
      case 3:
      case "x":
        return true;
      default:
        await onError();
        return false;
    }
  }
}
//#endregion
//#region Storage Interfaces
interface Storage {
  players: Players;
}

interface Players {
  [player: string]: Player;
}

interface Player {
  [perso: string]: Character;
}

interface Character {
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  roll: number;
  bonus: number;
  requestDate: Date;
  receiptDate: Date;
  kind: Items;
  name: string;
  quantity: number;
  toBeStored: boolean;
  received?: boolean;
  storedInInventory?: boolean;
}
//#endregion
