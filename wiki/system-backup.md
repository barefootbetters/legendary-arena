---
title: System Backup
type: Guide
tags:
  - operations
  - backup
  - disaster-recovery
  - postgres
  - pcloud
  - cloudflare
related:
  - disaster-recovery.md
  - ubuntu-lab-provisioning.md
  - development-workflow.md
  - ai-second-brain.md
  - operational-health-checks.md
  - data-file-locations.md
  - service-dependency-map.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\system-backup.md (this page — https://ewiki.legendary-arena.com/system-backup/)
  - ../docs/ops/DISASTER_RECOVERY.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-10-12
---

## Summary

Every backup and recovery fact on the ewiki, on one page. This page owns no
facts of its own: each section below is rendered at build time from the page
that owns it (D-24709), so it is always as current as that page. To change
something here, edit the owner page named in the section's **Linked
section** caption.

**Something is down right now?** Start with the
[Service Dependency Map](service-dependency-map.md)
(`ewiki.legendary-arena.com/service-dependency-map/`): which products a
failed service takes down, and what to check, in order, when a product is down.

## Mechanics

### Backup policy at a glance

{{< include-section page="disaster-recovery" section="backup-policy-at-a-glance" >}}

### Known gaps

{{< include-section page="disaster-recovery" section="known-gaps" >}}

### What is at risk

{{< include-section page="disaster-recovery" section="what-is-actually-at-risk" >}}

### Database backup layers

{{< include-section page="disaster-recovery" section="the-backup-layers" >}}

### How the nightly backup runs

{{< include-section page="ubuntu-lab-provisioning" section="offsite-backups-r2--pcloud" >}}

### Checking last night's backup

{{< include-section page="disaster-recovery" section="reading-a-droplet-backup-result" >}}

### Not in any backup

{{< include-section page="disaster-recovery" section="not-in-any-backup" >}}

### Recovery scenarios

{{< include-section page="disaster-recovery" section="recovery-scenarios-dr-01--dr-05" >}}

### Proving a recovery

{{< include-section page="disaster-recovery" section="recovery-is-graded-by-capability-not-infrastructure" >}}

{{< include-section page="ubuntu-lab-provisioning" section="6--disaster-recovery-exercise-full-rebuild-from-docs" >}}

### Secrets

{{< include-section page="development-workflow" section="secrets-rotation" >}}

### What pCloud is for

{{< include-section page="development-workflow" section="what-pcloud-is-and-isnt" >}}

### The AI Second Brain

{{< include-section page="ai-second-brain" section="backup-and-recovery" >}}

## Interactions

- [Disaster Recovery](disaster-recovery.md) owns the database backup layers,
  the backup health signals, and the DR-01…DR-05 scenarios. It mirrors the
  operator runbook [`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md).
- [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) owns how the
  droplet's nightly backup runs, its configuration, and the full-rebuild
  exercise.
- [Development Workflow](development-workflow.md) owns secrets rotation and
  pCloud's role.
- [AI Second Brain](ai-second-brain.md) points to the knowledge-base backup
  plan, which lives with the brain's design record in the private ship repo
  and renders at [brain.barefootbetters.com](https://brain.barefootbetters.com/)
  (signed in, behind Cloudflare Access).
- [Operational Health Checks](operational-health-checks.md) covers the probes
  that confirm a restored system is serving.
- [Service Dependency Map](service-dependency-map.md) says what each service
  outage takes down and what to check when a product is down.

## Edge Cases

- **A renamed owner heading fails the build.** Each section is found by the
  owner heading's anchor. Renaming or removing that heading stops the ewiki
  build with an error naming this page and the missing anchor; update the
  `section=` value here to the heading's new anchor in the same PR.
- **Search returns the owner page, not this one.** Included blocks are
  excluded from the Pagefind index, so a search hit lands where the text is
  edited.
- **The raw Markdown shows the include lines, not the text.** On GitHub, or
  to an agent reading `wiki/system-backup.md` directly, each section is an
  `include-section` line naming the owner page and anchor. Follow it to the
  owner page.

## References

- [DECISIONS.md D-24709](../docs/ai/DECISIONS.md) — the include-section
  convention.
- [SCHEMA.md §Section includes](SCHEMA.md#section-includes-write-once-show-in-many-places)
  — how to use it.
- [`include-section.html`](../apps/wiki-viewer/layouts/shortcodes/include-section.html)
  — the shortcode.
