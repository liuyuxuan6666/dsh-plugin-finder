/**
 * Behaviour tests for the Plugins-page finder, run against the real
 * `lib/client.js` inside jsdom with the shell's own `data-*` markup.
 *
 *   node --test test/*.test.mjs
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { DEFAULT_GROUPS, mount } from './harness.mjs'

let live = []

async function open(options) {
  const page = await mount(options)
  live.push(page)
  return page
}

afterEach(() => {
  for (const page of live.splice(0)) page.close()
})

describe('injection', () => {
  it('puts one search box at the head of the list toolbar, before refresh', async () => {
    const page = await open()
    const toolbar = page.document.querySelector('[data-plugin-toolbar]')
    const box = page.box()
    assert.ok(box !== null, 'a search box exists')
    assert.equal(toolbar.firstElementChild, box, 'the box leads the toolbar')
    assert.equal(box.getAttribute('role'), 'search')
    assert.equal(box.hasAttribute('data-window-drag-recall'), true, 'desktop drag region stays clickable')
    assert.equal(toolbar.querySelectorAll('[data-plugin-finder]').length, 1, 'exactly one box')
    assert.equal(page.input().getAttribute('placeholder'), '搜索插件')
  })

  it('leaves no box behind when the list toolbar is absent, and brings it back with the query', async () => {
    const page = await open({ toolbar: false })
    assert.equal(page.box(), null, 'no toolbar, no box')

    const body = page.document.querySelector('[data-plugin-body]')
    body.insertAdjacentHTML('afterbegin', `
      <div data-plugin-bar>
        <header><div data-plugin-toolbar><button aria-label="刷新">刷新</button></div></header>
      </div>`)
    await page.tick(3)
    assert.ok(page.box() !== null, 'box appears with the toolbar')
  })
})

describe('filtering', () => {
  it('matches the title', async () => {
    const page = await open()
    await page.type('星标')
    assert.deepEqual(page.visible(), ['dsh-session-stars'])
  })

  it('matches the description', async () => {
    const page = await open()
    await page.type('SenseVoice')
    assert.deepEqual(page.visible(), ['@deepseek-ai/dsh-experimental-voice-input-bundle'])
  })

  it('matches the package name, case-insensitively', async () => {
    const page = await open()
    await page.type('DSH-TALLY')
    assert.deepEqual(page.visible(), ['dsh-tally'])
  })

  it('matches an official plugin id', async () => {
    const page = await open()
    await page.type('web-search')
    assert.deepEqual(page.visible(), ['web-search'])
  })

  it('ANDs space-separated terms', async () => {
    const page = await open()
    await page.type('dsh 星标')
    assert.deepEqual(page.visible(), ['dsh-session-stars'], 'both terms must hit')
    await page.type('dsh 不存在的词')
    assert.deepEqual(page.visible(), [])
  })

  it('hides groups that lost every card and keeps the ones that kept at least one', async () => {
    const page = await open()
    await page.type('星标')
    const empty = [...page.document.querySelectorAll('[data-plugin-group][data-plugin-finder-empty]')]
      .map(group => group.getAttribute('data-plugin-group'))
    assert.deepEqual(empty.sort(), ['basic', 'extensions'], 'both groups without a hit are hidden')
    const kept = [...page.document.querySelectorAll('[data-plugin-group]')]
      .filter(group => !group.hasAttribute('data-plugin-finder-empty'))
      .map(group => group.getAttribute('data-plugin-group'))
    assert.deepEqual(kept, ['bundles'])
  })

  it('reports hits out of the cards on screen, and says so when nothing matches', async () => {
    const page = await open()
    await page.type('dsh')
    assert.equal(page.count(), '5 / 7')

    await page.type('zzz')
    assert.equal(page.count(), '没有匹配')
    assert.equal(page.document.querySelector('[data-plugin-finder-part="count"]').getAttribute('data-plugin-finder-tone'), 'empty')
  })

  it('shows the shortcut hint while empty and swaps it for the counter while typing', async () => {
    const page = await open()
    const hint = page.document.querySelector('[data-plugin-finder-part="hint"]')
    const count = page.document.querySelector('[data-plugin-finder-part="count"]')
    assert.equal(hint.hidden, false)
    assert.equal(count.hidden, true)
    await page.type('dsh')
    assert.equal(hint.hidden, true)
    assert.equal(count.hidden, false)
  })

  it('scrolls the list back to the top when a search starts', async () => {
    const page = await open()
    const body = page.document.querySelector('[data-plugin-body]')
    body.scrollTop = 400
    await page.type('星标')
    assert.equal(body.scrollTop, 0, 'results are not left above the viewport')
  })

  it('stays quiet while the list has no cards yet, then reports once it does', async () => {
    const page = await open()
    const count = page.document.querySelector('[data-plugin-finder-part="count"]')
    const cards = [...page.document.querySelectorAll('[data-plugin-package],[data-plugin-item]')]
    for (const card of cards) card.remove()
    await page.type('星标')
    assert.equal(count.hidden, true, 'an empty list is not a failed search')

    page.document.querySelector('[data-plugin-installed]').insertAdjacentHTML('beforeend',
      '<section data-plugin-group="bundles"><ul><li data-plugin-package="dsh-session-stars">'
      + '<button aria-describedby="d1">会话星标</button><span id="d1">给会话加星标。</span></li></ul></section>')
    await page.tick(3)
    assert.equal(count.hidden, false, 'the counter appears with the first card')
    assert.equal(count.textContent, '1 / 1')
  })
})

describe('clearing', () => {
  it('Escape clears the query and restores the untouched DOM', async () => {
    const page = await open()
    const before = page.document.querySelector('[data-plugin-installed]').innerHTML
    await page.type('星标')
    assert.notEqual(page.document.querySelector('[data-plugin-installed]').innerHTML, before)

    await page.press('Escape')
    assert.equal(page.input().value, '')
    assert.deepEqual(page.hidden(), [])
    assert.equal(page.document.querySelectorAll('[data-plugin-finder-empty]').length, 0)
    assert.equal(page.document.querySelectorAll('[data-plugin-finder-flash]').length, 0)
    assert.equal(page.document.querySelector('[data-plugin-installed]').innerHTML, before, 'DOM matches the shell render again')
  })

  it('the clear button empties the query and keeps the caret in the box', async () => {
    const page = await open()
    await page.type('语音')
    const clear = page.document.querySelector('[data-plugin-finder-part="clear"]')
    assert.equal(clear.hidden, false)
    clear.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true }))
    await page.tick(2)
    assert.equal(page.input().value, '')
    assert.equal(page.window.document.activeElement, page.input())
  })
})

describe('shortcuts', () => {
  it('Ctrl+F and Cmd+F focus the box and swallow the browser find', async () => {
    const page = await open()
    for (const init of [{ ctrlKey: true }, { metaKey: true }]) {
      page.input().blur()
      const event = await page.shortcut('f', init)
      assert.equal(event.defaultPrevented, true, 'default browser find is prevented')
      assert.equal(page.window.document.activeElement, page.input(), 'focus moved into the box')
    }
  })

  it('ignores Ctrl+F when no box is mounted, so other pages keep their own find', async () => {
    const page = await open({ toolbar: false })
    const event = await page.shortcut('f', { ctrlKey: true })
    assert.equal(event.defaultPrevented, false)
  })

  it('Enter opens the first hit, Shift+Enter only flashes it', async () => {
    const page = await open()
    const clicks = []
    for (const button of page.document.querySelectorAll('[data-plugin-installed] button[aria-describedby]')) {
      button.addEventListener('click', () => clicks.push(button.textContent.trim()))
    }
    await page.type('语音')
    await page.press('Enter', { shiftKey: true })
    assert.deepEqual(clicks, [], 'Shift+Enter does not open anything')
    assert.equal(page.document.querySelectorAll('[data-plugin-finder-flash]').length, 1, 'the first hit flashes')

    await page.press('Enter')
    assert.deepEqual(clicks, ['语音输入'], 'Enter opens the only hit')
  })
})

describe('re-renders', () => {
  it('re-applies the query to freshly rendered cards and keeps the query in the box', async () => {
    const page = await open()
    await page.type('星标')
    assert.deepEqual(page.visible(), ['dsh-session-stars'])

    // React replaces the card nodes on a refresh: new elements, no attributes.
    const panel = page.document.querySelector('[data-plugin-installed]')
    const old = panel.querySelector('[data-plugin-group="bundles"] ul')
    const replacement = page.document.createElement('ul')
    for (const [card, title, description] of [
      ['dsh-session-stars', '会话星标', '给会话加星标并集中列出。'],
      ['dsh-tally', '待办清单', '一个极简的个人待办。'],
    ]) {
      const li = page.document.createElement('li')
      li.setAttribute('data-plugin-package', card)
      li.innerHTML = `<button aria-label="查看 ${title}" aria-describedby="d-${card}">${title}</button><span id="d-${card}">${description}</span>`
      replacement.append(li)
    }
    old.replaceWith(replacement)
    await page.tick(3)

    assert.deepEqual(page.visible(), ['dsh-session-stars'], 'the new node is filtered too')
    assert.equal(page.input().value, '星标', 'the query survives the re-render')
  })

  it('puts the caret back when the toolbar is rebuilt while typing', async () => {
    const page = await open()
    await page.type('星')
    page.input().focus()
    const toolbar = page.document.querySelector('[data-plugin-toolbar]')
    const oldBar = toolbar
    const fresh = oldBar.cloneNode(false)
    const refresh = page.document.createElement('button')
    refresh.setAttribute('aria-label', '刷新')
    refresh.textContent = '刷新'
    fresh.append(refresh)
    oldBar.replaceWith(fresh)
    await page.tick(3)
    assert.ok(page.box() !== null, 'box is re-mounted into the new toolbar')
    assert.equal(page.window.document.activeElement, page.input(), 'the focused box is restored')
    assert.deepEqual(page.visible(), ['dsh-session-stars'])
  })
})

describe('lifecycle', () => {
  it('removes the box, its stylesheet and every attribute when the plugin unloads', async () => {
    const page = await open()
    const original = page.document.querySelector('[data-plugin-installed]').innerHTML
    await page.type('星标')
    page.dispose()
    await page.tick(1)
    assert.equal(page.box(), null, 'the box is gone')
    assert.equal(page.document.getElementById('dsh-plugin-finder-style'), null, 'the stylesheet is gone')
    assert.equal(page.document.querySelector('[data-plugin-installed]').innerHTML, original, 'cards are untouched')
    const event = await page.shortcut('f', { ctrlKey: true })
    assert.equal(event.defaultPrevented, false, 'the shortcut is released')
  })

  it('follows the active locale without reloading', async () => {
    const page = await open()
    assert.equal(page.input().getAttribute('placeholder'), '搜索插件')
    page.locale.active = 'en'
    for (const listener of page.localeListeners) listener()
    await page.tick(2)
    assert.equal(page.input().getAttribute('placeholder'), 'Search plugins')
    assert.equal(page.document.querySelector('[data-plugin-finder-part="hint"]').textContent, 'Ctrl F')
    assert.equal(page.input().getAttribute('aria-label'), 'Search plugins by title, description or package name')
  })
})
