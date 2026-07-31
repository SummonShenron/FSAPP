export type StickerRarity = 'COMMON' | 'RARE' | 'LEGENDARY';

export interface Sticker {
  id: string;
  name: string;
  icon: string; // Emoji, SVG, or image URL
  rarity: StickerRarity;
}

export const STICKER_POOL: Sticker[] = [
  // Commons (60% drop rate)
  { id: 'puppy', name: 'Puppy', icon: '🐶', rarity: 'COMMON' },
  { id: 'star', name: 'Gold Star', icon: '⭐', rarity: 'COMMON' },
  { id: 'pizza', name: 'Pizza Slice', icon: '🍕', rarity: 'COMMON' },
  
  // Rares (30% drop rate)
  { id: 'rocket', name: 'Space Rocket', icon: '🚀', rarity: 'RARE' },
  { id: 'unicorn', name: 'Unicorn', icon: '🦄', rarity: 'RARE' },
  
  // Legendaries (10% drop rate)
  { id: 'crown', name: 'Golden Crown', icon: '👑', rarity: 'LEGENDARY' },
  { id: 'dragon', name: 'Fire Dragon', icon: '🐲', rarity: 'LEGENDARY' },
];

export const getRandomSticker = (): Sticker => {
  const rand = Math.random() * 100; // 0 - 100
  let rarityFilter: StickerRarity = 'COMMON';

  if (rand > 90) rarityFilter = 'LEGENDARY';      // 10% chance
  else if (rand > 60) rarityFilter = 'RARE';       // 30% chance
  else rarityFilter = 'COMMON';                   // 60% chance

  const matchingStickers = STICKER_POOL.filter(s => s.rarity === rarityFilter);
  const randomIndex = Math.floor(Math.random() * matchingStickers.length);
  return matchingStickers[randomIndex];
};