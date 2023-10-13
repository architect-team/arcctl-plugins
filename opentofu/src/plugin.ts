import { spawn } from 'child_process';
import { ApplyInputs, BasePlugin, EventEmitter } from "arcctl-plugin-core";
import path from 'path';

export class OpenTofuPlugin extends BasePlugin {
  apply(emitter: EventEmitter, inputs: ApplyInputs): void {

    let apply_vars = [];
    const mount_directories: string[] = [];
    if ((inputs.inputs || []).length) {
      for (const [key, value] of inputs.inputs) {
        let var_value = value;
        if (value.startsWith('file:')) {
          const value_without_delimiter = value.replace('file:', '');
          const file_directory = path.parse(value_without_delimiter);
          mount_directories.push('-v', `${file_directory.dir}:${file_directory.dir}`);

          var_value = value.replace('file:', '');
        }

        apply_vars.push(`-var="${key}=${var_value}"`);
      }
    }

    const state_file = 'terraform.tfstate';
    const state_write_cmd = inputs.state ?  `echo '${JSON.stringify(inputs.state)}' > ${state_file}` : 'echo "no state, continuing..."';
    const maybe_destroy = inputs.destroy ? '-destroy' : '';

    const output_delimiter = '****OUTPUT_DELIMITER****';

    // Note: `tofu plan -detailed-exitcode` is required for `tofu plan` to return a non-zero exit code
    // when the plan fails (e.g. a user has erroneous tf), however it makes exit code 2 mean the plan worked but there are changes.
    const cmd_args = [
      'run',
      '--rm',
      '--entrypoint',
      'sh',
      ...mount_directories,
      inputs.image,
      '-c',
      `
      ${state_write_cmd} &&
      tofu init &&
      tofu plan -input=false -out=tfplan -detailed-exitcode ${maybe_destroy} ${apply_vars.join(' ')}; if [ $? -eq 1 ]; then false; else true; fi &&
      tofu apply ${maybe_destroy} tfplan &&
      echo "${output_delimiter}" &&
      cat ${state_file} &&
      echo "${output_delimiter}" &&
      tofu output -json`
    ];


    console.log(`Inputs: ${JSON.stringify(inputs)}`);

    let output = '';
    const processChunk = (chunk: Buffer) => {
      const chunk_str = chunk.toString();
      output += chunk_str;
      emitter.log(chunk_str.replace(output_delimiter, ''));
    };

    const tofuPromise = () => {
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

    tofuPromise().then(() => {
      // At this point, output contains all the docker command output we've sent
      // back for verbose logging purposes
      const output_parts = output.split(output_delimiter);
      let state = '';
      let outputs: Record<string, string> = {};
      if (output_parts.length >= 2) {
        state = output_parts[1];
      }
      if (output_parts.length >= 3) {
        const raw_outputs: Record<string, Record<string, string>> = JSON.parse(output_parts[2] || '{}');
        for (const [key, value] of Object.entries(raw_outputs)) {
          // TF outputs values as {"id": {"value": "..."}} and we need to flatten to {"id": "..."}
          outputs[key] = value['value'];
        }
      }
      emitter.applyOutput(state, outputs);
    }).catch();
  }
}
