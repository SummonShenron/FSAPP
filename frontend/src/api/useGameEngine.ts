import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from './useApiClient'; 

export interface Sticker {
  id: string;
  icon: string;
  name: string;
  rarity: 'COMMON' | 'RARE' | 'LEGENDARY';
}

export type GameState = 'PLAYING' | 'VICTORY' | 'GAME_OVER';

export const useGameEngine = (cards: any[] = []) => {
  const { apiFetch } = useApiClient();
  const BASE_URL = import.meta.env.DEV
    ? `http://${window.location.hostname}:8000` 
    : import.meta.env.VITE_API_URL;
  // --- Game Engine State ---
  const MAX_LIVES = 3;
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [inventory, setInventory] = useState<Sticker[]>([]);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [unlockedGoldFrames, setUnlockedGoldFrames] = useState<boolean>(false);
  const unlockCard = async (cardId: string) => {
    // 1. Update React state immediately for instant UI feedback
    setSavedCardIds((prev) => [...new Set([...prev, cardId])]);

    // 2. Persist to backend MongoDB
    try {
      await apiFetch('/api/user/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saved_card_ids: [cardId],
          inventory: inventory
        })
      });
    } catch (err) {
      console.error('Failed to save card progress:', err);
    }
  };
  // ----------------------------------------------------
  // 1. Fetch saved card progress from MongoDB on mount
  // ----------------------------------------------------
  useEffect(() => {
  const loadUserProgress = async () => {
    try {
      const data = await apiFetch('/api/user/progress');
      if (data) {
        // Load saved cards if they exist
        if (Array.isArray(data.saved_card_ids)) {
          setSavedCardIds(data.saved_card_ids);
        }
        // CRUCIAL FIX: Load inventory stickers into React state on refresh!
        if (Array.isArray(data.inventory)) {
          setInventory(data.inventory);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user progress:', err);
    }
  };
  loadUserProgress();
}, []);
  // ----------------------------------------------------
  // 2. Submit Guess Logic
  // ----------------------------------------------------
  const submitGuess = useCallback(
    async (isCorrect: boolean, cardId?: string) => {
      if (gameState !== 'PLAYING') return;
      if (isCorrect) {
        if (cardId) {
          // Optimistically update saved card IDs in React state
          setSavedCardIds((prev) => {
            if (prev.includes(cardId)) return prev;
            const updated = [...prev, cardId];
            // Trigger Victory if all family members are saved
            if (cards.length > 0 && updated.length >= cards.length) {
              setGameState('VICTORY');
              if (lives === MAX_LIVES) {
                setUnlockedGoldFrames(true);
              }
            }
            return updated;
          });
          // Sync saved card ID with FastAPI / MongoDB backend
          try {
            await apiFetch('/api/user/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                saved_card_ids: [cardId],
                inventory: inventory,             // 👈 CRUCIAL: Include inventory here!
              }),
            });
          } catch (err) {
            console.error('Failed to sync saved card to backend:', err);
          }
        }
      } else {
        // Incorrect door clicked -> lose a heart
        setLives((prevLives) => {
          const newLives = prevLives - 1;
          if (newLives <= 0) {
            setGameState('GAME_OVER');
          }
          return Math.max(0, newLives);
        });
      }
    },
    [gameState, cards.length, lives, MAX_LIVES, apiFetch]
  );
  // ----------------------------------------------------
  // 3. Reward Sticker Handler
  // ----------------------------------------------------
 const addSticker = useCallback((stickerEmoji: string) => {
    // Determine rarity and name based on the sticker emoji
    let rarity: 'COMMON' | 'RARE' | 'LEGENDARY' = 'COMMON';
    let name = 'Common Sticker';

    if (['👑', '🌟', '🚀'].includes(stickerEmoji)) {
      rarity = 'LEGENDARY';
      name = 'Legendary Sticker';
    } else if (['🦄', '🎀', '🥸'].includes(stickerEmoji)) {
      rarity = 'RARE';
      name = 'Rare Sticker';
    } else {
      rarity = 'COMMON';
      name = 'Common Sticker';
    }

    const newSticker: Sticker = {
      id: `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      icon: stickerEmoji,
      name: name,
      rarity: rarity,
    };

    setInventory((prevInventory) => {
      const updatedInventory = [...prevInventory, newSticker];
      // Send the updated inventory array to MongoDB immediately!
      apiFetch('/api/user/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saved_card_ids: savedCardIds,
          inventory: updatedInventory,
        }),
      }).catch((err) => console.error("Failed to save sticker:", err));
      return updatedInventory;
    });
  }, [savedCardIds, apiFetch]);
  // ----------------------------------------------------
  // 4. Restart Game (Restores hearts, keeps saved cards)
  // ----------------------------------------------------
  const restartGame = useCallback(() => {
    setLives(MAX_LIVES);
    setGameState('PLAYING');
  }, [MAX_LIVES]);
  // ----------------------------------------------------
  // 5. Reset All Progress (Full wipe: deletes DB record)
  // ----------------------------------------------------
  const resetAllProgress = useCallback(async () => {
    setLives(MAX_LIVES);
    setGameState('PLAYING');
    setInventory([]);
    setSavedCardIds([]);
    setUnlockedGoldFrames(false);
    try {
      await apiFetch('/api/user/progress', {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to reset progress on backend:', err);
    }
  }, [MAX_LIVES, apiFetch]);
  return {
    lives,
    MAX_LIVES,
    inventory,
    gameState,
    savedCardIds,
    unlockedGoldFrames,
    submitGuess,
    addSticker,
    restartGame,
    resetAllProgress,
  };
};