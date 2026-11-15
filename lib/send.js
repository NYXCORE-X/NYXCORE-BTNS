'use strict'
const { getLib } = require('./baileys')
const { normalize } = require('./builders')
const { renderText } = require('./fallback')

const DEBUG = () => !!process.env.NYXCORE_BTNS_DEBUG

const crypto = require('crypto')

const SINGLE_FLOWS = new Set(['mpm', 'cta_catalog', 'send_location', 'call_permission_request', 'wa_payment_transaction_details', 'automated_greeting_message_view_catalog', 'form_message'])

/**
 * WhatsApp only shows native-flow buttons to other people when the stanza carries this routing node.
 * Mirrors the current WhatsApp Web format: biz attrs + interactive/native_flow + quality_control.
 */
function routingNodes(jid, buttons) {
  const first = buttons && buttons[0] && buttons[0].name
  const flow = first && SINGLE_FLOWS.has(first)
    ? { tag: 'native_flow', attrs: first === 'form_message' ? { name: first } : { v: '2', name: first } }
    : { tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }
  return [{
    tag: 'biz',
    attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: String(Math.floor(Date.now() / 1000)) },
    content: [
      { tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [flow] },
      {
        tag: 'quality_control',
        attrs: { decision_id: crypto.randomBytes(20).toString('hex'), source_type: 'third_party' },
        content: [{ tag: 'decision_source', attrs: { value: 'df' } }],
      },
    ],
  }]
}

function contextFor(opts, sendOptions) {
  const ctx = { ...(opts.contextInfo || {}) }
  const q = sendOptions?.quoted || opts.quoted
  if (q?.key && q?.message) {
    ctx.stanzaId = q.key.id
    ctx.participant = q.key.participant || q.key.remoteJid
    ctx.quotedMessage = q.message
    ctx.remoteJid = q.key.remoteJid
  }
  if (opts.mentions?.length) ctx.mentionedJid = opts.mentions
  return ctx
}

async function buildHeader(sock, opts, lib) {
  const header = { title: opts.title || '', subtitle: opts.subtitle || '', hasMediaAttachment: false }
  const media = opts.image ? { image: opts.image } : opts.video ? { video: opts.video } : null
  if (!media) return header
  const key = opts.image ? 'image' : 'video'
  const src = media[key]
  const content = { [key]: typeof src === 'string' ? { url: src } : src }
  if (!lib.prepareWAMessageMedia) throw new Error('this Baileys build cannot prepare media for buttons')
  const prepared = await lib.prepareWAMessageMedia(content, { upload: sock.waUploadToServer })
  return Object.assign(header, prepared, { hasMediaAttachment: true })
}

/** Build + relay a native-flow button message. Throws on failure (see sendButtons for the safe version). */
async function sendNative(sock, jid, opts = {}, sendOptions = {}) {
  const lib = getLib()
  const source = opts.buttons || opts.interactiveButtons || []
  const buttons = source.map(normalize).filter(Boolean)
  if (!buttons.length) throw new Error('no usable buttons')

  const interactiveMessage = {
    body: { text: String(opts.text ?? opts.body ?? ' ') },
    footer: { text: String(opts.footer || '') },
    header: await buildHeader(sock, opts, lib),
    nativeFlowMessage: { buttons, messageParamsJson: '' },
    contextInfo: contextFor(opts, sendOptions),
  }
  const isPrivate = !/@(g\.us|newsletter|broadcast)$/.test(String(jid))
  const messageContextInfo = { messageSecret: crypto.randomBytes(32) }
  if (isPrivate) {
    messageContextInfo.deviceListMetadata = { recipientKeyHash: crypto.randomBytes(10), recipientTimestamp: Math.floor(Date.now() / 1000) }
    messageContextInfo.deviceListMetadataVersion = 2
  }
  // current WhatsApp expects a bare interactiveMessage; { wrap: true } restores the old viewOnce wrapper
  const content = opts.wrap
    ? { viewOnceMessage: { message: { messageContextInfo, interactiveMessage } } }
    : { messageContextInfo, interactiveMessage }
  const message = lib.generateWAMessageFromContent(jid, content, { userJid: sock.user?.id })
  await sock.relayMessage(jid, message.message, { messageId: message.key.id, additionalNodes: routingNodes(jid, buttons) })
  message.nyxMode = 'native'
  return message
}

/**
 * Send buttons. If WhatsApp or the library rejects the interactive message, falls back to a plain
 * text message with every link / copy code in it (so a command never goes silent).
 * Pass { fallback: false } in the options to get the error instead.
 */
async function sendButtons(sock, jid, opts = {}, sendOptions = {}) {
  try {
    return await sendNative(sock, jid, opts, sendOptions)
  } catch (err) {
    const reason = err && err.message ? err.message : String(err)
    console.error('[nyxcorebtns] interactive send failed:', reason)
    if (DEBUG() && err && err.stack) console.error(err.stack)
    if (opts.fallback === false) throw err
    const sent = await sock.sendMessage(jid, { text: renderText(opts), ...(opts.mentions?.length ? { mentions: opts.mentions } : {}) }, sendOptions)
    if (sent && typeof sent === 'object') sent.nyxMode = 'text'
    return sent
  }
}

/** a "tap to pick" list: sendList(sock, jid, { text, footer, title, buttonText, sections | rows }) */
function sendList(sock, jid, opts = {}, sendOptions = {}) {
  const { list } = require('./builders')
  return sendButtons(sock, jid, { ...opts, buttons: [list(opts.buttonText || 'Open menu', opts.sections || opts.rows || [])] }, sendOptions)
}

/** one or more quick-reply buttons: sendQuickReplies(sock, jid, 'Pick one', [{ id, text }]) */
function sendQuickReplies(sock, jid, text, replies = [], opts = {}, sendOptions = {}) {
  return sendButtons(sock, jid, { ...opts, text, buttons: replies.map(r => normalize(typeof r === 'string' ? { id: r, text: r } : r)) }, sendOptions)
}

/** a single copy button */
function sendCopy(sock, jid, text, label, code, opts = {}, sendOptions = {}) {
  const { copy } = require('./builders')
  return sendButtons(sock, jid, { ...opts, text, buttons: [copy(label, code)] }, sendOptions)
}

/** a single link button */
function sendUrl(sock, jid, text, label, link, opts = {}, sendOptions = {}) {
  const { url } = require('./builders')
  return sendButtons(sock, jid, { ...opts, text, buttons: [url(label, link)] }, sendOptions)
}

module.exports = { sendNative, sendButtons, sendInteractiveMessage: sendButtons, sendList, sendQuickReplies, sendCopy, sendUrl, routingNodes }
