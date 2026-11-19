<p align="center">
  <img src="icon.svg" width="88" height="88" alt="dsh-plugin-finder icon">
</p>

<h1 align="center">dsh-plugin-finder</h1>

<p align="center">
  Search for DeepSeek Harness plugins: <b>Ctrl+F</b> to focus, type to filter, Enter to open.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-3F77D8"></a>
  <img alt="DSH" src="https://img.shields.io/badge/DSH-%E2%89%A50.2.1-2A55C8">
  <img alt="Runtime dependencies" src="https://img.shields.io/badge/runtime%20deps-0-2ea043">
  <img alt="Tests" src="https://img.shields.io/badge/tests-21%20passing-2ea043">
  <img alt="Build step" src="https://img.shields.io/badge/build%20step-none-6e7781">
</p>

---

[中文说明](README.md)

## Why

With a few dozen plugins installed, the Plugins page becomes a wall: installed,
official and experimental cards scroll for screens, and the header only offers
refresh and add. There is no search and no sort. What you remember is usually
"the one that stars sessions" — a title, a description, a package name — all of
it on the cards, none of it queryable.

`dsh-plugin-finder` adds one search box to the header and makes the page
searchable.

## What it does

- The box sits in the Plugins page toolbar, immediately left of **Refresh** and
  **Add plugin**, and follows the header when it shrinks on scroll.
- **Ctrl+F / ⌘F** focuses it (and swallows the browser's own find) while the
  plugins list is on screen; on any other page it stays out of the way.
- Filters the cards by **title, description and package name / registration id**,
  case-insensitively. Space-separated terms are **ANDed**.
- A group that keeps no card is hidden with its heading — no empty "Official 0".
- The box shows `hits / total`; when nothing matches it says so in the warning
  colour, and it stays silent while the list has not rendered any card yet.
- **Enter** opens the first hit, **Shift+Enter** scrolls to it and flashes it.
- **Esc** or the × clears; with an empty query the DOM is exactly what the shell
  rendered.

| Key | Action |
| --- | --- |
| `Ctrl+F` / `⌘F` | Focus the search box (plugins list only) |
| type | Filter as you type |
| `Enter` | Open the first hit |
| `Shift+Enter` | Scroll to the first hit and flash it |
| `Esc` | Clear, then leave the field |

## Install

GUI: **Plugins** → **Add plugin** → spec
`github:liuyuxuan6666/dsh-plugin-finder` → refresh the page.

CLI:

```bash
dsh plugin --profile <profile> add github:liuyuxuan6666/dsh-plugin-finder
```

Local checkout for development:

```bash
git clone https://github.com/liuyuxuan6666/dsh-plugin-finder.git
dsh plugin --profile <profile> add ./dsh-plugin-finder
```

The Host half is empty, so client changes take effect on a page refresh; no DSH
restart is required. Remove with `dsh plugin --profile <profile> remove dsh-plugin-finder`.

## What it does not do

Display state only. It sets its own `data-plugin-finder-*` attributes on
non-matching cards and empty groups and injects one stylesheet that hides them;
clearing the query removes every one of those attributes. It sends no requests,
reads no session data, writes no files, keeps no storage, and never enables,
disables, installs or uninstalls a plugin.

## How it works

The Plugins page belongs to `@deepseek-ai/dsh-client-ui-plugin-manager`. Its
declared slots are for cards (`plugins.item`, `plugins.bundle.config`,
`plugins.row.config`), detail pages (`plugins.detail.*`) and extra tabs
(`plugins.tab`) — **the list toolbar has no slot**. Replacing the page through
the keyed `main` slot would shadow shipped UI and break on every upgrade, so the
box anchors on the page's own `data-*` contracts instead (never the hashed
CSS-module class names):

| Selector | Role |
| --- | --- |
| `[data-plugin-panel]` | page root |
| `[data-plugin-toolbar]` | header toolbar; `:not([hidden])` keeps detail and market tabs clean |
| `[data-plugin-group]` | one group of cards |
| `[data-plugin-package]` / `[data-plugin-item]` | one bundle card / one official plugin card |
| `aria-describedby` on a card's title button | the description text |

React replaces cards on first load, tab switches, refreshes and installs, so a
`MutationObserver` on `document.body` (plus `aria-busy`) drives a
`requestAnimationFrame`-coalesced re-sync; the query lives outside the rendered
tree, so it survives re-renders. Writes are idempotent, which is what keeps the
plugin's own DOM edits from re-triggering that loop. Every lookup fails open: if
a future build renames an anchor, the page simply has no search box.

## Tests

```bash
npm install   # jsdom only
npm test
```

21 cases run the real `lib/client.js` inside jsdom against markup copied from
the shell: injection point, title/description/name/id matching, AND terms, group
hiding, counter and empty state, Esc restoring the DOM, Ctrl/⌘+F, Enter and
Shift+Enter, re-filtering fresh nodes, caret restore after a toolbar rebuild,
cleanup on unload, locale switch.

## Compatibility and limits

- Verified on **DSH 0.2.2-rc.5** (desktop profile, Chinese UI); `engines.dsh` is
  `>=0.2.1-rc.3 <0.3.0`.
- Substring matching only — no fuzzy or pinyin search.
- The "more" group is a sub-view: only cards currently rendered are filtered.
- The query is not persisted across reloads, and this plugin does not sort.

## Credits

[huangxp12/dsh-plugin-search](https://github.com/huangxp12/dsh-plugin-search)
established the same toolbar-injection approach; this project adds
Ctrl/⌘+F focus, Enter-to-open, Shift+Enter locate, silent empty lists and a
runnable test suite.

## License

[MIT](LICENSE).
