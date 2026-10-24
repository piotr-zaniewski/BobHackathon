<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import {
  ArrowDown, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown,
  CircleHelp, Clock3, Code2, Command, Copy, Ellipsis, ExternalLink, Eye, EyeOff,
  FileCode2, FlaskConical, Lightbulb, ListChecks, LoaderCircle, MessageCircle,
  PanelRightClose, PanelRightOpen, Play, Plus, Send, Settings2, ShieldCheck, Sparkles,
  Moon, Sun, Target, ThumbsUp, Timer, WandSparkles, X,
} from 'lucide-vue-next'
import CodeEditor from './components/CodeEditor.vue'
import Button from './components/ui/Button.vue'
import { debounced } from './lib/utils.js'

const assignment = ref({
  title: 'Two Sum',
  course: 'Data structures & algorithms',
  unit: 'Hash maps · Week 04',
  prompt: 'Given an array of integers numbers and an integer target, return the indices of the two numbers that add up to target. You may assume exactly one solution exists, and you may not use the same element twice.',
  signature: 'twoSum(numbers, target)',
  rubric: ['Return the original indices', 'Complete in linear time', 'Explain the lookup invariant'],
})
const starterCode = {
  cpp: `#include <unordered_map>
#include <vector>
using namespace std;

vector<int> twoSum(const vector<int>& numbers, int target) {
    unordered_map<int, int> seen;

    for (int index = 0; index < static_cast<int>(numbers.size()); ++index) {
        const int complement = target - numbers[index];

        // What should you check before storing this number?

    }

    return {};
}`,
  python: `def two_sum(numbers, target):
    seen = {}

    for index, number in enumerate(numbers):
        complement = target - number

        # What should you check before storing this number?

    return []`,
}
const language = ref(localStorage.getItem('codecraft-language') === 'python' ? 'python' : 'cpp')
const codeBuffers = ref({ ...starterCode })
const code = ref(codeBuffers.value[language.value])
const suppressEditTracking = ref(false)
const theme = ref(localStorage.getItem('codecraft-theme') === 'dark' ? 'dark' : 'light')
const messages = ref([])
const draft = ref('')
const metrics = ref({ attempts: 0, edits: 0, explanations: 0, minutes: 0, pasteEvents: 0, passing: false, reviewSignal: false })
const tests = ref(null)
const pasteSinceLastCheck = ref(false)
const coachVisible = ref(true)
const isSending = ref(false)
const isChecking = ref(false)
const timeTick = ref(0)
const activeSeconds = ref(0)
const showSessionTime = ref(localStorage.getItem('codecraft-show-session-time') !== 'false')
const sessionId = localStorage.getItem('codecraft-session') || crypto.randomUUID()
localStorage.setItem('codecraft-session', sessionId)
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true, typographer: false })
let heartbeatTimer
let displayTimer
let lastActivity = Date.now()

const completedRubric = computed(() => [
  Boolean(tests.value?.runtimeVerified),
  language.value === 'cpp'
    ? code.value.includes('unordered_map') && code.value.includes('seen[')
    : code.value.includes('seen = {}') && code.value.includes('seen['),
  messages.value.some((message) => message.role === 'user' && message.content.trim().length > 45),
])
const rubricProgress = computed(() => completedRubric.value.filter(Boolean).length)
const detectedPatternCount = computed(() => tests.value?.checks?.filter((check) => check.detected).length || 0)
const elapsed = computed(() => {
  timeTick.value
  const seconds = activeSeconds.value
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})
const reviewCopy = computed(() => metrics.value.reviewSignal
  ? 'A large paste was recorded. This is context for review, not proof of misconduct.'
  : 'No unusual insert activity recorded')

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

async function loadWorkspace() {
  try {
    const [task, summary] = await Promise.all([
      api('/api/assignment'),
      api(`/api/metrics?sessionId=${encodeURIComponent(sessionId)}`),
    ])
    assignment.value = task
    metrics.value = summary
    activeSeconds.value = summary.activeSeconds || 0
  } catch {
    messages.value = [{ role: 'assistant', content: 'Let’s start with the invariant: as you scan from left to right, what information would make it possible to find the matching number in one lookup?' }]
  }
}

