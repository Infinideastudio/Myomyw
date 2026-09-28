import { MAX_NAME_LENGTH, PROTOCOL_VERSION, type ClientMessage } from "@myomyw/protocol";
import type { Client } from "./client.ts";
import { config } from "./config.ts";
import { Room } from "./room.ts";

/**
 * Greets new connections and pairs them up, first come first served.
 * The first player of a pair plays Left (and so moves first).
 */
export class Lobby {
  private waiting: Client | null = null;
  private readonly rooms = new Map<number, Room>();

  admit(client: Client): void {
    const helloTimer = setTimeout(() => client.close(), config.helloTimeoutMs);
    client.onMessage((message) => {
      clearTimeout(helloTimer);
      this.hello(client, message);
    });
    client.onClose(() => {
      clearTimeout(helloTimer);
      if (this.waiting === client) this.waiting = null;
    });
  }

  private hello(client: Client, message: ClientMessage): void {
    if (message.t !== "hello") {
      client.send({ t: "rejected", reason: "badMessage" });
      return client.close();
    }
    if (message.version !== PROTOCOL_VERSION) {
      client.send({ t: "rejected", reason: "version" });
      return client.close();
    }
    const name = typeof message.name === "string" ? message.name.trim() : "";
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      client.send({ t: "rejected", reason: "badName" });
      return client.close();
    }
    if (this.rooms.size >= config.maxRooms) {
      client.send({ t: "rejected", reason: "full" });
      return client.close();
    }
    client.name = name;
    client.onMessage(() => {}); // ignore anything until matched
    client.send({ t: "welcome", motd: config.motd });
    console.log(`${client} is looking for a game`);

    const opponent = this.waiting;
    if (opponent && opponent.open) {
      this.waiting = null;
      this.openRoom(opponent, client);
    } else {
      this.waiting = client;
    }
  }

  private openRoom(left: Client, right: Client): void {
    let id = 0;
    while (this.rooms.has(id)) id++;
    this.rooms.set(id, new Room(id, left, right, () => this.rooms.delete(id)));
    console.log(`room ${id}: ${left} vs ${right}`);
  }
}
