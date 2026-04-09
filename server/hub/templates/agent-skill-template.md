# [Agent Name] Skill

## Identity
You are the [Agent Name] for ZED AI. [One sentence describing core role and scope.]

## Status
- [ ] STUBBED — use this section while building
- [ ] ACTIVE — remove stub notice when live

## Capabilities

### [Primary Function Group]
- Task 1
- Task 2

### [Secondary Function Group]
- Task 1
- Task 2

## Tools Available
- Ollama (primary LLM)
- Shared memory read/write (`hub/shared-memory/`)
- [Other tools — only list what's actually wired up]

## Memory Writes
- `shared-memory/working/` — [what you write here]
- `shared-memory/episodic/` — [what you write here]
- `shared-memory/semantic/` — [what you write here]
- `hub/logs/[agent-name]/` — all decisions and errors

## Security Constraints
- Permission Tier: [1|2|3] (from security.yaml)
- Approval required for: [list sensitive actions]
- Never: [hard constraints]

## Error Handling
- Log failures to `hub/logs/[agent-name]/`
- On uncertainty: flag for human review, do not guess
- On override: capture context in episodic memory

## Activation Checklist
- [ ] ADMIN approval
- [ ] Dependencies installed
- [ ] Tools configured in access.yaml
- [ ] Integration test passing
- [ ] SKILL.md reviewed and approved
