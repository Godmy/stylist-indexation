#!/usr/bin/env node
import { IndexationCli } from '../src/lib/indexation/class/facade/indexation-cli/index.ts';

process.exitCode = IndexationCli.main(process.argv.slice(2), process.cwd());
