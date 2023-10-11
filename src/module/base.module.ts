import WebSocket from "ws";

export interface BuildInputs {
  directory: string;
};

export interface ApplyInputs {
  datacenterid: string;
  state?: string;
  inputs: [string, string][];
  image: string; // digest
  destroy?: boolean;
};

export type ImageDigest = string;

export type PulumiStateString = string;

export abstract class BaseModule {
  abstract build(inputs: BuildInputs, wsConn: WebSocket): void;
  abstract apply(inputs: ApplyInputs, wsConn: WebSocket): void;
}
