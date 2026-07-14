# Claude Limit Monitor

Chrome extension to track usage limits across multiple Claude accounts.

## Features

- Remembers each account's 5-hour and weekly limit status after login
- Shows countdown to reset ("resets in 1h 20m")
- Usage progress bars per account
- Persists data across sessions — just switch accounts and the extension accumulates each one

## Install (Developer Mode)

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select this folder

## How it works

The extension intercepts fetch calls on `claude.ai` to capture usage/limit data from API responses. It also watches the DOM for reset-time text (e.g. "resets in 2 hours").

Data is stored per account (keyed by email) in `chrome.storage.local`. When you switch accounts and log in again, the extension updates that account's entry.

## Debugging

Click the **デバッグ** button in the popup to see raw captured data. This helps identify which API endpoints carry the limit info — contributions welcome if you find the exact response shape.

## Privacy

All data stays in your browser's local storage. Nothing is sent anywhere.

## License

MIT
