'use strict'
// Finds the Baileys build the bot is using. NYXCORE Baileys first, then the common alternatives.
// You can force one with setLib(require('your-baileys')).
let cached = null

function setLib(mod) { cached = mod || null }

function getLib() {
  if (cached) return cached
  for (const name of ['@nyxcore/nyxcorebailey', '@whiskeysockets/baileys', 'baileys', '@adiwajshing/baileys']) {
    try {
      const mod = require(name)
      const lib = mod && (mod.generateWAMessageFromContent ? mod : mod.default)
      if (lib && lib.generateWAMessageFromContent) return (cached = lib)
    } catch {}
  }
  throw new Error('NYXCORE Buttons: no Baileys library found. Install @nyxcore/nyxcorebailey or call setLib(require("your-baileys")).')
}

module.exports = { getLib, setLib }
