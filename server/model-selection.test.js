import test from 'node:test'
import assert from 'node:assert/strict'
import { selectClaudeModel } from './model-selection.js'

test('prefers Claude Opus over Sonnet and Haiku', () => {
  const selected = selectClaudeModel([
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  ])

  assert.equal(selected.id, 'claude-3-opus')
})

test('chooses the newest model within the highest available Claude tier', () => {
  const selected = selectClaudeModel([
    { id: 'claude-3-5-sonnet', name: 'Claude Sonnet' },
    { id: 'claude-3-7-sonnet', name: 'Claude Sonnet' },
    { id: 'some-other-model', name: 'General chat' },
  ])

  assert.equal(selected.id, 'claude-3-7-sonnet')
})

test('returns null when ICA lists no Claude tier model', () => {
  assert.equal(selectClaudeModel([{ id: 'llama-3', name: 'Llama' }]), null)
})