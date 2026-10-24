export type SwipeParams = {
  onLeft: () => void
  threshold?: number
}

/**
 * Swipe horizontal para filas de la tabla.
 * - izquierda: favorito
 * - tap/scroll: no hace nada
 *
 * `touch-action: pan-y` en la fila deja el scroll vertical al navegador.
 */
export function swipe(node: HTMLElement, params: SwipeParams) {
  let current = params
  let startX = 0
  let startY = 0
  let tracking = false
  let swiping = false

  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startX = event.clientX
    startY = event.clientY
    tracking = true
    swiping = false
  }

  function move(event: PointerEvent) {
    if (!tracking) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (!swiping && dx < -10 && Math.abs(dx) > Math.abs(dy)) {
      swiping = true
      node.dataset.swipe = 'left'
    }
  }

  function up(event: PointerEvent) {
    if (!tracking) return
    tracking = false
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    delete node.dataset.swipe
    const threshold = current.threshold ?? 56

    if (swiping && dx <= -threshold && Math.abs(dx) > Math.abs(dy)) current.onLeft()
    swiping = false
  }

  function cancel() {
    tracking = false
    swiping = false
    delete node.dataset.swipe
  }

  node.addEventListener('pointerdown', down)
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', cancel)

  return {
    update(next: SwipeParams) {
      current = next
    },
    destroy() {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', cancel)
    },
  }
}
