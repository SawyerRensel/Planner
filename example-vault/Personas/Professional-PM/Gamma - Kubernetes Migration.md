---
title: Gamma - Kubernetes Migration
summary: Migrate services to Kubernetes cluster
tags:
  - task
calendar:
  - Project-Gamma
context:
  - dev
people:
  - "[[DevOps Lead Tom]]"
location:
related:
status: In-Progress
priority: High
progress: 40
date_created: 2026-01-06T10:00:00
date_modified: 2026-01-11T10:00:00
date_start_scheduled: 2026-01-06T09:00:00
date_start_actual: 2026-01-06T09:00:00
date_end_scheduled: 2026-02-28T17:00:00
date_end_actual:
date_due: 2026-02-28T23:59:00
all_day: false
repeat_frequency:
repeat_interval:
repeat_until:
repeat_count:
repeat_byday:
repeat_bymonth:
repeat_bymonthday:
repeat_bysetpos:
repeat_completed_dates:
parent: "[[Project Gamma - Infrastructure]]"
children:
blocked_by:
cover:
color:
---

## Description

Migrating all services from EC2 to Kubernetes.

### Progress
- [x] Set up EKS cluster
- [x] Define Helm charts
- [x] Migrate non-critical services
- [ ] Migrate API services
- [ ] Migrate background workers
- [ ] Decommission old infrastructure
