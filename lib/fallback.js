'use strict'
const { parse, normalize } = require('./builders')

/** Plain-text version of a button message — every link and copy code is still there. */
function renderText(opts = {}) {
  const parts = []
  if (opts.title) parts.push(`*${opts.title}*`)
  if (opts.subtitle) parts.push(String(opts.subtitle))
  const body = opts.text ?? opts.body ?? opts.caption
  if (body) parts.push(String(body))
  const lines = []
  const buttons = (opts.buttons || opts.interactiveButtons || []).map(normalize).filter(Boolean)
  buttons.forEach((b, i) => {
    const p = parse(b)
    if (b.name === 'cta_url') lines.push(`🔗 ${p.display_text || 'Open'}: ${p.url}`)
    else if (b.name === 'cta_copy') lines.push(`📋 ${p.display_text || 'Copy'}: ${p.copy_code}`)
    else if (b.name === 'cta_call') lines.push(`📞 ${p.display_text || 'Call'}: ${p.phone_number}`)
    else if (b.name === 'single_select') {
      for (const s of p.sections || []) {
        if (s.title && s.title.trim()) lines.push(`*${s.title.trim()}*`)
        for (const r of s.rows || []) lines.push(`• ${r.title}${r.description ? ` — ${r.description}` : ''}`)
      }
    } else lines.push(`${i + 1}. ${p.display_text || p.id || 'Option'}`)
  })
  if (lines.length) parts.push(lines.join('\n'))
  if (opts.footer) parts.push(`_${opts.footer}_`)
  return parts.filter(Boolean).join('\n\n').slice(0, 3800)
}

module.exports = { renderText }
