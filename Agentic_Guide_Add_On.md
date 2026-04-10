Critical Success Factors
1. Start with the Hub: Don't skip the central configuration. It's your source of truth for personality, security, and access control.
2. Operations before Intelligence: Get the external touchpoint agent working first. Intelligence without action is just noise.
3. Learning tunnel is mandatory: The error feedback loop between agents is what makes this a system rather than a collection of tools ​￼.
4. Security gates are non-negotiable: Operations Agent can send emails. All need explicit ADMIN approval gates initially.
5. Shared memory architecture: Use the blackboard pattern ​￼—all agents write to common stores, read what they need. No direct agent-to-agent messaging (too fragile).

# Project: [Your AI Workforce Hub]

## Architecture
- Operations Agent: Handles exec + social (unified external presence)
- Intelligence Agent: Background research (feeds Operations)
- Future: Audio Engineer, IDE Operator

## Critical Constraints
- NEVER modify UI framework files without explicit ADMIN approval
- ALL server changes must pass `npm run test` before suggesting
- Import errors: Check `package.json` dependencies first, don't guess



KNOWLEDGE TYPES

Identity knowledge
Purpose: define what an entity is
Key fields: id, type, name, classification, labels
Relationships: linked to roles, permissions, profiles, resources, events
Source of truth: canonical entity records

State knowledge
Purpose: define current condition or status
Key fields: status, value, timestamp, version, active flags
Relationships: linked to users, sessions, tasks, tools, alerts
Source of truth: live system state and status records

Rule knowledge
Purpose: define governing logic and behavior
Key fields: rule_id, condition, action, priority, scope
Relationships: linked to entities, constraints, permissions, modules
Source of truth: rule registry and configuration records

Relationship knowledge
Purpose: define how entities connect
Key fields: relationship_id, source_id, target_id, type, direction
Relationships: linked across all entities
Source of truth: relationship mappings and references

Memory knowledge
Purpose: define retained history that matters later
Key fields: memory_id, summary, relevance, timestamp, retention, source
Relationships: linked to users, tasks, events, goals, context
Source of truth: memory store and event-derived records

KNOWLEDGE LAYERS

Canonical entities
Purpose: define the primary objects in the system
Key fields: id, type, name, metadata, timestamps
Relationships: linked to rules, events, state, sources
Source of truth: primary entity database

Canonical rules
Purpose: define official system behavior
Key fields: rule_id, logic, scope, priority, enabled
Relationships: linked to entities, modules, constraints, permissions
Source of truth: rule/configuration store

Event history
Purpose: define what happened over time
Key fields: event_id, actor, action, target, timestamp, outcome
Relationships: linked to users, tasks, tools, alerts, memory
Source of truth: event log and audit trail

CORE ENTITIES

User
Purpose: represent a human actor
Key fields: user_id, name, email, status, created_at
Relationships: linked to account, profile, role, session, task, event
Source of truth: user record

Account
Purpose: represent system access container
Key fields: account_id, user_id, username, status, created_at
Relationships: linked to user, role, permission, session, preference
Source of truth: account record

Profile
Purpose: represent descriptive user information
Key fields: profile_id, user_id, display_name, bio, metadata
Relationships: linked to user, preference, context, memory
Source of truth: profile record

Session
Purpose: represent active or historical access instance
Key fields: session_id, user_id, status, started_at, ended_at
Relationships: linked to user, account, action, event, alert
Source of truth: session store

Permission
Purpose: represent allowed capabilities
Key fields: permission_id, name, scope, action, enabled
Relationships: linked to role, account, tool, service, module
Source of truth: permission registry

Role
Purpose: represent grouped access level or responsibility
Key fields: role_id, name, scope, status, metadata
Relationships: linked to user, account, permission
Source of truth: role registry

Preference
Purpose: represent saved user or system choices
Key fields: preference_id, owner_id, key, value, updated_at
Relationships: linked to user, profile, account, context
Source of truth: preference store

MemoryRecord
Purpose: represent retained meaningful history
Key fields: memory_id, subject_id, summary, relevance, timestamp
Relationships: linked to user, task, goal, event, context
Source of truth: memory store

KnowledgeRecord
Purpose: represent a discrete stored fact or structured note
Key fields: record_id, title, type, content, source, updated_at
Relationships: linked to source, context, rule, entity, memory
Source of truth: knowledge store

Task
Purpose: represent a unit of work
Key fields: task_id, title, status, owner_id, due_at
Relationships: linked to user, goal, plan, action, event, alert
Source of truth: task store

Goal
Purpose: represent a desired outcome
Key fields: goal_id, title, description, owner_id, status
Relationships: linked to plan, task, user, context
Source of truth: goal store

Plan
Purpose: represent ordered approach to reach a goal
Key fields: plan_id, goal_id, title, steps, status
Relationships: linked to goal, task, action, constraint, resource
Source of truth: plan store

