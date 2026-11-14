# FocusPad

A pomodoro focus timer with a breathing progress ring, automatic focus/break cycling, adjustable phase lengths, and daily stats — all offline.

## Features

- 6-phase cycle (focus → short break ×2 → focus → long break) with phase dots
- Wall-clock deadline timing — stays accurate even when the browser throttles background tabs
- Live countdown in the tab title; gentle pulse when a phase completes
- Progress ring animates with openmotion-style transitions; breathes while running
- Adjustable focus/break/long-break durations (1–90 min), persisted
- Today's session count and minutes, all-time total, last 100 sessions stored locally

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

## Motion

Ring dash-offset transitions at 300ms linear for smooth countdown; the ring "breathes" (4s opacity oscillation) while running; completion pulses 3× with a spring curve. `prefers-reduced-motion` respected.

## License

MIT
