import { planRoom, searchDetailedTrackVariants } from '@racehubos/shared'
self.onmessage = ({ data }) => {
  try {
    if (data.mode === 'room') {
      self.postMessage({ type: 'result', result: planRoom(data.room) })
      return
    }
    const generator = searchDetailedTrackVariants(data.room, {
      sourcePlan: data.sourcePlan,
    })
    let next
    do {
      next = generator.next()
      if (!next.done) self.postMessage({ type: 'progress', ...next.value })
    } while (!next.done)
    self.postMessage({ type: 'result', result: next.value })
  } catch {
    self.postMessage({ type: 'error' })
  }
}
