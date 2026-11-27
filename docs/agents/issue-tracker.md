# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in
[andreykolomensky-prog/ai-for-developers-project-387](https://github.com/andreykolomensky-prog/ai-for-developers-project-387/issues).
Use the `gh` CLI for all operations.

## Decisions of the first project

The app was built in [ai-for-developers-project-386](https://github.com/andreykolomensky-prog/ai-for-developers-project-386). Its tracker stays the source of the original decisions; do not re-create them here, link to them:

- Decision map: [#1](https://github.com/andreykolomensky-prog/ai-for-developers-project-386/issues/1) with its closed questions #2–#11.
- Application spec: [#12](https://github.com/andreykolomensky-prog/ai-for-developers-project-386/issues/12), tickets #13–#20, implementation PR [#21](https://github.com/andreykolomensky-prog/ai-for-developers-project-386/pull/21).
- Decision records live in this repo in `docs/adr/`, the vocabulary in `GLOSSARY.md`.

A bare `#12` in this repo means an issue of **this** tracker. Refer to the first project's issues by full URL.

## Incoming requests and prepared tickets

- A new issue from a user is an **incoming request**: it gets `needs-triage` and is triaged before any work.
- Specs published by `/to-spec` and tickets published by `/to-tickets` carry `ready-for-agent`. They are already agreed, so automatic triage skips them.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards.
- **Blocking**: GitHub's native issue dependencies. Add an edge with `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>`. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `gh issue view <n> --json blockedBy --jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'` (0 means startable).
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: post the explanation with `gh issue comment <number> --body "..."`, then `gh issue close <number>`.

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

File issues only into this repo. Before the first `gh issue create` of a session, check the target with `gh repo view --json nameWithOwner`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under Conventions.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer to the map's Decisions-so-far.
