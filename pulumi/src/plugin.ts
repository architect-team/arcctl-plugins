import { spawn } from 'child_process';
import { ApplyInputs, BasePlugin, BuildInputs, EventEmitter } from "arcctl-plugin-core";
import path from 'path';

export class PulumiPlugin extends BasePlugin {
  private convertToPath(key: string): string {
    const parts = key.split(':');
    let result = '';
    for (const part of parts) {
      if (result === '') {
        result = part;
      } else if (isNaN(Number(part))) {
        result += `.${part}`;
      } else {
        result += `[${part}]`;
      }
    }
    return result;
  }

  // run pulumi image and apply provided pulumi
  apply(emitter: EventEmitter, inputs: ApplyInputs): void {
    // set variables as secrets for the pulumi stack
    let pulumi_config = '';
    if (!inputs.datacenterid) {
      inputs.datacenterid = 'default';
    }

    const mount_directories: string[] = [];
    if ((inputs.inputs || []).length) {
      const literal_inputs: [string, string][] = [];
      for (const [key, value] of inputs.inputs) {
        if (value.startsWith('file:')) {
          const value_without_delimiter = value.replace('file:', '');
          const file_directory = path.parse(value_without_delimiter);
          mount_directories.push('-v');
          mount_directories.push(`${file_directory.dir}:${file_directory.dir}`);

          literal_inputs.push([key, value.replace('file:', '')])
        } else {
          literal_inputs.push([key, value]);
        }
      }

      const config_pairs = literal_inputs.map(([key, value]) => {
        const escaped_value = value.replace(/\"/g, "\\\"");
        if (key.includes(':')) {
          const parts = key.split(':');
          let path = '';
          // if the path contains a number then we cannot pass it in using the : configuration syntax
          if (parts.filter(part => !isNaN(Number(part))).length === 0) {
            path = ` --plaintext "${key}"="${escaped_value}"`;
          }
          return `--path --plaintext "${this.convertToPath(key)}"="${escaped_value}"${path}`;
        }
        return `--plaintext ${key}="${escaped_value}"`;
      }).join(' ');
      pulumi_config = `pulumi config --stack ${inputs.datacenterid} set-all ${config_pairs} &&`;
    }
    console.log(`Pulumi config: ${pulumi_config}`);
    const apply_or_destroy = inputs.destroy ? 'destroy' : 'up';
    const environment = ['-e', 'PULUMI_CONFIG_PASSPHRASE=']; // ignore this pulumi requirement

    // set pulumi state to the state passed in, if it was supplied
    const state_file = 'pulumi-state.json';
    const state_write_cmd = inputs.state ? `echo '${JSON.stringify(inputs.state)}' > ${state_file}` : '';
    const state_import_cmd = inputs.state ? `pulumi stack import --stack ${inputs.datacenterid} --file ${state_file} &&` : '';
    const output_delimiter = '****OUTPUT_DELIMITER****';

    const cmd_args = [
      'run',
      '--rm',
      '--entrypoint',
      'bash',
      ...environment,
      ...mount_directories,
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
            emitter.error(`${output}\nExited with exit code: ${code}`);
            reject();
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
    }).catch();
  }
}
