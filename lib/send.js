'use strict'
const { getLib } = require('./baileys')
const { normalize } = require('./builders')
const { renderText } = require('./fallback')

const DEBUG = () => !!process.env.NYXCORE_BTNS_DEBUG

/** WhatsApp only shows native-flow buttons to other people when the stanza carries this routing node. */
function routingNodes(jid) {
  const nodes = [{
    tag: 'biz', attrs: {},
    content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }],
  }]
  // one-to-one chats also need the bot marker (same as WhatsApp Web)
  if (!/@(g\.us|newsletter|broadcast)$/.test(String(jid))) nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } })
  return nodes
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
  const content = {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage,
      },
    },
  }
  const message = lib.generateWAMessageFromContent(jid, content, { userJid: sock.user?.id })
  await sock.relayMessage(jid, message.message, { messageId: message.key.id, additionalNodes: routingNodes(jid) })
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
