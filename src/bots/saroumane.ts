import { watch } from '../config';
import saroumane from '../config/saroumane.json';
import { Bot } from './bot';
import * as Utils from '../utils';


const name = 'saroumane';

export class Saroumane extends Bot {
  private answers = watch('saroumane.json', saroumane, data => {
    return {
      answersYes: data.answersYes,
      answersNo: data.answersNo,
      answersOther: data.answersDontKnow,
      answersPlayers: data.answersPlayers

    }
  });

  constructor(config: { token: string, triggerTellMe: string, triggerWho: string }) {
    super(name, config.token, client => {
      client.on('message', message => {

        let msg = message.content.toLowerCase();
        let answer = "";

        if (msg.substring(0, config.triggerTellMe.length) === config.triggerTellMe) {
          answer = this.getAnswerTellMe();
          console.log(`[${name}] Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }

        else if (msg.substring(0, config.triggerWho.length) === config.triggerWho) {
          answer = this.getAnswerWho();
          console.log(`[${name}] Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }
      });
    });
  }

  private getAnswerTellMe() {

    let answerType = Utils.roll(3);

    if (answerType == 1) {
      return this.answers.answersYes[Utils.roll(this.answers.answersYes.length) - 1];
    }

    else if (answerType == 2) {
      return this.answers.answersNo[Utils.roll(this.answers.answersNo.length) - 1];
    }

    else {
      return this.answers.answersOther[Utils.roll(this.answers.answersOther.length) - 1];
    }
  }

  private getAnswerWho() {
    return this.answers.answersPlayers[Utils.roll(this.answers.answersPlayers.length) - 1];
  }
}
