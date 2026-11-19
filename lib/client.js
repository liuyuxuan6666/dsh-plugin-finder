/**
 * dsh-plugin-finder — client half.
 *
 * A keyword finder for the Plugins page (sidebar › Plugins): a search box in
 * the page header toolbar, Ctrl/Cmd+F to focus it, live filtering of the plugin
 * cards, and Enter to open the first result.
 *
 * The Plugins page belongs to `@deepseek-ai/dsh-client-ui-plugin-manager`. It
 * declares slots for *cards*, *detail sections* and *tabs* — but not for its
 * list-level toolbar. Replacing the page through the keyed `main` slot would
 * shadow shipped UI (every upgrade an opportunity to break install dialogs and
 * per-package configuration pages), which is a bad trade for one search box.
 * So this module anchors on the page's own stable `data-*` contracts instead —
 * the same attributes the shell writes on its JSX, not the hashed CSS-module
 * class names:
 *
 *   [data-plugin-panel]              page root
 *   [data-plugin-toolbar]            header toolbar (refresh + add plugin)
 *   [data-plugin-group]              one group of cards (basic/extensions/bundles/more)
 *   [data-plugin-package="<name>"]   one installed/official bundle card
 *   [data-plugin-item="<id>"]        one official plugin card
 *
 * Behaviour rules, deliberately narrow:
 *
 *   1. Display state only. Filtering sets our own `data-plugin-finder-*`
 *      attributes on cards and groups; nothing is removed, no data is read from
 *      the Host, no request is sent, and an empty query removes every attribute
 *      again so the DOM matches what the shell rendered.
 *   2. Fail open. When the anchors are missing (a future build renamed them),
 *      the page simply has no search box; nothing throws, nothing is hidden.
 *   3. Idempotent writes, so our own DOM edits never re-trigger the sync loop
 *      through the MutationObserver that watches for React re-renders.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-finder',
  factory() {
    'use strict'

    const module = { exports: {} }
    const exports = module.exports

    // ------------------------------------------------------------ constants

    const NS = 'pluginFinder'
    const PAGE_SELECTOR = '[data-plugin-panel]'
    const TOOLBAR_SELECTOR = '[data-plugin-toolbar]:not([hidden])'
    const GROUP_SELECTOR = '[data-plugin-group]'
    const CARD_SELECTOR = '[data-plugin-package],[data-plugin-item]'

    const STYLE_ID = 'dsh-plugin-finder-style'
    const ATTR_ROOT = 'data-plugin-finder'
    const ATTR_PART = 'data-plugin-finder-part'
    const ATTR_ACTIVE = 'data-plugin-finder-active'
    const ATTR_HIDDEN = 'data-plugin-finder-hidden'
    const ATTR_EMPTY_GROUP = 'data-plugin-finder-empty'
    const ATTR_FLASH = 'data-plugin-finder-flash'
    const ATTR_TONE = 'data-plugin-finder-tone'

    const MESSAGES = {
      zh: {
        placeholder: '搜索插件',
        label: '搜索插件：标题、简介或包名',
        hint: '按标题、简介或包名查找；回车打开第一个结果',
        clear: '清除搜索',
        empty: '没有匹配',
        count: '{hits} / {total}',
      },
      en: {
        placeholder: 'Search plugins',
        label: 'Search plugins by title, description or package name',
        hint: 'Matches titles, descriptions and package names; Enter opens the first result',
        clear: 'Clear search',
        empty: 'No match',
        count: '{hits} / {total}',
      },
    }

    const CSS = `
[${ATTR_ROOT}] {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: 208px;
  max-width: 40vw;
  height: 28px;
  padding: 0 6px 0 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.28));
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: var(--dsw-alias-label-primary, inherit);
  transition: border-color 120ms ease, background-color 120ms ease;
}
[${ATTR_ROOT}][${ATTR_ACTIVE}] {
  border-color: var(--dsw-alias-brand-primary, #3f77d8);
  background: var(--dsw-alias-bg-layer-2, transparent);
}
[${ATTR_ROOT}] > [${ATTR_PART}="icon"] {
  display: flex;
  flex: none;
  color: var(--dsw-alias-label-secondary, currentColor);
}
[${ATTR_ROOT}] > input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 1;
}
[${ATTR_ROOT}] > input::placeholder {
  color: var(--dsw-alias-label-secondary, currentColor);
  opacity: 1;
}
[${ATTR_ROOT}] > [${ATTR_PART}="hint"],
[${ATTR_ROOT}] > [${ATTR_PART}="count"] {
  flex: none;
  color: var(--dsw-alias-label-secondary, currentColor);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
[${ATTR_ROOT}] > [${ATTR_PART}="hint"] {
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.28));
  border-radius: 4px;
  font-family: inherit;
}
[${ATTR_ROOT}] > [${ATTR_PART}="count"][${ATTR_TONE}="empty"] {
  color: var(--dsw-alias-state-warn-primary, currentColor);
}
[${ATTR_ROOT}] > [${ATTR_PART}="clear"] {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, currentColor);
  cursor: pointer;
}
[${ATTR_ROOT}] > [${ATTR_PART}="clear"]:hover {
  background: var(--dsw-alias-bg-layer-2, transparent);
  color: var(--dsw-alias-label-primary, currentColor);
}
[${ATTR_ROOT}] > [${ATTR_PART}="clear"]:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: 1px;
}
[${ATTR_ROOT}] > [hidden] {
  display: none !important;
}
[${ATTR_HIDDEN}],
[${ATTR_EMPTY_GROUP}] {
  display: none !important;
}
[${ATTR_FLASH}] {
  border-radius: 10px;
  animation: dsh-plugin-finder-flash 620ms ease-out 2;
}
@keyframes dsh-plugin-finder-flash {
  from { box-shadow: 0 0 0 2px var(--dsw-alias-brand-primary, #3f77d8); }
  to { box-shadow: 0 0 0 9px rgba(63, 119, 216, 0); }
}
@media (prefers-reduced-motion: reduce) {
  [${ATTR_FLASH}] {
    animation: none;
    box-shadow: 0 0 0 2px var(--dsw-alias-brand-primary, #3f77d8);
  }
}
`.trim()

    // ------------------------------------------------------------- helpers

    /** Replace `{name}` placeholders without pulling in a template engine. */
    function format(text, vars) {
      if (vars === undefined) return text
      return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
    }

    function isChinese(tag) {
      return /^zh/i.test(String(tag ?? ''))
    }

    /** Set or remove an empty marker attribute, touching the DOM only on change. */
    function setFlag(node, name, on) {
      if (on) {
        if (!node.hasAttribute(name)) node.setAttribute(name, '')
      } else if (node.hasAttribute(name)) {
        node.removeAttribute(name)
      }
    }

    function setText(node, text) {
      if (node.textContent !== text) node.textContent = text
    }

    /**
     * One card's searchable fields.
     * Title and description come from the shell's own accessible wiring: the
     * card's title button carries `aria-describedby` pointing at the
     * description element, so both survive localization and class renames.
     * @param card - one `[data-plugin-package]` or `[data-plugin-item]` element.
     * @returns The package name/id, the visible title, its description, and the button that opens the card.
     */
    function fieldsOf(card) {
      const id = card.getAttribute('data-plugin-package') ?? card.getAttribute('data-plugin-item') ?? ''
      let title = ''
      let description = ''
      let open = null
      for (const button of card.querySelectorAll('button')) {
        // The enable switch also has an accessible name; the card's title is a plain button.
        if (button.getAttribute('role') !== null) continue
        const label = (button.textContent ?? '').trim()
        if (label === '') continue
        open = button
        title = label
        const describedBy = button.getAttribute('aria-describedby')
        if (describedBy !== null && describedBy !== '') {
          const node = document.getElementById(describedBy)
          if (node !== null) description = (node.textContent ?? '').trim()
        }
        break
      }
      return { id, title, description, open }
    }

    function haystackOf(card) {
      const fields = fieldsOf(card)
      return `${fields.id}\n${fields.title}\n${fields.description}`.toLowerCase()
    }

    /** Space-separated terms, ANDed; an empty query is no filter at all. */
    function termsOf(query) {
      return query.toLowerCase().split(/\s+/).filter(term => term !== '')
    }

    function matches(haystack, terms) {
      for (const term of terms) if (!haystack.includes(term)) return false
      return true
    }

    // ---------------------------------------------------------- translator

    function createTranslator(ctx) {
      let translate = null
      try {
        ctx.locale.register(NS, 'zh', MESSAGES.zh)
        ctx.locale.register(NS, 'en', MESSAGES.en)
        translate = ctx.locale.bind(NS)
      } catch (error) {
        // A locale that is already registered, or a context without the service.
        translate = null
      }
      const activeLanguage = () => {
        try {
          return ctx.locale.getSnapshot().active
        } catch (error) {
          return null
        }
      }
      return {
        /** True when the visible language prefers Chinese copy. */
        chinese() {
          return isChinese(activeLanguage() ?? (typeof navigator === 'undefined' ? '' : navigator.language))
        },
        /** One message key with `{name}` interpolation. */
        t(key, vars) {
          let text
          if (translate !== null) {
            try {
              text = translate(key)
            } catch (error) {
              text = undefined
            }
          }
          if (typeof text !== 'string' || text === key) {
            const dict = this.chinese() ? MESSAGES.zh : MESSAGES.en
            text = dict[key] ?? MESSAGES.en[key] ?? key
          }
          return format(text, vars)
        },
      }
    }

    // -------------------------------------------------------------- finder

    function createFinder(ctx) {
      const i18n = createTranslator(ctx)
      const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')
      const shortcut = mac ? '⌘ F' : 'Ctrl F'

      const state = {
        /** The current query; it outlives card re-renders and detail-page visits. */
        query: '',
        /** Whether card attributes are currently applied (so clearing is skipped when nothing is filtered). */
        filtered: false,
        /** The mounted control, or null when the list view is not on screen. */
        control: null,
        /** Timestamp of the last keystroke, used to restore focus after a re-render. */
        typedAt: 0,
        frame: 0,
        flashTimer: 0,
      }

      // ---------------------------------------------------------- styles

      function ensureStyle() {
        if (document.getElementById(STYLE_ID) !== null) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        document.head.append(style)
      }

      // -------------------------------------------------------- the control

      function paintLabels() {
        const control = state.control
        if (control === null) return
        control.input.placeholder = i18n.t('placeholder')
        control.input.setAttribute('aria-label', i18n.t('label'))
        control.clear.setAttribute('aria-label', i18n.t('clear'))
        control.root.title = `${i18n.t('hint')} · ${shortcut}`
        setText(control.hint, shortcut)
        paintCount()
      }

      function buildControl() {
        const root = document.createElement('div')
        root.setAttribute(ATTR_ROOT, '')
        root.setAttribute('role', 'search')
        // The page header is a desktop window drag region; keep the box clickable there.
        root.setAttribute('data-window-drag-recall', '')

        const icon = document.createElement('span')
        icon.setAttribute(ATTR_PART, 'icon')
        icon.setAttribute('aria-hidden', 'true')
        icon.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">'
          + '<circle cx="7" cy="7" r="4.4" stroke="currentColor" stroke-width="1.4"/>'
          + '<path d="M10.5 10.5 13.9 13.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'

        const input = document.createElement('input')
        input.type = 'text'
        input.setAttribute(ATTR_PART, 'input')
        input.setAttribute('spellcheck', 'false')
        input.setAttribute('autocomplete', 'off')
        input.setAttribute('autocapitalize', 'off')
        input.value = state.query

        const hint = document.createElement('kbd')
        hint.setAttribute(ATTR_PART, 'hint')
        setText(hint, shortcut)

        const count = document.createElement('span')
        count.setAttribute(ATTR_PART, 'count')
        count.setAttribute('aria-live', 'polite')
        count.hidden = true

        const clear = document.createElement('button')
        clear.type = 'button'
        clear.setAttribute(ATTR_PART, 'clear')
        clear.hidden = true
        clear.innerHTML = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">'
          + '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

        root.append(icon, input, hint, count, clear)

        input.addEventListener('input', () => {
          state.query = input.value
          state.typedAt = Date.now()
          schedule()
        })
        input.addEventListener('focus', () => root.setAttribute(ATTR_ACTIVE, ''))
        input.addEventListener('blur', () => root.removeAttribute(ATTR_ACTIVE))
        input.addEventListener('keydown', onControlKeyDown)
        clear.addEventListener('click', () => {
          setQuery('')
          input.focus()
        })

        return { root, input, hint, count, clear }
      }

      function controlFor(bar) {
        const current = state.control
        if (current !== null && current.root.parentElement === bar) return current
        if (current !== null) current.root.remove()

        const control = buildControl()
        state.control = control
        paintLabels()
        bar.insertBefore(control.root, bar.firstChild)

        // React may have replaced the toolbar while the pointer was in the box; if the
        // person was typing a moment ago, put the caret back rather than losing the query's focus.
        if (state.query !== '' && Date.now() - state.typedAt < 4000) {
          control.input.focus()
          const end = control.input.value.length
          try {
            control.input.setSelectionRange(end, end)
          } catch (error) {
            // Input types without a selection API are irrelevant here, but never throw from a repaint.
          }
        }
        return control
      }

      function dropControl() {
        const control = state.control
        if (control === null) return
        control.root.remove()
        state.control = null
      }

      function setQuery(value) {
        const control = state.control
        if (control !== null && control.input.value !== value) control.input.value = value
        state.query = value
        if (value !== '') state.typedAt = Date.now()
        schedule()
      }

      // -------------------------------------------------------- filtering

      function clearFilter(page) {
        for (const card of page.querySelectorAll(CARD_SELECTOR)) {
          card.removeAttribute(ATTR_HIDDEN)
          card.removeAttribute(ATTR_FLASH)
        }
        for (const group of page.querySelectorAll(GROUP_SELECTOR)) group.removeAttribute(ATTR_EMPTY_GROUP)
        state.filtered = false
      }

      function filterPage(page) {
        const terms = termsOf(state.query)
        const active = terms.length > 0
        let hits = 0
        let total = 0

        for (const card of page.querySelectorAll(CARD_SELECTOR)) {
          total += 1
          const hit = !active || matches(haystackOf(card), terms)
          if (hit) hits += 1
          setFlag(card, ATTR_HIDDEN, active && !hit)
        }
        // A group with no surviving card becomes an empty shell: hide its title too.
        for (const group of page.querySelectorAll(GROUP_SELECTOR)) {
          let alive = false
          for (const card of group.querySelectorAll(CARD_SELECTOR)) {
            if (!card.hasAttribute(ATTR_HIDDEN)) {
              alive = true
              break
            }
          }
          setFlag(group, ATTR_EMPTY_GROUP, active && !alive)
        }
        state.filtered = active
        return { hits, total, active }
      }

      function firstHit(page) {
        for (const card of page.querySelectorAll(CARD_SELECTOR)) {
          if (!card.hasAttribute(ATTR_HIDDEN)) return card
        }
        return null
      }

      function openFirst(page) {
        const card = firstHit(page)
        if (card === null) return
        const fields = fieldsOf(card)
        if (fields.open !== null) fields.open.click()
      }

      function flashFirst(page) {
        const card = firstHit(page)
        if (card === null) return
        if (typeof card.scrollIntoView === 'function') {
          try {
            card.scrollIntoView({ block: 'center', behavior: 'smooth' })
          } catch (error) {
            card.scrollIntoView()
          }
        }
        card.setAttribute(ATTR_FLASH, '')
        window.clearTimeout(state.flashTimer)
        state.flashTimer = window.setTimeout(() => card.removeAttribute(ATTR_FLASH), 1500)
      }

      function paintCount() {
        const control = state.control
        if (control === null) return
        const active = state.query !== ''
        const result = state.result ?? { hits: 0, total: 0 }
        // No cards on screen yet (first paint, a refresh, an empty profile): an empty list
        // is not a failed search, so stay quiet instead of claiming "no match".
        const loading = active && result.total === 0
        if (!active || loading) {
          if (!control.count.hidden) control.count.hidden = true
          if (!control.clear.hidden) control.clear.hidden = !active
          if (control.hint.hidden !== active) control.hint.hidden = active
          if (!active) setText(control.count, '')
          return
        }
        if (control.hint.hidden !== true) control.hint.hidden = true
        if (control.clear.hidden) control.clear.hidden = false
        if (control.count.hidden) control.count.hidden = false
        setText(control.count, result.hits === 0 ? i18n.t('empty') : i18n.t('count', { hits: result.hits, total: result.total }))
        const tone = result.hits === 0 ? 'empty' : ''
        if (tone === '') {
          if (control.count.hasAttribute(ATTR_TONE)) control.count.removeAttribute(ATTR_TONE)
        } else if (control.count.getAttribute(ATTR_TONE) !== tone) {
          control.count.setAttribute(ATTR_TONE, tone)
        }
      }

      // ------------------------------------------------------------ sync

      function sync() {
        const page = document.querySelector(PAGE_SELECTOR)
        if (page === null) {
          dropControl()
          return
        }
        const bar = page.querySelector(TOOLBAR_SELECTOR)
        if (bar === null) {
          // Detail pages carry no list toolbar; the query is kept for the way back.
          dropControl()
          return
        }
        ensureStyle()
        const control = controlFor(bar)
        const wasActive = state.filtered
        if (state.query === '') {
          if (state.filtered) clearFilter(page)
          state.result = { hits: 0, total: page.querySelectorAll(CARD_SELECTOR).length, active: false }
        } else {
          state.result = filterPage(page)
        }
        // A search starts at the top of the list: results above a scrolled viewport look like no results.
        if (!wasActive && state.query !== '') {
          const body = page.querySelector('[data-plugin-body]')
          if (body !== null && body.scrollTop > 0) body.scrollTop = 0
        }
        paintCount()
        if (control.input.value !== state.query) control.input.value = state.query
      }

      function schedule() {
        if (state.frame !== 0) return
        state.frame = window.requestAnimationFrame(() => {
          state.frame = 0
          try {
            sync()
          } catch (error) {
            // Fail open: a broken sync must never take the Plugins page down with it.
            if (typeof console !== 'undefined') console.debug('[dsh-plugin-finder]', error)
          }
        })
      }

      // ------------------------------------------------------- shortcuts

      function focusBox() {
        const control = state.control
        if (control === null) return false
        control.input.focus()
        const value = control.input.value
        try {
          control.input.setSelectionRange(value.length, value.length)
        } catch (error) {
          // No selection API; focus alone is enough.
        }
        return true
      }

      function onWindowKeyDown(event) {
        if (event.defaultPrevented === true || event.isComposing === true) return
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
        if (event.key !== 'f' && event.key !== 'F' && event.code !== 'KeyF') return
        const control = state.control
        if (control === null || !control.root.isConnected) return
        event.preventDefault()
        event.stopPropagation()
        focusBox()
      }

      function onControlKeyDown(event) {
        if (event.isComposing === true) return
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          if (state.query !== '') setQuery('')
          else event.currentTarget.blur()
          return
        }
        if (event.key !== 'Enter') return
        const page = document.querySelector(PAGE_SELECTOR)
        if (page === null) return
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) flashFirst(page)
        else openFirst(page)
      }

      // -------------------------------------------------------- lifecycle

      function start() {
        ensureStyle()
        const observer = new MutationObserver(schedule)
        // Child list: React re-renders cards, groups and the toolbar.
        // aria-busy: the list finished (or started) loading, which decides whether the counter speaks.
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] })
        window.addEventListener('keydown', onWindowKeyDown, true)

        let unsubscribeLocale = null
        try {
          unsubscribeLocale = ctx.locale.subscribe(() => {
            paintLabels()
            schedule()
          })
        } catch (error) {
          unsubscribeLocale = null
        }
        schedule()

        return () => {
          observer.disconnect()
          window.removeEventListener('keydown', onWindowKeyDown, true)
          if (typeof unsubscribeLocale === 'function') unsubscribeLocale()
          window.clearTimeout(state.flashTimer)
          if (state.frame !== 0) window.cancelAnimationFrame(state.frame)
          state.frame = 0
          const page = document.querySelector(PAGE_SELECTOR)
          if (page !== null) clearFilter(page)
          dropControl()
          document.getElementById(STYLE_ID)?.remove()
        }
      }

      return { start }
    }

    // ---------------------------------------------------------------- export

    function apply(ctx) {
      ctx.effect(() => {
        const finder = createFinder(ctx)
        return finder.start()
      })
    }

    exports.apply = apply
    exports.inject = ['locale']
    return module.exports
  },
})
