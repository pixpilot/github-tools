import type { RunCommand } from './types';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { CliError } from './cli-error';

const COMMAND_TIMEOUT_MS = 120000;

// Runs tools without a shell; credentials travel through stdin or environment variables.
export const runCommand: RunCommand = async (command, args, options = {}) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env ?? process.env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(
        new CliError(
          `${command} timed out. Check authentication and connectivity, then retry.`,
        ),
      );
    }, COMMAND_TIMEOUT_MS);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', () => {
      clearTimeout(timeout);
      reject(
        new CliError(
          `Cannot run ${command}. Ensure it is installed and available on PATH.`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output.trim());
      else
        reject(
          new CliError(
            `${command} failed. Check authentication, account permissions, and organization policies, then retry.`,
          ),
        );
    });
    child.stdin.end(options.input);
  });
