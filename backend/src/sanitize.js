// sanitize.js — Input sanitization and prompt-injection prevention.

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /forget\s+(all\s+)?(previous|prior|above)/gi,
  /you\s+are\s+now\s+a/gi,
  /act\s+as\s+(a\s+)?(?:different|new|another)/gi,
  /system\s*prompt\s*:/gi,
  /\[INST\]/gi,
  /<\|im_start\|>/gi,
  /###\s*instruction/gi,
  /new\s+instructions?\s*:/gi,
]

/**
 * Sanitize a single string:
 * 1. Remove non-printable control chars (keep \n \r \t)
 * 2. Neutralise known prompt-injection phrases
 * 3. Trim
 */
export const sanitizeText = (input) => {
  if (typeof input !== 'string') return String(input ?? '')
  let out = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  for (const pattern of INJECTION_PATTERNS) {
    out = out.replace(pattern, '[REMOVED]')
  }
  return out.trim()
}

/**
 * Sanitize all string fields in a flat object (shallow).
 */
export const sanitizeFields = (obj) => {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === 'string' ? sanitizeText(v) : v
  }
  return result
}