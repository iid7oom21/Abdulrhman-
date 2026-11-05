# RAVEN — cinematic entrance

> Handoff v2 (2026-11-01): this is the original design note with the sections about the removed Case 017 investigation (information architecture of the case, investigator toolkit, story integrity, expanded investigation, closing the file, case acceptance criteria) taken out. The visual system and sound rules below are unchanged from the original text, except that sentences about the investigation were removed.

## Experience and visual system

The homepage is a cinematic entrance. The visitor can watch the films without any other requirement.

- Palette: near black `#080a0b`, warm ivory `#eee8de`, restrained gold `#d6b98d`, and aged paper for documents.
- Typography: local IBM Plex Sans Arabic for reading; Cinzel for the Latin RAVEN identity. Body text 17–19 px, labels at least 14 px, comfortable line height. Do not add letter spacing to Arabic text.
- Interaction: controls outside the image, touch targets at least 48 px where practical, visible keyboard focus, sufficient contrast. A dark background must not make the copy faint.
- Motion: a short muted landscape hero and optional quiet mode. Reduced motion and data-saving connections should get a poster instead of automatic video.
- Terminal texture: a restrained nine-second desktop frame glow rather than rapid flashes. Reduced motion and quiet mode suppress animation. A short heading reveal is decorative.
- First entry to the homepage: the owner's 12-second portrait RAVEN film, muted, with immediately available skip/pause/sound controls outside the picture. It ends on the cinematic homepage and “شاهد RAVEN 17”. Reduced motion, quiet mode, Save-Data and direct film links reach their page without automatic introduction. Replay is an explicit homepage action; no audio gate is required.
- Film cards: two visible parts with actual durations 1:55 and 3:58. The former second and third films are now Part One and Part Two; the former first film is no longer listed or played. Portrait aspect ratios and separate completion/resume state are retained.
- Zarqa Al-Yamama: the existing 16-second teaser, “قيد التطوير”, and the official follow link. There is no confirmed release date or countdown.

## Persistent sound and local state

One soundtrack element owns the unchanged 320 kbps recording. It receives a source only after an eligible user interaction. Explicit pause and volume choices persist within preview storage. Audible films temporarily hold the song; releasing the hold resumes it only when the visitor has enabled music. A first click that starts a film must not briefly start the song too.

Ambient room tone and typewriter effects are independent and off initially. These effects suspend while the document is hidden. View-specific media stops when disposed, while the site's song follows the visitor's playback choice.

All state uses the `raven-preview:v1` namespace. Storage denial leaves an in-memory session usable. Each route mounts and disposes its own events/media; the single audio owner survives route replacement.

Browser releases carry one content-derived version through all module imports and entry styles. This prevents returning visitors from combining an old cached core with a new route module. Normal internal navigation remains within the existing shell and audio owner.
