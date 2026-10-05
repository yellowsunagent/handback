# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `yellowsunagent/handback`.
Use the `gh` CLI. Include `--repo yellowsunagent/handback` on issue
and PR commands to select the repository explicitly.

## Conventions

The examples below omit the repository flag for readability.

- Create: `gh issue create --title "..." --body-file <path>`
- Read: `gh issue view <number> --comments`
- Read structured data: `gh issue view <number> --json number,title,body,labels,comments,state,url`
- List: `gh issue list --state open --json number,title,body,labels,comments,assignees`
- Comment: `gh issue comment <number> --body-file <path>`
- Apply/remove labels: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- Close: `gh issue close <number>`

Write multiline bodies to a temporary file and pass `--body-file`.
Apply appropriate label/state filters and retrieve enough results for
the requested scope.

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read the issue and its comments.

Tracker writes follow the authorization rules in `AGENTS.md`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub issues and PRs share a number space. When a bare reference is
ambiguous, resolve it with `gh pr view <number>` and fall back to
`gh issue view <number>`.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, containing Notes,
  Decisions-so-far, and Fog.
- Child ticket: link it as a GitHub sub-issue. If unavailable, add
  it to a task list in the map and put `Part of #<map>` at the top
  of the child body. Use `wayfinder:research`, `wayfinder:prototype`,
  `wayfinder:grilling`, or `wayfinder:task`.
- Blocking: use native GitHub issue dependencies. API operations
  requiring an issue ID use its numeric database ID, not its issue
  number or node ID. If dependencies are unavailable, put
  `Blocked by: #<number>` references at the top of the child body.
  A ticket is unblocked when every blocker is closed.
- Frontier: consider only open map children with no assignee or
  open blockers. Choose the first in map order.
- Claim: assign the ticket to the driving developer
  (`gh issue edit <number> --add-assignee @me` for yourself).
- Resolve: comment with the result, close the child, and append
  a concise result and link to the map's Decisions-so-far.
