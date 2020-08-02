import { Client, MessageReaction, User } from "discord.js";
import { formatString, formatTime, notEmpty } from "../../utils";
import { Stagiaire } from "../stagiaire";
import { Items } from "./items";
import { MessageContext } from "./messageContext";
import { RollMiddleware } from "./middlewares/roll";
import { getPersoId, getStorage, setStorage } from "./storage";

export class ReactionContext {
  private readonly _reaction: MessageReaction;
  private readonly _user: User;
  private get _message() {
    return this._reaction.message;
  }
  readonly kind: Items;

  constructor(
    readonly stagiaire: Stagiaire,
    readonly client: Client,
    readonly config: Stagiaire["config"],
    reaction: MessageReaction,
    user: User,
    readonly messageContext: MessageContext
  ) {
    this._reaction = reaction;
    this._user = user;
    const kind = this.getKind();
    if (kind) this.kind = kind;
  }

  private getKind() {
    switch (this._message.channel.id) {
      case this.config.triggers.plants.chanPlayers:
        return "plants";
      case this.config.triggers.potions.chanPlayers:
        return "potions";
    }
  }

  isBot(user: User) {
    const botUser = this.client.users.cache.get(this.config.tagBotId);
    return user === botUser;
  }

  async process() {
    // is the current channel known?
    if (!this.kind) return;
    // is the reaction an attempt to cancel a transaction?
    if (this._reaction.emoji.name !== "💩") return;
    // is the reaction's message not from the bot?
    if (this.isBot(this._message.author)) return;
    // has the reaction's message been processed by the bot?
    const reactions = this._message.reactions.cache.get("👌");
    if (!reactions || !reactions.users.cache.has(this.config.tagBotId)) return;
    // is the current user allowed to cancel the transaction?
    if (!this.isUserAllowed()) return;
    // is the reaction's message sent to the bot?
    if (!this.messageContext.isBotMentioned()) return;
    // is the reaction's message a valid roll?
    const groups = await RollMiddleware.parse(this.messageContext);
    if (!groups) return;
    // find the transaction to cancel
    const storage = getStorage();
    const player = storage?.players?.[this._message.author.id];
    if (!storage || !player) return;
    const persoId = getPersoId(player, groups.perso);
    const perso = player[persoId];
    if (!perso) return;
    const transaction = perso.transactions
      .filter((t) => {
        if (t.received && t.kind !== this.kind) return false;
        const item = this.stagiaire.getItem(this.kind, groups.item);
        if (!item || t.name !== item.name) return false;
        return true;
      })
      .reverse()
      .shift();
    if (!transaction) return;
    const index = perso.transactions.lastIndexOf(transaction);
    if (index < 0) return;
    // cancel the transaction
    this.stagiaire.log(`Aborting transaction ${transaction.id} by ${this._user.tag}`);
    this.stagiaire.unsetTransactionTimer(transaction);
    perso.transactions.splice(index, 1);
    setStorage(storage);
    await this.sendMessage(
      formatString(this.config.messages.itemCanceled[this.kind], {
        perso: groups.perso,
        item: transaction.name,
        receiptDate: formatTime(transaction.receiptDate),
      })
    );
  }

  private isUserAllowed() {
    // has the reaction been added by the message author?
    if (this._message.author === this._user) return true;
    // has the reaction been added by a MJ?
    const mjRoles = this.config.triggers[this.kind].MJ.map((id) => this._message.guild?.roles.cache.get(id)).filter(
      notEmpty
    );
    const isMJ = mjRoles.some((role) => role.members.has(this._user.id));
    return isMJ;
  }

  async sendMessage(content: string) {
    const finalContent = [content, `${this._message.author}`];
    await this._message.channel.send(finalContent.join("\n"));
    await this._message.react("💩");
  }
}
