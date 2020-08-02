import { loadAndWatch } from "../config";
import { getRandom, roll } from "../utils";
import { Bot } from "./bot";
import saroumaneConfig from "./saroumane.json";

export class Saroumane extends Bot {
  private config = loadAndWatch("saroumane.json", saroumaneConfig, (config) => {
    this.log(`Triggers: tellMe='${config.triggers.tellMe}',
      who='${config.triggers.who}',
      players='${config.triggers.whichPlayer}',
      characters='${config.triggers.whichCharacter}',
      songs='${config.triggers.bawdySong}',
      fit='${config.triggers.makeMeSweat}'`);

    const tellMeAnswers = config.answers.tellMe.map((value) => value.length);
    const whoAnswers = config.answers.who.map((value) => value.length);
    const whoPlayers = config.answers.players;
    const whoCharacters = config.answers.characters;
    const bawdySongs = config.songs;
    const fitness = config.fit;

    this.log(`Answers: tellMe=[${tellMeAnswers.join(", ")}],
      who=[${whoAnswers.join(", ")}],
      players = [${whoPlayers.length}],
      characters = [${whoCharacters.length}],
      songs = [${bawdySongs.length}],
      fit = [${fitness.length}]`);

    config.triggers.tellMe = config.triggers.tellMe.toUpperCase();
    config.triggers.who = config.triggers.who.toUpperCase();
    config.triggers.whichPlayer = config.triggers.whichPlayer.toUpperCase();
    config.triggers.whichCharacter = config.triggers.whichCharacter.toUpperCase();
    config.triggers.bawdySong = config.triggers.bawdySong.toUpperCase();
    config.triggers.makeMeSweat = config.triggers.makeMeSweat.toUpperCase();
    this.config = config;
  });

  constructor(token: string) {
    super(token, () => {
      this.client.on("message", async (message) => {
        const msg = message.content.toUpperCase();

        if (msg.substring(0, this.config.triggers.tellMe.length) === this.config.triggers.tellMe) {
          const answer = this.getAnswerTellMe();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          await message.reply(answer);
        } else if (msg.substring(0, this.config.triggers.whichPlayer.length) === this.config.triggers.whichPlayer) {
          const answer = this.getAnswerWhichPlayer();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          await message.reply(answer);
        } else if (
          msg.substring(0, this.config.triggers.whichCharacter.length) === this.config.triggers.whichCharacter
        ) {
          const answer = this.getAnswerWhichCharacter();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          await message.reply(answer);
        } else if (msg.substring(0, this.config.triggers.who.length) === this.config.triggers.who) {
          const answer = this.getAnswerWho();
          this.log(`Reply "${answer}" to "${message.content}" from ${message.author.tag}`);
          await message.reply(answer);
        } else if (msg.substring(0, this.config.triggers.bawdySong.length) === this.config.triggers.bawdySong) {
          const song = this.getSong();
          this.log(`Reply "${song}" to "${message.content}" from ${message.author.tag}`);
          await message.reply(song);
        } else if (msg.substring(0, this.config.triggers.makeMeSweat.length) === this.config.triggers.makeMeSweat) {
          const fit = this.getFit();
          const maso = message.content.substring(this.config.triggers.makeMeSweat.length).trim();
          this.log(`Reply "${fit}" to "${message.content}" from ${message.author.tag}`);
          await message.channel.send(maso + ", " + fit);
        }
      });
    });
  }

  private getSong() {
    return getRandom(this.config.songs);
  }

  private getAnswerTellMe() {
    const answers = getRandom(this.config.answers.tellMe);
    return getRandom(answers);
  }

  private getTypeAnswerWho() {
    const answers = getRandom(this.config.answers.who);
    return getRandom(answers);
  }

  private getAnswerWhichPlayer() {
    const answer = this.getTypeAnswerWho();
    const player = getRandom(this.config.answers.players);
    return answer.replace("*", player);
  }

  private getAnswerWhichCharacter() {
    const answer = this.getTypeAnswerWho();
    const character = getRandom(this.config.answers.characters);
    return answer.replace("*", character);
  }

  private getAnswerWho() {
    const answer = this.getTypeAnswerWho();
    const names = this.config.answers.players.concat(this.config.answers.characters);
    return getRandom(names);
  }

  private getFit() {
    const exercise = getRandom(this.config.fit);
    const points = roll(5);
    const rollMalus = roll(100);

    if (rollMalus > 89) {
      return "bravo ! Demande à n'importe qui de faire " + exercise + " pour " + points.toString() + " point(s)";
    } else if (rollMalus < 11) {
      return "grâce à toi, tout le monde doit faire " + exercise + " pour " + points.toString() + " point(s)";
    } else {
      return "fais-nous " + exercise + " pour " + points.toString() + " point(s)";
    }
  }
}
