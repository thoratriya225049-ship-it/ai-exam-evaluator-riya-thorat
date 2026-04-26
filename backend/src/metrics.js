// metrics.js — In-memory counters and average duration tracking.
// No persistence — resets on server restart.
 
const state = {
  totalRequests:    0,
  ocrRequests:      0,
  evalRequests:     0,
  sarvamSuccess:    0,
  sarvamFail:       0,
  geminiUsed:       0,
  parseFail:        0,
  retryCount:       0,
  blankAnswerCount: 0,
 
  _ocr_total_ms:  0,
  _ocr_count:     0,
  _ai_total_ms:   0,
  _ai_count:      0,
  _req_total_ms:  0,
  _req_count:     0,
}
 
export const metrics = {
  inc(key) {
    if (key in state) state[key]++
  },
 
  recordDuration(type, ms) {
    // type: 'ocr' | 'ai' | 'req'
    state[`_${type}_total_ms`] += ms
    state[`_${type}_count`]++
  },
 
  snapshot() {
    const avg = (total, count) => count === 0 ? 0 : Math.round(total / count)
    return {
      counters: {
        totalRequests:    state.totalRequests,
        ocrRequests:      state.ocrRequests,
        evalRequests:     state.evalRequests,
        sarvamSuccess:    state.sarvamSuccess,
        sarvamFail:       state.sarvamFail,
        geminiUsed:       state.geminiUsed,
        parseFail:        state.parseFail,
        retryCount:       state.retryCount,
        blankAnswerCount: state.blankAnswerCount,
      },
      averageDurations: {
        ocr_ms:   avg(state._ocr_total_ms, state._ocr_count),
        ai_ms:    avg(state._ai_total_ms,  state._ai_count),
        total_ms: avg(state._req_total_ms, state._req_count),
      },
      uptime_s: Math.floor(process.uptime()),
      generatedAt: new Date().toISOString(),
    }
  },
}
 