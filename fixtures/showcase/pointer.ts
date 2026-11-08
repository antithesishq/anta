export function installPointer() {
  const layer = document.createElement('div')
  layer.setAttribute('popover', 'manual')
  layer.className = 'showcase-pointer'
  layer.innerHTML = '<svg width="24" height="29" viewBox="0 0 24 29"><path d="M3 2v22l6-6 5 9 4-2-5-9h9Z" fill="#253324" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>'
  document.body.append(layer)
  layer.showPopover()
  const cursor = layer.firstElementChild as SVGElement
  const move = (event: PointerEvent) => {cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`;cursor.style.visibility = 'visible'}
  const down = (event: PointerEvent) => {
    const pulse = document.createElement('i')
    pulse.className = 'showcase-click'
    pulse.style.left = `${event.clientX}px`
    pulse.style.top = `${event.clientY}px`
    layer.append(pulse)
    setTimeout(() => pulse.remove(), 650)
  }
  let frame = 0
  const raise = (event: Event) => {
    if (event.target === layer) return
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {layer.hidePopover();layer.showPopover()})
  }
  document.addEventListener('pointermove', move, true)
  document.addEventListener('pointerdown', down, true)
  document.addEventListener('statechange', raise, true)
  document.addEventListener('toggle', raise, true)
  return () => {
    cancelAnimationFrame(frame)
    document.removeEventListener('pointermove', move, true)
    document.removeEventListener('pointerdown', down, true)
    document.removeEventListener('statechange', raise, true)
    document.removeEventListener('toggle', raise, true)
    layer.remove()
  }
}