const saveEdit = debounced(async (value) => {
  try {
    await api('/api/events', { method: 'POST', body: JSON.stringify({ sessionId, type: 'edit', amount: 1 }) })
    if (value.length > 0) metrics.value.edits += 1
  } catch { /* The editor remains usable while the API is offline. */ }
}, 900)

watch(code, (value) => {
  codeBuffers.value[language.value] = value
  if (suppressEditTracking.value) return
  saveEdit(value)
})

function changeLanguage(nextLanguage) {
  if (nextLanguage === language.value) return
  codeBuffers.value[language.value] = code.value
  language.value = nextLanguage
  localStorage.setItem('codecraft-language', nextLanguage)
  code.value = codeBuffers.value[nextLanguage]
  tests.value = null
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('codecraft-theme', theme.value)
}

function toggleCoach() {
  coachVisible.value = !coachVisible.value
}

async function record(type, amount = 1) {
  try {
    await api('/api/events', { method: 'POST', body: JSON.stringify({ sessionId, type, amount }) })
    metrics.value = await api(`/api/metrics?sessionId=${encodeURIComponent(sessionId)}`)
  } catch { /* Keep local interaction available if the API is offline. */ }
}

async function sendMessage() {
  const content = draft.value.trim()
  if (!content || isSending.value) return
  messages.value.push({ role: 'user', content })
  draft.value = ''
  isSending.value = true
  await record('explanation')
  try {
    const result = await api('/api/coach', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message: content, code: code.value, history: messages.value.slice(-8, -1) }),
    })
    messages.value.push({ role: 'assistant', content: result.reply, provider: result.provider })
  } catch (error) {
    messages.value.push({ role: 'assistant', content: error.message || 'Could not reach the ICA coach. Check your ICA key, model ID, access entitlement, and network connection.' })
  } finally {
    isSending.value = false
    await nextTickScroll()
  }
}

function nextTickScroll() {
  return new Promise((resolve) => requestAnimationFrame(() => {
    const feed = document.querySelector('.chat-feed')
    if (feed) feed.scrollTop = feed.scrollHeight
    resolve()
  }))
}

async function runCheck() {
  if (isChecking.value) return
  isChecking.value = true
  try {
    tests.value = await api('/api/check', { method: 'POST', body: JSON.stringify({ sessionId, code: code.value, language: language.value }) })
    metrics.value = await api(`/api/metrics?sessionId=${encodeURIComponent(sessionId)}`)
    const checks = tests.value.checks || []
    if (pasteSinceLastCheck.value) {
      coachVisible.value = true
      messages.value.push({
        role: 'assistant',
        content: 'I noticed a paste event before this check. That does not tell me who wrote the code, and this source review does not detect copying. Let’s talk through the solution so I can check your understanding.',
      })
      await nextTick()
      try {
        const result = await api('/api/coach', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            code: code.value,
            message: `The student pasted code and then explicitly submitted it for a source-pattern review. Do not accuse them or infer copying from the paste. Ask two short Socratic questions about the approach and its edge cases. The static scan detected ${tests.value.detectedCount} of ${checks.length} expected patterns, but it cannot establish correctness.`,
            history: messages.value.slice(-6, -1),
          }),
        })
        messages.value.push({ role: 'assistant', content: result.reply, provider: result.provider })
      } catch (error) {
        messages.value.push({ role: 'assistant', content: `Could you explain what the map stores and why the lookup happens before inserting the current number? (${error.message})` })
      }
    }
    pasteSinceLastCheck.value = false
    await nextTickScroll()
  } catch {
    tests.value = { status: 'unavailable', detectedCount: 0, label: 'Pattern review unavailable', detail: 'Start the local API to review source patterns.' , checks: [] }
  } finally {
    isChecking.value = false
  }
}

async function notePaste(size) {
  pasteSinceLastCheck.value = true
  await record('paste', size)
}

function copyCode() {
  navigator.clipboard?.writeText(code.value)
}

function noteActivity() {
  lastActivity = Date.now()
}

function toggleSessionTime() {
  showSessionTime.value = !showSessionTime.value
  localStorage.setItem('codecraft-show-session-time', String(showSessionTime.value))
}

