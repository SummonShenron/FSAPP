// src/useGameEngine.ts
import { useState } from 'react';
import { getRandomSticker, Sticker } from '../stickers/Stickers'

export function useGameEngine(allCards: any[]) {
  const MAX_LIVES = 4;

  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [inventory, setInventory] = useState<Sticker[]>([]);
  const [unlockedGoldFrames, setUnlockedGoldFrames] = useState<boolean>(false);
  const [gameState, setGameState] = useState<'PLAYING' | 'GAME_OVER' | 'VICTORY'>('PLAYING');

  const submitGuess = (isCorrect: boolean) => {
    if (gameState !== 'PLAYING') return;

    if (isCorrect) {
      const newSticker = getRandomSticker();
      setInventory((prev) => [...prev, newSticker]);

      if (currentRound + 1 >= allCards.length) {
        setGameState('VICTORY');
        if (lives === MAX_LIVES) setUnlockedGoldFrames(true);
        return;
      }
      setCurrentRound((prev) => prev + 1);
    } else {
      const remainingLives = lives - 1;
      setLives(remainingLives);

      if (remainingLives <= 0) {
        setGameState('GAME_OVER');
      } else if (currentRound + 1 >= allCards.length) {
        setGameState('VICTORY');
      } else {
        setCurrentRound((prev) => prev + 1);
      }
    }
  };

  const restartGame = () => {
    setLives(MAX_LIVES);
    setCurrentRound(0);
    setGameState('PLAYING');
  };

  // Full reset: resets hearts, game state AND wipes all collected stickers
  const resetAllProgress = () => {
    setLives(MAX_LIVES);
    setCurrentRound(0);
    setInventory([]);
    setUnlockedGoldFrames(false);
    setGameState('PLAYING');
  };

  return {
    lives,
    MAX_LIVES,
    currentRound,
    inventory,
    gameState,
    unlockedGoldFrames,
    submitGuess,
    restartGame,
    resetAllProgress,
  };
}