# Handback

Local-first tool lending tracker (iOS-first).

## Run (local dev)

```bash
cd app
npm install
npm start
```

Then:
- Use **Expo Go** on your iPhone, or
- iOS Simulator on macOS.

## 5-minute demo script

1) Open **Settings** → set **My name** (e.g., “Jason”) → **Save**
2) In Settings, tap **Seed demo tools**
3) Tap a tool (e.g., Drill) → **Start loan (QR)**
4) On a second phone, open Handback → **Confirm loan (scan QR)** → scan → **Confirm**
5) Back on the tool detail screen, show:
   - status = Loaned out
   - borrower name
   - optional due date
6) Tap **Mark returned**

Notes:
- v1 is **local-first** and **standalone per phone** (no sync). Borrower devices auto-import tools from the QR so the demo works out of the box.
