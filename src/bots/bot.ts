import { Client } from "discord.js";

/** Abstract class for bots. */
export abstract class Bot {
  protected readonly name = this.constructor.name;
  protected readonly client = new Client();

  /**
   * @param token Token of the account to log in with.
   * @param builder Callback to configure the Discord client.
   */
  protected constructor(
    private readonly token: string,
    builder: (client: Client) => void
  ) {
    this.log("Starting...");
    this.client
      .on("disconnect", () => this.log("Disconnected"))
      .on("error", (error) => this.error(`Error: ${error}`))
      .on("ready", () => {
        this.log(`Logged in as ${this.client.user?.tag ?? "<unknown>"}!`);
        builder(this.client);
      })
      .on("warn", (info) => this.error(`Warning: ${info}`));
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
  public log(message: string) {
    console.log(`[${this.name}] ${message}`);
  }

  /** Prints to `stderr` with newline for the bot. */
  public error(message: string) {
    console.error(`[${this.name}] ${message}`);
  }

  /** Prints warning to `stdout` with newline for the bot. */
  public warn(message: string) {
    console.warn(`[${this.name}] ${message}`);
  }
}
