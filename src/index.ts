import express from 'express';
import WebSocket from "ws";
import { PulumiModule } from "./module/pulumi.module";

type WSRequest = {
  command: 'build';
  request: BuildRequest;
} | {
  command: 'apply';
  request: ApplyRequest;
}

type BuildRequest = {
  directory: string;
};

const buildImage = (request: BuildRequest, wsConn: WebSocket): void => {
  console.log('Building image');
  const pulumi_module = new PulumiModule();
  pulumi_module.build({
    directory: request.directory
  }, wsConn);
}

type ApplyRequest = {
  datacenterid: string;
  image: string;
  inputs: [string, string][];
  pulumistate: string;
  destroy: boolean;
}

const applyPulumi = (request: ApplyRequest, wsConn: WebSocket): void => {
  const pulumi_module = new PulumiModule();
  pulumi_module.apply({
    datacenterid: request.datacenterid,
    image: request.image,
    inputs: request.inputs,
    state: request.pulumistate ? JSON.parse(request.pulumistate) : undefined,
    destroy: request.destroy,
  }, wsConn);

}

function main() {
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
        const ws_request: WSRequest = JSON.parse(message.toString());
        // TODO: Better error handling of invalid commands
        if (ws_request.command) {
          if (ws_request.command === 'build') {
            console.log(JSON.stringify(ws_request.request, null, 2));
            buildImage(ws_request.request, conn);
          } else if (ws_request.command === 'apply') {
            console.log(JSON.stringify(ws_request.request, null, 2));
            applyPulumi(ws_request.request, conn);
          }
        }
      });
    }
  );
}

main();
