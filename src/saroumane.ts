import { watch } from './config';
import discord from 'discord.js';
import saroumane from './config/saroumane.json';

export default (config: { token: string, trigger: string }) => new Promise<void>(resolve => {
  let client = new discord.Client();
  console.log('Starting saroumane...');

  let answers = watch('saroumane.json', saroumane, data => {
    console.log(`${data.answers.length} available answer(s)`);
    return data.answers;
  });
  let getAnswer = () => answers[Math.floor(Math.random() * answers.length)];

  client
    .on('ready', () => {
      console.log(`Logged in as ${client.user.tag}!`);
    })
    .on('error', error => {
      console.error(`Error on saroumane: ${error}`)
    })
    .on('disconnect', () => {
      console.log('Disconnecting saroumane...');
      resolve();
    })
    .on('message', message => {
      if (message.content.substring(0, config.trigger.length).toLowerCase() === config.trigger) {
        let answer = getAnswer();
        console.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
        message.reply(answer);
      }
    })
    .login(config.token);
});
