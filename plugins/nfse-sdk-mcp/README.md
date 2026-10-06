# NFS-e SDK local MCP plugin

This local plugin wraps `@useinvio/nfse-sdk` for Codex desktop and other hosts that support stdio MCP plugins. It does not run in web/mobile clients because it intentionally uses a local Node process and local `xmllint`.

## Tools

| Tool | Certificate | Effect |
| --- | --- | --- |
| `validate_dps_json` | No | Returns structured validation errors and warnings. |
| `build_dps_xml` | No | Returns unsigned DPS XML. |
| `validate_dps_xml` | No | Validates DPS XML against XSD 1.01. |
| `prepare_nfse` | A1/PFX in base64 | Validates and signs locally; does not transmit. |
| `emit_nfse` | A1/PFX in base64 | Signs and sends to the selected SEFIN environment. |

The server accepts PFX content and password only as one tool call's arguments. It does not write, log, cache, or retain them. The host must provide Node 20+ and `xmllint`.

## Local setup

From this directory, install dependencies and launch the server:

```bash
npm install
npm start
```

Verify the local MCP protocol without issuing a note:

```bash
npm run test:protocol
```

Use `mcp.json` as the plugin MCP manifest. The compatibility manifest at `.codex-plugin/plugin.json` supports local Codex discovery. The `file:../..` dependency deliberately binds the plugin to this checked-out SDK, including the unreleased `3.0.0` behavior. For a distributable plugin, replace it with a published SDK version after publishing the package.

## Safety

`emit_nfse` creates an external fiscal submission. It must only be called after the user explicitly confirms the target environment and operation. The server never retries a send; a transport failure or incomplete authorization must be reconciled before retrying.
