---
name: ts
aliases:
  - truesight
  - truesight-cli
description: Run TrueSight CLI commands to query analytics data, manage projects, teams, segments, cohorts, funnels, boards, and more. Use when the user wants to interact with TrueSight analytics from the terminal.
user_invocable: true
---

# TrueSight CLI (`truesight`)

You are an assistant that helps the user run TrueSight CLI commands. The CLI binary is `truesight`. It talks to the TrueSight admin API.

## Authentication

The CLI uses Google OAuth via browser. Credentials are stored in `~/.truesight/credentials.json`.

```bash
truesight auth login       # Sign in via browser
truesight auth logout      # Sign out
truesight auth status      # Show current user
truesight auth token       # Print raw JWT token
```

## Configuration

Stored in `~/.truesight/config.json`. Key settings: `api_url`, `default_project`.

```bash
truesight config set api_url https://ts-admin.cityflo.net
truesight config set default_project <UUID>
truesight config get api_url
```

**Resolution priority**: CLI flags > env vars > config file > defaults.

## Global Flags

| Flag | Env Var | Description |
|------|---------|-------------|
| `--api-url <URL>` | `TRUESIGHT_API_URL` | Override API base URL |
| `--token <TOKEN>` | `TRUESIGHT_TOKEN` | Override bearer token |
| `-p, --project <ID>` | `TRUESIGHT_PROJECT` | Project UUID |
| `--format <FORMAT>` | `TRUESIGHT_FORMAT` | `json` (default) or `table` |
| `-v, --verbose` | | Enable debug logging |

## Commands Reference

### Projects

```bash
truesight projects list [--sort-by name|created_at|updated_at] [--sort-order asc|desc] [--page N] [--per-page N]
truesight projects get <PROJECT_ID>
truesight projects create --name <NAME>
truesight projects update <PROJECT_ID> [--name <NAME>] [--active true|false]
truesight projects delete <PROJECT_ID>
```

### Teams

```bash
truesight teams list [--sort-by name|created_at] [--sort-order asc|desc] [--page N] [--per-page N]
truesight teams get <TEAM_ID>
truesight teams create --name <NAME>
truesight teams update <TEAM_ID> [--name <NAME>]
truesight teams delete <TEAM_ID>

# Members
truesight teams members list --team-id <ID>
truesight teams members update --team-id <ID> --user-id <ID> --role <ROLE>
truesight teams members remove --team-id <ID> --user-id <ID>

# Project links
truesight teams projects list --team-id <ID>
truesight teams projects link --team-id <ID> --project-id <ID>
truesight teams projects unlink --team-id <ID> --project-id <ID>

# Invitations
truesight teams invitations list --team-id <ID>
truesight teams invitations create --team-id <ID> --email <EMAIL> [--role <ROLE>]
truesight teams invitations delete --team-id <ID> --invitation-id <ID>

# Allowed domains
truesight teams domains list --team-id <ID>
truesight teams domains add --team-id <ID> --domain <DOMAIN>
truesight teams domains remove --team-id <ID> --domain-id <ID>
```

### Stats (require `-p <project>`)

All date params accept DD-MM-YYYY, YYYY-MM-DD, or ISO datetime.

```bash
truesight stats event-count --from <DATE> --to <DATE>
truesight stats throughput --from <DATE> --to <DATE> [--granularity hour|day]
truesight stats event-types --from <DATE> --to <DATE>
truesight stats event-names --from <DATE> --to <DATE> [--limit N]
truesight stats events --from <DATE> --to <DATE> [--page N] [--per-page N] [--event-type TYPE] [--event-name NAME] [--sort-by col] [--sort-order asc|desc]
truesight stats active-users --from <DATE> --to <DATE>
truesight stats live-users
truesight stats platform-distribution --from <DATE> --to <DATE>
```

### Event Catalog (require `-p <project>`)

```bash
truesight event-catalog list [--sort-by event_name|event_count|first_seen|last_seen] [--sort-order asc|desc] [--page N] [--per-page N]
truesight event-catalog properties <EVENT_NAME>
```

### Properties (require `-p <project>`)

```bash
truesight properties keys [--event-name <NAME>]
truesight properties values --key <KEY> [--event-name <NAME>]
truesight properties insights [--body <JSON>] [--body-file <PATH>]
```

