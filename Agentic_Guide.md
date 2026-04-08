# Project: ZedAI - Operations Agent (Executive + Social Media)

## Current System Status
**ACTIVE**: Building Operations Agent with integrated knowledge system.
**Primary Focus**: Executive assistant + Social media management.
**Framework**: llama.cpp (qwen2.5:7b) + Knowledge-based memory architecture.
**Hardware**: 4GB RAM + 10GB swap - optimized for efficiency.

## System Architecture

### Core: Operations Agent
**Purpose**: Unified external presence - handles all touchpoints.
**Components**:
- Executive Assistant (calendar, email, tasks, meetings)
- Social Media Manager (content, scheduling, analytics)
- Shared Knowledge Base (your document as memory system)

### LLM Backend
- **Model**: qwen2.5:7b (4.5GB, 8K context, tool-capable)
- **Endpoint**: http://localhost:11434 (Ollama)
- **Performance**: Load slowly once, run efficiently after

## ABSOLUTE CONSTRAINTS

1. **NEVER modify UI** without "UI_REDESIGN_APPROVED" flag
2. **NEVER change Ollama port** (11434) unless debugging
3. **ALWAYS check imports** before adding dependencies
4. **NEVER delete route files** - append/modify only
5. **SERVER STARTUP IS THE GOAL** - test after every change
6. **WORK WITHIN 4GB RAM** - if qwen2.5:7b fails, fallback to phi-2 with simplified tasks

## KNOWLEDGE SYSTEM IMPLEMENTATION

Your document defines the memory architecture. Here's how we implement it:

### Core Entities to Build First

| Entity | Purpose | For Operations Agent |
|--------|---------|---------------------|
| **User** | You (the human) | Owner of all tasks, preferences |
| **Account** | System access | API keys, credentials, permissions |
| **Profile** | Your preferences | Communication style, brand voice |
| **Session** | Active work | Current Goose session, context |
| **Task** | Unit of work | Email to send, post to schedule |
| **Goal** | Desired outcome | "Launch social campaign" |
| **Plan** | Steps to goal | Content calendar, outreach sequence |
| **Action** | Performed step | "Drafted tweet", "Sent email" |
| **Event** | What happened | "Meeting completed", "Post published" |
| **MemoryRecord** | Retained history | Past decisions, what worked/failed |
| **KnowledgeRecord** | Stored facts | Contact info, brand guidelines |
| **Preference** | Saved choices | "Post at 9am", "Formal tone" |
| **Status** | Current state | "Draft", "Scheduled", "Sent" |

### Knowledge Types in Use

| Type | Stored In | Example |
|------|-----------|---------|
| **Identity** | `~/.config/goose/identity.yaml` | You are [Name], prefer [style] |
| **State** | SQLite/JSON | Current task queue, calendar status |
| **Rule** | `CLAUDE.md`, `RULES.md` | "Never post without approval" |
| **Relationship** | SQLite | Contact → Company → Last interaction |
| **Memory** | `~/ai-workforce/memory/` | Past campaigns, what worked |

### Implementation: SQLite Database

```sql
-- Core tables to implement first
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    created_at TIMESTAMP
);

CREATE TABLE profiles (
    profile_id TEXT PRIMARY KEY,
    user_id TEXT,
    communication_style TEXT, -- "direct, minimal fluff"
    brand_voice TEXT, -- "professional but conversational"
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT, -- pending, active, completed
    owner_id TEXT,
    due_at TIMESTAMP,
    type TEXT, -- email, social_post, meeting_prep
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
);

CREATE TABLE memory_records (
    memory_id TEXT PRIMARY KEY,
    subject_id TEXT, -- user or task
    summary TEXT,
    relevance INTEGER, -- 1-10
    timestamp TIMESTAMP,
    source TEXT -- which agent created it
);

CREATE TABLE preferences (
    preference_id TEXT PRIMARY KEY,
    owner_id TEXT,
    key TEXT, -- "social_post_time"
    value TEXT, -- "09:00 EST"
    updated_at TIMESTAMP
);
```

