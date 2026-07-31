export interface AudioClip {
  id: string;
  url: string;
  label?: string;
}

export interface SoundCard {
  id: string;
  title: string;
  relation: string;
  photo_url: string;
  photo_urls?: string[];
  audio_url: string | null;
  audio_urls?: string[];
  audio_clips?: AudioClip[];
  bg_color?: string;
  fact?: string;
  facts?: string[];
}