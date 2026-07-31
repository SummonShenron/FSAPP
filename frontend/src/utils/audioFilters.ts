// utils/audioFilters.ts

export type VoiceFilter = 'normal' | 'chipmunk' | 'monster' | 'robot' | 'slowmo';

// utils/audioFilters.ts

export const playModifiedAudio = (
  audioUrl: string | null, // 👈 Update type here
  filter: VoiceFilter = 'normal'
) => {
  if (!audioUrl) return null; // 👈 Guard clause for null or empty strings

  const audio = new Audio(audioUrl);

  // @ts-ignore
  audio.preservesPitch = false;
  // @ts-ignore
  audio.webkitPreservesPitch = false;

  switch (filter) {
    case 'chipmunk':
      audio.playbackRate = 1.45;
      break;
    case 'monster':
      audio.playbackRate = 0.72;
      break;
    case 'slowmo':
      audio.playbackRate = 0.55;
      break;
    default:
      audio.playbackRate = 1.0;
      break;
  }

  audio.play();
  return audio;
};