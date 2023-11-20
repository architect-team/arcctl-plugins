import { spawn } from "child_process";
import express from "express";
import { existsSync } from "fs";
import path from "path";
import WebSocket from "ws";

type BuildRequest = {
  directory: string;
  platform?: string;
};

export interface BuildInputs {
  directory: string;
  platform?: string;
};

export interface ApplyInputs {
  datacenterid: string;
  state?: string;
  inputs: Record<string, any>;
  environment?: Record<string, string>;
  volumes?: {
    host_path: string;
    mount_path: string;
  }[];
  image: string;
  destroy?: boolean;
};

type ApplyRequest = {
  datacenterid: string;
  image: string;
  inputs: Record<string, any>;
  environment?: Record<string, string>;
  volumes?: {
    host_path: string;
    mount_path: string;
  }[];
  state: string;
  destroy: boolean;
}

type WSRequest = {
  command: 'build';
  request: BuildRequest;
} | {
  command: 'apply';
  request: ApplyRequest;
};

/**
 * Name of a default dockerfile to use when building a module. If this file is not present,
 * a Dockerfile must already exist within the inputs.cwd, otherwise the build will fail.
 */
const DEFAULT_DOCKERFILE = 'ModuleDefault.dockerfile';

/**
 * Handles emitting events (like logs and results) via the websocket connection
 */
export class EventEmitter {
  conn: WebSocket;

  constructor (conn: WebSocket) {
    this.conn = conn;
  }

  /**
   * Sends verbose output to the client which is displayed when
   * running commands using the verbose flag.
   */
  log(message: string) {
    this.conn.send(JSON.stringify({
      verboseOutput: message
    }));
  }

  /**
   * Sends an error to the client. This will cause the connection to
   * be closed and further commands won't be received.
   */
  error(message: string) {
    this.conn.send(JSON.stringify({
      error: message
    }));
  }

  /**
   * Sends the build output to the client.
   * @param image_digest Image digest of the built image used to run the Apply step
   */
  buildOutput(image_digest: string) {
    this.conn.send(JSON.stringify({
      result: {
        image: image_digest,
      },
    }));
  }

  /**
   * Sends the apply output to the client.
   * @param state Resulting state to store
   * @param outputs Datacenter outputs from the execution of this module
   */
  applyOutput(state: string, outputs: Record<string, any>) {
    this.conn.send(JSON.stringify({
      result: {
        state,
        outputs,
      }
    }));
  }
}

export abstract class BasePlugin {
  /**
   * This method must be overridden, the apply process is different for every
   * plugin type. This method is expected to call `emitter.applyOutput()` with
   * the state and outputs of the apply.
   */
  abstract apply(emitter: EventEmitter, inputs: ApplyInputs): void;

  /**
   * This method may be overridden, but for most use cases is as simple as
   * running `docker build` on the given directory and returning the results
   * via `emitter.buildOutput()`.
   */
  build(emitter: EventEmitter, inputs: BuildInputs): void {
    const args = ['build', '--quiet'];
    if (inputs.platform) {
      args.push(...['--platform', inputs.platform])
    }
    if (!existsSync(path.join(inputs.directory, 'Dockerfile'))) {
      if (existsSync(DEFAULT_DOCKERFILE)) {
        args.push('-f', path.resolve(DEFAULT_DOCKERFILE));
      } else {
        emitter.error('No Dockerfile found in this module, and no default Dockerfile exists for this plugin.');
        return;
      }
    }
    args.push(inputs.directory);

    const docker_result = spawn('docker', args);
    let image_digest = '';
    const processChunk = (chunk: Buffer) => {
      const chunk_str = chunk.toString();
      emitter.log(chunk_str);

      if (chunk_str) {
        const matches = chunk_str.match(/(sha256:[a-f0-9]{64})/);
        if (matches && matches[1]) {
          image_digest = matches[1];
        }
      }
    }

    const processError = () => {
      emitter.error('Unknown Error');
      return;
    }

    docker_result.stdout.on('data', processChunk);
    docker_result.stderr.on('data', processChunk);

    docker_result.stdout.on('error', processError);
    docker_result.stderr.on('error', processError);

    docker_result.on('error', (error) => {
      emitter.error(error.message);
    });

    docker_result.on('close', (code) => {
      if (!image_digest) {
        emitter.error(`Failed to collect image digest. Args: ${JSON.stringify(args)}`);
      } else if (code === 0) {
        emitter.buildOutput(image_digest);
      } else {
        emitter.error(`Exited with exit code: ${code}`);
      }
    });
  }

  /**
   * Run this module. This method creates an express application
   * and configures the WebSocket server with path `/ws` to handle
   * 'build' and 'apply' commands.
   *
   * The express server is started on `process.env.PORT`, defaulting
   * to port 50051.
   */
  run() {
    const app = express()
    const server_port = process.env.PORT || 50051;

    const websocketServer = new WebSocket.Server({
      noServer: true,
      path: '/ws',
    });

    const server = app.listen(server_port, () => {
      console.log(`Started server on port ${server_port}`);
    });

    server.on('upgrade', (request, socket, head) => {
      websocketServer.handleUpgrade(request, socket, head, (websocket) => {
        websocketServer.emit('connection', websocket, request);
      });
    });

    websocketServer.on('connection', (conn, _req) => {
      conn.on('message', (message) => {
        const ws_message: WSRequest = JSON.parse(message.toString());

        // Construct an emitter so that Module impls don't need to
        // interact directly with the WebSocket connection.
        const emitter = new EventEmitter(conn);

        if (ws_message.command) {
          if (ws_message.command === 'build') {
            this.build(emitter, ws_message.request);
          } else if (ws_message.command === 'apply') {
            const request = ws_message.request;
            this.apply(emitter, {
              datacenterid: request.datacenterid,
              image: request.image,
              inputs: request.inputs,
              environment: request.environment,
              volumes: request.volumes,
              state: request.state,
              destroy: request.destroy,
            });
          } else {
            emitter.error(`Invalid command: ${(ws_message as any).command}`)
          }
        } else {
          emitter.error(`Invalid message: ${message}`);
        }
      });
    });
  }
}
