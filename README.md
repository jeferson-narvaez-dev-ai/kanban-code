# kanban-code

A Kanban board where an AI agent (Amazon Bedrock + Claude) reads and writes your tasks as plain Markdown files. Manage work visually in the browser, or talk to the agent in natural language — it will create, move, and organize tasks for you.

- Drag-and-drop Kanban board (backlog → in-progress → review → done)
- **Markdown files as source of truth** — edit tasks by hand, commit them to git, diff them
- **AI agent powered by Amazon Bedrock (Claude)** — create, move, and organize tasks in natural language
- Real-time sync via WebSocket (file watcher → browser)
- `kanban init` CLI for instant project setup
- Slash commands for **Claude Code** (`/kanban-board`, `/kanban-agent`, and more)
- Embedded terminal in the UI
- Mock mode for development without AWS credentials

---

## Requirements

- Node.js >= 20
- npm >= 9
- An AWS account with Amazon Bedrock access (Claude 3.5 Sonnet enabled in your region)
- [Claude Code](https://claude.ai/code) — optional, required only for slash commands

---

## Installation

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd kanban-code

# Frontend + backend
npm install
cd server && npm install && cd ..

# CLI
cd cli && npm install && npm run build && cd ..
```

### 2. Configure environment variables

```bash
cp .env.example .env.kanban
```

Open `.env.kanban` and fill in your AWS credentials:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

> **No AWS credentials?** Set `BEDROCK_MOCK=true` to run the agent in mock mode. Everything else works normally.

### 3. Initialize your first project

```bash
npx kanban init
```

This command will:
1. Ask for a project name (defaults to the current directory name)
2. Create `~/.kanban/<project>/.kanban/` with four column files (`backlog.md`, `in-progress.md`, `review.md`, `done.md`)
3. Write `.env.kanban` in the current directory (prompts before overwriting)
4. Inject `.env.kanban` into `.gitignore` if not already present
5. Install four Claude Code slash commands into `.claude/commands/`

### 4. Start the app

```bash
npm run dev:server   # backend on port 3001
npm run dev          # frontend on port 5173
```

Open [http://localhost:5173](http://localhost:5173), select your project, and start managing tasks.

---

## Using kanban-code with your own projects

kanban-code is designed to manage tasks for **any** development project — not just itself.

### Option A — Install the CLI globally

```bash
cd kanban-code/cli
npm install -g .
```

Then, in any project:

```bash
cd ~/projects/my-app
kanban init
```

Running `kanban init` inside a repo will:
- Create `~/.kanban/my-app/.kanban/` with the four column Markdown files
- Generate `.env.kanban` in that directory pre-configured for `my-app`
- Install `/kanban-*` slash commands into `.claude/commands/` of that repo

### Option B — Shared workspace

All projects share the same workspace directory (`~/.kanban/` by default, or wherever `KANBAN_WORKSPACE` points):

```
~/.kanban/
  my-app/
    .kanban/
      backlog.md
      in-progress.md
      review.md
      done.md
  another-project/
    .kanban/
      backlog.md
      ...
```

Switch between projects using the project picker in the web UI, or by setting `KANBAN_PROJECT` in your `.env.kanban`.

### Option C — Initialize from the web UI

Open the app, click on an uninitialized project, and hit **"Initialize now"**. The server creates the workspace structure automatically — no CLI required.

---

## Claude Code slash commands

Running `kanban init` installs these commands into `.claude/commands/`:

| Command | Description |
|---------|-------------|
| `/kanban-board` | Show the current state of the board (task counts per column) |
| `/kanban-new-task <title>` | Create a new task in the backlog |
| `/kanban-move <TASK-ID> <column>` | Move a task to another column |
| `/kanban-agent <message>` | Open a conversation with the Bedrock agent |

### Examples

```
/kanban-board

/kanban-new-task Implement JWT authentication

/kanban-move TASK-003 in-progress

/kanban-agent Organize the backlog by priority and move any urgent tasks to in-progress
```

---

## Markdown file format

Tasks are stored as `##` sections inside column files. You can edit them directly in any text editor or via git.

```markdown
# Backlog

## TASK-001: Implement JWT authentication

priority: high
createdAt: 2026-05-14

Add refresh tokens and a 7-day expiry. Store tokens in httpOnly cookies.

---

## TASK-002: Design landing page

priority: medium
createdAt: 2026-05-14

Wireframes approved. Use the Figma components from the design system.
```

Moving a task means moving its `## TASK-XXX` section from one file to another — nothing more.

> Deleted tasks are moved to `.kanban/.trash/` (soft delete). Tasks in `done/` older than 30 days can be archived via `POST /api/projects/:id/archive-done`.

---

## AI agent tools

The Bedrock agent has access to eight tools it can call autonomously:

| Tool | What it does |
|------|-------------|
| `list_projects` | List all projects in the workspace |
| `list_tasks` | List tasks in a column (or all columns) |
| `create_task` | Create a new task with title, description, priority |
| `update_task` | Update title, description, or priority of a task |
| `move_task` | Move a task to another column |
| `delete_task` | Soft-delete a task (moves to `.trash/`) |
| `get_task` | Get details of a specific task by ID |
| `create_project` | Initialize a new project in the workspace |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `KANBAN_WORKSPACE` | `~/.kanban` | Root directory for all project workspaces |
| `KANBAN_PROJECT` | — | Default active project |
| `AWS_REGION` | `us-east-1` | AWS region for Bedrock |
| `AWS_ACCESS_KEY_ID` | — | AWS access key (falls back to IAM role if omitted) |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Bedrock model to use |
| `BEDROCK_MOCK` | `false` | Set to `true` to run without real AWS calls |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL (used for CORS) |
| `VITE_API_URL` | `http://localhost:3001/api` | API base URL (Vite frontend) |
| `VITE_WS_URL` | `ws://localhost:3001/ws` | WebSocket URL (Vite frontend) |

---

## Architecture

```
Browser / Claude Code
        │
        ▼
  Express API (:3001)
        │
   ┌────┴────┐
   │         │
markdownStore  BedrockAgent
(gray-matter    (@aws-sdk/client-bedrock-runtime
 + async-lock)   ConverseCommand + tool-use loop)
   │
~/.kanban/{project}/.kanban/{column}.md
   │
chokidar (file watcher)
   │
WebSocket broadcast → TanStack Query invalidation → UI re-render
```

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the frontend with Vite HMR |
| `npm run dev:server` | Start the backend with ts-node-dev |
| `npm run build` | Build frontend for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

---

## License

MIT
