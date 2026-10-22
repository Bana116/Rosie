# Rosie

An iPad companion that helps older adults with arthritis keep up gentle hand exercises on their own, after their family sets it up once.

**She moves. Her family knows. Her family answers.**

## The flow

1. **Family setup** (`setup.html`, or press and hold the Rosie logo for 2 seconds): intro, who Rosie is for, who can send messages (with a contacts sync), then hand the iPad over.
2. **Her daily session** (`app.html`):
   - Rosie wakes up with one tap and talks; her words are always on screen.
   - Sound check ("Can you hear me?").
   - **Hand check-in** (`pain.html`): a 3D hand with a pink dot on every joint. She taps where it hurts and a flower grows there. Sore spots make the moves slower and easier.
   - **Finger walk** and **Fist stretch**, following Mayo Clinic's guidance. Rosie shows each move in 3D first, then she does it on screen (pink moves, grey stays still).
   - Rescues everywhere: Say it again, Help, Skip, and "Stop, this hurts". If she freezes, Rosie repeats, shows the move again, then offers to skip.
   - The ending: "Maya got your update", her daughter's reply arrives, then a twice-a-week reminder (yes or no).
3. **Family's phone** (`notify.html`): the notification and a quick reply that lands on Mom's iPad (open it next to `app.html` in the same browser).

## Run it

```bash
python3 server.py      # serves on http://localhost:3001
```

`server.py` asks for an ElevenLabs API key at startup for Rosie's voice (Sarah). Press Return to skip and Rosie uses the browser's built-in voice. The key is never stored in the project. Spoken lines are cached in `voice-cache/`.

- Family setup: http://localhost:3001/setup.html
- Her daily Rosie (opens by default): http://localhost:3001
- Family's phone: http://localhost:3001/notify.html

Presenter tip: Space wakes Rosie, completes the pink finger in Finger walk, and acts as "hand on the screen" in Fist stretch.

## Deploy (Cloudflare Pages)

It's a static site: no build step.
- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: **/**

Without `server.py`, `voice.js` plays Sarah's saved lines from `voice-cache/`, and the browser voice reads anything else.

## Built with

Plain HTML, CSS and JavaScript (no build step), three.js for the 3D hand (`vendor/`), Web Audio for chimes, and ElevenLabs for the voice.

Exercises adapted from Mayo Clinic, "Hand exercises for people with arthritis". This is a design prototype, not medical advice.
