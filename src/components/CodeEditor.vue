<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, insertTab } from '@codemirror/commands'
import { cpp } from '@codemirror/lang-cpp'
import { python } from '@codemirror/lang-python'
import { Compartment } from '@codemirror/state'

const props = defineProps({
  modelValue: { type: String, required: true },
  language: { type: String, default: 'cpp' },
  dark: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'paste'])
const host = ref(null)
const languageConfig = new Compartment()
const themeConfig = new Compartment()
let view

function languageExtension(language) {
  return language === 'python' ? python() : cpp()
}

function editorTheme(dark) {
  const background = dark ? '#151b18' : 'transparent'
  const gutter = dark ? '#151b18' : 'transparent'
  const activeLine = dark ? '#202923' : '#e9ebe5'
  const foreground = dark ? '#d7dfd7' : '#353b35'
  return EditorView.theme({
    '&': { height: '100%', fontSize: '13px', backgroundColor: background, color: foreground },
    '.cm-scroller': { fontFamily: '"IBM Plex Mono", monospace', overflow: 'auto' },
    '.cm-content': { padding: '18px 0', caretColor: '#d4684b' },
    '.cm-gutters': { backgroundColor: gutter, border: 'none', color: dark ? '#77837a' : '#90938d' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-activeLine': { backgroundColor: activeLine },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: '#d4684b' },
    '::selection': { backgroundColor: dark ? '#394d3f' : '#cddbc8' },
  }, { dark })
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([
          { key: 'Tab', run: insertTab },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        languageConfig.of(languageExtension(props.language)),
        themeConfig.of(editorTheme(props.dark)),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
        }),
        EditorView.domEventHandlers({ paste: (event) => { emit('paste', event.clipboardData?.getData('text/plain')?.length ?? 0); return false } }),
      ],
    }),
    parent: host.value,
  })
})

watch(() => props.modelValue, (value) => {
  if (!view || value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})

watch(() => props.language, (language) => {
  view?.dispatch({ effects: languageConfig.reconfigure(languageExtension(language)) })
})

watch(() => props.dark, (dark) => {
  view?.dispatch({ effects: themeConfig.reconfigure(editorTheme(dark)) })
})

onBeforeUnmount(() => view?.destroy())
</script>

<template><div ref="host" class="editor-host"></div></template>