import express, { Request, Response } from 'express';
import { PulumiModule } from "./module/pulumi.module";

type BuildRequest = {
  directory: string;
};

type BuildResponse = {
  image?: string;
  error?: string;
};

const buildImage = async (request: BuildRequest): Promise<BuildResponse> => {
  console.log('Building image');
  const pulumi_module = new PulumiModule();
  const build_result = await pulumi_module.build({
    directory: request.directory
  });

  if (build_result.digest) {
    return {
      image: build_result.digest
    }
  }
  return { error: build_result.error };
}

type ApplyRequest = {
  datacenterid: string;
  image: string;
  inputs: [string, string][];
  pulumistate: string;
  destroy: boolean;
}

type ApplyResponse = {
  pulumistate?: string;
  outputs?: Record<string, string>;
  error?: string;
}

const applyPulumi = async (request: ApplyRequest): Promise<ApplyResponse> => {
  const pulumi_module = new PulumiModule();

  const apply_result = await pulumi_module.apply({
    datacenterid: request.datacenterid,
    image: request.image,
    inputs: request.inputs,
    state: request.pulumistate ? JSON.parse(request.pulumistate) : undefined,
    destroy: request.destroy,
  });

  if (apply_result.state) {
    return {
      pulumistate: JSON.stringify(apply_result.state),
      outputs: apply_result.outputs
    }
  }
  return { error: apply_result.error };
}

function main() {
  const app = express()
  app.use(express.json());
  const server_port = 50051;

  app.post('/build', async (req: Request, res: Response) => {
    console.log(JSON.stringify(req.body, null, 2));
    const response = await buildImage(req.body);
    if (response.error) {
      res.status(500);
    }
    res.send(response);
  });

  app.post('/apply', async (req: Request, res: Response) => {
    console.log(JSON.stringify(req.body, null, 2));
    const response = await applyPulumi(req.body);
    if (response.error) {
      res.status(500);
    }
    console.log(JSON.stringify(response, null, 2));
    res.send(response);
  });

  app.listen(server_port, () => {
    console.log(`Started server on port ${server_port}`);
  });
}

main();
