---
name: nfse-emission
description: Use when the user wants to validate DPS JSON/XML, generate DPS XML, prepare a signed NFS-e DPS, or transmit an NFS-e through the local NFS-e SDK MCP tools.
---

# NFS-e emission workflow

Use `validate_dps_json` before generating or sending a DPS. Explain `issues` as blocking errors and `warnings` as non-blocking discrepancies. Then use `build_dps_xml` for JSON input, or `validate_dps_xml` for external XML.

Only call `prepare_nfse` or `emit_nfse` after the user has explicitly supplied an A1/PFX certificate as base64 and its password for this operation. Do not ask for, store, repeat, log, or include certificate data in chat summaries. Certificate content is used in memory for the request only.

Before `emit_nfse`, state the target environment and the note identifier derived from the payload. Treat transmission as an external fiscal action: report the returned access key on success; on transport uncertainty or an incomplete authorization response, tell the user to reconcile the DPS before retrying. Do not retry automatically.

The SDK validates data structure and XML layout. It does not determine fiscal classification, service codes, tax rates, withholding eligibility, numbering policy, or legal authorization to issue.
