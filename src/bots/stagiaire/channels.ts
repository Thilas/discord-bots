import { formatString, Groups, localeEquals } from "../../utils";
import { Context } from "./context";
import { Items, Kinds, Plants, Potions } from "./items";
import { Character, Transaction } from "./storage";

export type Channel = PlantChannel | PotionChannel;
export type ChannelType = "chanPlayers" | "chanMJ";

export class PlantChannel {
  readonly kind: Plants = "plants";
  constructor(readonly context: Context) {}

  isValidTrigger(trigger: string, groups: Groups) {
    return isValidTrigger(this.context, trigger, groups, () => {
      if (trigger === this.context.config.triggers.list && groups.ingredient) return "plants";
    });
  }

  async writeList(groups: Groups) {
    const difficulty = getDifficulty(groups);
    this.context.stagiaire.log(
      `Listing plants by ${this.context.author.tag}: difficulty=${groups.difficulty}, category=${groups.category}`
    );
    const items = this.context.config.plants.filter((item) => {
      if (difficulty && item.level !== difficulty) return false;
      return !groups.category || hasCategory(item, groups.category);
    });
    if (!items.length) {
      await this.context.sendMessage(this.context.config.messages.errors.listResultsNotFound.plants, true, true);
      return;
    }
    let n = 1;
    await this.context.sendMessage(`${items.length} plante(s) trouvée(s)`, false, true);
    for (const item of items) {
      await this.context.sendBasic(
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

  isValidTransaction(transaction: Transaction, perso: Character) {}
}

export class PotionChannel {
  readonly kind: Potions = "potions";
  constructor(readonly context: Context) {}

  isValidTrigger(trigger: string, groups: Groups) {
    return isValidTrigger(this.context, trigger, groups);
  }

  async writeList(groups: Groups) {
    const difficulty = getDifficulty(groups);
    const plant = groups.ingredient ? this.context.stagiaire.getPlant(groups.ingredient) : undefined;
    const ingredient = plant ? plant.name : groups.ingredient;
    this.context.stagiaire.log(
      `Listing potions by ${this.context.author.tag}: difficulty=${groups.difficulty}, ingredient=${groups.ingredient}, category=${groups.category}`
    );
    const items = this.context.config.potions.filter((item) => {
      if (difficulty && item.level !== difficulty) return false;
      if (ingredient) {
        if (localeEquals("aucun", ingredient)) {
          if (item.plants.length) return false;
        } else if (!item.plants.some((plant) => localeEquals(plant, ingredient))) {
          return false;
        }
      }
      return !groups.category || hasCategory(item, groups.category);
    });
    if (!items.length) {
      await this.context.sendMessage(this.context.config.messages.errors.listResultsNotFound.potions, true, true);
      return;
    }
    let n = 1;
    await this.context.sendMessage(`${items.length} potion(s) trouvée(s)`, false, true);
    for (const item of items) {
      await this.context.sendBasic(
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

  isValidTransaction(transaction: Transaction, perso: Character) {
    if (perso.transactions.some((t) => t.kind === "potions" && !t.received)) {
      return this.context.config.messages.errors.hasOngoingPotion;
    }
  }
}

async function isValidTrigger(
  context: Context,
  trigger: string,
  groups: Groups,
  getWrongChannels?: () => Items | Items[] | undefined
) {
  if (getWrongChannels) {
    const wrongChannels = getWrongChannels();
    if (wrongChannels) {
      if (Array.isArray(wrongChannels)) {
        await writeErrorWrongChannelCommand(context, ...wrongChannels);
      } else {
        await writeErrorWrongChannelCommand(context, wrongChannels);
      }
      return false;
    }
  }
  const triggers = context.config.triggers;
  switch (trigger) {
    case triggers.help:
      if (
        !groups.command ||
        localeEquals(groups.command, triggers.list) ||
        localeEquals(groups.command, triggers[context.channel.kind].roll)
      ) {
        return true;
      }
      trigger = groups.command;
      break;
    case triggers.list:
    case triggers[context.channel.kind].roll:
      return true;
  }
  const kind = Kinds.find((k) => localeEquals(trigger, triggers[k].roll));
  if (kind) {
    await writeErrorWrongChannelCommand(context, kind);
    return false;
  }
  await context.writeError(context.config.messages.errors.wrongSyntax);
  return false;
}

function writeErrorWrongChannelCommand(context: Context, ...kinds: Items[]) {
  return context.writeError(
    formatString(context.config.messages.errors.wrongChannelCommand[context.channel.kind], {
      channels: kinds.map((kind) => context.stagiaire.getDiscordChannel(kind)).join(", "),
    })
  );
}

function getDifficulty(groups: Groups) {
  return groups.difficulty ? new Number(groups.difficulty).valueOf() : undefined;
}

function hasCategory(item: { categories: string[] }, category: string) {
  return item.categories.some((item) => localeEquals(item, category));
}
