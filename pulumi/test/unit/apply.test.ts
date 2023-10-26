import { describe, it } from "mocha";
import WebSocket from "ws";
import sinon, { SinonStub, spy } from "sinon";
import child_process, { ChildProcess } from 'child_process';
import { expect } from "chai";
import { PulumiPlugin } from "../../src/plugin";
import { EventEmitter } from "arcctl-plugin-core";

describe('apply commands', () => {
  let spawn_stub: SinonStub;
  const mock_spawn_process = {
    stdout: { on: spy() },
    stderr: { on: spy() },
    on: spy()
  };
  const mock_websocket_connection = { send: spy() };
  const pulumi_plugin = new PulumiPlugin();

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
    pulumi_plugin.apply(event_emitter, { datacenterid, inputs, image });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_run_args = docker_command_args[1];

    expect(docker_command_args[0]).to.equal('docker');
    let docker_run_idx = 0;
    expect(docker_run_args[docker_run_idx++]).to.equal('run');
    expect(docker_run_args[docker_run_idx++]).to.equal('--rm');
    expect(docker_run_args[docker_run_idx++]).to.equal('--entrypoint');
    expect(docker_run_args[docker_run_idx++]).to.equal('sh');
    expect(docker_run_args[docker_run_idx++]).to.equal('-e');
    expect(docker_run_args[docker_run_idx++]).to.equal('PULUMI_CONFIG_PASSPHRASE=');
    expect(docker_run_args[docker_run_idx++]).to.equal(image);
    expect(docker_run_args[docker_run_idx++]).to.equal('-c');

    const pulumi_command = docker_run_args[docker_run_idx].split('\n').map((c: string) => c.trim());
    let command_idx = 0;
    expect(pulumi_command[command_idx++]).to.equal('pulumi login --local &&');
    expect(pulumi_command[command_idx++]).to.equal(`pulumi stack init --stack ${datacenterid} &&`);
    expect(pulumi_command[command_idx++]).to.be.empty;
    expect(pulumi_command[command_idx++]).to.equal(`pulumi refresh --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[command_idx++]).to.equal(`pulumi config --stack ${datacenterid} set-all --path --plaintext 'input1'='1' &&`);
    expect(pulumi_command[command_idx++]).to.equal(`pulumi up --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[command_idx++]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[command_idx++]).to.equal(`pulumi stack export --stack ${datacenterid} &&`);
    expect(pulumi_command[command_idx++]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[command_idx++]).to.equal('pulumi stack output --show-secrets -j');
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
    const state = 'path/to/state.txt';
    const event_emitter = new EventEmitter(mock_websocket_connection as unknown as WebSocket);

    pulumi_plugin.apply(event_emitter, { datacenterid, inputs, image, destroy, state });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_run_args = docker_command_args[1];

    expect(docker_command_args[0]).to.equal('docker');
    let docker_run_idx = 0;
    expect(docker_run_args[docker_run_idx++]).to.equal('run');
    expect(docker_run_args[docker_run_idx++]).to.equal('--rm');
    expect(docker_run_args[docker_run_idx++]).to.equal('--entrypoint');
    expect(docker_run_args[docker_run_idx++]).to.equal('sh');
    expect(docker_run_args[docker_run_idx++]).to.equal('-e');
    expect(docker_run_args[docker_run_idx++]).to.equal('PULUMI_CONFIG_PASSPHRASE=');
    expect(docker_run_args[docker_run_idx++]).to.equal('-v');
    expect(docker_run_args[docker_run_idx++]).to.equal(`${state}:/pulumi-state.json`);
    expect(docker_run_args[docker_run_idx++]).to.equal(image);
    expect(docker_run_args[docker_run_idx++]).to.equal('-c');

    const pulumi_command = docker_run_args[docker_run_idx].split('\n').map((c: string) => c.trim());
    let command_idx = 0;
    expect(pulumi_command[command_idx++]).to.equal('pulumi login --local &&');
    expect(pulumi_command[command_idx++]).to.equal(`pulumi stack init --stack ${datacenterid} &&`);
    expect(pulumi_command[command_idx++]).to.equal(`pulumi stack import --stack ${datacenterid} --file /pulumi-state.json &&`);
    expect(pulumi_command[command_idx++]).to.equal(`pulumi refresh --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[command_idx++]).to.equal(`pulumi config --stack ${datacenterid} set-all --path --plaintext 'input1'='1' --path --plaintext 'input2:nestedKey'='value' &&`);
    expect(pulumi_command[command_idx++]).to.equal(`pulumi destroy --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[command_idx++]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[command_idx++]).to.equal(`pulumi stack export --stack ${datacenterid} &&`);
    expect(pulumi_command[command_idx++]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[command_idx++]).to.equal('pulumi stack output --show-secrets -j');
    expect(docker_command_args[2]).to.deep.equal({ stdio: ['inherit'] });
  });
});
