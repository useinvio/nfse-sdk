#!/usr/bin/env node
import { runNfseMcpStdio } from './mcpServer.js';

runNfseMcpStdio().catch((error) => {
  process.stderr.write(`[nfse-mcp] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
