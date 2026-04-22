# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Browser extension (Manifest V3) that scrapes the Binance Alpha "Order History" table in the active tab and computes the user's daily trading volume + Alpha points. UI text is Vietnamese.

There is **no build system**: files are loaded unpacked directly by the browser. No `package.json`, no tests, no linter config.

## Two parallel builds — they have diverged

[chrome/](chrome/) and [firefox/](firefox/) are independent copies of the extension, not a shared codebase. They are **not in sync**:

- [chrome/](chrome/) is the actively maintained version (manifest `1.2`). Popup has volume/target-point selectors, shows "points", remaining volume, and trades-remaining. Content script also counts `Đã hủy` (cancelled with partial fill) rows. Storage is reset automatically when the saved day ≠ today.
- [firefox/](firefox/) is the older, simpler version (manifest `1.0`) — only accumulates totals across Collect clicks, has Reset/ShowTotal buttons, and includes a `browser_specific_settings.gecko` block plus MV3 `strict_min_version`.

**When the user says "update the extension", confirm which build(s) they mean.** Porting a change from `chrome/` to `firefox/` is a manual merge, not a copy — the popups have different HTML, storage shape, and buttons.

## Load / test cycle

- Chrome: `chrome://extensions` → Developer mode → "Load unpacked" → select [chrome/](chrome/). After editing files, click the extension's reload icon.
- Firefox: `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on" → select [firefox/manifest.json](firefox/manifest.json).
- Verify against a live Binance Alpha order-history page — the content script matches `*://*.binance.com/*` and depends on DOM selectors that Binance can change without notice.

## Scraping contract (content.js)

The content script hardcodes selectors against the Binance DOM. If scraping returns 0 or fails, the DOM has almost certainly shifted and these need to be re-inspected:

- Table root: `#trd-order-history tbody.bn-web-table-tbody tr[role="row"]`
- Columns are read by `aria-colindex`:
  - `1` → created-at timestamp (`YYYY-MM-DD HH:MM:SS`)
  - `4` → direction (`Mua` = Buy)
  - `9` → total in USDT (Vietnamese format: `1.024,94797 USDT` — dots are thousand separators, comma is decimal)
  - `13` → status (`Đã khớp` = Filled, `Đã hủy` = Cancelled)

Filter applied to each row:
1. Date must equal today (local time, `YYYY-MM-DD`).
2. Hour must be `≥ 7` — the Binance Alpha daily reset is 07:00 local, so orders before that belong to the prior day.
3. Direction `Mua` only.
4. Status `Đã khớp` (chrome also accepts `Đã hủy` when amount > 0, to capture partially-filled cancels).

Amount parsing is locale-specific: strip `USDT`, remove `.`, then replace `,` with `.` before `parseFloat`. Don't "fix" this to use `Number()` directly — it will misread `1.024,94` as `1.024`.

## The ×4 multiplier and the points formula

Two pieces of math are load-bearing and span content script + popup:

- **`pageTotal += amount * 4`** in [chrome/content.js](chrome/content.js) and [firefox/content.js](firefox/content.js): Binance Alpha counts certain trades with a 4× volume boost. This multiplier is applied at scrape time — downstream code already assumes `total` is post-multiplier.
- **Points = `Math.floor(Math.log2(totalVolume))`** in [chrome/popup.js](chrome/popup.js) and [firefox/popup.js](firefox/popup.js): each point tier doubles required volume. Target-point `N` means target volume `2^N` USDT.

In the Chrome popup specifically:
- `volPerTrade = volumePerOrder * 4` (selector is the *base* order size; the ×4 matches the content script).
- `volBase = ceil(volShort / 4) + 3` — the `+3` is an empirical safety buffer for rounding/fee slippage when working out the raw USDT the user still needs to trade to hit the target. Don't drop it without asking.

## Storage shape

Chrome uses `chrome.storage.local` with these keys:
- `total` — current day's computed volume (already ×4-multiplied)
- `selectedVolume`, `selectedPoint` — persisted UI selections
- `lastCollectedAt` — epoch ms; popup uses this to decide whether cached `total` is still same-day

Firefox stores only `total`, and accumulates across Collect clicks instead of replacing — this is the main behavioral gap between the two builds.
