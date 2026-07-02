# discord-build-notifier

Discord build notification CLI for CI/CD environments.

## Features

- Send start, success, and failure notifications to Discord via Webhooks.
- Automatically detects project name from `package.json`.
- Automatically fetches latest git commit message.
- Automatically detects target branch from common CI/CD environment variables.
- Support for Cloudflare Pages environment variables.

## Installation

```bash
npm install discord-build-notifier --save-dev
# or
pnpm add discord-build-notifier -D
```

## Configuration

You can configure the Discord Webhook URL in two ways:

### 1. package.json

```json
{
  "name": "your-project",
  "config": {
    "discord_build_noti_url": "https://discord.com/api/webhooks/..."
  }
}
```

### 2. Environment Variables

Set `DISCORD_BUILD_NOTI_URL` in your CI/CD environment (e.g., Cloudflare Pages dashboard).

- `DISCORD_BUILD_NOTI_URL`: Your Discord Webhook URL.
- `PROJECT_NAME` (Optional): Override project name if `package.json` is missing.
- `DISCORD_BUILD_TARGET_BRANCH` (Optional): Explicitly set the target branch name shown in notifications.
- `BUILD_TARGET_BRANCH` (Optional): Generic fallback for target branch name.

### Target branch detection

Notifications include the detected target branch:

```text
🚢 your-project [main] - Commit message - Build Started
```

The CLI detects the branch from the first available source:

1. `DISCORD_BUILD_TARGET_BRANCH`
2. `BUILD_TARGET_BRANCH`
3. `CF_PAGES_BRANCH`
4. `GITHUB_BASE_REF`
5. `GITHUB_REF_NAME`
6. `BRANCH`
7. local git branch

## Usage

Add scripts to your `package.json`:

```json
{
  "scripts": {
    "deploy": "noti start && (your-deploy-command && noti success) || (noti fail && exit 1)"
  }
}
```

### Command API

- `noti start`: Sends a "Ship it" notification.
- `noti success`: Sends a "Success" notification.
- `noti fail`: Sends an "Alert" notification.

Use `--dry-run` to print the notification message without sending a Discord webhook:

```bash
noti start --dry-run
```

## Testing

```bash
npm test
```

## License

ISC