### Trends (require `-p <project>`)

```bash
truesight trends query [--body <JSON>] [--body-file <PATH>]
```

### Retention (require `-p <project>`)

```bash
truesight retention query [--body <JSON>] [--body-file <PATH>]
```

### Pivots (require `-p <project>`)

```bash
truesight pivots query [--body <JSON>] [--body-file <PATH>]
```

### Flows (require `-p <project>`)

```bash
truesight flows query [--body <JSON>] [--body-file <PATH>]
```

### Funnels (require `-p <project>`)

```bash
truesight funnels list
truesight funnels get <FUNNEL_ID>
truesight funnels create [--body <JSON>] [--body-file <PATH>]
truesight funnels update <FUNNEL_ID> [--body <JSON>] [--body-file <PATH>]
truesight funnels delete <FUNNEL_ID>
truesight funnels results <FUNNEL_ID> [--from <DATE>] [--to <DATE>]
truesight funnels compare --ids <ID1,ID2,...> [--from <DATE>] [--to <DATE>]
truesight funnels compare-time <FUNNEL_ID> --from <DATE> --to <DATE> --compare-from <DATE> --compare-to <DATE>
```

### Users (require `-p <project>`)

```bash
truesight users list [--page N] [--per-page N] [--search QUERY] [--sort-by last_seen|first_seen|event_count] [--sort-order asc|desc]
truesight users get <USER_ID>
truesight users events <USER_ID> [--page N] [--per-page N]
```

### Segments (require `-p <project>`)

```bash
truesight segments list
truesight segments get <SEGMENT_ID>
truesight segments create [--body <JSON>] [--body-file <PATH>]
truesight segments update <SEGMENT_ID> [--body <JSON>] [--body-file <PATH>]
truesight segments delete <SEGMENT_ID>
truesight segments size <SEGMENT_ID>
truesight segments users <SEGMENT_ID> [--page N] [--per-page N]
truesight segments preview [--body <JSON>] [--body-file <PATH>]
```

### Cohorts (require `-p <project>`)

```bash
truesight cohorts list
truesight cohorts get <COHORT_ID>
truesight cohorts create [--body <JSON>] [--body-file <PATH>]
truesight cohorts update <COHORT_ID> [--body <JSON>] [--body-file <PATH>]
truesight cohorts delete <COHORT_ID>
truesight cohorts size <COHORT_ID>
truesight cohorts users <COHORT_ID> [--page N] [--per-page N]
```

### Boards (require `-p <project>`)

```bash
truesight boards list
truesight boards get <BOARD_ID>
truesight boards create [--body <JSON>] [--body-file <PATH>]
truesight boards update <BOARD_ID> [--body <JSON>] [--body-file <PATH>]
truesight boards delete <BOARD_ID>

# Widgets
truesight boards widgets create --board-id <ID> [--body <JSON>] [--body-file <PATH>]
truesight boards widgets update --board-id <ID> --widget-id <ID> [--body <JSON>] [--body-file <PATH>]
truesight boards widgets delete --board-id <ID> --widget-id <ID>

# Layouts
truesight boards layouts --board-id <ID> [--body <JSON>] [--body-file <PATH>]
```

### Self-Update

```bash
truesight update   # Check and install latest version
```

## JSON Body Input

Commands accepting POST/PATCH support three input methods (in priority order):

1. **Inline**: `--body '{"key": "value"}'`
2. **File**: `--body-file /path/to/file.json`
3. **Stdin**: Pipe JSON when stdin is not a TTY

## How to Help the User

1. **Check auth first**: If a command fails with 401, suggest `truesight auth login`.
2. **Check default project**: If the user hasn't set one, suggest `truesight config set default_project <UUID>` or remind them to pass `-p`.
3. **Use `--format table`** for human-readable output when displaying results to the user.
4. **Use `--format json`** (default) when you need to parse the output programmatically.
5. **Date formats**: The CLI accepts DD-MM-YYYY, YYYY-MM-DD, or ISO datetime. Use YYYY-MM-DD for clarity.
6. **For complex queries** (trends, retention, pivots, flows, insights): construct the JSON body and pass it via `--body`.
7. **Always run commands via Bash tool** — the CLI is a standard terminal binary.
