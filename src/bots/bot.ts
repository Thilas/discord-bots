import discord from "discord.js";

/** Abstract class for any bot. */
export abstract class Bot {
  private readonly name = this.constructor.name;
  private readonly client = new discord.Client();

  /**
   * @param token Token of the account to log in with.
   * @param builder Callback to configure the Discord client.
   */
  protected constructor(
    private readonly token: string,
    builder: (client: discord.Client) => void
  ) {
    this.log("Starting...");
    this.client
      .on("disconnect", () => this.log("Disconnected"))
      .on("error", (error) => this.error(`Error: ${error}`))
      .on("ready", () => this.log(`Logged in as ${this.client.user.tag}!`))
      .on("reconnecting", () => this.log("Reconnecting..."))
      .on("warn", (info) => this.error(`Warning: ${info}`));
    builder(this.client);
  }

  /** Starts the bot, logging it in, and establishing a websocket connection to Discord. */
  public async start() {
    await this.client.login(this.token);
  }

  /** Disposes the bot, logging it out, and terminating the connection to Discord. */
  public async dispose() {
    await this.client.destroy();
  }

  /** Prints to `stdout` with newline for the bot. */
  protected log(message?: any, ...optionalParams: any[]) {
    console.log(`[${this.name}] ${message}`, ...optionalParams);
  }

  /** Prints to `stderr` with newline for the bot. */
  private error(message?: any, ...optionalParams: any[]) {
    console.error(`[${this.name}] ${message}`, ...optionalParams);
  }
}
