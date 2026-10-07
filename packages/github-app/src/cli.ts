#!/usr/bin/env node
import process from 'node:process';
import { runCli } from './run-cli';

const CLI_ARGUMENT_OFFSET = 2;
void runCli(process.argv.slice(CLI_ARGUMENT_OFFSET)).then((code) => {
  process.exitCode = code;
});
