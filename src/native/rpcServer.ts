import { type Server, type Socket, createServer } from "node:net";
import { join } from "node:path";

import { app } from "electron";

import { mainWindow, showMainWindow } from "./window";

const IPC_VERSION = 1;
const MAX_PACKET_SIZE = 1024 * 1024;
const IPC_OPCODES = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
} as const;

type RpcRequest = {
  cmd?: unknown;
  nonce?: string | number | null;
  v?: unknown;
};

type ClientState = {
  buffer: Buffer;
  handshaken: boolean;
};

let ipcServer: Server | undefined;
const clients = new Set<Socket>();

function getIpcPath(index: number) {
  if (process.platform === "win32") {
    return `\\\\?\\pipe\\discord-ipc-${index}`;
  }

  const tempDir =
    process.env.XDG_RUNTIME_DIR ??
    process.env.TMPDIR ??
    process.env.TMP ??
    process.env.TEMP ??
    "/tmp";

  return join(tempDir, `discord-ipc-${index}`);
}

function writePacket(socket: Socket, opcode: number, payload: unknown) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  socket.write(Buffer.concat([encodeHeader(opcode, body.length), body]));
}

function respond(socket: Socket, request: RpcRequest, data: unknown) {
  writePacket(socket, IPC_OPCODES.FRAME, {
    cmd: request.cmd,
    data,
    evt: null,
    nonce: request.nonce ?? null,
  });
}

function respondWithError(socket: Socket, request: RpcRequest, error: string) {
  writePacket(socket, IPC_OPCODES.FRAME, {
    cmd: request.cmd,
    data: null,
    evt: "ERROR",
    nonce: request.nonce ?? null,
    error,
  });
}

function getStatus() {
  const windowExists = !mainWindow.isDestroyed();

  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    window: {
      visible: windowExists && mainWindow.isVisible(),
      focused: windowExists && mainWindow.isFocused(),
      minimized: windowExists && mainWindow.isMinimized(),
    },
  };
}

function handleFrame(
  socket: Socket,
  state: ClientState,
  opcode: number,
  body: Buffer,
) {
  if (opcode === IPC_OPCODES.PING) {
    socket.write(
      Buffer.concat([encodeHeader(IPC_OPCODES.PONG, body.length), body]),
    );
    return;
  }

  if (opcode === IPC_OPCODES.CLOSE) {
    socket.end();
    return;
  }

  if (opcode !== IPC_OPCODES.HANDSHAKE && opcode !== IPC_OPCODES.FRAME) {
    socket.destroy();
    return;
  }

  let request: RpcRequest;
  try {
    request = JSON.parse(body.toString("utf8")) as RpcRequest;
  } catch {
    socket.destroy();
    return;
  }

  if (opcode === IPC_OPCODES.HANDSHAKE) {
    if (state.handshaken || !request || typeof request !== "object") {
      socket.destroy();
      return;
    }

    if (request.v !== IPC_VERSION) {
      socket.destroy();
      return;
    }

    state.handshaken = true;
    writePacket(socket, IPC_OPCODES.FRAME, {
      cmd: "DISPATCH",
      evt: "READY",
      data: {
        v: IPC_VERSION,
        application: {
          name: app.getName(),
          version: app.getVersion(),
        },
      },
    });
    return;
  }

  if (!state.handshaken || !request || typeof request.cmd !== "string") {
    socket.destroy();
    return;
  }

  switch (request.cmd) {
    case "GET_STATUS":
      respond(socket, request, getStatus());
      break;
    case "SHOW_WINDOW":
      showMainWindow();
      respond(socket, request, { shown: true });
      break;
    default:
      respondWithError(socket, request, `Unsupported command: ${request.cmd}`);
  }
}

function encodeHeader(opcode: number, length: number) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode, 0);
  header.writeUInt32LE(length, 4);
  return header;
}

function handleConnection(socket: Socket) {
  clients.add(socket);
  const state: ClientState = { buffer: Buffer.alloc(0), handshaken: false };

  socket.on("data", (chunk) => {
    state.buffer = Buffer.concat([state.buffer, chunk]);

    while (state.buffer.length >= 8) {
      const opcode = state.buffer.readUInt32LE(0);
      const length = state.buffer.readUInt32LE(4);

      if (length > MAX_PACKET_SIZE) {
        socket.destroy();
        return;
      }

      if (state.buffer.length < length + 8) return;

      const body = state.buffer.subarray(8, length + 8);
      state.buffer = state.buffer.subarray(length + 8);
      handleFrame(socket, state, opcode, body);

      if (socket.destroyed || socket.writableEnded) return;
    }
  });

  socket.on("error", (error) => {
    if (error.code !== "ECONNRESET" && error.code !== "EPIPE") {
      console.error("RPC client connection failed:", error);
    }
  });
  socket.on("close", () => clients.delete(socket));
}

function listenOnAvailablePath(index: number) {
  if (index >= 10) {
    console.error(
      "Unable to start RPC server: all Discord IPC endpoints are in use.",
    );
    return;
  }

  const server = createServer(handleConnection);
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      listenOnAvailablePath(index + 1);
    } else {
      console.error("Unable to start RPC server:", error);
    }
  });
  server.listen(getIpcPath(index), () => {
    ipcServer = server;
    console.info(`RPC server listening on ${getIpcPath(index)}`);
  });
}

export function initRpcServer() {
  listenOnAvailablePath(0);
}

export function destroyRpcServer() {
  for (const client of clients) {
    client.destroy();
  }
  clients.clear();
  ipcServer?.close();
  ipcServer = undefined;
}
