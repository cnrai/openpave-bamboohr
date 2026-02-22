# OpenPAVE BambooHR Skill

Query BambooHR for time off, employee information, and applicant tracking in the PAVE sandbox environment.

## Features

- 📅 **Time Off** - Check who's out today, this week, or in a date range
- 👥 **Employees** - Access employee directory and individual profiles
- 📋 **Applicant Tracking** - Manage job candidates, applications, and statuses
- 💼 **Jobs** - List and filter job openings

## Setup

### 1. Configure Token

Add to `~/.pave/permissions.yaml`:

```yaml
tokens:
  bamboohr:
    env: BAMBOOHR_API_KEY
    type: api_key
    domains:
      - api.bamboohr.com
    placement:
      type: header
      name: Authorization
      format: "Basic {token}"
    encoding: basic_with_x
```

### 2. Add API Key

Add to `~/.pave/tokens.yaml`:

```yaml
BAMBOOHR_API_KEY: your-api-key-here
```

Get your API key from: **BambooHR > Settings > API Keys**

### 3. Install and Test

```bash
pave install openpave-bamboohr
pave-run bamboohr.js whos-out --summary
```

## Usage

### Time Off Commands

```bash
# Who's out today
pave-run bamboohr.js whos-out --summary

# Who's out this week (Monday to Sunday)
pave-run bamboohr.js whos-out --week --summary

# Who's out in a date range
pave-run bamboohr.js whos-out -s 2026-01-01 -e 2026-01-31 --summary

# Get time off requests
pave-run bamboohr.js time-off -s 2026-01-01 -e 2026-01-31

# List time off types
pave-run bamboohr.js time-off-types
```

### Employee Commands

```bash
# Get employee directory
pave-run bamboohr.js directory --summary

# Get specific employee
pave-run bamboohr.js employee 12345

# Get employee with specific fields
pave-run bamboohr.js employee 12345 --fields firstName,lastName,department,hireDate
```

### Applicant Tracking Commands

```bash
# List all candidates
pave-run bamboohr.js candidates --summary

# Filter by job
pave-run bamboohr.js candidates --job 46 --summary

# Filter by status
pave-run bamboohr.js candidates --status 1 --summary

# Get specific candidate
pave-run bamboohr.js candidate 1645 --summary

# List applicant statuses
pave-run bamboohr.js statuses --summary

# Update candidate status
pave-run bamboohr.js update-candidate-status 1645 12

# Add comment to candidate
pave-run bamboohr.js add-candidate-comment 1645 "Reviewed resume, lacks required experience"

# List job openings
pave-run bamboohr.js jobs --summary

# List open jobs only
pave-run bamboohr.js jobs --status OPEN --summary
```

### Create New Candidate

```bash
pave-run bamboohr.js add-candidate \
  --first-name John \
  --last-name Doe \
  --job 46 \
  --email john.doe@example.com \
  --phone "+1-555-0123" \
  --linkedin "https://linkedin.com/in/johndoe"
```

## Command-Line Configuration

```bash
# Use different company domain
pave-run bamboohr.js whos-out --company mycompany --summary

# Global options available for all commands:
#   --company <domain>   Company domain (default: crholdingslimited)
#   --json              Output raw JSON
#   --summary           Human-readable output
#   --help              Show command help
```

## Applicant Status IDs

Common status IDs for updating candidates:

| Status | ID | Code |
|--------|-----|------|
| New | 1 | NEW |
| Not a Fit | 10 | NOFIT |
| Not Qualified | 12 | NOQUAL |
| Over Qualified | 13 | OVERQUAL |
| Hired Elsewhere | 14 | POACHED |
| Hired | 15 | HIRED |
| Offer Sent | 16 | OLSENT |
| Offer Signed | 17 | OLSIGNED |

Use `pave-run bamboohr.js statuses --summary` to see all available statuses.

## Output Formats

### Human-Readable (--summary)

```bash
pave-run bamboohr.js whos-out --week --summary

# Who's Out This Week (Mon, Jan 13 - Sun, Jan 19)
# ==============================================
# 
# • John Smith: Mon, Jan 13 - Wed, Jan 15 (Vacation)
# • Jane Doe: Thu, Jan 16 (Sick)
# 
# Total: 2 people out
```

### JSON (--json or default)

```bash
pave-run bamboohr.js whos-out --json
```

## Security

- ✅ **Secure Token System** - API key never visible to sandbox code
- ✅ **Network Restricted** - Only communicates with api.bamboohr.com
- ✅ **Read-Only by Default** - Most operations are read-only
- ⚠️ **Write Operations** - Status updates and comments require approval

## Error Handling

### Token Not Configured

```
❌ BambooHR token not configured.

Add to ~/.pave/permissions.yaml:

tokens:
  bamboohr:
    env: BAMBOOHR_API_KEY
    type: api_key
    domains:
      - api.bamboohr.com
    placement:
      type: header
      name: Authorization
      format: "Basic {token}"
    encoding: basic_with_x

Then add to ~/.pave/tokens.yaml:

BAMBOOHR_API_KEY: your-api-key-here
```

### API Errors

```
❌ BambooHR Error: Unauthorized
Status: 401
```

Check that your API key is correct and has the necessary permissions.

## Integration Examples

### Daily Who's Out Report

```bash
#!/bin/bash
echo "=== Who's Out Today ==="
pave-run bamboohr.js whos-out --summary

echo -e "\n=== Who's Out This Week ==="
pave-run bamboohr.js whos-out --week --summary
```

### Candidate Pipeline Review

```bash
#!/bin/bash
echo "=== New Candidates ==="
pave-run bamboohr.js candidates --status 1 --summary

echo -e "\n=== Open Positions ==="
pave-run bamboohr.js jobs --status OPEN --summary
```

## License

MIT License - see LICENSE file for details.

## Contributing

- **GitHub**: https://github.com/cnrai/openpave-bamboohr
- **Issues**: Report bugs and feature requests
- **Pull Requests**: Submit improvements and fixes
