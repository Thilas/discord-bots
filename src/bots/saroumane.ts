import { Bot } from './bot';
import { loadAndWatch } from '../config';
import saroumaneConfig from '../config/saroumane.json';
import { roll } from '../utils';

export class Saroumane extends Bot {
  private config = loadAndWatch('saroumane.json', saroumaneConfig, config => {
    this.log(`Triggers: tellMe='${config.triggers.tellMe}', who='${config.triggers.who}'`);
    const tellMeAnswers = config.answers.tellMe.map(value => value.length);
    this.log(`Answers: tellMe=[${tellMeAnswers.join(', ')}], who=${config.answers.who.length}, players=${config.answers.players.length}`);
    config.triggers.tellMe = config.triggers.tellMe.toUpperCase();
    config.triggers.who = config.triggers.who.toUpperCase();
    this.config = config;
  });

  constructor(token: string) {
    super(token, client => {
      client.on('message', message => {
        const msg = message.content.toUpperCase();

        if (msg.substring(0, this.config.triggers.tellMe.length) === this.config.triggers.tellMe) {
          const answer = this.getAnswerTellMe();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
        else if (msg.substring(0, this.config.triggers.who.length) === this.config.triggers.who) {
          const answer = this.getAnswerWho();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
      });
    });
  }

  private getAnswerTellMe() {
    const answers = this.config.answers.tellMe[roll(this.config.answers.tellMe.length) - 1];
    return answers[roll(answers.length) - 1];
  }

  private getAnswerWho() {
    return this.config.answers.players[roll(this.config.answers.players.length) - 1];
  }
}
