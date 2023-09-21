import { spawnSync } from 'child_process';
import { ApplyInputs, BaseModule, BuildInputs, ImageDigest, PulumiStateString } from "./base.module";
import path from 'path';

export class PulumiModule extends BaseModule {
  // build an image that pulumi code can be run on
  async build(inputs: BuildInputs): Promise<{ digest?: ImageDigest, error?: string }> {
    const args = ['build', inputs.directory, '--quiet'];
    console.log(`Building image with args: ${args.join('\n')}`);
    const docker_result = spawnSync('docker', args, { cwd: inputs.directory });

    let error;
    if (docker_result.error) {
      error = docker_result.error.message;
    } else if (docker_result.stderr?.length) {
      error = docker_result.stderr.toString();
    } else if (docker_result.status === 255) {
      error = `Error running Pulumi Docker container with the following args: ${args}`;
    }

    return { digest: docker_result.stdout?.toString().replace('sha256:', '').trim(), error };
  }

  // run pulumi image and apply provided pulumi
  async apply(inputs: ApplyInputs): Promise<{ state?: PulumiStateString, outputs: Record<string, string>, error?: string }> {
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

      const config_pairs = literal_inputs.map(([key, value]) => `--plaintext ${key}="${value}"`).join(' ');
      pulumi_config = `pulumi config --stack ${inputs.datacenterid} set-all ${config_pairs} &&`;
    }
    const apply_or_destroy = inputs.destroy ? 'destroy' : 'up';
    const environment = ['-e', 'PULUMI_CONFIG_PASSPHRASE=']; // ignore this pulumi requirement

    // set pulumi state to the state passed in, if it was supplied
    const state_file = 'pulumi-state.json';
    const state_write_cmd = inputs.state ? `echo '${inputs.state}' > ${state_file}` : '';
    const state_import_cmd = inputs.state ? `pulumi stack import --stack ${inputs.datacenterid} --file ${state_file} &&` : '';
    const pulumi_delimiter = '****PULUMI_DELIMITER****';

    const args = [
      'run',
      '--rm',
      '--entrypoint',
      'bash',
      ...environment,
      ...mount_directories,
      inputs.image,
      '-c',
      `
        ${state_write_cmd}
        pulumi login --local &&
        pulumi stack init --stack ${inputs.datacenterid} &&
        ${state_import_cmd}
        pulumi refresh --stack ${inputs.datacenterid} --non-interactive --yes &&
        ${pulumi_config}
        pulumi ${apply_or_destroy} --stack ${inputs.datacenterid} --non-interactive --yes &&
        echo "${pulumi_delimiter}" &&
        pulumi stack export --stack ${inputs.datacenterid} &&
        echo "${pulumi_delimiter}" &&
        pulumi stack output --show-secrets -j
      `
    ];
    console.log(`Running pulumi with args: ${args.join('\n')}`);
    console.log(JSON.stringify(inputs));
    const docker_result = spawnSync('docker', args, {
      stdio: 'inherit',
    });

    let error;
    if (docker_result.error) {
      error = docker_result.error.message;
    } else if (docker_result.stdout && !docker_result.stdout.includes(pulumi_delimiter)) {
      error = docker_result.stdout.toString();
    } else if (docker_result.stderr?.length) {
      error = docker_result.stderr.toString();
    } else if (docker_result.status === 255) {
      error = `Error running Pulumi Docker container with the following args: ${args}`;
    }

    const output_parts = docker_result.stdout?.toString().split(pulumi_delimiter);
    let state;
    if (output_parts?.length === 2) {
      state = output_parts[1];
    }
    let outputs;
    if (output_parts?.length === 3) {
      outputs = JSON.parse(output_parts[2] || '{}');
    }

    return { state, outputs, error };
  }
}
