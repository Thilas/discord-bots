import discord from 'discord.js';

export default (name: string, token: string, builder: (client: discord.Client) => void) => {
  let client = new discord.Client();
  console.log(`[${name}] Starting...`);

  client
    .on('disconnect', () => console.log(`[${name}] Disconnected`))
    .on('error', error => console.error(`[${name}] ${error}`))
    .on('ready', () => console.log(`[${name}] Logged in as ${client.user.tag}!`))
    .on('reconnecting', () => console.log(`[${name}] Reconnecting...`))
    .on('warn', info => console.warn(`[${name}] ${info}`));
  builder(client);
  client.login(token);

  return client;
}
