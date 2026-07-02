import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const cliPath = resolve('index.mjs')

function runNoti(args, env = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'discord-build-notifier-test-'))
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      PROJECT_NAME: 'test-project',
      CF_PAGES_COMMIT_MESSAGE: 'Test commit',
      DISCORD_BUILD_NOTI_URL: '',
      ...env
    }
  })
}

test('prints explicit target branch in dry-run mode', () => {
  const result = runNoti(['start', '--dry-run'], {
    DISCORD_BUILD_TARGET_BRANCH: 'dev'
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /🚢 test-project \[dev\] - Test commit - Build Started/)
  assert.equal(result.stderr, '')
})

test('uses Cloudflare Pages branch fallback', () => {
  const result = runNoti(['success', '--dry-run'], {
    CF_PAGES_BRANCH: 'main'
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /✨ test-project \[main\] - Test commit - Build Succeeded/)
})

test('uses GitHub pull request base branch fallback', () => {
  const result = runNoti(['fail', '--dry-run'], {
    GITHUB_BASE_REF: 'release'
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /🚨 test-project \[release\] - Test commit - Build Failed/)
})

test('prefers explicit notifier branch over CI fallbacks', () => {
  const result = runNoti(['start', '--dry-run'], {
    DISCORD_BUILD_TARGET_BRANCH: 'prod',
    CF_PAGES_BRANCH: 'dev',
    GITHUB_BASE_REF: 'main'
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /\[prod\]/)
  assert.doesNotMatch(result.stdout, /\[dev\]|\[main\]/)
})

test('dry-run does not warn when webhook URL is missing', () => {
  const result = runNoti(['start', '--dry-run'], {
    DISCORD_BUILD_TARGET_BRANCH: 'dev'
  })

  assert.equal(result.status, 0)
  assert.doesNotMatch(result.stderr, /Discord Webhook URL is not configured/)
})

test('non-dry-run keeps missing webhook warning behavior', () => {
  const result = runNoti(['start'], {
    DISCORD_BUILD_TARGET_BRANCH: 'dev'
  })

  assert.equal(result.status, 0)
  assert.match(result.stderr, /Discord Webhook URL is not configured/)
})

test('invalid status keeps usage error and non-zero exit code', () => {
  const result = runNoti(['unknown', '--dry-run'])

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Usage: noti <start\|success\|fail> \[--dry-run\]/)
})
