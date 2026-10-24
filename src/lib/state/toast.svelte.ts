export const toast = $state<{ message: string | null }>({ message: null })

let timer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string, ms = 2800) {
  toast.message = message
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
