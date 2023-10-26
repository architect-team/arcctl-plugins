import { describe, it } from "mocha";
import WebSocket from "ws";
import sinon, { SinonStub, spy } from "sinon";
import child_process, { ChildProcess } from 'child_process';
import { expect } from "chai";
import { OpenTofuPlugin } from "../../src/plugin";
import { EventEmitter } from "arcctl-plugin-core";

describe('apply commands', () => {
  let spawn_stub: SinonStub;
  const mock_spawn_process = {
    stdout: { on: spy() },
    stderr: { on: spy() },
    on: spy()
  };
  const mock_websocket_connection = { send: spy() };
  const opentofu_plugin = new OpenTofuPlugin();

  beforeEach(() => {
    spawn_stub = sinon.stub(child_process, 'spawn').callsFake(() => mock_spawn_process as unknown as ChildProcess);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('runs an apply command to create a module', async () => {
    const datacenterid = 'datacenter-id';
    const inputs = {'input1': '1'};
    const image = 'image-digest';
    const event_emitter = new EventEmitter(mock_websocket_connection as unknown as WebSocket);
    opentofu_plugin.apply(event_emitter, { datacenterid, inputs, image });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_run_args = docker_command_args[1];
    const opentofu_command = docker_run_args[6].split('\n').map((c: string) => c.trim());

    expect(docker_command_args[0]).to.equal('docker');
    expect(docker_run_args[0]).to.equal('run');
    expect(docker_run_args[1]).to.equal('--rm');
    expect(docker_run_args[2]).to.equal('--entrypoint');
    expect(docker_run_args[3]).to.equal('sh');
    expect(docker_run_args[4]).to.equal(image);
    expect(docker_run_args[5]).to.equal('-c');
    expect(opentofu_command[0]).to.be.empty;
    expect(opentofu_command[1]).to.equal('echo "no state, continuing..." &&');
    expect(opentofu_command[2]).to.equal(`tofu init &&`);
    expect(opentofu_command[3]).to.equal(`tofu plan -input=false -out=tfplan -detailed-exitcode  -var='input1=1'; if [ $? -eq 1 ]; then false; else true; fi &&`);
    expect(opentofu_command[4]).to.equal(`tofu apply  tfplan &&`);
    expect(opentofu_command[5]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(opentofu_command[6]).to.equal(`cat terraform.tfstate &&`);
    expect(opentofu_command[7]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(opentofu_command[8]).to.equal('tofu output -json');
    expect(docker_command_args[2]).to.deep.equal({ stdio: ['inherit'] });
  });

  it('runs an apply command to delete a module', async () => {
    const datacenterid = 'datacenter-id';
    const inputs = {
      'input1': '1',
      'input2': {
        'nestedKey': 'value'
      }
    };
    const image = 'image-digest';
    const destroy = true;
    const state = '{}';
    const event_emitter = new EventEmitter(mock_websocket_connection as unknown as WebSocket);

    opentofu_plugin.apply(event_emitter, { datacenterid, inputs, image, destroy, state });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_run_args = docker_command_args[1];
    const opentofu_command = docker_run_args[6].split('\n').map((c: string) => c.trim());

    expect(docker_command_args[0]).to.equal('docker');
    expect(docker_run_args[0]).to.equal('run');
    expect(docker_run_args[1]).to.equal('--rm');
    expect(docker_run_args[2]).to.equal('--entrypoint');
    expect(docker_run_args[3]).to.equal('sh');
    expect(docker_run_args[4]).to.equal(image);
    expect(docker_run_args[5]).to.equal('-c');
    expect(opentofu_command[0]).to.be.empty;
    expect(opentofu_command[1]).to.equal(`echo '${state}' > terraform.tfstate &&`);
    expect(opentofu_command[2]).to.equal('tofu init &&');
    expect(opentofu_command[3]).to.equal(`tofu plan -input=false -out=tfplan -detailed-exitcode -destroy -var='input1=1' -var='input2={"nestedKey":"value"}'; if [ $? -eq 1 ]; then false; else true; fi &&`);
    expect(opentofu_command[4]).to.equal(`tofu apply -destroy tfplan &&`);
    expect(opentofu_command[5]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(opentofu_command[6]).to.equal(`cat terraform.tfstate &&`);
    expect(opentofu_command[7]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(opentofu_command[8]).to.equal('tofu output -json');
    expect(docker_command_args[2]).to.deep.equal({ stdio: ['inherit'] });
  });
});
