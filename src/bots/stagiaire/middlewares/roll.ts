import { v4 as uuidv4 } from "uuid";
import { IMiddleware, Middleware } from "../../../middleware";
import { formatString, formatTime, Groups, localeEquals, roll } from "../../../utils";
import { InputData } from "../inputData";
import { getReceiptDate, Item, Kinds } from "../items";
import { MessageContext } from "../messageContext";
import { Character, getPersoId, getStorage, Player, setStorage, Storage, Transaction } from "../storage";

export class RollMiddleware extends Middleware<MessageContext> {
  constructor(next: IMiddleware<MessageContext>) {
    super(next);
  }

  async invoke(context: MessageContext) {
    const groups = await RollMiddleware.parse(context);
    if (groups !== null) {
      if (groups) {
        await this.processRoll(context, groups);
      }
      return;
    }
    await this.next.invoke(context);
  }

  static async parse(context: MessageContext) {
    const match = context.message.match(
      /(?<trigger>[A-zÀ-ú-]+) +(?<item>.+?) *\( *(?<perso>.+?) +(?:(?<bonus>-?\d+)|(?<semester>\d+|x) +(?<gift>\d+)) *\)/
    );
    if (match?.groups) {
      const trigger = match.groups.trigger;
      const kind = Kinds.find((k) => localeEquals(trigger, context.config.triggers[k].roll));
      if (kind) {
        if (await context.channel.isValidTrigger(context.config.triggers[kind].roll, match.groups)) {
          return match.groups;
        }
        return;
      }
    }
    return null;
  }

  private async processRoll(context: MessageContext, groups: Groups) {
    const item = context.stagiaire.getItem(context.channel.kind, groups.item);
    if (!item) {
      await context.writeError(context.config.messages.errors.wrongItem[context.channel.kind]);
      return;
    }

    const data = await InputData.create(
      groups.perso,
      parseInt(groups.bonus, 10),
      groups.semester,
      parseInt(groups.gift, 10),
      () =>
        context.writeError(
          formatString(context.config.messages.errors.wrongGift, {
            triggerItem: context.config.triggers[item.kind].roll,
          })
        ),
      () =>
        context.writeError(
          formatString(context.config.messages.errors.wrongSemester, {
            triggerItem: context.config.triggers[item.kind].roll,
          })
        )
    );
    if (!data.validated) return;

    const bonus = data.inputBonus ? data.bonus : this.getBonus(context, item, data);
    if (bonus === undefined) {
      await context.writeError(context.config.messages.errors.bonusNotFound);
      return;
    }

    // Send Roll Request
    const request = roll(context.config.maxRoll ?? 100);
    const result = this.computeRoll(context, request, bonus, item, data);
    if (result instanceof Error) {
      await context.writeError(result.message);
      return;
    }
    const { perso, transaction } = result;
    context.stagiaire.log(
      `Rolling ${item.name} among ${item.kind} by ${context.author.id} > ${data.perso}:
  user=${context.author.tag}
  bonus=${data.bonus}
  semester=${data.semester}
  gift=${data.gift}
  transaction=${transaction.id}
  request date=${formatTime(transaction.requestDate)}
  receipt date=${formatTime(transaction.receiptDate)}`
    );
    const content = formatString(context.config.messages.confirmation[item.kind], {
      time: formatTime(transaction.receiptDate),
      perso: perso,
    });
    await context.sendMessage(content, false, true);
  }

  private getBonus(context: MessageContext, item: Item, data: InputData) {
    const itemBonus = context.config.bonuses[item.kind].find(
      (id) => id.level === item.level && id.semester === data.semester
    );
    if (!itemBonus) return;
    const giftBonus = data.gift ? 15 : 0;
    return itemBonus.bonus + giftBonus;
  }

  private computeRoll(context: MessageContext, roll: number, bonus: number, item: Item, data: InputData) {
    let quantity = 0;
    switch (roll) {
      case 1:
      case 2:
        return this.addTransaction(context, roll, bonus, item, data, quantity);
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
    return this.addTransaction(context, roll, bonus, item, data, quantity);
  }

  private addTransaction(
    context: MessageContext,
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
      receiptDate: getReceiptDate(item),
      kind: item.kind,
      name: item.name,
      quantity: quantity,
      toBeStored: quantity > 0 || (item.kind === "potions" && item.plants.length > 0),
    };
    let storage = getStorage();
    if (!storage)
      storage = {
        players: {},
      } as Storage;
    let player = storage.players[context.author.id];
    if (!player) {
      player = storage.players[context.author.id] = {} as Player;
    }
    // looking for the persoId that "localEquals" the specified perso (to avoid duplicated entries)
    let persoId = getPersoId(player, data.perso);
    let perso = player[persoId];
    if (!perso) {
      perso = player[persoId] = {
        transactions: [],
      } as Character;
    }
    // is transaction valid?
    const error = context.channel.isValidTransaction(transaction, perso);
    if (error) {
      return new Error(error);
    }
    // ... then process it
    perso.transactions.push(transaction);
    setStorage(storage);
    context.stagiaire.setTransactionTimer(transaction, item, context.author.id, persoId, data.perso);
    return { player: context.author.id, perso: data.perso, transaction };
  }
}
