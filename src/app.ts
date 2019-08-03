import { app } from './config';
import { Saroumane } from './saroumane';

let bots = [
  new Saroumane(app.saroumane)
];

process.on('SIGINT', () => {
  console.log('Closing...');
  bots.forEach(bot => bot.dispose());
  process.exit();
});

console.log('Initialized');