async function resetDemoSession() {
  const confirmed = window.confirm('Reset this demo session? Timer, checks, revisions, paste signals, chat, and editor changes will be cleared.')
  if (!confirmed) return

  saveEdit.cancel()
  try {
    await api('/api/session/reset', { method: 'POST', body: JSON.stringify({ sessionId }) })
  } catch (error) {
    messages.value.push({ role: 'assistant', content: `Could not reset the saved session data: ${error.message}` })
    return
  }

  metrics.value = { attempts: 0, edits: 0, explanations: 0, minutes: 0, pasteEvents: 0, passing: false, reviewSignal: false }
  tests.value = null
  activeSeconds.value = 0
  timeTick.value = 0
  pasteSinceLastCheck.value = false
  language.value = 'cpp'
  localStorage.setItem('codecraft-language', 'cpp')
  codeBuffers.value = { ...starterCode }
  suppressEditTracking.value = true
  code.value = starterCode.cpp
  await nextTick()
  suppressEditTracking.value = false
  messages.value = [{ role: 'assistant', content: 'Demo session reset. Start with the invariant: as you scan from left to right, what information would let you find the matching number in one lookup?' }]
}

onMounted(async () => {
  await loadWorkspace()
  if (!messages.value.length) {
    messages.value = [{ role: 'assistant', content: 'As you scan the numbers once, what would you need to remember so you can find the matching value without searching the array again?' }]
  }
  await record('heartbeat')
  activeSeconds.value = metrics.value.activeSeconds || activeSeconds.value
  heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastActivity < 60000) record('heartbeat')
  }, 30000)
  displayTimer = window.setInterval(() => {
    timeTick.value += 1
    if (document.visibilityState === 'visible' && Date.now() - lastActivity < 60000) activeSeconds.value += 1
  }, 1000)
  window.addEventListener('focus', onFocus)
  window.addEventListener('pointerdown', noteActivity)
  window.addEventListener('keydown', noteActivity)
})

function onFocus() { noteActivity(); record('heartbeat') }
onBeforeUnmount(() => {
  saveEdit.flush()
  window.clearInterval(heartbeatTimer)
  window.clearInterval(displayTimer)
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('pointerdown', noteActivity)
  window.removeEventListener('keydown', noteActivity)
})
</script>

