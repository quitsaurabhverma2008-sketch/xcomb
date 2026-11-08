#!/usr/bin/env node
'use strict';

const {COMMANDS, UsageError} = require('../lib/commands');
const {parseArgs} = require('../lib/args');

const HELP = `xcomb — use Android phones running XComb like small Linux machines, over USB.

Usage:
  xcomb devices                       List connected phones and their state
  xcomb pair [phone] [--name NAME]    Trust this computer (asks for the XComb password)
  xcomb ssh [phone] [-- command...]   Open a shell, or run one command
  xcomb exec <phone|--all> -- cmd     Run a command on one or every paired phone
  xcomb cp [-r] SRC... DST            Copy files (like scp: follows symlinks); phone side as phone:path
  xcomb sync SRC DST [--delete]       rsync a folder, keeping symlinks; phone side as phone:path
  xcomb forward [phone] PORT [LOCAL]  Reach a server on the phone at localhost:LOCAL
  xcomb config [--install]            Write ssh config so \`ssh phone\` and VS Code work
  xcomb status [phone] [--log]        Battery, temperature, and server state
  xcomb stop [phone]                  Turn remote access off on the phone
  xcomb unpair [phone]                Remove this computer's key from the phone
  xcomb tune [phone]                  Lift Android's background process limit (Android 12+)

The phone is picked automatically when only one is connected. Phones are
named when paired; the adb serial works everywhere a name does.
Needs adb and OpenSSH (ssh, scp; rsync for sync). State lives in ~/.xcomb.`;

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  if (command === '--version' || command === 'version') {
    process.stdout.write(`${require('../package.json').version}\n`);
    return 0;
  }
  const handler = COMMANDS[command];
  if (!handler) throw new UsageError(`Unknown command: ${command}. Run \`xcomb help\`.`);
  return handler(parseArgs(rest));
}

main(process.argv.slice(2)).then(
  code => { process.exitCode = code; },
  error => {
    process.stderr.write(`xcomb: ${error.message}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  },
);
