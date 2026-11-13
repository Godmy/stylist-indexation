#!/usr/bin/env node
import { IndexationCli } from '../dist/class/facade/indexation-cli/index.js';

process.exitCode = IndexationCli.main(process.argv.slice(2), process.cwd());
