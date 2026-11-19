/**
 * Test harness: a jsdom page whose markup mirrors what
 * `@deepseek-ai/dsh-client-ui-plugin-manager` really renders (attributes and
 * nesting copied from the shell's JSX), plus a stub Client context with just the
 * two services this plugin touches.
 *
 * The fixture is the contract under test: it uses only the `data-*` anchors and
 * the accessible wiring (`aria-label`, `aria-describedby`) the plugin relies on.
 * Hashed CSS-module class names are deliberately absent — the plugin must never
 * need them.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
export const CLIENT_SOURCE = readFileSync(join(here, '..', 'lib', 'client.js'), 'utf8')

/** One card, shaped like the shell's bundle card (or official plugin card). */
export function cardTemplate({ name, title, description, official = false, status = 'enabled' }) {
  const describedBy = `desc-${title.replace(/[^\w\u4e00-\u9fa5]+/g, '-')}`
  const anchor = official ? `data-plugin-item="${name}"` : `data-plugin-package="${name}" data-plugin-status="${status}"`
  return `
    <li ${anchor}>
      <div>
        <span aria-hidden="true"></span>
        <div>
          <div>
            <button type="button" aria-label="查看 ${title}" aria-describedby="${describedBy}">${title}</button>
            <span data-tone="info">实验性</span>
          </div>
          <span id="${describedBy}">${description}</span>
        </div>
        <div>
          <button type="button" role="switch" aria-checked="false" aria-label="启用 ${title}"></button>
        </div>
      </div>
    </li>`
}

/** The whole Plugins page: header toolbar, groups of cards, and an optional toolbar. */
export function pageHtml({ groups, toolbar = true } = {}) {
  const rendered = groups.map(group => `
      <section data-plugin-scope="global" data-plugin-group="${group.id}">
        <div><h3>${group.title}</h3><button type="button">更多</button></div>
        <ul>${group.cards.map(cardTemplate).join('')}</ul>
      </section>`).join('')
  const header = toolbar
    ? `<div data-plugin-bar>
        <header data-window-drag>
          <div><h1 data-plugin-header-part="title">插件</h1></div>
          <div data-plugin-toolbar data-plugin-header-part="toolbar">
            <button type="button" aria-label="刷新" aria-busy="false">刷新</button>
            <span role="group" aria-label="添加插件"><button type="button" aria-label="添加插件">添加插件</button></span>
          </div>
        </header>
      </div>`
    : ''
  return `<!doctype html><html lang="zh-CN"><head></head><body>
    <main>
      <section data-plugin-panel>
        <div data-plugin-body>
          ${header}
          <div data-plugin-installed>${rendered}</div>
        </div>
      </section>
    </main>
  </body></html>`
}

/** Three groups worth of realistic cards. */
export const DEFAULT_GROUPS = [
  {
    id: 'extensions',
    title: '实验性插件',
    cards: [
      { name: '@deepseek-ai/dsh-experimental-voice-input-bundle', title: '语音输入', description: '在本机使用 SenseVoice 转写录音，首次使用需安装依赖。' },
      { name: '@deepseek-ai/dsh-experimental-auto-review', title: '自动授权审查', description: '每次工具调用前由模型检查，获准的调用立即运行。' },
    ],
  },
  {
    id: 'bundles',
    title: '已安装插件',
    cards: [
      { name: 'dsh-sidebar-more', title: '侧栏折叠', description: '把左侧栏的面板入口收进「更多」菜单。', status: 'disabled' },
      { name: 'dsh-tally', title: '待办清单', description: '一个极简的个人待办，支持就地编辑与截止日期。' },
      { name: 'dsh-session-stars', title: '会话星标', description: '给会话加星标并集中列出。' },
    ],
  },
  {
    id: 'basic',
    title: '内置插件',
    cards: [
      { name: 'subagent', title: '子智能体', description: '设置子智能体的递归层级、数量和模型。', official: true },
      { name: 'web-search', title: '网页搜索与获取', description: '选择网页搜索与网页获取使用的提供方。', official: true },
    ],
  },
]

/**
 * Build a jsdom page, evaluate the real client bundle in it, and hand back the
 * applied plugin plus the handles a test needs.
 */
export async function mount({ groups = DEFAULT_GROUPS, toolbar = true, locale = 'zh', source = CLIENT_SOURCE } = {}) {
  const dom = new JSDOM(pageHtml({ groups, toolbar }), {
    url: 'http://127.0.0.1/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  })
  const { window } = dom
  const loaded = []
  window.__ModuleLoader__ = { load: registration => loaded.push(registration) }
  window.eval(source)

  const effects = []
  const localeListeners = []
  const localeService = {
    active: locale,
    dicts: {},
    register(ns, id, dict) {
      this.dicts[id] = dict
    },
    bind() {
      return key => this.dicts[this.active]?.[key] ?? key
    },
    getSnapshot() {
      return { active: this.active, locales: [], revision: 0 }
    },
    subscribe(listener) {
      localeListeners.push(listener)
      return () => {}
    },
  }
  const ctx = {
    locale: localeService,
    effect(fn) {
      effects.push(fn())
    },
  }

  const registration = loaded[0]
  const client = registration.factory()
  client.apply(ctx)

  /** Wait for the rAF-coalesced sync (runs as many frames as asked). */
  const tick = async (times = 3) => {
    for (let index = 0; index < times; index += 1) {
      await new Promise(resolve => window.requestAnimationFrame(() => resolve()))
    }
  }
  await tick()

  return {
    dom,
    window,
    document: window.document,
    client,
    registration,
    ctx,
    locale: localeService,
    localeListeners,
    tick,
    /** The injected search box, if any. */
    box: () => window.document.querySelector('[data-plugin-finder]'),
    input: () => window.document.querySelector('[data-plugin-finder-part="input"]'),
    /** Type a query the way a person does: set the value, fire `input`. */
    async type(query) {
      const input = window.document.querySelector('[data-plugin-finder-part="input"]')
      input.value = query
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
      await tick(2)
    },
    /** Press a key on the focused box. */
    async press(key, init = {}) {
      const input = window.document.querySelector('[data-plugin-finder-part="input"]')
      const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
      input.dispatchEvent(event)
      await tick(2)
      return event
    },
    /** Press a window-level shortcut. */
    async shortcut(key, init = {}) {
      const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
      window.document.dispatchEvent(event)
      await tick(2)
      return event
    },
    /** Card elements currently hidden by the plugin. */
    hidden: () => [...window.document.querySelectorAll('[data-plugin-finder-hidden]')].map(node => node.getAttribute('data-plugin-package') ?? node.getAttribute('data-plugin-item')),
    /** Card elements currently visible. */
    visible: () => [...window.document.querySelectorAll('[data-plugin-package],[data-plugin-item]')]
      .filter(node => !node.hasAttribute('data-plugin-finder-hidden'))
      .map(node => node.getAttribute('data-plugin-package') ?? node.getAttribute('data-plugin-item')),
    count: () => window.document.querySelector('[data-plugin-finder-part="count"]')?.textContent ?? '',
    dispose: () => {
      for (const cleanup of effects.splice(0)) {
        if (typeof cleanup === 'function') cleanup()
      }
    },
    close: () => {
      for (const cleanup of effects.splice(0)) {
        try {
          if (typeof cleanup === 'function') cleanup()
        } catch (error) {
          // A closed window cannot be cleaned twice; tests only care about the live one.
        }
      }
      dom.window.close()
    },
  }
}
