import { Client, TextChannel, User } from "discord.js";
import { ellipsis, formatString, formatTime } from "../../utils";
import { Stagiaire } from "../stagiaire";
import { getStorage, setStorage } from "./storage";

export async function displayTransactions(stagiaire: Stagiaire, client: Client) {
  stagiaire.log(`Display Transactions started at ${new Date().toUTCString()}`);
  const storage = getStorage();
  if (!storage) {
    stagiaire.log("Storage is empty");
    return;
  }

  const plantChannel = stagiaire.getDiscordChannel("plants", "chanMJ");
  const potionChannel = stagiaire.getDiscordChannel("potions", "chanMJ");

  let pingMJPlant = false;
  let pingMJPotion = false;
  for (const [playerId, playerContent] of Object.entries(storage.players)) {
    const playerDiscord = client.users.cache.get(playerId) ?? playerId;
    for (const [persoId, persoContent] of Object.entries(playerContent)) {
      let contentPlant: string[] = [];
      let contentPotion: string[] = [];
      persoContent.transactions
        .filter((t) => t.received && t.toBeStored && !t.storedInInventory)
        .forEach((t) => {
          const message = `${t.name} : +${t.quantity} (${formatTime(t.receiptDate)})`;
          switch (t.kind) {
            case "plants":
              contentPlant.push(message);
              break;
            case "potions":
              contentPotion.push(message);
              const item = stagiaire.getPotion(t.name);
              item?.plants?.forEach((p) => contentPotion.push(`    ${p.name} : -1`));
              break;
            default:
              stagiaire.warn("Unknown item.");
              return;
          }
          stagiaire.log(message);
          t.storedInInventory = true;
        });

      pingMJPlant = await sendTransactionsSummary(plantChannel, playerDiscord, persoId, contentPlant, pingMJPlant);
      pingMJPotion = await sendTransactionsSummary(potionChannel, playerDiscord, persoId, contentPotion, pingMJPotion);
    }
  }
  setStorage(storage);
  await stagiaire.pingMJ("plants", plantChannel, pingMJPlant);
  await stagiaire.pingMJ("potions", potionChannel, pingMJPotion);
  stagiaire.log("Display Transactions ended");
}

async function sendTransactionsSummary(
  channel: TextChannel,
  player: User | string,
  perso: string,
  transactions: string[],
  ping: boolean
) {
  if (!transactions.length) return ping;

  const content = formatString("{player}\n```md\n# {perso}\n{transactions}```\n\n", {
    player,
    perso,
    transactions: ellipsis(transactions.join("\n"), 1800, "la suite a été tronquée"),
  });
  await channel.send(content);
  return true;
}