## OPERATIONS AGENT: EXECUTIVE FUNCTIONS

### Email Management
**Knowledge Used**: User, Profile, Task, MemoryRecord, Preference

```
TRIGGER: New email arrives
ACTION:
  1. Create Task (email triage)
  2. Query Memory: Past interactions with sender?
  3. Query Preference: User's priority rules?
  4. Classify: Urgent/Important/Delegate/Ignore
  5. If Urgent: Alert user immediately
  6. If Important: Draft response, queue for review
  7. Log Event: Email processed
  8. Update Memory: Sender pattern learned
```

### Calendar Management
**Knowledge Used**: User, Task, Plan, Event, Preference

```
TRIGGER: Meeting request or scheduling conflict
ACTION:
  1. Query Preference: Working hours, focus time blocks
  2. Query Plan: Current goals, deadlines
  3. Check conflicts with existing Tasks/Events
  4. If conflict: Propose alternatives
  5. If clear: Accept, create Event
  6. Create Task: Prep briefing (15 min before)
  7. Update Memory: Meeting patterns
```

### Task Prioritization
**Knowledge Used**: Task, Goal, Plan, Status

```
DAILY ACTION:
  1. Query all Tasks with status=pending
  2. Query active Goals and Plans
  3. Score: Urgency × Importance × Alignment to Goals
  4. Return: Prioritized queue
  5. Create Plan: Today's execution order
```

## OPERATIONS AGENT: SOCIAL MEDIA FUNCTIONS

### Content Creation
**Knowledge Used**: Profile, KnowledgeRecord, MemoryRecord, Preference

```
TRIGGER: Need social post for [topic]
ACTION:
  1. Query Profile: Brand voice, communication style
  2. Query Knowledge: Brand guidelines, key messages
  3. Query Memory: Past high-performing posts
  4. Query Preference: Optimal posting times, platforms
  5. Draft 3 variations
  6. Save as Task (status=draft)
  7. Queue for human approval
```

### Content Calendar
**Knowledge Used**: Plan, Task, Event, Preference

```
WEEKLY ACTION:
  1. Query Plan: Content themes for week
  2. Create Tasks: One per post (draft, review, schedule)
  3. Set due_at: Based on Preference (posting times)
  4. Schedule: Auto-post if approved, else notify
  5. Log Event: Content scheduled
```

### Engagement Monitoring
**Knowledge Used**: Event, MemoryRecord, Status

```
CONTINUOUS:
  1. Poll APIs: Mentions, DMs, comments
  2. Classify: Question/Complaint/Praise/Spam
  3. If Question: Draft response, queue for review
  4. If Complaint: Alert user immediately
  5. Log Event: Engagement handled
  6. Update Memory: Sentiment trends
```

## DEBUGGING PROTOCOL

When import errors or server failures occur:

### Step 1: Diagnostic (Read-Only)
```bash
1. Check: curl http://localhost:11434/api/tags (Ollama running?)
2. Check: free -h (enough RAM?)
3. Check: ollama ps (model loaded?)
4. Check: npm start or python server.py (specific error)
5. Identify: Missing package, syntax error, or OOM?
```

### Step 2: Fix
```bash
# If Ollama down
ollama serve &

# If OOM (out of memory)
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches
# Or restart WSL2: wsl --shutdown, then reopen Ubuntu

# If missing package
npm install [package] --save

# If model won't load
ollama rm qwen2.5:7b
ollama pull qwen2.5:7b
```

### Step 3: Surgical Change
- ONE change at a time
- Test server start
- If fails: git checkout . (revert)
- Document in KNOWN_ISSUES

## FALLBACK: If qwen2.5:7b Fails

**Switch to phi-2** for lighter tasks:
```bash
ollama pull phi-2
# Configure Goose with phi-2
# Simplify: Break complex requests into smaller steps
```

