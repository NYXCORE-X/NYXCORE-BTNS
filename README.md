<div align="center">

# NYXCORE Buttons

**Reliable WhatsApp buttons, lists and click handling for Baileys bots.**

`@nyxcore/nyxcorebtns` · plain JavaScript (types included) · MIT

</div>

Everything a bot needs to send real tappable WhatsApp messages — quick replies, copy / link / call buttons, tap-to-pick lists, image headers — and to read what people tapped. If WhatsApp or the library rejects an interactive message, it falls back to a plain-text version with every link and copy code in it, so a command never goes silent.

Works with `@nyxcore/nyxcorebailey` (recommended), `@whiskeysockets/baileys` and `baileys`.

## Install

```bash
npm install @nyxcore/nyxcorebtns
```

## Send buttons

```js
const { sendButtons, btn } = require('@nyxcore/nyxcorebtns')

await sendButtons(sock, jid, {
  title: 'LIGHT MD',
  text: 'Pick something',
  footer: 'NYXCORE',
  buttons: [
    btn.quickReply('📋 Menu', '.menu'),
    btn.copy('Copy prefix', '.'),
    btn.url('Website', 'https://example.com'),
    btn.call('Call us', '+2348000000000'),
  ],
}, { quoted: msg })
```

Other button shapes work too (`{ id, text }`, `{ type: 'url', text, url }`, …), and it accepts the gifted-btns names `sendButtons` / `sendInteractiveMessage` with `interactiveButtons`, so existing code keeps working.

### Lists

```js
const { sendList } = require('@nyxcore/nyxcorebtns')

await sendList(sock, jid, {
  title: '⚡ MENU',
  text: 'Tap to browse',
  footer: 'NYXCORE',
  buttonText: '📋 Open Menu',
  sections: [{ title: 'Categories', rows: [
    { id: 'cat_1', title: '🎮 FUN', description: '64 commands' },
    { id: 'cat_2', title: '💰 ECONOMY', description: '40 commands' },
  ] }],
}, { quoted: msg })
```

### Shortcuts

```js
sendQuickReplies(sock, jid, 'Do you agree?', [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }])
sendCopy(sock, jid, 'Your code', '📋 Copy', 'ABC-123')
sendUrl(sock, jid, 'Read more', '🔗 Open', 'https://example.com')
```

An `image` (URL, Buffer or `{ url }`) or `video` option adds a picture above the buttons.

## Read taps

```js
const { onButton, waitForButton, getButtonReply } = require('@nyxcore/nyxcorebtns')

// every tap whose id starts with "cat_" in this chat, for 10 minutes
const stop = onButton(sock, async (reply, msg) => {
  await sock.sendMessage(msg.key.remoteJid, { text: `You picked ${reply.title} (${reply.id})` })
}, { jid, ids: /^cat_/, timeout: 10 * 60 * 1000 })

// wait for one tap from one person
const tap = await waitForButton(sock, { jid, from: sender, ids: ['yes', 'no'], timeout: 30000 })
if (tap) console.log(tap.reply.id)

// or read it from any incoming message yourself
sock.ev.on('messages.upsert', ({ messages }) => {
  const reply = getButtonReply(messages[0])   // { id, title, type } or null
})
```

Quick-reply, list, classic-button and template replies are all understood.

## How it stays visible to everyone

WhatsApp only shows native-flow buttons to other people when the message carries a `<biz>` routing node (plus a `<bot>` marker in one-to-one chats). This package adds both on every send, so buttons show up in groups and for other users, not just on your own phone.

## Options

| Option | What it does |
|---|---|
| `title`, `subtitle`, `text`, `footer` | the card's text |
| `buttons` / `interactiveButtons` | the buttons |
| `image` / `video` | media header |
| `mentions` | JIDs to mention in the text |
| `fallback: false` | throw instead of falling back to text |

The returned message has `nyxMode`: `'native'` when buttons were sent, `'text'` when the fallback was used. Set `NYXCORE_BTNS_DEBUG=1` to print full error stacks.

If your Baileys isn't auto-detected, call `setLib(require('your-baileys'))` once.

## Notes

- Button labels are clipped to 25 characters and list titles to 24, as WhatsApp requires.
- WhatsApp changes how it renders interactive messages from time to time. If a style stops showing, the text fallback keeps your command working while you update.
- Not affiliated with or endorsed by WhatsApp.

## License

MIT © NYXCORE
