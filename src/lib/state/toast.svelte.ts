export type ToastKind = 'ok' | 'error'

export const toast = $state<{ message: string | null; kind: ToastKind }>({
  message: null,
  kind: 'ok',
})

let timer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, ms = 2800, kind: ToastKind = 'ok') {
  toast.message = message
  toast.kind = kind
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    toast.message = null
    timer = null
  }, ms)
}

export function clearToast() {
  toast.message = null
  if (timer) clearTimeout(timer)
  timer = null
}