## PROJECT STRUCTURE

```
/mnt/c/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/
├── CLAUDE.md (this file)
├── knowledge/
│   ├── schema.sql (SQLite tables)
│   ├── db.sqlite (actual database)
│   └── config.yaml (identity, preferences)
├── agents/
│   └── operations/
│       ├── executive.js (email, calendar, tasks)
│       ├── social.js (content, scheduling)
│       └── memory.js (knowledge system interface)
├── ui/ (existing - READ ONLY)
├── server/ (existing - modify carefully)
└── package.json (check before adding)
```

## IMPLEMENTATION ROADMAP

### Week 1: Foundation
- [ ] Set up SQLite database with core tables
- [ ] Create User, Profile entries for you
- [ ] Implement basic Task creation/logging
- [ ] Connect to existing UI/backend (read-only first)

### Week 2: Executive Functions
- [ ] Email triage (mock data first)
- [ ] Calendar integration (Google/Outlook APIs)
- [ ] Task prioritization algorithm
- [ ] Daily briefing generation

### Week 3: Social Media
- [ ] Content drafting (using Profile voice)
- [ ] Content calendar (Plan + Tasks)
- [ ] Scheduling integration (Buffer or native APIs)
- [ ] Analytics logging (MemoryRecord)

### Week 4: Intelligence Connection
- [ ] R&D Agent feeds into Operations
- [ ] Market intel → Content ideas
- [ ] Research briefs → Email digests

## TOOL PERMISSIONS

- **Read**: All files, APIs, database
- **Write**: `knowledge/`, `agents/`, backend routes
- **Execute**: Server start/stop, Ollama commands, git
- **Locked**: `ui/` (read-only), system paths

## COMMUNICATION STYLE

- Direct, minimal, action-focused
- When stuck: State block, propose 2 options, wait
- No circular debugging (3 strikes = escalate)
- Acknowledge RAM limits: If qwen2.5:7b slow, suggest phi-2 fallback

## KNOWN ISSUES

- [ ] qwen2.5:7b loads slowly on 4GB RAM - expected, wait it out
- [ ] Swap usage high - monitor with `free -h`
- [ ] Context limit 8K - break large tasks into chunks

---

**Current Session Goal**: Set up SQLite database with core tables (User, Profile, Task, MemoryRecord) and connect to existing project structure.

# Project: ZedAI - Operations Agent (Executive + Social Media)

## Current System Status
**ACTIVE**: Building Operations Agent with integrated knowledge system.
**Primary Focus**: Executive assistant + Social media management.
**Framework**: llama.cpp (qwen2.5:7b) + Knowledge-based memory architecture.
**Hardware**: 4GB RAM + 10GB swap - optimized for efficiency.

## System Architecture

### Core: Operations Agent
**Purpose**: Unified external presence - handles all touchpoints.
**Components**:
- Executive Assistant (calendar, email, tasks, meetings)
- Social Media Manager (content, scheduling, analytics)
- Shared Knowledge Base (your document as memory system)

### LLM Backend
- **Model**: qwen2.5:7b (4.5GB, 8K context, tool-capable)
- **Endpoint**: http://localhost:11434 (Ollama)
- **Performance**: Load slowly once, run efficiently after

## ABSOLUTE CONSTRAINTS

1. **NEVER modify UI** without "UI_REDESIGN_APPROVED" flag
2. **NEVER change Ollama port** (11434) unless debugging
3. **ALWAYS check imports** before adding dependencies
4. **NEVER delete route files** - append/modify only
5. **SERVER STARTUP IS THE GOAL** - test after every change
6. **WORK WITHIN 4GB RAM** - if qwen2.5:7b fails, fallback to phi-2 with simplified tasks

## KNOWLEDGE SYSTEM IMPLEMENTATION

Your document defines the memory architecture. Here's how we implement it:

### Core Entities to Build First

