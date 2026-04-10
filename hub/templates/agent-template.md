# AGENT TEMPLATE — ZED Hub
*Copy this template when creating a new specialist agent*

---

## SKILL.md Template

```markdown
# SKILL: [Agent Name]
**Version**: 1.0.0 | **Status**: [ACTIVE | STUBBED] | **Hub**: ZED AI

## Identity
[Who this agent is, its specialization, its role in the hub]

## Core Capabilities
[Numbered or bulleted list of what this agent can do]

## Approval Gates
**Tier 1 — Auto-approved**: [list actions that don't need confirmation]
**Tier 2 — Requires admin approval**: [list actions that need sign-off]

## Memory Usage
- Working: [what it writes to working memory]
- Episodic: [what it writes to episodic memory]
- Semantic: [what it writes to semantic store]

## Output Format
[How this agent formats its responses]

## Routing Handoffs
[Which other agents it routes to and why]

## Activation Checklist (if STUBBED)
- [ ] ADMIN approves activation
- [ ] Required dependencies installed
- [ ] Configuration complete
```

---

## Implementation Template (TypeScript)

```typescript
import fs from "fs/promises";
import path from "path";
import { generateChatFromOllama } from "../../services/Ollama/OllamaService";

const CWD = process.cwd();
const SKILL_PATH = path.resolve(CWD, "agents/[agent-name]/SKILL.md");
const LOG_DIR = path.resolve(CWD, "hub/logs/[agent-name]");

export interface [Agent]Request {
  userId: string;
  message: string;
  conversationId?: string;
}

export interface [Agent]Response {
  reply: string;
  agent: "[Agent]Agent";
  requiresApproval?: boolean;
}

export class [Agent]Agent {
  private static skill: string | null = null;

  static async loadSkill(): Promise<string> {
    if (this.skill) return this.skill;
    try {
      this.skill = await fs.readFile(SKILL_PATH, "utf-8");
    } catch {
      this.skill = "[Agent] specialization description.";
    }
    return this.skill;
  }

  static async process(request: [Agent]Request): Promise<[Agent]Response> {
    const skill = await this.loadSkill();

    const reply = await generateChatFromOllama(
      [{ role: "user", content: request.message }],
      skill
    );

    await this.log(request, reply);

    return { reply, agent: "[Agent]Agent" };
  }

  static isActive(): boolean {
    return true; // or false for STUBBED
  }

  private static async log(request: [Agent]Request, reply: string): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      const date = new Date().toISOString().split("T")[0];
      const logFile = path.join(LOG_DIR, `${date}.log`);
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: request.userId,
        messageLength: request.message.length,
        replyLength: reply.length,
      }) + "\n";
      await fs.appendFile(logFile, entry);
    } catch {}
  }
}
```

---

## Integration Checklist

When adding a new agent:
1. Create `server/agents/[name]/SKILL.md` — fill in from SKILL.md template
2. Create `server/agents/[name]/[Name]Agent.ts` — implement from TypeScript template
3. Add import to `server/orchestrator/ManagerAgent.ts`
4. Add routing keywords to `ManagerAgent.selectAgent()`
5. Add switch case to `ManagerAgent.route()`
6. Add to `status.orchestrator.active` in `/api/admin/system-status`
7. Create log dir: `hub/logs/[name]/`
8. Update this template with lessons learned

---

## Hub Directory Reference

```
hub/
├── config/               ← YAML files loaded by ManagerAgent
│   ├── personality.yaml  ← ZED voice, tone, decision rules
│   ├── security.yaml     ← Permission tiers, approval gates
│   ├── parameters.yaml   ← Model selection, timeouts, routing
│   └── access.yaml       ← External API config (keys, paths)
├── shared-memory/
│   ├── working/          ← Active tasks, current session context
│   ├── episodic/         ← Conversation history, approval queue
│   ├── semantic/         ← Domain knowledge, research corpus
│   └── consensus/        ← Verified procedures, brand guidelines
├── templates/            ← This file and other agent templates
└── logs/
    ├── routing/          ← ManagerAgent routing decisions
    ├── operations/       ← OperationsAgent decisions
    └── intelligence/     ← IntelligenceAgent research logs
```
