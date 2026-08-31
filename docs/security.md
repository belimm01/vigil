# Security model

## Trust boundaries

- Monitor URLs and journey definitions are tenant-controlled input.
- The worker makes outbound requests and therefore sits on an SSRF boundary.
- JWT signing material, database credentials, and SMTP credentials are deployment secrets.
- Organization authorization must be checked on every tenant-scoped resource.

## Deployment controls

- Containers run as non-root with dropped Linux capabilities and read-only root filesystems where supported.
- The Helm chart references pre-existing Secrets; credentials are never accepted as chart values.
- NetworkPolicy denies unsolicited ingress and permits only the web-to-API path inside the namespace.
- Production deployments should restrict worker egress, block link-local/cloud metadata ranges, and resolve DNS defensively before enabling arbitrary public monitor URLs.

## Known scope boundary

The current reference implementation is appropriate for trusted/self-hosted tenants. Internet-facing multi-tenant operation requires hardened outbound URL validation against DNS rebinding and private-address targets before monitor creation and again before each connection.
