import { Client } from "discord-rpc";

import { config } from "./config";

// internal state
let rpc: Client;

export async function initDiscordRpc() {
  if (!config.discordRpc) return;

  // clean up existing client if one exists
  rpc?.removeAllListeners();

  try {
    rpc = new Client({ transport: "ipc" });

    rpc.on("ready", () =>
      rpc.setActivity({
        state: "cynk.space",
        details: "Чатица в cynk",
        largeImageKey: "qr",
        largeImageText: "Залетай в Cynk!",
        buttons: [
          {
            label: "Залетай в Cynk",
            url: "https://cynk.space/",
          },
        ],
      }),
    );

    rpc.on("disconnected", reconnect);

    rpc.login({ clientId: "1564267906538405941" });
  } catch (err) {
    reconnect();
  }
}

const reconnect = () => setTimeout(() => initDiscordRpc(), 1e4);

export async function destroyDiscordRpc() {
  rpc?.destroy();
}
