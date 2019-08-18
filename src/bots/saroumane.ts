import { Bot } from './bot';
import { loadAndWatch } from '../config';
import saroumaneConfig from '../config/saroumane.json';
import { roll } from '../utils';

export class Saroumane extends Bot {
  private config = loadAndWatch('saroumane.json', saroumaneConfig, config => {
    this.log(`Triggers: tellMe='${config.triggers.tellMe}',
      who='${config.triggers.who}',
      players='${config.triggers.whichPlayer}',
      characters='${config.triggers.whichCharacter}'`);

    const tellMeAnswers = config.answers.tellMe.map(value => value.length);
    const whoAnswers = config.answers.who.map(value => value.length);
    const whoPlayers = config.answers.players;
    const whoCharacters = config.answers.characters;


    this.log(`Answers: tellMe=[${tellMeAnswers.join(', ')}],
      who=[${whoAnswers.join(', ')}],
      players = [${whoPlayers.length}],
      characters = [${whoCharacters.length}]`);

    config.triggers.tellMe = config.triggers.tellMe.toUpperCase();
    config.triggers.who = config.triggers.who.toUpperCase();
    config.triggers.whichPlayer = config.triggers.whichPlayer.toUpperCase();
    config.triggers.whichCharacter = config.triggers.whichCharacter.toUpperCase();
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

        else if (msg.substring(0, this.config.triggers.whichPlayer.length) === this.config.triggers.whichPlayer) {
          const answer = this.getAnswerWhichPlayer();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          message.reply(answer);
        }

        else if (msg.substring(0, this.config.triggers.whichCharacter.length) === this.config.triggers.whichCharacter) {
          const answer = this.getAnswerWhichCharacter();
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

  private getTypeAnswerWho() {
    const answers = this.config.answers.who[roll(this.config.answers.who.length) - 1];
    return answers[roll(answers.length) - 1];
  }

  private getAnswerWhichPlayer() {
    const answer = this.getTypeAnswerWho();
    const player = this.config.answers.players[roll(this.config.answers.players.length) - 1];
    return answer.replace('*', player);
  }

  private getAnswerWhichCharacter() {
    const answer = this.getTypeAnswerWho();
    const character = this.config.answers.characters[roll(this.config.answers.characters.length) - 1];
    return answer.replace('*', character);
  }

  private getAnswerWho() {
    const answer = this.getTypeAnswerWho();
    const names = this.config.answers.players.concat(this.config.answers.characters);
    return names[roll(names.length) - 1];
  }



}
