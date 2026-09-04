import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { rootDir } from "./lib/render-app.mjs";

const host = "127.0.0.1";
const requestedPort = Number.parseInt(process.env.PE_NOTE_PORT ?? "4173", 10);
const port = Number.isInteger(requestedPort) ? requestedPort : 4173;
const indexPath = path.join(rootDir, process.argv[2] ?? "index.html");

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${host}`).pathname;
  if (pathname !== "/" && pathname !== "/index.html") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
  });
  createReadStream(indexPath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`PE Note is available at http://${host}:${port}`);
});
