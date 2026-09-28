/**
 * Short SFX playback via expo-audio, with a mute toggle.
 *
 * NOTE: no CC0 sound assets are bundled in this repo (assets/sounds/ is not populated -- see the
 * project's final implementation report). Every `play*()` call below is written against real
 * expo-audio APIs and will work the moment .mp3/.wav files are dropped into assets/sounds/ and
 * wired into `SOUND_SOURCES`; until then this module no-ops silently and safely, so the rest of
 * the app never needs to know whether sound is actually available.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

export type SoundEffect = 'turn' | 'invalidPlay' | 'swap' | 'cardPlay' | 'draw' | 'win';

// Populate with `require('@/assets/sounds/<name>.mp3')` once real audio assets exist.
const SOUND_SOURCES: Partial<Record<SoundEffect, number>> = {};

let muted = false;
let modeConfigured = false;

export function isSoundAvailable(effect: SoundEffect): boolean {
  return effect in SOUND_SOURCES;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

export async function playSound(effect: SoundEffect): Promise<void> {
  if (muted) return;
  const source = SOUND_SOURCES[effect];
  if (source === undefined) return; // No asset for this effect yet -- silent no-op by design.

  try {
    if (!modeConfigured) {
      await setAudioModeAsync({ playsInSilentMode: true });
      modeConfigured = true;
    }
    const player = createAudioPlayer(source);
    player.play();
  } catch {
    // Never let sound failures affect gameplay.
  }
}
