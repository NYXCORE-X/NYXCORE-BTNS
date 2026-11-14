'use strict'
const b = require('./lib/builders')
const s = require('./lib/send')
const r = require('./lib/respond')
const { renderText } = require('./lib/fallback')
const { setLib, getLib } = require('./lib/baileys')

module.exports = {
  // sending (gifted-btns compatible names first)
  sendButtons: s.sendButtons,
  sendInteractiveMessage: s.sendInteractiveMessage,
  sendList: s.sendList,
  sendQuickReplies: s.sendQuickReplies,
  sendCopy: s.sendCopy,
  sendUrl: s.sendUrl,
  sendNative: s.sendNative,
  // button builders
  btn: { quickReply: b.quickReply, copy: b.copy, url: b.url, call: b.call, location: b.location, list: b.list },
  quickReply: b.quickReply, copy: b.copy, url: b.url, call: b.call, location: b.location, list: b.list,
  normalizeButton: b.normalize,
  // tap handling
  getButtonReply: r.getButtonReply,
  getButtonId: r.getButtonId,
  onButton: r.onButton,
  waitForButton: r.waitForButton,
  // misc
  renderText,
  routingNodes: s.routingNodes,
  setLib,
  getLib,
}
