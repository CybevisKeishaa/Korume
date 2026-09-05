# Branch run state

Each multi-task branch has one `docs/superpowers/run-state/<branch>.md` file.
It is the compact authority for current branch facts needed to resume work.

Authority is deliberately split:

- Run state records current branch facts and the next action.
- The cited plan records intended work and task sequencing.
- Git records changed work and accepted evidence.
- `docs/lessons.md` records durable process learning.

A run state is not a diary, copied task report, or substitute for Git. Update
it at each accepted-task, review, decision, or verification checkpoint. Keep
it at or below 200 lines, using [TEMPLATE.md](TEMPLATE.md) so the protocol
validator and agents agree on its structure.
