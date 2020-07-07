import { Saroumane } from "./bots/saroumane";
import { Stagiaire } from "./bots/stagiaire";
import { app } from "./config";
import { allSettled } from "./promise";

const bots = [
  new Saroumane(app.tokens.saroumane),
  new Stagiaire(app.tokens.stagiaire),
];

process.on("SIGINT", () => {
  console.log("** Closing...");
  allSettled(bots.map((bot) => bot.dispose())).then(() => process.exit());
});

allSettled(bots.map((bot) => bot.start())).then(() =>
  console.log("** Initialized")
);
