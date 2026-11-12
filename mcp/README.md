# @useinvio/nfse-mcp

MCP server for Brazil's **NFS-e Nacional**. Ask Claude, Cursor or any MCP client
to validate a DPS, issue an invoice, look it up, cancel it, or explain a SEFIN
rejection code. Built on [`@useinvio/nfse-sdk`](https://github.com/useinvio/nfse-sdk).

## Try it without a certificate

Test mode runs a mock SEFIN inside the server and uses a throwaway certificate.
Nothing is sent anywhere.

```bash
claude mcp add nfse --env NFSE_MCP_MOCK=1 --env NFSE_MCP_ALLOW_WRITE=1 -- npx -y @useinvio/nfse-mcp
```

> **Not published yet.** `@useinvio/nfse-mcp` reaches npm together with SDK 3.2.0,
> and the Claude Code plugin depends on that release. Until then, run the server
> from a clone of the repository (`npm install` builds it):

```bash
git clone https://github.com/useinvio/nfse-sdk && cd nfse-sdk && npm install
claude mcp add nfse --env NFSE_MCP_MOCK=1 --env NFSE_MCP_ALLOW_WRITE=1 -- node "$PWD/dist/mcpCli.js"
```

Then ask: *"Valide e emita uma NFS-e de teste de R$ 10 para desenvolvimento de software."*

## With your A1 certificate

```bash
claude mcp add nfse \
  --env NFSE_CERT_PATH=/caminho/certificado.pfx \
  --env NFSE_CERT_PASSWORD_FILE=/caminho/senha.txt \
  -- npx -y @useinvio/nfse-mcp
```

This starts read-only in `restrita` (the official sandbox). Add
`--env NFSE_MCP_ALLOW_WRITE=1` to allow emission and cancellation, and
`--env NFSE_AMBIENTE=producao` only when you mean to issue legally valid invoices.

### Claude Desktop, Cursor, VS Code

Claude Desktop (`claude_desktop_config.json`) and Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "nfse": {
      "command": "npx",
      "args": ["-y", "@useinvio/nfse-mcp"],
      "env": {
        "NFSE_CERT_PATH": "/caminho/certificado.pfx",
        "NFSE_CERT_PASSWORD_FILE": "/caminho/senha.txt"
      }
    }
  }
}
```

VS Code (`.vscode/mcp.json`) uses the same entry under `"servers"` with `"type": "stdio"`.

### Claude Code plugin

The plugin bundles this server with a skill that teaches Claude the workflow,
and asks for the certificate in a settings dialog (the password goes to the
system keychain):

```text
/plugin install nfse-nacional --marketplace useinvio/nfse-sdk
```

## Tools

| Tool | Effect | Certificate |
|---|---|---|
| `validate_dps` | Validates a DPS request; returns issues with path and suggestion. | No |
| `build_dps_xml` | Builds the unsigned DPS XML and checks it against the official XSD. | No |
| `explain_rejection` | Official message, rule and field for codes like `E0014`, from the gov.br annexes. | No |
| `get_nfse` | Looks up an NFS-e by its 50-digit access key. | Yes |
| `recover_nfse_by_dps` | Tells whether SEFIN issued an NFS-e for a DPS id (after a timeout). | Yes |
| `prepare_nfse_emission` | Validates and signs, **does not send**; returns a summary and a `confirmationId`. | Yes, write |
| `confirm_nfse_emission` | Sends the prepared DPS. Retrying after a dropped connection never duplicates. | Yes, write |
| `prepare_nfse_cancellation` | Builds the cancellation and shows the invoice; does not send. | Yes, write |
| `confirm_nfse_cancellation` | Sends the prepared cancellation. | Yes, write |

Write tools only exist with `NFSE_MCP_ALLOW_WRITE=1`. Confirmation ids are
single-use and expire after 10 minutes.

## Safety model

- The certificate and environment come from the host's environment variables.
  No tool accepts them as input, so the model can neither pick `producao` nor
  see key material.
- Emission and cancellation always take two calls. The server instructions tell
  the model to show the summary and wait for your approval before `confirm_*`.
- After a timeout, `confirm_nfse_emission` asks SEFIN about the DPS before it
  resends anything.

## Configuration

| Variable | Default | |
|---|---|---|
| `NFSE_CERT_PATH` or `NFSE_CERT_BASE64` | – | A1 certificate (`.pfx`). Without it, only the certificate-free tools work. |
| `NFSE_CERT_PASSWORD` or `NFSE_CERT_PASSWORD_FILE` | – | Certificate password. Prefer the file form. |
| `NFSE_AMBIENTE` | `restrita` | `restrita` or `producao`. |
| `NFSE_MCP_ALLOW_WRITE` | off | `1` enables the prepare/confirm tools. |
| `NFSE_MCP_MOCK` | off | `1` uses the in-process mock SEFIN and a test certificate. Refused with `producao`. |

The server logs its configuration (never secrets) to stderr at startup.

## License

MIT
