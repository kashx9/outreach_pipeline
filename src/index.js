#!/usr/bin/env node
import { runPipeline } from './pipeline.js';
import { assertKeys } from './config.js';

const USAGE = `
Automated outreach pipeline \u2014 one domain in, personalized emails out.

Usage:
  node src/index.js <company.domain> [options]

Options:
  --mock      Run end-to-end with fixture data (no API keys needed)
  --dry-run   Run all stages but stop at the checkpoint (no emails sent)
  --yes, -y   Skip the confirmation prompt (use with care)
  --help, -h  Show this help

Examples:
  node src/index.js stripe.com --mock --dry-run   # safe local smoke test
  node src/index.js stripe.com --dry-run          # real data, no sends
  node src/index.js stripe.com                     # full run (asks to confirm)
`;

function parseArgs(argv) {
  const args = { _: [], mock: false, dryRun: false, autoYes: false, help: false };
  for (const a of argv) {
    if (a === '--mock') args.mock = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--yes' || a === '-y') args.autoYes = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!a.startsWith('-')) args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args._[0]) {
    console.log(USAGE);
    process.exit(args.help ? 0 : 1);
  }

  // Normalize "https://stripe.com/pricing" -> "stripe.com"
  const seedDomain = args._[0].replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  try {
    assertKeys({ mock: args.mock });
    console.log(`\nSeed domain: ${seedDomain}${args.mock ? '  (mock mode)' : ''}`);
    await runPipeline(seedDomain, args);
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
}

main();
