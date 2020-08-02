import { IMiddleware, Middleware } from "../../../middleware";
import { formatString, localeEquals } from "../../../utils";
import { Items } from "../items";
import { MessageContext } from "../messageContext";

export class HelpMiddleware extends Middleware<MessageContext> {
  constructor(next: IMiddleware<MessageContext>) {
    super(next);
  }

  async invoke(context: MessageContext) {
    const matchHelp = context.message.match(/(?<trigger>[A-zÀ-ú-]+)(?: *(?<command>[A-zÀ-ú-]+))?/);
    if (matchHelp?.groups && localeEquals(matchHelp.groups.trigger, context.config.triggers.help)) {
      if (await context.channel.isValidTrigger(context.config.triggers.help, matchHelp.groups)) {
        await this.writeHelp(context, context.channel.kind, matchHelp.groups.command);
      }
      return;
    }
    await this.next.invoke(context);
  }

  private async writeHelp(context: MessageContext, kind: Items, command: string) {
    context.stagiaire.log(`Helping ${context.author.tag} for ${kind} about command "${command ?? "<none>"}"`);
    if (!command) {
      await context.sendMessage(
        formatString(context.config.messages.help[kind].general, {
          plantChannel: context.stagiaire.getDiscordChannel("plants"),
          potionChannel: context.stagiaire.getDiscordChannel("potions"),
        }),
        false,
        true
      );
    } else if (localeEquals(command, context.config.triggers.list)) {
      await context.sendMessage(
        formatString(context.config.messages.help[kind].commands.list, {
          plantChannel: context.stagiaire.getDiscordChannel("plants"),
        }),
        false,
        true
      );
    } else if (localeEquals(command, context.config.triggers[kind].roll)) {
      await context.sendMessage(context.config.messages.help[kind].commands.roll, false, true);
    }
  }
}
