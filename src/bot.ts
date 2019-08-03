import discord from 'discord.js';

export abstract class Bot {
  private readonly client = new discord.Client();

  constructor(name: string, token: string, builder: (client: discord.Client) => void) {
    console.log(`[${name}] Starting...`);
    this.client
      .on('disconnect', () => console.log(`[${name}] Disconnected`))
      .on('error', error => console.error(`[${name}] ${error}`))
      .on('ready', () => console.log(`[${name}] Logged in as ${this.client.user.tag}!`))
      .on('reconnecting', () => console.log(`[${name}] Reconnecting...`))
      .on('warn', info => console.warn(`[${name}] ${info}`));
    builder(this.client);
    this.client.login(token);
  }

  dispose() {
    this.client.destroy();
  }
}
