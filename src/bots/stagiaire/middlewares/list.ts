import { Middleware } from "../../../middleware";
import { localeEquals } from "../../../utils";
import { Context } from "../context";

export class ListMiddleware extends Middleware<Context> {
  constructor(next: Middleware<Context>) {
    super(next);
  }

  async invoke(context: Context) {
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
