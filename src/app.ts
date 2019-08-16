import { Saroumane } from './bots/saroumane';
import { app } from './config';
import { allSettled } from './promise';

let bots = [
  new Saroumane(app.tokens.saroumane)
];

process.on('SIGINT', () => {
  console.log('Closing...');
  allSettled(bots.map(bot => bot.dispose()))
    .then(() => process.exit());
});

allSettled(bots.map(bot => bot.start()))
  .finally(() => console.log('Initialized'));
