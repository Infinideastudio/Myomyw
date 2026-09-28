import { config } from "./config.ts";
import { createGameServer } from "./server.ts";

createGameServer(config.staticDir).listen(config.port, config.host, () => {
  console.log(`Myomyw server listening on http://${config.host}:${config.port}`);
});
