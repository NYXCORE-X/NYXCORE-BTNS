'use strict'
const test = require('node:test')
const assert = require('node:assert')
const EventEmitter = require('node:events')
const B = require('../index.js')

// a tiny fake Baileys: generateWAMessageFromContent just wraps the content
const fakeLib = {
  generateWAMessageFromContent: (jid, content, o) => ({ key: { id: 'MSGID', remoteJid: jid, fromMe: true }, message: content, userJid: o.userJid }),
  prepareWAMessageMedia: async (c) => ({ imageMessage: { url: 'uploaded', from: Object.keys(c)[0] } }),
}
B.setLib(fakeLib)

const makeSock = (relayFail) => {
  const sock = { user: { id: '1@s.whatsapp.net' }, ev: new EventEmitter(), relayed: [], texts: [], waUploadToServer: () => {} }
  sock.relayMessage = async (jid, message, opts) => { if (relayFail) throw new Error(relayFail); sock.relayed.push({ jid, message, opts }) }
  sock.sendMessage = async (jid, content, opts) => { sock.texts.push({ jid, content, opts }); return { key: { id: 'T' } } }
  return sock
}

test('builders produce native-flow params', () => {
  assert.deepStrictEqual(JSON.parse(B.btn.quickReply('Hi', 'a').buttonParamsJson), { display_text: 'Hi', id: 'a' })
  assert.strictEqual(B.btn.copy('Copy', 'XYZ').name, 'cta_copy')
  assert.strictEqual(JSON.parse(B.btn.url('Open', 'https://a.b').buttonParamsJson).merchant_url, 'https://a.b')
  assert.strictEqual(B.btn.call('Call', '+234').name, 'cta_call')
  const l = JSON.parse(B.btn.list('Menu', [{ title: 'S', rows: [{ id: 'r1', title: 'One', description: 'd' }] }]).buttonParamsJson)
  assert.strictEqual(l.sections[0].rows[0].id, 'r1')
  const flat = JSON.parse(B.btn.list('Menu', [{ id: 'x', title: 'X' }]).buttonParamsJson)
  assert.strictEqual(flat.sections[0].rows[0].id, 'x')
})

test('long labels are clipped', () => {
  const p = JSON.parse(B.btn.quickReply('A'.repeat(60), 'id').buttonParamsJson)
  assert.ok(p.display_text.length <= 25)
})

test('normalize accepts the shapes people use', () => {
  assert.strictEqual(B.normalizeButton({ id: 'a', text: 'A' }).name, 'quick_reply')
  assert.strictEqual(B.normalizeButton({ buttonId: 'b', buttonText: { displayText: 'B' } }).name, 'quick_reply')
  assert.strictEqual(B.normalizeButton({ type: 'url', text: 'U', url: 'https://x.y' }).name, 'cta_url')
  assert.strictEqual(B.normalizeButton({ type: 'copy', text: 'C', code: '1' }).name, 'cta_copy')
  assert.strictEqual(B.normalizeButton({ name: 'x', buttonParamsJson: '{}' }).name, 'x')
})

test('sendButtons relays a native-flow message with the routing nodes', async () => {
  const sock = makeSock()
  const msg = await B.sendButtons(sock, '123@g.us', { title: 'T', text: 'Body', footer: 'F', buttons: [B.btn.quickReply('Go', 'go')] })
  assert.strictEqual(msg.nyxMode, 'native')
  const r = sock.relayed[0]
  const im = r.message.viewOnceMessage.message.interactiveMessage
  assert.strictEqual(im.body.text, 'Body')
  assert.strictEqual(im.footer.text, 'F')
  assert.strictEqual(im.nativeFlowMessage.buttons[0].name, 'quick_reply')
  assert.strictEqual(r.message.viewOnceMessage.message.messageContextInfo.deviceListMetadataVersion, 2)
  assert.strictEqual(r.opts.messageId, 'MSGID')
  assert.deepStrictEqual(r.opts.additionalNodes.map(n => n.tag), ['biz']) // group: no bot node
})

test('private chats also get the bot marker', async () => {
  const sock = makeSock()
  await B.sendButtons(sock, '234@s.whatsapp.net', { text: 'x', buttons: [B.btn.copy('c', '1')] })
  assert.deepStrictEqual(sock.relayed[0].opts.additionalNodes.map(n => n.tag), ['biz', 'bot'])
})

test('quoted + mentions go into contextInfo', async () => {
  const sock = makeSock()
  const quoted = { key: { id: 'Q', remoteJid: '9@s.whatsapp.net' }, message: { conversation: 'hey' } }
  await B.sendButtons(sock, '9@s.whatsapp.net', { text: 'x', mentions: ['5@s.whatsapp.net'], buttons: [B.btn.quickReply('a', 'a')] }, { quoted })
  const ctx = sock.relayed[0].message.viewOnceMessage.message.interactiveMessage.contextInfo
  assert.strictEqual(ctx.stanzaId, 'Q')
  assert.deepStrictEqual(ctx.mentionedJid, ['5@s.whatsapp.net'])
})