| Entity | Purpose | For Operations Agent |
|--------|---------|---------------------|
| **User** | You (the human) | Owner of all tasks, preferences |
| **Account** | System access | API keys, credentials, permissions |
| **Profile** | Your preferences | Communication style, brand voice |
| **Session** | Active work | Current Goose session, context |
| **Task** | Unit of work | Email to send, post to schedule |
| **Goal** | Desired outcome | "Launch social campaign" |
| **Plan** | Steps to goal | Content calendar, outreach sequence |
| **Action** | Performed step | "Drafted tweet", "Sent email" |
| **Event** | What happened | "Meeting completed", "Post published" |
| **MemoryRecord** | Retained history | Past decisions, what worked/failed |
| **KnowledgeRecord** | Stored facts | Contact info, brand guidelines |
| **Preference** | Saved choices | "Post at 9am", "Formal tone" |
| **Status** | Current state | "Draft", "Scheduled", "Sent" |

### Knowledge Types in Use

| Type | Stored In | Example |
|------|-----------|---------|
| **Identity** | `~/.config/goose/identity.yaml` | You are [Name], prefer [style] |
| **State** | SQLite/JSON | Current task queue, calendar status |
| **Rule** | `CLAUDE.md`, `RULES.md` | "Never post without approval" |
| **Relationship** | SQLite | Contact → Company → Last interaction |
| **Memory** | `~/ai-workforce/memory/` | Past campaigns, what worked |

### Implementation: SQLite Database

```sql
-- Core tables to implement first
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    created_at TIMESTAMP
);

CREATE TABLE profiles (
    profile_id TEXT PRIMARY KEY,
    user_id TEXT,
    communication_style TEXT, -- "direct, minimal fluff"
    brand_voice TEXT, -- "professional but conversational"
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    title TEXT,
    status TEXT, -- pending, active, completed
    owner_id TEXT,
    due_at TIMESTAMP,
    type TEXT, -- email, social_post, meeting_prep
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
);

CREATE TABLE memory_records (
    memory_id TEXT PRIMARY KEY,
    subject_id TEXT, -- user or task
    summary TEXT,
    relevance INTEGER, -- 1-10
    timestamp TIMESTAMP,
    source TEXT -- which agent created it
);

CREATE TABLE preferences (
    preference_id TEXT PRIMARY KEY,
    owner_id TEXT,
    key TEXT, -- "social_post_time"
    value TEXT, -- "09:00 EST"
    updated_at TIMESTAMP
);
```

## OPERATIONS AGENT: EXECUTIVE FUNCTIONS

### Email Management
**Knowledge Used**: User, Profile, Task, MemoryRecord, Preference

```
TRIGGER: New email arrives
ACTION:
  1. Create Task (email triage)
  2. Query Memory: Past interactions with sender?
  3. Query Preference: User's priority rules?
  4. Classify: Urgent/Important/Delegate/Ignore
  5. If Urgent: Alert user immediately
  6. If Important: Draft response, queue for review
  7. Log Event: Email processed
  8. Update Memory: Sender pattern learned
```

### Calendar Management
**Knowledge Used**: User, Task, Plan, Event, Preference

```
TRIGGER: Meeting request or scheduling conflict
ACTION:
  1. Query Preference: Working hours, focus time blocks
  2. Query Plan: Current goals, deadlines
  3. Check conflicts with existing Tasks/Events
  4. If conflict: Propose alternatives
  5. If clear: Accept, create Event
  6. Create Task: Prep briefing (15 min before)
  7. Update Memory: Meeting patterns
```

### Task Prioritization
**Knowledge Used**: Task, Goal, Plan, Status

```
DAILY ACTION:
  1. Query all Tasks with status=pending
  2. Query active Goals and Plans
  3. Score: Urgency × Importance × Alignment to Goals
  4. Return: Prioritized queue
  5. Create Plan: Today's execution order
```

## OPERATIONS AGENT: SOCIAL MEDIA FUNCTIONS

### Content Creation
**Knowledge Used**: Profile, KnowledgeRecord, MemoryRecord, Preference

