import { watch } from '../config';
import saroumane from '../config/saroumane.json';
import { Bot } from './bot';
import * as Utils from '../utils';

const name = 'saroumane';

export class Saroumane extends Bot {
  private answers = watch('saroumane.json', saroumane, json => {
    console.log(`[${name}] Available answers: yes=${json.answersYes.length}, no=${json.answersNo.length}, other=${json.answersDontKnow.length}, players=${json.answersPlayers.length}`);
    return {
      yes: json.answersYes,
      no: json.answersNo,
      other: json.answersDontKnow,
      players: json.answersPlayers
    };
  }, data => {
    this.answers = data;
  });

  constructor(config: { token: string, triggerTellMe: string, triggerWho: string }) {
    super(name, config.token, client => {
      config.triggerTellMe = config.triggerTellMe.toUpperCase();
      config.triggerWho = config.triggerWho.toUpperCase();

      client.on('message', message => {
        let msg = message.content.toUpperCase();

        if (msg.substring(0, config.triggerTellMe.length) === config.triggerTellMe) {
          let answer = this.getAnswerTellMe();
          console.log(`[${name}] Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
        else if (msg.substring(0, config.triggerWho.length) === config.triggerWho) {
          let answer = this.getAnswerWho();
          console.log(`[${name}] Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
      });
    });
  }

  private getAnswerTellMe() {
    let answerType = Utils.roll(3);
    switch (answerType) {
      case 1:
        return this.answers.yes[Utils.roll(this.answers.yes.length) - 1];
      case 2:
        return this.answers.no[Utils.roll(this.answers.no.length) - 1];
      default:
        return this.answers.other[Utils.roll(this.answers.other.length) - 1];
    }
  }

  private getAnswerWho() {
    return this.answers.players[Utils.roll(this.answers.players.length) - 1];
  }
}
