# Punxsutawney Phil Live

Interactive "livestream" featuring a 3D animated Punxsutawney Phil that responds to viewer chat messages in real-time using an LLM backend.

## Project Vision

- **What**: A fake "livestream" of a talking 3D groundhog that responds to chat
- **When**: Built for Groundhog Day (February 2nd)
- **Style**: TikTok Live / Instagram Live aesthetic
- **Domain**: groundhog.life

## Phil's Personality

- 147 years old (born 1887)
- Lives at Gobbler's Knob, Punxsutawney, PA
- Member of the "Inner Circle" (handlers who wear top hats)
- Sarcastic and witty - sharp with comebacks
- Obsessed with shadows and weather prediction
- Celebrity status (knows he's famous)
- Speaks in "Groundhogese" (translated by handlers)
- Has a Philly/Delco accent
- NOT cheesy or Disney - more edgy humor

## Core Features

### 3D Groundhog Character
- Animated 3D model with expressive features
- Idle breathing/bobbing animation
- Talking animation (mouth movement, head bobs)
- Eye blinking, ear twitching
- Subtle body movements

### Livestream UI
- Desktop: Split-screen (3D scene left, chat panel right)
- Mobile: Instagram Live style (chat overlays bottom, fades)
- "LIVE" badge with viewer count
- Stream title overlay
- Dark theme matching modern livestream platforms

### Chat System
- Users type messages to Phil
- Phil responds in character via LLM
- Typing indicator when Phil is "thinking"
- Chat history with conversation flow
- TikTok Live style message bubbles

### LLM Integration
- System prompt defines Phil's personality
- Responses are witty, sarcastic, weather-obsessed
- Knowledge of Groundhog Day traditions, history, Inner Circle

## Future Enhancements

1. Autonomous monologues (Phil talks unprompted)
2. Text-to-speech voice
3. Real news/weather commentary
4. Multiple characters
5. Special Groundhog Day event mode
6. Simulated viewer chat for ambiance

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **3D**: React Three Fiber (@react-three/fiber, @react-three/drei, three.js)
- **Styling**: Tailwind CSS
- **LLM**: Claude API (for Phil's responses)
- **Voice**: ElevenLabs (for text-to-speech)
- **Hosting**: Vercel

## Project Structure

```
groundhog/
├── app/                    # Next.js app router
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Main livestream page
│   └── globals.css        # Global styles
├── components/
│   ├── Phil3D.tsx         # 3D scene with Phil model
│   ├── ChatPanel.tsx      # Chat interface
│   ├── LiveBadge.tsx      # LIVE indicator
│   └── ViewerCount.tsx    # Viewer count display
├── lib/                   # Utilities (coming soon)
├── public/
│   ├── favicon.svg        # Site favicon
│   ├── phil.jpg           # Phil image for OG
│   └── models/            # 3D model files (coming soon)
└── package.json
```

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Install dependencies
npm install
```

## Implementation Status

### Phase 1: Foundation (Current)
- [x] Next.js project setup
- [x] Basic layout (split view desktop, stacked mobile)
- [x] Placeholder 3D scene (spinning cube)
- [x] Chat UI with hardcoded responses
- [x] LIVE badge and viewer count

### Phase 2: Chat Integration (Next)
- [ ] Claude API integration
- [ ] Phil's personality system prompt
- [ ] Streaming responses
- [ ] Typing indicator sync

### Phase 3: 3D Character
- [ ] Acquire/create groundhog model
- [ ] Idle animations
- [ ] Talking animations
- [ ] Eye blinks, subtle movements

### Phase 4: Voice
- [ ] ElevenLabs integration
- [ ] Phil's custom voice
- [ ] Audio/mouth sync
- [ ] Mute controls

### Phase 5: Polish
- [ ] Mobile responsiveness refinement
- [ ] Error handling
- [ ] Performance optimization