```
TRIGGER: Need social post for [topic]
ACTION:
  1. Query Profile: Brand voice, communication style
  2. Query Knowledge: Brand guidelines, key messages
  3. Query Memory: Past high-performing posts
  4. Query Preference: Optimal posting times, platforms
  5. Draft 3 variations
  6. Save as Task (status=draft)
  7. Queue for human approval
```

### Content Calendar
**Knowledge Used**: Plan, Task, Event, Preference

```
WEEKLY ACTION:
  1. Query Plan: Content themes for week
  2. Create Tasks: One per post (draft, review, schedule)
  3. Set due_at: Based on Preference (posting times)
  4. Schedule: Auto-post if approved, else notify
  5. Log Event: Content scheduled
```

### Engagement Monitoring
**Knowledge Used**: Event, MemoryRecord, Status

```
CONTINUOUS:
  1. Poll APIs: Mentions, DMs, comments
  2. Classify: Question/Complaint/Praise/Spam
  3. If Question: Draft response, queue for review
  4. If Complaint: Alert user immediately
  5. Log Event: Engagement handled
  6. Update Memory: Sentiment trends
```

## DEBUGGING PROTOCOL

When import errors or server failures occur:

### Step 1: Diagnostic (Read-Only)
```bash
1. Check: curl http://localhost:11434/api/tags (Ollama running?)
2. Check: free -h (enough RAM?)
3. Check: ollama ps (model loaded?)
4. Check: npm start or python server.py (specific error)
5. Identify: Missing package, syntax error, or OOM?
```

### Step 2: Fix
```bash
# If Ollama down
ollama serve &

# If OOM (out of memory)
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches
# Or restart WSL2: wsl --shutdown, then reopen Ubuntu

# If missing package
npm install [package] --save

# If model won't load
ollama rm qwen2.5:7b
ollama pull qwen2.5:7b
```

### Step 3: Surgical Change
- ONE change at a time
- Test server start
- If fails: git checkout . (revert)
- Document in KNOWN_ISSUES

## FALLBACK: If qwen2.5:7b Fails

**Switch to phi-2** for lighter tasks:
```bash
ollama pull phi-2
# Configure Goose with phi-2
# Simplify: Break complex requests into smaller steps
```

## PROJECT STRUCTURE

```
/mnt/c/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/
├── CLAUDE.md (this file)
├── knowledge/
│   ├── schema.sql (SQLite tables)
│   ├── db.sqlite (actual database)
│   └── config.yaml (identity, preferences)
├── agents/
│   └── operations/
│       ├── executive.js (email, calendar, tasks)
│       ├── social.js (content, scheduling)
│       └── memory.js (knowledge system interface)
├── ui/ (existing - READ ONLY)
├── server/ (existing - modify carefully)
└── package.json (check before adding)
```

## IMPLEMENTATION ROADMAP

### Week 1: Foundation
- [ ] Set up SQLite database with core tables
- [ ] Create User, Profile entries for you
- [ ] Implement basic Task creation/logging
- [ ] Connect to existing UI/backend (read-only first)

### Week 2: Executive Functions
- [ ] Email triage (mock data first)
- [ ] Calendar integration (Google/Outlook APIs)
- [ ] Task prioritization algorithm
- [ ] Daily briefing generation

### Week 3: Social Media
- [ ] Content drafting (using Profile voice)
- [ ] Content calendar (Plan + Tasks)
- [ ] Scheduling integration (Buffer or native APIs)
- [ ] Analytics logging (MemoryRecord)

### Week 4: Intelligence Connection
- [ ] R&D Agent feeds into Operations
- [ ] Market intel → Content ideas
- [ ] Research briefs → Email digests

## TOOL PERMISSIONS

- **Read**: All files, APIs, database
- **Write**: `knowledge/`, `agents/`, backend routes
- **Execute**: Server start/stop, Ollama commands, git
- **Locked**: `ui/` (read-only), system paths

