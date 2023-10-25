import { describe, it } from "mocha";
import { OpenTofuPlugin } from "../../src/plugin";
import WebSocket from "ws";
import sinon, { SinonStub, spy } from "sinon";
import child_process, { ChildProcess } from 'child_process';
import { expect } from "chai";
import { EventEmitter } from "arcctl-plugin-core";

describe('build commands', () => {
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

  it('runs a docker build command', async () => {
    const directory = '/home/test-user/opentofu-module/';
    const event_emitter = new EventEmitter(mock_websocket_connection as unknown as WebSocket);

    await opentofu_plugin.build(event_emitter, { directory });

    const docker_command_args = spawn_stub.firstCall.args;
    const docker_build_args = docker_command_args[1];

    expect(docker_command_args[0]).to.equal('docker');
    expect(docker_build_args[0]).to.equal('build');
    expect(docker_build_args[1]).to.equal(directory);
    expect(docker_command_args[2]).to.deep.equal({ cwd: directory });
  });
});
