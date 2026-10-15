# Attribution

Dot is MIT licensed. Parts of it are ported from, or modelled on, other MIT work:

- **Clicky** by Farza Majeed, https://github.com/farzaa/clicky (MIT). The push-to-talk
  CGEvent tap (`Sources/Dot/Input/HotkeyMonitor.swift`), the per-display ScreenCaptureKit
  capture with the cursor display first (`Sources/Dot/Screen/ScreenCapture.swift`), the
  click-through overlay window and the bezier flight of the pointer
  (`Sources/Dot/Overlay/OverlayWindow.swift`), the `[POINT:x,y:label:screenN]` tag idea,
  and the structure of the voice persona prompt (`Sources/Dot/Brain/Prompts.swift`).
  The prompt text itself was rewritten for Dot.
- **Murmur** by Roshan Shah, https://github.com/roshanshah11/murmur (MIT). The 16 kHz
  WAV recorder, the FluidAudio Parakeet engine wrapper, and the notch geometry
  measurement.
- **FluidAudio** by FluidInference, https://github.com/FluidInference/FluidAudio (Apache 2.0),
  as a Swift package dependency, running NVIDIA Parakeet TDT 0.6B v3 (CC-BY-4.0 weights,
  downloaded by FluidAudio at first use).
- **cua-driver** by trycua, https://github.com/trycua/cua (MIT), installed separately as
  the optional computer-use MCP server for agents. Nothing from it is bundled.
- **Kokoro-82M** by hexgrad (Apache 2.0 weights, https://huggingface.co/hexgrad/Kokoro-82M),
  the MLX conversion by mlx-community, run through **mlx-audio** by Blaizzy (MIT,
  https://github.com/Blaizzy/mlx-audio) with **misaki** (Apache 2.0) for phonemes. All
  installed into `~/Dot/tts` by `scripts/install-tts.sh`; nothing is bundled.

HeyClicky (the commercial product that grew out of Clicky) was studied from its public
download to understand its architecture: its notch HUD, named agents with a workspace
folder, consent-gated computer use, and voice-to-agent handoff. None of its code,
prompts, sounds, images or other assets are included here.
