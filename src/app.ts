import { Saroumane } from "./bots/saroumane";
import { Stagiaire } from "./bots/stagiaire";
import { app } from "./config";
import { allSettled } from "./promise";
// import { timeZone } from "./utils";

// process.env.TZ = timeZone;
console.log("Starting bots...");
console.log(`UTC Time:   ${new Date().toUTCString()}`);
console.log(`Local Time: ${new Date().toLocaleString()}`);

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
