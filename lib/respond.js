'use strict'
// Reading button taps. Works for quick replies, lists, and the older buttons / template / list replies.

function unwrap(message) {
  let m = message
  for (let i = 0; i < 6 && m; i++) {
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message || m.documentWithCaptionMessage?.message || m.deviceSentMessage?.message ||
      m.editedMessage?.message
    if (!inner) break
    m = inner
  }
  return m || {}
}

/**
 * The tap in a message, or null.
 * → { id, title, type: 'native' | 'buttons' | 'list' | 'template', params }
 */
function getButtonReply(msg) {
  const m = unwrap(msg?.message)
  const ir = m.interactiveResponseMessage
  if (ir) {
    let params = {}
    try { params = JSON.parse(ir.nativeFlowResponseMessage?.paramsJson || '{}') } catch {}
    const id = params.id ?? params.selectedId ?? params.selected_id
    if (id !== undefined) return { id: String(id), title: params.title || params.display_text || ir.body?.text || '', type: 'native', params }
    if (ir.body?.text) return { id: String(ir.body.text), title: ir.body.text, type: 'native', params }
  }
  if (m.buttonsResponseMessage) {
    const b = m.buttonsResponseMessage
    return { id: String(b.selectedButtonId), title: b.selectedDisplayText || '', type: 'buttons', params: {} }
  }
  if (m.listResponseMessage) {
    const l = m.listResponseMessage
    return { id: String(l.singleSelectReply?.selectedRowId ?? ''), title: l.title || '', type: 'list', params: {} }
  }
  if (m.templateButtonReplyMessage) {
    const t = m.templateButtonReplyMessage
    return { id: String(t.selectedId), title: t.selectedDisplayText || '', type: 'template', params: {} }
  }
  return null
}

/** shortcut: just the id */
const getButtonId = (msg) => getButtonReply(msg)?.id ?? null

/**
 * Run `handler(reply, msg)` for every button tap.
 * opts: { jid, from, ids (array | RegExp | prefix string), once, timeout }  → returns a function that stops listening.
 */
function onButton(sock, handler, opts = {}) {
  const match = (id) => {
    const f = opts.ids
    if (f === undefined) return true
    if (f instanceof RegExp) return f.test(id)
    if (typeof f === 'string') return id.startsWith(f)
    return Array.isArray(f) ? f.includes(id) : true
  }
  const froms = opts.from ? [].concat(opts.from).map(x => String(x).split('@')[0].split(':')[0]) : null
  let timer = null
  const listener = async ({ messages }) => {
    for (const msg of messages || []) {
      if (!msg?.message) continue
      if (opts.jid && msg.key.remoteJid !== opts.jid) continue
      const reply = getButtonReply(msg)
      if (!reply || !match(reply.id)) continue
      if (froms) {
        const who = String(msg.key.participant || msg.key.remoteJid || '').split('@')[0].split(':')[0]
        if (!froms.includes(who)) continue
      }
      if (opts.once) off()
      try { await handler(reply, msg) } catch (e) { console.error('[nyxcorebtns] handler error:', e && e.message) }
    }
  }
  const off = () => { clearTimeout(timer); sock.ev.off('messages.upsert', listener) }
  sock.ev.on('messages.upsert', listener)
  if (opts.timeout) { timer = setTimeout(off, opts.timeout); timer.unref?.() }
  return off
}

/** Wait for ONE tap. Resolves with { reply, msg } or null on timeout. */
function waitForButton(sock, opts = {}) {
  return new Promise(resolve => {
    let done = false
    const finish = (v) => { if (done) return; done = true; off(); clearTimeout(t); resolve(v) }
    const off = onButton(sock, (reply, msg) => finish({ reply, msg }), { ...opts, once: true, timeout: 0 })
    const t = setTimeout(() => finish(null), opts.timeout || 30000)
  })
}

module.exports = { getButtonReply, getButtonId, onButton, waitForButton, unwrap }
