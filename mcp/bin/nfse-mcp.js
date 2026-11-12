#!/usr/bin/env node
import { runNfseMcpStdio } from '@useinvio/nfse-sdk/mcp';

runNfseMcpStdio().catch((error) => {
  process.stderr.write(`[nfse-mcp] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