<template>
  <div class="app-shell min-h-screen" :data-theme="theme">
    <header class="topbar">
      <div class="brand-lockup">
        <div class="brand-mark"><Command :size="17" :stroke-width="2.4" /></div>
        <span class="brand-name">BobLab</span>
        <span class="top-divider"></span>
        <span class="workspace-label">Learning lab</span>
      </div>
      <div class="top-center"><span class="course-crumb">CS 204</span><span class="crumb-slash">/</span><span>Problem set 04</span></div>
      <div class="top-actions">
        <span class="save-state"><span class="save-dot"></span>Saved</span>
        <Button variant="ghost" size="icon" :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleTheme"><Sun v-if="theme === 'dark'" :size="17" /><Moon v-else :size="17" /></Button>
        <button class="avatar" aria-label="Student profile">AL</button>
      </div>
    </header>

    <main class="main-wrap">
      <div class="breadcrumb-row">
        <button class="back-link"><ArrowLeft :size="14" /> Assignments</button>
        <span class="breadcrumb-sep">/</span>
        <span>{{ assignment.course }}</span>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{{ assignment.title }}</span>
      </div>

      <section class="task-heading">
        <div class="task-title-block">
          <div class="eyebrow"><span class="eyebrow-line"></span>{{ assignment.course }} · {{ assignment.unit }}</div>
          <h1 class="font-display">{{ assignment.title }}</h1>
          <p class="task-subtitle">Build a one-pass solution. Explain the idea as you go.</p>
        </div>
      </section>

      <details class="problem-details" open>
        <summary><span><FileCode2 :size="15" /> Problem & reference</span><ChevronDown :size="15" /></summary>
        <div class="problem-detail-body">
          <div class="problem-description"><div class="section-kicker">TASK</div><p>{{ assignment.prompt }}</p><div class="signature-inline"><span>Signature</span><code>{{ assignment.signature }}</code><span class="complexity-tag">Target O(n)</span></div></div>
          <div class="problem-rubric"><div class="section-kicker">WHAT YOU'LL DEMONSTRATE</div><div v-for="(item, index) in assignment.rubric" :key="item" class="rubric-item"><span :class="['rubric-check', { done: completedRubric[index] }]"><Check v-if="completedRubric[index]" :size="11" /></span><span :class="{ 'rubric-done': completedRubric[index] }">{{ item }}</span></div></div>
        </div>
      </details>

      <section class="session-strip" aria-label="Session summary">
        <div v-if="showSessionTime" class="session-stat time-stat"><Clock3 :size="14" /><span class="stat-label">Time</span><strong>{{ elapsed }}</strong></div>
        <button class="timer-toggle strip-toggle" :aria-label="showSessionTime ? 'Hide session timer' : 'Show session timer'" :title="showSessionTime ? 'Hide session timer' : 'Show session timer'" @click="toggleSessionTime"><EyeOff v-if="showSessionTime" :size="14" /><Eye v-else :size="14" /></button>
        <span class="strip-divider"></span>
        <div class="session-stat"><CheckCheck :size="14" /><span class="stat-label">Checks</span><strong>{{ metrics.attempts || 0 }}</strong></div>
        <div class="session-stat integrity-stat" :title="reviewCopy"><ShieldCheck :size="14" /><span class="stat-label">Integrity</span><strong>{{ metrics.reviewSignal ? 'Review signal' : 'No flags' }}</strong><span v-if="metrics.pasteEvents" class="paste-count">{{ metrics.pasteEvents }} paste{{ metrics.pasteEvents === 1 ? '' : 's' }}</span></div>
        <div class="strip-end"><button class="coach-toggle" :aria-expanded="coachVisible" @click="toggleCoach"><PanelRightClose v-if="coachVisible" :size="14" /><PanelRightOpen v-else :size="14" />{{ coachVisible ? 'Hide coach' : 'Show coach' }}</button></div>
      </section>

      <section :class="['workspace-grid', { 'coach-hidden': !coachVisible }]">
        <section class="work-column">
          <div class="editor-panel panel">
            <div class="panel-heading editor-heading">
              <div class="file-tab"><FileCode2 :size="14" /><span>{{ language === 'cpp' ? 'solution.cpp' : 'solution.py' }}</span><span class="unsaved-dot"></span></div>
              <div class="editor-tools"><div class="language-switch" role="group" aria-label="Programming language"><button :class="{ selected: language === 'cpp' }" @click="changeLanguage('cpp')">C++</button><button :class="{ selected: language === 'python' }" @click="changeLanguage('python')">Python</button></div><span class="meta-divider"></span><button class="icon-soft" title="Copy code" @click="copyCode"><Copy :size="14" /></button><button class="icon-soft" title="Editor options"><Ellipsis :size="17" /></button></div>
            </div>
            <div class="editor-body"><CodeEditor v-model="code" :language="language" :dark="theme === 'dark'" @paste="notePaste" /></div>
            <div class="editor-footer">
              <div class="editor-status"><span class="status-mark"></span><span>{{ language === 'cpp' ? 'C++' : 'Python' }}</span><span class="footer-sep">·</span><span>UTF-8</span><span class="footer-sep">·</span><span>Ln {{ code.split('\n').length }}, Col 1</span></div>
              <div class="run-controls"><span class="run-shortcut"><kbd>⌘</kbd><kbd>↵</kbd></span><Button class="run-button" @click="runCheck"><LoaderCircle v-if="isChecking" class="spin" :size="14" /><Play v-else :size="13" fill="currentColor" /> Check solution</Button></div>
            </div>
          </div>

          <div class="lower-panel panel">
            <div class="lower-tabs">
              <div class="lower-tab active"><FlaskConical :size="14" />Pattern review<span v-if="tests" class="test-count">{{ detectedPatternCount }}/{{ tests.checks?.length || 0 }}</span></div>
              <span class="demo-grader-label">Static scan · not compiled or run</span>
            </div>
            <div class="test-content">
              <template v-if="tests">
                <div class="test-summary test-summary-neutral"><span class="test-summary-icon"><CircleHelp :size="15" /></span><div><strong>{{ tests.label }} · {{ detectedPatternCount }}/{{ tests.checks.length }} patterns detected</strong><small>{{ tests.detail }}</small></div></div>
                <div class="test-list"><div v-for="(item, index) in tests.checks || []" :key="index" :class="['test-row', item.detected ? 'pattern-detected' : 'pattern-missing']"><span :class="['test-icon', item.detected ? 'pattern-found-icon' : 'pattern-missing-icon']">{{ item.detected ? '✓' : '·' }}</span><span class="test-row-label">{{ item.label }}</span><span class="test-row-result">{{ item.detected ? 'Detected' : 'Not detected' }}</span></div></div>
              </template>
              <div v-else class="empty-test"><span class="empty-test-icon"><FlaskConical :size="16" /></span><span>Run a check when you’re ready. The sample checker looks for solution structure, not correctness.</span><button @click="runCheck">Run check <ArrowRight :size="13" /></button></div>
            </div>
          </div>
        </section>

        <aside v-if="coachVisible" class="coach-rail panel">
          <div class="coach-heading panel-heading"><div class="coach-orb"><Sparkles :size="14" /></div><div class="coach-title"><strong>Thinking partner</strong><small><span class="online-dot"></span>{{ messages.at(-1)?.provider === 'ica' ? 'ICA · Socratic mode' : messages.at(-1)?.provider === 'demo' ? 'Demo coach · Socratic mode' : 'Socratic mode' }}</small></div><button class="icon-soft" aria-label="Coach options"><Ellipsis :size="17" /></button></div>
          <div class="coach-context"><span class="context-icon"><Target :size="14" /></span><span>Let’s work toward <strong>linear time</strong> by keeping a map as you scan.</span><button aria-label="Dismiss context"><X :size="13" /></button></div>
          <div class="chat-feed thin-scrollbar">
            <div class="chat-date"><span></span> TODAY <span></span></div>
            <div v-for="(message, index) in messages" :key="index" :class="['message-row', message.role === 'user' ? 'message-user' : 'message-assistant']">
              <div v-if="message.role === 'assistant'" class="assistant-avatar"><Sparkles :size="13" /></div>
              <div class="message-body"><span class="message-author">{{ message.role === 'user' ? 'You' : 'Coach' }}</span><div class="message-bubble" v-html="markdown.render(message.content)"></div><div v-if="message.role === 'assistant'" class="message-actions"><button aria-label="Helpful response"><ThumbsUp :size="12" /></button><button aria-label="Copy response"><Copy :size="12" /></button></div></div>
            </div>
            <div v-if="isSending" class="message-row message-assistant"><div class="assistant-avatar"><Sparkles :size="13" /></div><div class="typing-indicator"><i></i><i></i><i></i></div></div>
          </div>
          <div class="coach-compose">
            <div class="prompt-chips"><button @click="draft = 'Can you give me a small hint?'">Give me a hint <Lightbulb :size="12" /></button><button @click="draft = 'Can you review my reasoning?'">Review my thinking <ArrowRight :size="12" /></button></div>
            <form class="compose-box" @submit.prevent="sendMessage"><textarea v-model="draft" rows="2" placeholder="Explain your thinking or ask a question…" @keydown.enter.exact.prevent="sendMessage"></textarea><div class="compose-footer"><span><WandSparkles :size="12" /> Hints, not solutions</span><button class="send-button" :disabled="!draft.trim() || isSending" aria-label="Send message"><Send :size="14" /></button></div></form>
            <div class="coach-footnote">AI can make mistakes. Verify important details.</div>
          </div>
        </aside>
      </section>

      <footer class="page-footer"><span><span class="footer-brand-dot"></span> BOBLAB · HACKATHON PROJECT</span><span>CS 204 <span class="breadcrumb-sep">·</span> Problem set 04</span><button title="Reset the demo session to zero" @click="resetDemoSession"><CircleHelp :size="13" /> Need help?</button></footer>
    </main>
  </div>
</template>