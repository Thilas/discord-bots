import { loadAndwatch } from '../config';
import saroumaneConfig from '../config/saroumane.json';
import { Bot } from './bot';
import * as Utils from '../utils';

export class Saroumane extends Bot {
  private config = loadAndwatch('saroumane.json', saroumaneConfig, config => {
    this.log(`Triggers: tellMe='${config.triggers.tellMe}', who='${config.triggers.who}'`);
    let tellMeAnswers = config.answers.tellMe.map(value => value.length);
    this.log(`Answers: tellMe=[${tellMeAnswers.join(', ')}], who=${config.answers.who.length}, players=${config.answers.players.length}`);
    config.triggers.tellMe = config.triggers.tellMe.toUpperCase();
    config.triggers.who = config.triggers.who.toUpperCase();
    this.config = config;
  });

  constructor(token: string) {
    super(token, client => {
      client.on('message', message => {
        let msg = message.content.toUpperCase();

        if (msg.substring(0, this.config.triggers.tellMe.length) === this.config.triggers.tellMe) {
          let answer = this.getAnswerTellMe();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
        else if (msg.substring(0, this.config.triggers.who.length) === this.config.triggers.who) {
          let answer = this.getAnswerWho();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
      });
    });
  }

  private getAnswerTellMe() {
    let answers = this.config.answers.tellMe[Utils.roll(this.config.answers.tellMe.length) - 1];
    return answers[Utils.roll(answers.length) - 1];
  }

  private getAnswerWho() {
    return this.config.answers.players[Utils.roll(this.config.answers.players.length) - 1];
  }
}
