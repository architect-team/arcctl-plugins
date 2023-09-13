export interface BuildInputs {
  directory: string;
};

export interface ApplyInputs {
  datacenterid: string;
  state?: object;
  inputs: [string, string][];
  image: string; // digest
  destroy?: boolean;
};

export type ImageDigest = string;

export type PulumiStateString = string;

export abstract class BaseModule {
  abstract build(inputs: BuildInputs): Promise<{ digest?: ImageDigest, error?: string }>;

  abstract apply(inputs: ApplyInputs): Promise<{ state?: PulumiStateString, error?: string }>;
}
