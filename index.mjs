#!/usr/bin/env node
import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

function sanitizeSingleLine(value, fallback = '') {
  const sanitized = String(value || '')
    .replace(/[\n\r]+/g, '')
    .trim()

  return sanitized || fallback
}

/**
 * Retrieves project configuration.
 * Returns project name and Discord webhook URL from package.json or environment variables.
 * @returns {Promise<{name: string, webhookUrl: string}>}
 */
async function getProjectConfig() {
  try {
    const content = await readFile('./package.json', 'utf-8')
    const pkg = JSON.parse(content)
    return {
      name: sanitizeSingleLine(pkg?.name, 'Unknown Project'),
      webhookUrl: sanitizeSingleLine(
        pkg?.config?.discord_build_noti_url ||
          process.env.DISCORD_BUILD_NOTI_URL
      )
    }
  } catch (e) {
    // Fallback to environment variables if package.json is missing or unreadable
    return {
      name: sanitizeSingleLine(process.env.PROJECT_NAME, 'Unknown Project'),
      webhookUrl: sanitizeSingleLine(process.env.DISCORD_BUILD_NOTI_URL)
    }
  }
}

/**
 * Retrieves the latest Git commit message.
 * Falls back to Cloudflare Pages environment variable if Git command fails.
 * @returns {Promise<string>}
 */
async function getCommitMessage() {
  try {
    const { stdout } = await execAsync('git log -1 --pretty=%s')
    return sanitizeSingleLine(stdout, 'No commit message')
  } catch (e) {
    return sanitizeSingleLine(
      process.env.CF_PAGES_COMMIT_MESSAGE,
      'No commit message'
    )
  }
}

/**
 * Retrieves the target branch name from common CI/CD variables or local Git.
 * @returns {Promise<string>}
 */
async function getTargetBranch() {
  const envBranch =
    process.env.DISCORD_BUILD_TARGET_BRANCH ||
    process.env.BUILD_TARGET_BRANCH ||
    process.env.CF_PAGES_BRANCH ||
    process.env.GITHUB_BASE_REF ||
    process.env.GITHUB_REF_NAME ||
    process.env.BRANCH

  const branch = sanitizeSingleLine(envBranch)
  if (branch) {
    return branch
  }

  try {
    const { stdout } = await execAsync('git branch --show-current')
    const gitBranch = sanitizeSingleLine(stdout)
    if (gitBranch) {
      return gitBranch
    }
  } catch (e) {
    // Ignore and try the next fallback.
  }

  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD')
    const gitBranch = sanitizeSingleLine(stdout)
    if (gitBranch && gitBranch !== 'HEAD') {
      return gitBranch
    }
  } catch (e) {
    // Ignore and use the final fallback.
  }

  return 'unknown'
}

function getStatusConfig(status) {
  switch (status) {
    case 'start':
      return {
        consoleIcon: '🚢',
        statusText: 'Build Started'
      }
    case 'success':
      return {
        consoleIcon: '✨',
        statusText: 'Build Succeeded'
      }
    case 'fail':
      return {
        consoleIcon: '🚨',
        statusText: 'Build Failed'
      }
    default:
      return null
  }
}

/**
 * Sends a notification via Discord Webhook.
 * Logs a warning if the webhook URL is missing.
 * @param {string} message
 * @param {string} [webhookUrl]
 */
async function sendDiscordNotification(message, webhookUrl) {
  if (!webhookUrl) {
    console.warn(
      '⚠️ Discord Webhook URL is not configured. To receive notifications, set config.discord_build_noti_url in package.json or define DISCORD_BUILD_NOTI_URL environment variable.'
    )
    return
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message.trim() })
    })
  } catch (e) {
    console.error('Failed to send Discord notification:', e.message)
  }
}

async function run() {
  const status = process.argv[2]
  const isDryRun = process.argv.includes('--dry-run')
  const statusConfig = getStatusConfig(status)

  if (!statusConfig) {
    console.error('Usage: noti <start|success|fail> [--dry-run]')
    process.exit(1)
  }

  const { name, webhookUrl } = await getProjectConfig()
  const commitMsg = await getCommitMessage()
  const targetBranch = await getTargetBranch()
  const { consoleIcon, statusText } = statusConfig
  const displayMsg = `${consoleIcon} **${name}** [${targetBranch}] - ${commitMsg} - ${statusText}`

  // Console output
  console.log(
    `${consoleIcon} ${name} [${targetBranch}] - ${commitMsg} - ${statusText}`
  )

  if (!isDryRun) {
    await sendDiscordNotification(displayMsg, webhookUrl)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
