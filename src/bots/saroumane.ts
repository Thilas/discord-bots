import { Bot } from './bot';
import { loadAndWatch } from '../config';
import saroumaneData from '../config/saroumane.json';
import { roll } from '../utils';
import { cpus } from 'os';
import { stringify } from 'querystring';

class Configuration {
  constructor(public readonly Prefix: string, public readonly Commands: Command[]) {
  }
}

class Command {
  constructor(
    public readonly Trigger: string,
    public readonly Answers: any[],
    public readonly Variables: Map<string, any[]>) {
  }
}

function GetList(references: string | string[], lists: Map<string, any[]>) {
  if (typeof references == 'string') {
    if (!lists.has(references)) {
      throw 'Unknown list: ' + references;
    }
    return lists.get(references);
  } else {
    let result: any[] = [];
    references.forEach(reference => {
      if (!lists.has(reference)) {
        throw 'Unknown list: ' + reference;
      }
      result.concat(lists.get(reference));
    });
    return result;
  }
}

export class Saroumane extends Bot {
  private config: Configuration = loadAndWatch('saroumane.json', saroumaneData, data => {

    const commands = data.commands.map(c => {
      const answers = GetList(c.answers, saroumaneData.lists);
      return new Command(data.prefix + c.trigger, answers, c.variables);
    });
    this.config = new Configuration(data.prefix, commands);
    const config = this.config;
    return config;


    this.log(`Triggers: tellMe='${data.triggers.tellMe}',
      who='${data.triggers.who}',
      players='${data.triggers.whichPlayer}',
      characters='${data.triggers.whichCharacter}',
      songs='${data.triggers.bawdySong}'`);

    const tellMeAnswers = data.answers.tellMe.map(value => value.length);
    const whoAnswers = data.answers.who.map(value => value.length);
    const whoPlayers = data.answers.players;
    const whoCharacters = data.answers.characters;
    const bawdySongs = data.songs;


    this.log(`Answers: tellMe=[${tellMeAnswers.join(', ')}],
      who=[${whoAnswers.join(', ')}],
      players = [${whoPlayers.length}],
      characters = [${whoCharacters.length}],
      songs = [${bawdySongs.length}]`);

    data.triggers.tellMe = data.triggers.tellMe.toUpperCase();
    data.triggers.who = data.triggers.who.toUpperCase();
    data.triggers.whichPlayer = data.triggers.whichPlayer.toUpperCase();
    data.triggers.whichCharacter = data.triggers.whichCharacter.toUpperCase();
    data.triggers.bawdySong = data.triggers.bawdySong.toUpperCase();
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

        else if (msg.substring(0, this.config.triggers.bawdySong.length) === this.config.triggers.bawdySong) {
          const song = this.getSong();
          this.log(`Reply "${song}" to "${message.content}" from ${message.author.tag}`);
          message.reply(song);
        }
      });
    });
  }

  private getSong() {
    return this.config.songs[roll(this.config.songs.length) - 1];
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
