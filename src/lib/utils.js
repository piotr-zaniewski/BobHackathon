import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { debounce } from 'lodash-es'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const debounced = debounce