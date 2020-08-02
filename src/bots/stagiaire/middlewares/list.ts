import { IMiddleware, Middleware } from "../../../middleware";
import { localeEquals } from "../../../utils";
import { MessageContext } from "../messageContext";

export class ListMiddleware extends Middleware<MessageContext> {
  constructor(next: IMiddleware<MessageContext>) {
    super(next);
  }

  async invoke(context: MessageContext) {
    const matchLists = context.message.match(
      /(?<trigger>[A-zÀ-ú-]+)(?: *(?<difficulty>\d+)\b)?(?: *(?<category>[^() ]+))?(?: *\( *(?<ingredient>.+?)? *\))?/
    );
    if (matchLists?.groups && localeEquals(matchLists.groups.trigger, context.config.triggers.list)) {
      if (await context.channel.isValidTrigger(context.config.triggers.list, matchLists.groups)) {
        await context.channel.writeList(matchLists.groups);
      }
      return;
    }
    await this.next.invoke(context);
  }
}
