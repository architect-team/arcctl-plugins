import { Server, ServerCredentials, ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js';
import { PulumiModule } from "./module/pulumi.module";
import { ArcctlPulumiService } from './proto/arcctlpulumi_grpc_pb';
import { ApplyRequest, ApplyResponse, BuildRequest, BuildResponse } from './proto/arcctlpulumi_pb';

const buildImage = async (
  call: ServerUnaryCall<BuildRequest, BuildResponse>,
  callback: sendUnaryData<BuildResponse>) =>
{
  console.log('Building image');
  const pulumi_module = new PulumiModule();
  const build_result = await pulumi_module.build({
    directory: call.request.toObject().directory
  });

  if (build_result.digest) {
    const build_response = new BuildResponse();
    build_response.setImage(build_result.digest);
    callback(null, build_response);
    console.log(`Image built: ${build_result.digest}`);
  } else if (build_result.error) {
    callback({ details: build_result.error, code: 2 });
    console.log(`Error building image: ${build_result.error}`);
  }
}

const applyPulumi = async (
  call: ServerUnaryCall<ApplyRequest, ApplyResponse>,
  callback: sendUnaryData<ApplyResponse>) =>
{
  const apply_request = call.request.toObject();
  const pulumi_module = new PulumiModule();

  const apply_result = await pulumi_module.apply({
    datacenterid: apply_request.datacenterid,
    image: apply_request.image,
    inputs: apply_request.inputsMap,
    state: apply_request.pulumistate ? JSON.parse(apply_request.pulumistate) : undefined,
    destroy: apply_request.destroy,
  });

  if (apply_result.state) {
    const apply_response = new ApplyResponse();
    apply_response.setPulumistate(apply_result.state);
    for (const [key, value] of Object.entries(apply_result.outputs)) {
      apply_response.getOutputsMap().set(key, value);
    }
    callback(null, apply_response);
  } else if (apply_result.error) {
    callback({ details: apply_result.error, code: 2 });
  }
}

function main() {
  const server_port = 50051;
  const server = new Server();
  server.addService(ArcctlPulumiService, { build: buildImage, apply: applyPulumi });
  server.bindAsync(`0.0.0.0:${server_port}`, ServerCredentials.createInsecure(), () => {
    console.log(`Started server on port ${server_port}`);
    server.start();
  });
}

main();
