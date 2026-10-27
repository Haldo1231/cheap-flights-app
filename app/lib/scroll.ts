// "Scroll to the top of the next screen" -- but only when the user moved
// FORWARD (clicked a country, city, trip ...). Pressing Back must keep the old
// scroll position, so the new screen only scrolls when a forward click asked it to.

let requestedAt = 0

/** Call right before navigating forward to a new level. */
export function requestScrollTop() {
  requestedAt = Date.now()
}

/** Called by the new screen when it appears; true if it should jump to the top. */
export function consumeScrollTop(): boolean {
  const wanted = Date.now() - requestedAt < 3000
  requestedAt = 0
  return wanted
}
