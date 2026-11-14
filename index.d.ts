export interface NativeButton { name: string; buttonParamsJson: string }

export type ButtonInput =
  | NativeButton
  | { id: string; text: string }
  | { buttonId: string; buttonText: { displayText: string } }
  | { type: 'url'; text: string; url: string; merchant_url?: string }
  | { type: 'copy'; text: string; code: string }
  | { type: 'call'; text: string; phone: string }
  | { type: 'location'; text?: string }
  | { type: 'list'; text?: string; sections?: ListSection[]; rows?: ListRow[] }

export interface ListRow { id: string; title: string; description?: string; header?: string }
export interface ListSection { title?: string; highlight_label?: string; rows: ListRow[] }

export interface ButtonOptions {
  title?: string
  subtitle?: string
  text?: string
  body?: string
  footer?: string
  /** image to show above the buttons (URL, Buffer or { url }) */
  image?: string | Buffer | { url: string }
  video?: string | Buffer | { url: string }
  buttons?: ButtonInput[]
  /** alias of buttons (gifted-btns style) */
  interactiveButtons?: ButtonInput[]
  mentions?: string[]
  contextInfo?: Record<string, unknown>
  /** set to false to throw instead of falling back to plain text */
  fallback?: boolean
}

export interface SendOptions { quoted?: any; [k: string]: unknown }
export interface SentMessage { key: any; message?: any; nyxMode?: 'native' | 'text'; [k: string]: any }

export function sendButtons(sock: any, jid: string, options: ButtonOptions, sendOptions?: SendOptions): Promise<SentMessage>
export function sendInteractiveMessage(sock: any, jid: string, options: ButtonOptions, sendOptions?: SendOptions): Promise<SentMessage>
export function sendNative(sock: any, jid: string, options: ButtonOptions, sendOptions?: SendOptions): Promise<SentMessage>
export function sendList(sock: any, jid: string, options: Omit<ButtonOptions, 'buttons'> & { buttonText?: string; sections?: ListSection[]; rows?: ListRow[] }, sendOptions?: SendOptions): Promise<SentMessage>
export function sendQuickReplies(sock: any, jid: string, text: string, replies: (string | { id: string; text: string })[], options?: ButtonOptions, sendOptions?: SendOptions): Promise<SentMessage>
export function sendCopy(sock: any, jid: string, text: string, label: string, code: string, options?: ButtonOptions, sendOptions?: SendOptions): Promise<SentMessage>
export function sendUrl(sock: any, jid: string, text: string, label: string, url: string, options?: ButtonOptions, sendOptions?: SendOptions): Promise<SentMessage>

export function quickReply(text: string, id?: string): NativeButton
export function copy(text: string, code: string): NativeButton
export function url(text: string, link: string, merchant?: string): NativeButton
export function call(text: string, phone: string): NativeButton
export function location(text?: string): NativeButton
export function list(title: string, sections: ListSection[] | ListRow[]): NativeButton
export const btn: { quickReply: typeof quickReply; copy: typeof copy; url: typeof url; call: typeof call; location: typeof location; list: typeof list }
export function normalizeButton(b: ButtonInput, index?: number): NativeButton | null

export interface ButtonReply { id: string; title: string; type: 'native' | 'buttons' | 'list' | 'template'; params: Record<string, any> }
export function getButtonReply(msg: any): ButtonReply | null
export function getButtonId(msg: any): string | null
export function onButton(sock: any, handler: (reply: ButtonReply, msg: any) => void | Promise<void>, options?: { jid?: string; from?: string | string[]; ids?: string[] | RegExp | string; once?: boolean; timeout?: number }): () => void
export function waitForButton(sock: any, options?: { jid?: string; from?: string | string[]; ids?: string[] | RegExp | string; timeout?: number }): Promise<{ reply: ButtonReply; msg: any } | null>

export function renderText(options: ButtonOptions): string
export function routingNodes(jid: string): any[]
export function setLib(lib: any): void
export function getLib(): any