## COMMUNICATION STYLE

- Direct, minimal, action-focused
- When stuck: State block, propose 2 options, wait
- No circular debugging (3 strikes = escalate)
- Acknowledge RAM limits: If qwen2.5:7b slow, suggest phi-2 fallback

## KNOWN ISSUES

- [ ] qwen2.5:7b loads slowly on 4GB RAM - expected, wait it out
- [ ] Swap usage high - monitor with `free -h`
- [ ] Context limit 8K - break large tasks into chunks

---

**Current Session Goal**: Set up SQLite database with core tables (User, Profile, Task, MemoryRecord) and connect to existing project structure.
/mnt/kimi/output/CLAUDE_qwen_operations.md3. **ALWAYS check existing imports** in `package.json`/`requirements.txt`/`Cargo.toml` before suggesting new ones
4. **NEVER delete existing route files** - append or modify, don't destroy
5. **SERVER STARTUP IS THE GOAL** - every change must be tested with `npm start`/`python server.py`/etc.

## Debugging Protocol (Current Priority)
When import errors or server failures occur:

### Step 1: Diagnostic (Read-Only)
```
1. Check package.json dependencies (what's installed vs. what's imported)
2. Check for typos in import statements (case sensitivity, path aliases)
3. Verify Ollama is running: `ollama list` and `ollama ps`
4. Check server logs for stack traces (last 20 lines)
5. Identify: Is this a missing dependency, path error, or runtime crash?
```

### Step 2: Dependency Resolution
```
- If package missing: `npm install [exact-package-name]` (check npm registry first)
- If version conflict: Check package.json for version ranges, suggest pin
- If path alias broken: Check tsconfig.json/jsconfig.json paths
- If Ollama connection fails: Verify CORS, port 11434, model availability
```

### Step 3: Surgical Fix
```
- ONE change at a time
- Test server start after each change
- If fails, revert and document in KNOWN_ISSUES
- No "shotgun debugging" (changing 5 things hoping one works)
```

## Project Structure (Existing)
```
[Your actual structure - to be filled in first session]
├── ui/ or src/ or client/          [Your UI directory]
│   ├── components/                  [EXISTING - hands off]
│   ├── pages/ or views/             [EXISTING - hands off]
│   └── [other UI files]              [EXISTING - hands off]
├── server/ or api/ or backend/      [Your backend directory]
│   ├── routes/                       [EXISTING - modify carefully]
│   ├── models/ or db/                [EXISTING - hands off]
│   └── [other backend files]         [EXISTING - hands off]
├── ollama/ or config/                [Ollama integration - hands off]
└── package.json / requirements.txt   [CRITICAL - check before changes]
```

## Current Known Issues (Update As We Work)
- [ ] Import error: [specific module] in [specific file] - Status: [investigating/fixed]
- [ ] Server fails to start: [error message] - Status: [investigating/fixed]
- [ ] Ollama connection: [issue] - Status: [investigating/fixed]

## Working Session Log (Persistent Memory)
**2026-03-29**: Initial CLAUDE.md creation. Current focus: Stabilize existing Ollama + UI + backend integration before adding agent infrastructure.

## Agent Integration Plan (Post-Stabilization)
Once server starts reliably:
1. Add Operations Agent endpoints (exec/social APIs)
2. Add Intelligence Agent background worker
3. Integrate with existing Ollama for local LLM inference
4. Add Audio Engineer (DAW control)
5. Add IDE Operator (code review of this project + other apps)

## Tool Permissions
- Read: All files (diagnostic)
- Write: Backend routes (new agent endpoints), config files (careful), documentation
- Execute: Server start/stop, test commands, Ollama status checks
- **Locked**: UI components (read-only unless explicitly unlocked)

## Communication Style
- Direct, minimal, action-focused
- When stuck: State exactly what's blocking, propose 2 options, wait for choice
- No circular debugging - if 3 attempts fail, escalate to human with full context

