import process from 'node:process';

// Writes user-facing CLI output to stdout.
export function print(message: string): void {
  process.stdout.write(`${message}\n`);
}
