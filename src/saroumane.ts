import { watch } from './config';
import discord from './discord';
import saroumane from './config/saroumane.json';

const name = 'saroumane';

export default (config: { token: string, trigger: string }) => {
  let answers = watch('saroumane.json', saroumane, data => {
    console.log(`[${name}] ${data.answers.length} available answer(s)`);
    return data.answers;
  });
  let getAnswer = () => answers[Math.floor(Math.random() * answers.length)];

  discord(name, config.token, client => {
    client
      .on('message', message => {
        if (message.content.substring(0, config.trigger.length).toLowerCase() === config.trigger) {
          let answer = getAnswer();
          console.log(`[${name}] Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
      });
  });
}
