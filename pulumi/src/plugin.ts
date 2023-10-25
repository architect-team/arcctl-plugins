import { spawn } from 'child_process';
import { ApplyInputs, BasePlugin, EventEmitter } from "arcctl-plugin-core";
import path from 'path';

export class PulumiPlugin extends BasePlugin {
  // run pulumi image and apply provided pulumi
  apply(emitter: EventEmitter, inputs: ApplyInputs): void {
    // set variables as secrets for the pulumi stack
    let pulumi_config = '';
    if (!inputs.datacenterid) {
      inputs.datacenterid = 'default';
    }

    const apply_vars: string[] = [];
    const additional_docker_args: string[] = [];

    for (const [key, value] of inputs.inputs) {
      let var_value = value;
      if (typeof value === 'string' && value.startsWith('file:')) {
        const value_without_delimiter = value.replace('file:', '');
        const file_directory = path.parse(value_without_delimiter);
        additional_docker_args.push('-v', `${file_directory.dir}:${file_directory.dir}`);

        var_value = value.replace('file:', '');
      }

      apply_vars.push(`--path --plaintext "${key}"="${typeof var_value === 'object' ? JSON.stringify(var_value) : var_value}"`);
    };

    if (apply_vars.length > 0) {
      pulumi_config = `pulumi config --stack ${inputs.datacenterid} set-all ${apply_vars.join(' ')} &&`
    }

    console.log(`Pulumi config: ${pulumi_config}`);
    const apply_or_destroy = inputs.destroy ? 'destroy' : 'up';
    const environment = ['-e', 'PULUMI_CONFIG_PASSPHRASE=']; // ignore this pulumi requirement

    // set pulumi state to the state passed in, if it was supplied
    const state_file = 'pulumi-state.json';
    const state_write_cmd = inputs.state ? `echo '${inputs.state}' > ${state_file}` : '';
    const state_import_cmd = inputs.state ? `pulumi stack import --stack ${inputs.datacenterid} --file ${state_file} &&` : '';
    const output_delimiter = '****OUTPUT_DELIMITER****';

    inputs.volumes?.forEach(volume => {
      additional_docker_args.push('-v', `${volume.host_path}:${volume.mount_path}`);
    });

    Object.entries(inputs.environment || {}).forEach(([key, value]) => {
      additional_docker_args.push('-e', `${key}=${value}`);
    });

    const cmd_args = [
      'run',
      '--rm',
      '--entrypoint',
      'sh',
      ...environment,
      ...additional_docker_args,
      inputs.image,
      '-c',
      `${state_write_cmd}
        pulumi login --local &&
        pulumi stack init --stack ${inputs.datacenterid} &&
        ${state_import_cmd}
        pulumi refresh --stack ${inputs.datacenterid} --non-interactive --yes &&
        ${pulumi_config}
        pulumi ${apply_or_destroy} --stack ${inputs.datacenterid} --non-interactive --yes &&
        echo "${output_delimiter}" &&
        pulumi stack export --stack ${inputs.datacenterid} &&
        echo "${output_delimiter}" &&
        pulumi stack output --show-secrets -j`
    ];

    console.log(`Inputs: ${JSON.stringify(inputs)}`);

    let output = '';

    const processChunk = (chunk: Buffer) => {
      const chunk_str = chunk.toString();
      output += chunk_str;
      emitter.log(chunk_str.replace(output_delimiter, ''));
    };

    const pulumiPromise = () => {
      return new Promise((resolve, reject) => {
        console.log(`Running with args: ${cmd_args.join(' ')}`);
        const pulumi_result = spawn('docker', cmd_args, {
          stdio: ['inherit'],
        });

        pulumi_result.stdout?.on('data', processChunk);
        pulumi_result.stderr?.on('data', processChunk);
        pulumi_result.on('exit', (code) => {
          if (code !== 0) {
            const error_message = `${output}\nExited with exit code: ${code}`;
            emitter.error(error_message);
            return reject(error_message);
          }
          resolve(code);
        });
      });
    };

    pulumiPromise().then(() => {
      // At this point, output contains all the docker command output we've sent
      // back for verbose logging purposes
      const output_parts = output.split(output_delimiter);
      let state = '';
      let outputs = {};
      if (output_parts.length >= 2) {
        state = output_parts[1];
      }
      if (output_parts.length >= 3) {
        outputs = JSON.parse(output_parts[2] || '{}');
      }
      emitter.applyOutput(state, outputs);
    }).catch(error => {
      console.log(error)
    });
  }
}
