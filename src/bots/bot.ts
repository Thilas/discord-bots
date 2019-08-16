import discord from 'discord.js';

export abstract class Bot {
  private readonly name = this.constructor.name;
  private readonly client = new discord.Client();

  protected constructor(private readonly token: string, builder: (client: discord.Client) => void) {
    this.log('Starting...');
    this.client
      .on('disconnect', () => this.log('Disconnected'))
      .on('error', error => this.error(`Error: ${error}`))
      .on('ready', () => this.log(`Logged in as ${this.client.user.tag}!`))
      .on('reconnecting', () => this.log('Reconnecting...'))
      .on('warn', info => this.error(`Warning: ${info}`))
    builder(this.client);
  }

  public async start() {
    await this.client.login(this.token);
  }

  public async dispose() {
    await this.client.destroy();
  }

  protected log(message?: any, ...optionalParams: any[]) {
    console.log(`[${this.name}] ${message}`, ...optionalParams);
  }

  private error(message?: any, ...optionalParams: any[]) {
    console.error(`[${this.name}] ${message}`, ...optionalParams);
  }
}
