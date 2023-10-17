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
    const inputs: [string, string][] = [['input1', '1']];
    const image = 'image-digest';
    const event_emitter = new EventEmitter(mock_websocket_connection as unknown as WebSocket);
    await pulumi_plugin.apply(event_emitter, { datacenterid, inputs, image });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_run_args = docker_command_args[1];
    const pulumi_command = docker_run_args[8].split('\n').map((c: string) => c.trim());

    expect(docker_command_args[0]).to.equal('docker');
    expect(docker_run_args[0]).to.equal('run');
    expect(docker_run_args[1]).to.equal('--rm');
    expect(docker_run_args[2]).to.equal('--entrypoint');
    expect(docker_run_args[3]).to.equal('bash');
    expect(docker_run_args[4]).to.equal('-e');
    expect(docker_run_args[5]).to.equal('PULUMI_CONFIG_PASSPHRASE=');
    expect(docker_run_args[6]).to.equal(image);
    expect(docker_run_args[7]).to.equal('-c');
    expect(pulumi_command[0]).to.be.empty;
    expect(pulumi_command[1]).to.equal('pulumi login --local &&');
    expect(pulumi_command[2]).to.equal(`pulumi stack init --stack ${datacenterid} &&`);
    expect(pulumi_command[3]).to.be.empty;
    expect(pulumi_command[4]).to.equal(`pulumi refresh --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[5]).to.equal(`pulumi config --stack ${datacenterid} set-all --plaintext ${inputs[0][0]}="${inputs[0][1]}" &&`);
    expect(pulumi_command[6]).to.equal(`pulumi up --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[7]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[8]).to.equal(`pulumi stack export --stack ${datacenterid} &&`);
    expect(pulumi_command[9]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[10]).to.equal('pulumi stack output --show-secrets -j');
    expect(docker_command_args[2]).to.deep.equal({ stdio: ['inherit'] });
  });

  it('runs an apply command to delete a module', async () => {
    const datacenterid = 'datacenter-id';
    const inputs: [string, string][] = [['input1', '1']];
    const image = 'image-digest';
    const destroy = true;
    const state = '{}';
    const event_emitter = new EventEmitter(mock_websocket_connection as unknown as WebSocket);
    await pulumi_plugin.apply(event_emitter, { datacenterid, inputs, image, destroy, state });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_run_args = docker_command_args[1];
    const pulumi_command = docker_run_args[8].split('\n').map((c: string) => c.trim());

    expect(docker_command_args[0]).to.equal('docker');
    expect(docker_run_args[0]).to.equal('run');
    expect(docker_run_args[1]).to.equal('--rm');
    expect(docker_run_args[2]).to.equal('--entrypoint');
    expect(docker_run_args[3]).to.equal('bash');
    expect(docker_run_args[4]).to.equal('-e');
    expect(docker_run_args[5]).to.equal('PULUMI_CONFIG_PASSPHRASE=');
    expect(docker_run_args[6]).to.equal(image);
    expect(docker_run_args[7]).to.equal('-c');
    expect(pulumi_command[0]).to.equal(`echo '${state}' > pulumi-state.json`);
    expect(pulumi_command[1]).to.equal('pulumi login --local &&');
    expect(pulumi_command[2]).to.equal(`pulumi stack init --stack ${datacenterid} &&`);
    expect(pulumi_command[3]).to.equal(`pulumi stack import --stack ${datacenterid} --file pulumi-state.json &&`);
    expect(pulumi_command[4]).to.equal(`pulumi refresh --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[5]).to.equal(`pulumi config --stack ${datacenterid} set-all --plaintext ${inputs[0][0]}="${inputs[0][1]}" &&`);
    expect(pulumi_command[6]).to.equal(`pulumi destroy --stack ${datacenterid} --non-interactive --yes &&`);
    expect(pulumi_command[7]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[8]).to.equal(`pulumi stack export --stack ${datacenterid} &&`);
    expect(pulumi_command[9]).to.equal('echo "****OUTPUT_DELIMITER****" &&');
    expect(pulumi_command[10]).to.equal('pulumi stack output --show-secrets -j');
    expect(docker_command_args[2]).to.deep.equal({ stdio: ['inherit'] });
  });
});
