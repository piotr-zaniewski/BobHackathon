<script setup>
import { computed } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '../../lib/utils.js'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'default' },
  as: { type: String, default: 'button' },
  class: { type: String, default: '' },
})
const classes = computed(() => cn(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315f50] disabled:pointer-events-none disabled:opacity-45',
  props.size === 'icon' ? 'size-9' : 'h-9 px-3.5 text-sm',
  props.variant === 'primary' && 'bg-[#173b32] text-white hover:bg-[#265447]',
  props.variant === 'outline' && 'border border-[#d8dad3] bg-white/70 text-[#353a35] hover:bg-[#e9ebe5]',
  props.variant === 'ghost' && 'text-[#555b54] hover:bg-[#e9ebe5] hover:text-[#252a26]',
  props.class,
))
</script>

<template>
  <Primitive :as="as" :class="classes"><slot /></Primitive>
</template>