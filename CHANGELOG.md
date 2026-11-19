# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project uses
[semantic versioning](https://semver.org/).

## [0.1.0] — 2026-11-19

First release.

### Added

- A search box in the Plugins page header toolbar, immediately left of Refresh
  and Add plugin, which follows the header as it shrinks on scroll.
- `Ctrl+F` / `Cmd+F` focus while the plugins list is on screen; the shortcut is
  not registered on any other page.
- Live filtering of the plugin cards by title, description and package name /
  registration id, case-insensitively; space-separated terms are ANDed.
- Groups that keep no card are hidden together with their heading.
- `hits / total` counter, a "no match" state, and silence while the list has not
  rendered any card yet.
- `Enter` opens the first hit, `Shift+Enter` scrolls to it and flashes it.
- `Esc` and the clear button restore the exact DOM the shell rendered.
- Light/dark via `--dsw-alias-*` theme tokens, zh/en copy through the client
  locale service, `role="search"`, an `aria-live` counter and a reduced-motion
  flash.
- 21 jsdom cases that run the real client bundle.
