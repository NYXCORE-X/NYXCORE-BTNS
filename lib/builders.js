'use strict'
// Button builders. Each returns { name, buttonParamsJson } — the exact shape WhatsApp's native flow wants.

const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }
const make = (name, params) => ({ name, buttonParamsJson: JSON.stringify(params) })

/** a tappable reply button; tapping it sends `id` back to the bot */
const quickReply = (text, id) => make('quick_reply', { display_text: clip(text, 25), id: String(id ?? text) })

/** a button that copies `code` to the clipboard */
const copy = (text, code) => make('cta_copy', { display_text: clip(text, 25), copy_code: String(code) })

/** a button that opens a link */
const url = (text, link, merchant) => make('cta_url', { display_text: clip(text, 25), url: String(link), merchant_url: String(merchant || link) })

/** a button that starts a phone call */
const call = (text, phone) => make('cta_call', { display_text: clip(text, 25), phone_number: String(phone) })

/** a button that asks the user to share their location */
const location = (text = 'Send location') => make('send_location', { display_text: clip(text, 25) })

/**
 * a "tap to pick" list.
 * sections: [{ title, rows: [{ id, title, description? }] }]  — or just a flat rows array.
 */
const list = (title, sections) => {
  const secs = (Array.isArray(sections) && sections.length && sections[0] && sections[0].rows ? sections : [{ title: ' ', rows: sections || [] }])
    .map(s => ({
      title: clip(s.title ?? ' ', 24),
      ...(s.highlight_label ? { highlight_label: clip(s.highlight_label, 24) } : {}),
      rows: (s.rows || []).map(r => ({
        ...(r.header ? { header: clip(r.header, 24) } : {}),
        title: clip(r.title ?? r.text ?? r.id, 24),
        description: clip(r.description ?? '', 72),
        id: String(r.id ?? r.title),
      })),
    }))
  return make('single_select', { title: clip(title, 25), sections: secs })
}

const parse = (b) => { try { return JSON.parse(b?.buttonParamsJson || '{}') } catch { return {} } }

/**
 * Accepts every shape people use and turns it into a native button:
 *  - { name, buttonParamsJson }                       (already native)
 *  - { id, text }  /  { buttonId, buttonText:{displayText} }   (quick reply)
 *  - { type:'url'|'copy'|'call'|'reply'|'list'|'location', text, url|code|phone|id, ... }
 */
function normalize(b, i = 0) {
  if (!b || typeof b !== 'object') return null
  if (b.name && b.buttonParamsJson) return { name: b.name, buttonParamsJson: b.buttonParamsJson }
  const text = b.text || b.display_text || b.title || b.buttonText?.displayText
  switch (b.type) {
    case 'url': return url(text || 'Open', b.url, b.merchant_url)
    case 'copy': return copy(text || 'Copy', b.code ?? b.copy_code)
    case 'call': return call(text || 'Call', b.phone ?? b.phone_number)
    case 'location': return location(text)
    case 'list': return list(text || 'Open', b.sections || b.rows)
  }
  if (b.url) return url(text || 'Open', b.url)
  if (b.copy_code || b.code) return copy(text || 'Copy', b.copy_code ?? b.code)
  if (b.phone_number || b.phone) return call(text || 'Call', b.phone_number ?? b.phone)
  const id = b.id ?? b.buttonId
  if (text || id !== undefined) return quickReply(text || String(id), id ?? text)
  return quickReply(`Option ${i + 1}`, `btn_${i + 1}`)
}

module.exports = { quickReply, copy, url, call, location, list, normalize, parse, clip }
