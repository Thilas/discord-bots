import { TextChannel } from "discord.js";
import Cron from "node-cron";
import { loadAndWatch } from "../config";
import { Args, formatString, formatTime, getRandom, localeEquals, notEmpty, omit } from "../utils";
import { Bot } from "./bot";
import stagiaireConfig from "./stagiaire.json";
import { ChannelType } from "./stagiaire/channels";
import { Context } from "./stagiaire/context";
import { getReceiptDate, Item, Items, Plant, Potion } from "./stagiaire/items";
import { getStorage, setStorage, Transaction } from "./stagiaire/storage";
import { displayTransactions } from "./stagiaire/summary";

export class Stagiaire extends Bot {
  private config = loadAndWatch("stagiaire.json", stagiaireConfig, (config) => {
    this.log(`Bot: id='${config.tagBotId}', roles='${config.tagBotRoles.join(", ")}'`);
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
    if (!this.setDisplayTransactionsCron(true)) this.error("Invalid summary cron");
  });
  private summaryCron: Cron.ScheduledTask;

  constructor(token: string) {
    super(token, () => {
      this.client.on("message", async (message) => {
        const context = new Context(this, this.client, this.config, message);
        if (context.isBotMentioned()) await context.process();
      });
      this.resetTransactionsTimers();
      this.setDisplayTransactionsCron();
      // DEBUG:
      // setTimeout(async () => {
      //   await this.displayTransactions(client);
      // }, 1);
    });
  }

  //#region Items
  getItem(kind: Items, name: string): Item | null {
    switch (kind) {
      case "plants":
        return this.getPlant(name);
      case "potions":
        return this.getPotion(name);
    }
  }

  getPlant(input: string) {
    const plant = this.config.plants.find(
      (item) => localeEquals(item.name, input) || item.key.some((alias) => localeEquals(alias, input))
    );
    if (!plant) return null;
    return new Plant(input, plant.name, plant.level, plant.duration);
  }

  getPotion(input: string) {
    const potion = this.config.potions.find(
      (item) => localeEquals(item.name, input) || item.key.some((alias) => localeEquals(alias, input))
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
  //#endregion
  //#region Transaction Summary
  private setDisplayTransactionsCron(reload?: boolean) {
    if (!Cron.validate(this.config.summary.cron)) return false;
    this.summaryCron?.destroy();
    if (!reload || this.summaryCron) {
      this.summaryCron = Cron.schedule(this.config.summary.cron, () => displayTransactions(this, this.client));
    }
    return true;
  }

  async pingMJ(kind: Items, channel: TextChannel, ping: boolean) {
    if (!ping) return;
    const mjRoles = this.config.triggers[kind].MJ.map((id) => channel.guild.roles.cache.get(id)).filter(notEmpty);
    if (mjRoles.length) await channel.send(`\n\n${mjRoles.join(", ")}`);
    else this.log(`No MJ roles found for ${kind}`);
  }
  //#endregion
  //#region Transaction Timers
  private resetTransactionsTimers() {
    this.log(`Reset Missing Transactions Timers started at ${new Date().toUTCString()}`);
    const storage = getStorage();
    if (!storage) {
      this.log("Storage is empty");
      return;
    }

    for (const [playerId, playerContent] of Object.entries(storage.players)) {
      for (const [persoId, persoContent] of Object.entries(playerContent)) {
        persoContent.transactions
          .filter((t) => !t.received)
          .forEach((t) => {
            const item = this.getItem(t.kind, t.name);
            if (item) {
              this.log(`Setting timer for transaction ${t.id} on ${formatTime(t.receiptDate)}`);
              this.setTransactionTimer(t, item, playerId, persoId);
            }
          });
      }
    }
    this.log("Reset Missing Transactions Timers ended");
  }

  setTransactionTimer(transaction: Transaction, item: Item, playerId: string, persoId: string, perso?: string) {
    const next = new Date(transaction.receiptDate).getTime() - Date.now();
    setTimeout(async () => {
      this.log(`Receiving ${item.name} among ${item.kind} by ${playerId} > ${perso ?? persoId}:
  transaction=${transaction.id}
  roll=${transaction.roll}
  bonus=${transaction.bonus}
  quantity=${transaction.quantity}`);
      const content = [
        this.getRollResult(transaction, item, perso ?? persoId),
        formatString(this.config.messages.results.logs[item.kind], {
          roll: transaction.roll,
          bonus: transaction.bonus,
          ingredients:
            item.kind === "potions" ? item.plants.map((plant) => plant.name).join(", ") || "aucun" : undefined,
        }),
      ];
      const channel = this.getDiscordChannel(item.kind);
      const playerDiscord = channel.client.users.cache.get(playerId);
      const ping = playerDiscord ? `${playerDiscord}, ` : "";
      await channel.send(`${ping}${content.join("\n")}`);
      this.updateTransaction(playerId, persoId, transaction.id, {
        received: true,
      });
    }, Math.max(next, 1));
  }

  private getRollResult(transaction: Transaction, item: Item, perso: string) {
    switch (transaction.roll) {
      case 1:
      case 2:
        return this.getFailureResult(transaction.roll, item, perso);
    }
    if (!transaction.quantity) {
      return this.formatResult(this.config.messages.results.missed[transaction.kind], item, perso);
    }
    return this.formatResult(this.config.messages.results.success[transaction.kind], item, perso, {
      quantity: transaction.quantity,
    });
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

  private formatResult(message: string, item: Item, perso: string, extraArgs?: Args) {
    let args: Args = {
      time: getReceiptDate(item),
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

  private updateTransaction(playerId: string, persoId: string, id: string, transaction: Partial<Transaction>) {
    const storage = getStorage();
    if (!storage?.players?.[playerId]?.[persoId]) return;
    const index = storage.players[playerId][persoId].transactions.findIndex((t) => t.id === id);
    if (index < 0) return;
    storage.players[playerId][persoId].transactions[index] = {
      ...storage.players[playerId][persoId].transactions[index],
      ...transaction,
    };
    setStorage(storage);
  }
  //#endregion
  //#region Utils
  getDiscordChannel(kind: Items, type: ChannelType = "chanPlayers") {
    return <TextChannel>this.client.channels.cache.get(this.config.triggers[kind][type]);
  }
  //#endregion
}
