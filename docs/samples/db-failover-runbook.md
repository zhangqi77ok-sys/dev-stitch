# Database failover runbook (SEEDED SAMPLE)

> This is bundled demo content for Dev Stitch. It is intentionally stale:
> the queue item `doc-001` exists because this runbook is out of date.

## Promote a replica (current, correct)

1. Confirm the primary is unreachable from two different networks.
2. Run `dbctl promote --cluster main --to replica-eu-2` from staging first.
3. Verify replication lag is under 5 seconds before cutting traffic over.
4. Update the status page, then page the next on-call for a second pair of eyes.

## Retired (do not follow)

- The old primary host `db-primary-01` was decommissioned last quarter.
- The old command `dbctl failover --force` no longer exists.
