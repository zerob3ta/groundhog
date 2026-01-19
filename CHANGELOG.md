# Changelog

## [0.2.0] - 2025-01-19

### Added

**Memory System**
- Persistent memory using Upstash Redis - Phil now remembers regulars across sessions
- Chatter recognition with relationship levels (stranger → familiar → regular → favorite/nemesis)
- Notable moments capture - epic rants, legendary roasts, meltdowns are saved
- Corrupted facts system - things chat "teaches" Phil persist with confidence decay
- Personality evolution - Phil's traits drift based on session experiences
- Emergent truths system - Phil develops his own questions, theories, and patterns
- Aftermath tracking - captures how chat reacted to Phil's notable moments
- State-based memory filtering - winter Phil remembers darker moments more vividly

**Stream Experience**
- Stream start overlay for mobile - "Watch Livestream" button unlocks audio on mobile browsers
- Fixes mobile autoplay restrictions by requiring user interaction before audio plays

**Orchestrator Improvements**
- Batch response model - Phil responds to all pending users at once, staying current with chat
- Removed dead air responses - chatters fill the space naturally now
- Faster response cooldowns for snappier interaction
- Fake chatter filtering - simulated chatters no longer pollute memory system

### Changed
- Memory prompt integration - Phil's responses are informed by his memories
- Notable moments include chaos flavor (winter/spring) and tone metadata

### Technical
- New files: `lib/memory/` module with types, KV client, memory manager, notability detection, personality tracking, prompts, aftermath, and truths systems
- New component: `StreamStartOverlay.tsx` for mobile audio unlock
- Updated orchestrator for batch responses and memory integration

---

## [0.1.0] - Initial Release

- Interactive 3D groundhog livestream
- Real-time chat with Phil via Claude API
- Simulated chatters with distinct personalities
- Season/chaos system affecting Phil's mood
- Text-to-speech with ElevenLabs
- Rant detection and reactive chatters
