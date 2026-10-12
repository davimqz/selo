# Claude Code prompts — Selo

The prompts used to build Selo with Claude Code. Use them in order. They all assume `CLAUDE.md` and
`TASKS.md` at the root of the repository.

---

## Prompt 1 — Adapt the existing project (use first if you have already started something)

```
Read CLAUDE.md and TASKS.md in full before anything else. From now on they define
the project: Selo is an invoice REGISTRY, not a lender (no pool, no lending).

This repository already has code from a previous version. Do not delete, move or
rewrite anything yet. Do only this:

1. Create the `dev` branch from the current state and work on it.
2. List what exists: Anchor programs, accounts, instructions, tests, packages,
   screens, scripts and dependencies, with the installed versions.
3. Classify each item in a table:
   - KEEP (already serves CLAUDE.md as it is)
   - ADAPT (serves with changes; say which)
   - REMOVE (contradicts CLAUDE.md, e.g. pool, LP, advance calculation)
   - MISSING (required by CLAUDE.md and absent)
4. Point out any private key, .env or keypair committed in the history.
5. Say which TASKS.md tasks the existing code already covers, and which day of
   the plan we are actually on.
6. Propose the order of changes, as small as possible, to reach the current
   day's definition of done.

Stop and wait for my approval before editing any file.
```

---

## Prompt 2 — Start from scratch (use if there is no code)

```
Read CLAUDE.md and TASKS.md in full. We are on Day 0. Work on the `dev` branch.
Do the Day 0 tasks in order, one at a time, running the build and the tests after
each one. Do not start Day 1 until Day 0's definition of done passes.
If anything in CLAUDE.md is out of date (Anchor version, a command that changed,
the Wallet Adapter API), stop and tell me before moving on.
```

---

## Prompt 3 — Run one day of the plan (use every day)

```
Read CLAUDE.md and the Day [N] section of TASKS.md. Do that day's tasks in order.
After each task: run the tests, tick [x] in TASKS.md and tell me in one line what
changed. If a task is stuck for more than 45 minutes, stop, explain the blocker
and suggest which pre-approved cut from TASKS.md to apply.
At the end of the day, run the definition of done and show me the real result.
```

---

## Prompt 4 — Review before recording (Day 4)

```
Act as a Colosseum technical judge reviewing this repository for the first time.
Without editing anything:
1. Run the tests and the five-moment flow from CLAUDE.md Section 2 against
   devnet, and say what failed.
2. Read the README as an outsider: in 60 seconds, can you understand the
   problem, run the project and see checkInvoice()?
3. Look for committed secrets and raw Anchor errors showing up in the UI.
4. List the 5 hardest questions a judge would ask, and whether the README or the
   pitch already answers each one.
Deliver a prioritized list of what to fix in under 4 hours.
```
