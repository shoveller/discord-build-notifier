#!/usr/bin/env node
import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Retrieves project configuration.
 * Returns project name and Discord webhook URL from package.json or environment variables.
 * @returns {Promise<{name: string, webhookUrl: string}>}
 */
async function getProjectConfig() {
  try {
    const content = await readFile('./package.json', 'utf-8')
    const pkg = JSON.parse(content)
    const nameStr = String(pkg?.name || 'Unknown Project')
    const urlStr = String(
      pkg?.config?.discord_build_noti_url ||
        process.env.DISCORD_BUILD_NOTI_URL ||
        ''
    )
    return {
      name: nameStr.replace(/[\n\r]+/g, '').trim(),
      webhookUrl: urlStr.replace(/[\n\r]+/g, '').trim()
    }
  } catch (e) {
    // Fallback to environment variables if package.json is missing or unreadable
    return {
      name: process.env.PROJECT_NAME || 'Unknown Project',
      webhookUrl: String(process.env.DISCORD_BUILD_NOTI_URL || '').trim()
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
    return (
      String(stdout)
        .replace(/[\n\r]+/g, '')
        .trim() || 'No commit message'
    )
  } catch (e) {
    const envMsg = process.env.CF_PAGES_COMMIT_MESSAGE || 'No commit message'
    return String(envMsg)
      .replace(/[\n\r]+/g, '')
      .trim()
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
  const { name, webhookUrl } = await getProjectConfig()
  const commitMsg = await getCommitMessage()

  let displayMsg = ''
  let consoleIcon = ''
  let statusText = ''

  switch (status) {
    case 'start':
      displayMsg = `🚢 **${name}** - ${commitMsg} - Build Started`
      consoleIcon = '🚢'
      statusText = 'Build Started'
      break
    case 'success':
      displayMsg = `✨ **${name}** - ${commitMsg} - Build Succeeded`
      consoleIcon = '✨'
      statusText = 'Build Succeeded'
      break
    case 'fail':
      displayMsg = `🚨 **${name}** - ${commitMsg} - Build Failed`
      consoleIcon = '🚨'
      statusText = 'Build Failed'
      break
    default:
      console.error('Usage: noti <start|success|fail>')
      process.exit(1)
  }

  // Console output
  console.log(`${consoleIcon} ${name} - ${commitMsg} - ${statusText}`)

  await sendDiscordNotification(displayMsg, webhookUrl)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
