import { Client, Message, Role, User } from "discord.js";
import { MiddlewareManager } from "../../middleware";
import { formatString, notEmpty } from "../../utils";
import { Stagiaire } from "../stagiaire";
import { Channel, PlantChannel, PotionChannel } from "./channels";
import { HelpMiddleware } from "./middlewares/help";
import { ListMiddleware } from "./middlewares/list";
import { RollMiddleware } from "./middlewares/roll";

export class Context {
  static readonly middlewares = new MiddlewareManager<Context>()
    .use(HelpMiddleware)
    .use(ListMiddleware)
    .use(RollMiddleware);

  private readonly _message: Message;
  readonly channel: Channel;
  get author() {
    return this._message.author;
  }
  get message() {
    return this._message.content;
  }

  constructor(
    readonly stagiaire: Stagiaire,
    readonly client: Client,
    readonly config: Stagiaire["config"],
    message: Message
  ) {
    this._message = message;
    const channel = this.getItemChannel();
    if (channel) this.channel = channel;
  }

  private getItemChannel() {
    switch (this._message.channel.id) {
      case this.config.triggers.plants.chanPlayers:
        return new PlantChannel(this);
      case this.config.triggers.potions.chanPlayers:
        return new PotionChannel(this);
    }
  }

  isBotMentioned() {
    const botIds = [
      this.client.users.cache.get(this.config.tagBotId),
      ...this.config.tagBotRoles.map((id) => this._message.guild?.roles.cache.get(id)),
    ].filter(notEmpty);
    const isMentioned = (data: User | Role) => this._message.mentions.has(data, { ignoreEveryone: true });
    return this.author.id !== this.config.tagBotId && botIds.some(isMentioned);
  }

  process() {
    if (!this.channel) {
      return this.writeError(
        formatString(this.config.messages.errors.wrongChannel, {
          plantChannel: this.stagiaire.getDiscordChannel("plants"),
          potionChannel: this.stagiaire.getDiscordChannel("potions"),
        })
      );
    }

    return Context.middlewares.invoke(this, () => this.writeError(this.config.messages.errors.wrongSyntax));
  }

  sendBasic(content: string) {
    return this._message.channel.send(content);
  }

  async sendMessage(content: string, error: boolean, ping: boolean) {
    const finalContent = [content];
    if (ping) finalContent.push(`${this.author}`);
    await this.sendBasic(finalContent.join("\n"));
    await this._message.react(error ? "💩" : "👌");
  }

  writeError(errorMessage: string) {
    this.stagiaire.error(`Reply "${errorMessage}" to "${this.message}" from ${this.author.tag}`);
    return this.sendMessage(errorMessage, true, true);
  }
}
