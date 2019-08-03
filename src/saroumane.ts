import { Bot } from './bot';
import { watch } from './config';
import saroumane from './config/saroumane.json';

const name = 'saroumane';

export class Saroumane extends Bot {
  private answers = watch('saroumane.json', saroumane, data => {
    console.log(`[${name}] ${data.answers.length} available answer(s)`);
    return data.answers;
  });

  constructor(config: { token: string, trigger: string }) {
    super(name, config.token, client => {
      client.on('message', message => {
        if (message.content.substring(0, config.trigger.length).toLowerCase() === config.trigger) {
          let answer = this.getAnswer();
          console.log(`[${name}] Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
      });
    });
  }

  private getAnswer() {
    return this.answers[Math.floor(Math.random() * this.answers.length)];
  }
}