Action
Purpose: represent a performed or proposed step
Key fields: action_id, actor_id, type, target_id, timestamp, outcome
Relationships: linked to user, task, tool, service, event
Source of truth: action log

Event
Purpose: represent something that occurred
Key fields: event_id, type, actor_id, target_id, timestamp, outcome
Relationships: linked to user, session, task, alert, memory
Source of truth: event log

Tool
Purpose: represent an executable capability
Key fields: tool_id, name, function, inputs, outputs, status
Relationships: linked to permission, action, service, module
Source of truth: tool registry

Service
Purpose: represent an operational system component
Key fields: service_id, name, status, endpoint, version
Relationships: linked to module, tool, resource, alert
Source of truth: service registry

Module
Purpose: represent a bounded functional area
Key fields: module_id, name, purpose, status, version
Relationships: linked to service, tool, rule, resource
Source of truth: module registry

Rule
Purpose: represent a single governing instruction
Key fields: rule_id, name, condition, action, priority, enabled
Relationships: linked to module, entity, constraint, permission
Source of truth: rule registry

Constraint
Purpose: represent a limit or requirement
Key fields: constraint_id, type, value, scope, active
Relationships: linked to rule, plan, task, resource, module
Source of truth: constraint registry

Resource
Purpose: represent something available for use
Key fields: resource_id, name, type, location, status
Relationships: linked to service, module, task, source
Source of truth: resource inventory

Source
Purpose: represent where information comes from
Key fields: source_id, type, origin, reference, trust_level, updated_at
Relationships: linked to knowledge records, memory, events, context
Source of truth: source registry

Connection
Purpose: represent an active or defined linkage between systems or entities
Key fields: connection_id, source_id, target_id, type, status
Relationships: linked to service, source, account, resource
Source of truth: connection registry

Alert
Purpose: represent a warning, issue, or important signal
Key fields: alert_id, type, severity, status, created_at
Relationships: linked to event, service, session, task, user
Source of truth: alert store

Status
Purpose: represent normalized condition values
Key fields: status_id, name, category, value, updated_at
Relationships: linked to entities, sessions, tasks, services, alerts
Source of truth: status registry or live state store

Context
Purpose: represent the relevant situational frame for reasoning or action
Key fields: context_id, scope, summary, active_entities, timestamp
Relationships: linked to user, goal, task, memory, knowledge records, events
Source of truth: context store

# Operations Agent Skill

## Identity
You are the Operations Agent for [Your Name]. You handle all external touchpoints: 
executive coordination and social media presence. You speak with the user's voice 
in all contexts.

## Capabilities

### Executive Functions
- Email triage: Read, categorize, draft responses, flag for human review when uncertain
- Calendar protection: Schedule meetings, block focus time, resolve conflicts
- Task capture: Extract action items from all communications, maintain priority queue
- Meeting prep: Generate briefings 15 min before meetings (attendees, agenda, relevant docs)

### Social Media Functions
- Content calendar: Maintain posting schedule across platforms
- Draft creation: Write posts, threads, captions matching brand voice
- Engagement monitoring: Track mentions, suggest responses, log sentiment
- Analytics: Weekly performance reports, trend identification

## Tools Available
- Gmail/Outlook API
- Google Calendar/Outlook Calendar
- Buffer/Hootsuite (or native Twitter/X, Instagram, LinkedIn APIs)
- Notion/Obsidian (for task/knowledge management)
- Slack (for team coordination)

## Workflow Integration
1. Morning: Process overnight email, check calendar, prep daily brief
2. Continuous: Monitor email/Slack for urgent items (response <30 min if flagged)
3. Scheduled: Social posts per content calendar
4. Evening: Digest of completed tasks, tomorrow's priorities, pending decisions

## Error Handling & Learning
- Log all uncertain decisions to `~/ai-workforce/logs/operations/`
- When human overrides a decision, capture context for prompt refinement
- Weekly self-review: Identify patterns in mistakes, propose SKILL.md updates


~/ai-workforce/
├── hub/
│   ├── config/
│   │   ├── personality.yaml          # Your voice, preferences, boundaries
│   │   ├── security.yaml             # Permissions, gates, sensitive data rules
│   │   ├── parameters.yaml           # Model selection, cost limits, timeout rules
│   │   └── access.yaml               # API keys, tool credentials, system paths
│   ├── shared-memory/                # Blackboard architecture [^43^]
│   │   ├── working/                  # Immediate context (JSON/Markdown)
│   │   ├── episodic/                 # Conversation histories, logs
│   │   ├── semantic/                 # Domain knowledge, facts, procedures
│   │   └── consensus/                # Verified team procedures [^47^]
│   ├── templates/                    # Skill templates for new agents
│   └── logs/                         # Error patterns, improvement cycles [^45^]
└── agents/
    ├── operations/                   # Executive + Social (Phase 1)
    ├── intelligence/                 # R&D (Phase 2)
    ├── audio-engineer/               # Music Production (Phase 3)
    └── ide-operator/                 # Code/Local System (Phase 3)