test('image header is uploaded and attached', async () => {
  const sock = makeSock()
  await B.sendButtons(sock, '9@s.whatsapp.net', { text: 'x', image: 'https://img/x.png', buttons: [B.btn.quickReply('a', 'a')] })
  const h = sock.relayed[0].message.viewOnceMessage.message.interactiveMessage.header
  assert.strictEqual(h.hasMediaAttachment, true)
  assert.strictEqual(h.imageMessage.url, 'uploaded')
})

test('falls back to text (with links and copy codes) when the send fails', async () => {
  const sock = makeSock('boom')
  const origErr = console.error; console.error = () => {}
  const msg = await B.sendButtons(sock, '9@s.whatsapp.net', { title: 'T', text: 'Body', buttons: [B.btn.url('Site', 'https://a.b'), B.btn.copy('Code', 'ABC')] })
  console.error = origErr
  assert.strictEqual(msg.nyxMode, 'text')
  const t = sock.texts[0].content.text
  assert.ok(t.includes('https://a.b') && t.includes('ABC') && t.includes('Body'))
})

test('fallback:false throws instead', async () => {
  const sock = makeSock('boom')
  const origErr = console.error; console.error = () => {}
  await assert.rejects(() => B.sendButtons(sock, '9@s.whatsapp.net', { text: 'x', fallback: false, buttons: [B.btn.quickReply('a', 'a')] }), /boom/)
  console.error = origErr
})

test('sendList builds a single_select', async () => {
  const sock = makeSock()
  await B.sendList(sock, '9@s.whatsapp.net', { text: 'Pick', buttonText: 'Open', sections: [{ title: 'A', rows: [{ id: '1', title: 'One' }] }] })
  const btn = sock.relayed[0].message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0]
  assert.strictEqual(btn.name, 'single_select')
})

test('reads taps from every reply type', () => {
  const native = { message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: 'row_3', title: 'Three' }) } } } }
  assert.deepStrictEqual(B.getButtonReply(native).id, 'row_3')
  assert.strictEqual(B.getButtonId({ message: { buttonsResponseMessage: { selectedButtonId: 'b1' } } }), 'b1')
  assert.strictEqual(B.getButtonId({ message: { listResponseMessage: { singleSelectReply: { selectedRowId: 'l1' } } } }), 'l1')
  assert.strictEqual(B.getButtonId({ message: { templateButtonReplyMessage: { selectedId: 't1' } } }), 't1')
  assert.strictEqual(B.getButtonId({ message: { ephemeralMessage: { message: native.message } } }), 'row_3')
  assert.strictEqual(B.getButtonId({ message: { conversation: 'hi' } }), null)
})

test('onButton filters by chat, sender and id, and can stop', async () => {
  const sock = makeSock()
  const seen = []
  const off = B.onButton(sock, (r) => seen.push(r.id), { jid: 'g@g.us', ids: /^menu_/, from: '5@s.whatsapp.net' })
  const tap = (id, jid, who) => sock.ev.emit('messages.upsert', { messages: [{ key: { remoteJid: jid, participant: who }, message: { buttonsResponseMessage: { selectedButtonId: id } } }] })
  tap('menu_1', 'g@g.us', '5:3@s.whatsapp.net')   // ok (device suffix ignored)
  tap('other', 'g@g.us', '5@s.whatsapp.net')      // wrong id
  tap('menu_2', 'x@g.us', '5@s.whatsapp.net')     // wrong chat
  tap('menu_3', 'g@g.us', '6@s.whatsapp.net')     // wrong sender
  await new Promise(r => setImmediate(r))
  assert.deepStrictEqual(seen, ['menu_1'])
  off(); tap('menu_4', 'g@g.us', '5@s.whatsapp.net'); await new Promise(r => setImmediate(r))
  assert.deepStrictEqual(seen, ['menu_1'])
})

test('waitForButton resolves with the tap, or null on timeout', async () => {
  const sock = makeSock()
  const p = B.waitForButton(sock, { jid: 'c@s.whatsapp.net', timeout: 500 })
  sock.ev.emit('messages.upsert', { messages: [{ key: { remoteJid: 'c@s.whatsapp.net' }, message: { buttonsResponseMessage: { selectedButtonId: 'yes' } } }] })
  assert.strictEqual((await p).reply.id, 'yes')
  assert.strictEqual(await B.waitForButton(sock, { jid: 'c@s.whatsapp.net', timeout: 30 }), null)
})
