import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { SoundCard } from '../../types';
import './__styles__/GameView.css';
import { useGameEngine } from '../api/useGameEngine';
import { playModifiedAudio, VoiceFilter } from '../utils/audioFilters';
import { PivotControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  cards: SoundCard[];
  onRewardSticker: (cardId: string, stickerEmoji: string) => void;
  engine: ReturnType<typeof useGameEngine>;
}

interface Door3DCardProps {
  isOpen: boolean;
  isKnocking: boolean;
  onClick: () => void;
  doorNumber: number;
}

interface RoundCard extends SoundCard {
  displayPhoto: string;
  displayFact: string;
}

// ----------------------------------------------------
// 3D Door Mesh Component
// ----------------------------------------------------
export function DoorModel({ isOpen, isKnocking }: { isOpen: boolean; isKnocking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftDoorRef = useRef<THREE.Object3D | null>(null);
  const rightDoorRef = useRef<THREE.Object3D | null>(null);

  const { scene } = useGLTF('/doubledoor.glb');

  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    leftDoorRef.current = clone.getObjectByName('Door_DoubleLeft') || null;
    rightDoorRef.current = clone.getObjectByName('Door_DoubleRight') || null;
    return clone;
  }, [scene]);

  const SWING_ANGLE = Math.PI * 0.55; 

  useFrame((state, delta) => {
    if (leftDoorRef.current) {
      const targetLeftY = isOpen ? -SWING_ANGLE : 0;
      leftDoorRef.current.rotation.y = THREE.MathUtils.damp(
        leftDoorRef.current.rotation.y,
        targetLeftY,
        7,
        delta
      );
    }

    if (rightDoorRef.current) {
      const targetRightY = isOpen ? SWING_ANGLE : 0;
      rightDoorRef.current.rotation.y = THREE.MathUtils.damp(
        rightDoorRef.current.rotation.y,
        targetRightY,
        7,
        delta
      );
    }

    if (groupRef.current) {
      if (isKnocking && !isOpen) {
        groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 30) * 0.05;
      } else {
        groupRef.current.rotation.z = THREE.MathUtils.damp(
          groupRef.current.rotation.z,
          0,
          10,
          delta
        );
      }
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={[0, -1.2, 0]} 
      rotation={[0, 0, 0]} 
      scale={[2.2, 2.2, 2.2]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload('/doubledoor.glb');

// ----------------------------------------------------
// 3D Canvas Door Component
// ----------------------------------------------------
export const Door3DCard: React.FC<Door3DCardProps> = ({ 
  isOpen, 
  isKnocking, 
  onClick, 
  doorNumber 
}) => {
  return (
    <div 
      onClick={onClick}
      style={{ position: 'relative', width: '100%', height: '100%', cursor: 'pointer' }}
    >
      <span className="door-number-overlay" style={{ zIndex: 10, pointerEvents: 'none' }}>
        Door #{doorNumber}
      </span>
      
      <Canvas camera={{ position: [0, 0, 2.2], fov: 45 }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        
        <Suspense fallback={null}>
          <PivotControls 
            depthTest={false} 
            scale={0.75}
            anchor={[0, 0, 0]}
            onDrag={(matrix) => console.log('Matrix:', matrix)}
          >
            <DoorModel isOpen={isOpen} isKnocking={isKnocking} />
          </PivotControls>
        </Suspense>
      </Canvas>
    </div>
  );
};

// ----------------------------------------------------
// Main Game Component
// ----------------------------------------------------
const VOICE_FILTERS: VoiceFilter[] = ['chipmunk', 'monster', 'slowmo'];
const STICKERS = ['👑', '🕶️', '🎩', '🥸', '🌟', '🦄', '🎀', '🚀'];

export const KnockGame: React.FC<Props> = ({ cards, onRewardSticker, engine }) => {
  const {
    lives,
    MAX_LIVES,
    inventory,
    gameState,
    unlockedGoldFrames,
    submitGuess,
    restartGame,
  } = engine;

  const [targetCard, setTargetCard] = useState<RoundCard | null>(null);
  const [doorOptions, setDoorOptions] = useState<RoundCard[]>([]);
  const [activeFilter, setActiveFilter] = useState<VoiceFilter>('normal');
  const [openedDoorId, setOpenedDoorId] = useState<string | null>(null);
  const [isKnocking, setIsKnocking] = useState(false);
  const [wonSticker, setWonSticker] = useState<string | null>(null);

  const startNewRound = () => {
    if (cards.length < 3) return;

    const shuffled = [...cards].sort(() => 0.5 - Math.random());
    const selected3 = shuffled.slice(0, 3);

    const roundCards: RoundCard[] = selected3.map((card) => {
      const allPhotos = (card.photo_urls && card.photo_urls.length > 0)
        ? card.photo_urls
        : (card.photo_url ? [card.photo_url] : ['https://via.placeholder.com/150']);
      const randomPhoto = allPhotos[Math.floor(Math.random() * allPhotos.length)];

      const allFacts = (card.facts && card.facts.length > 0)
        ? card.facts
        : (card.fact ? [card.fact] : ['No clue provided']);
      const randomFact = allFacts[Math.floor(Math.random() * allFacts.length)];

      return {
        ...card,
        displayPhoto: randomPhoto,
        displayFact: randomFact,
      };
    });

    const target = roundCards[Math.floor(Math.random() * 3)];
    const randomFilter = VOICE_FILTERS[Math.floor(Math.random() * VOICE_FILTERS.length)];

    setDoorOptions(roundCards);
    setTargetCard(target);
    setActiveFilter(randomFilter);
    setOpenedDoorId(null);
    setWonSticker(null);
    setIsKnocking(false);
  };

  useEffect(() => {
    startNewRound();
  }, [cards]);

  const handlePlaySound = () => {
    if (!targetCard) return;

    const clips = (targetCard as any).audio_clips || [];
    const audioPath = clips.length > 0 
      ? clips[Math.floor(Math.random() * clips.length)].audio_url 
      : (targetCard as any).audio_url;

    if (!audioPath) return;

    setIsKnocking(true);
    const fullAudioUrl = audioPath.startsWith('http') 
      ? audioPath 
      : `http://192.168.1.6:8000${audioPath}`;

    const audio = playModifiedAudio(fullAudioUrl, activeFilter);

    if (audio) {
      audio.onended = () => setIsKnocking(false);
    } else {
      setTimeout(() => setIsKnocking(false), 1200);
    }
  };

  const handleDoorClick = (card: SoundCard) => {
    if (openedDoorId || gameState !== 'PLAYING') return;
    setOpenedDoorId(card.id);
    setIsKnocking(false);
    const isCorrect = card.id === targetCard?.id;
    submitGuess(isCorrect);
    
    if (isCorrect) {
      const clips = (card as any).audio_clips || [];
      const audioPath = clips.length > 0 ? clips[0].audio_url : (card as any).audio_url;
      if (audioPath) {
        const fullUrl = audioPath.startsWith('http') ? audioPath : `http://192.168.1.6:8000${audioPath}`;
        playModifiedAudio(fullUrl, 'normal');
      }
      const reward = STICKERS[Math.floor(Math.random() * STICKERS.length)];
      setWonSticker(reward);
      onRewardSticker(card.id, reward);
    } else {
      const oops = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
      oops.volume = 0.4;
      oops.play();
    }
  };

  if (!targetCard) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Please add at least 3 people to start playing!
      </div>
    );
  }

  return (
    <div className="knock-game-container" style={{ maxWidth: '650px', margin: '0 auto', padding: '0.5rem', position: 'relative' }}> 
      {/* Header with Hearts & Inventory Count */}
      <div className="game-header" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
          Who is behind the door? 🚪
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          {Array.from({ length: MAX_LIVES }).map((_, index) => (
            <span key={index}>
              {index < lives ? '❤️' : '🖤'}
            </span>
          ))}
          <span style={{ fontSize: '0.8rem', marginLeft: '8px', background: '#f3e8ff', color: '#6b21a8', padding: '3px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
            🎁 {inventory.length} Stickers
          </span>
        </div>

        <button 
          type="button" 
          className="btn-primary" 
          onClick={handlePlaySound}
          style={{ fontSize: '0.95rem', padding: '0.65rem 1.25rem', margin: '0 auto' }}
        >
          🔊 Knock & Listen ({activeFilter === 'chipmunk' ? '🐿️ Chipmunk' : activeFilter === 'monster' ? '🐻 Monster' : '🐢 Slow-Mo'})
        </button>
      </div>

      {/* 3-Column Side-By-Side 3D Doors Grid */}
      <div className="doors-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {doorOptions.map((card, index) => {
          const isOpen = openedDoorId === card.id;
          const isTarget = card.id === targetCard.id;
          return (
            <div 
              key={card.id} 
              style={{ 
                borderRadius: '16px', 
                border: unlockedGoldFrames ? '4px solid #eab308' : '3px solid #facc15', 
                boxShadow: unlockedGoldFrames ? '0 0 15px rgba(234, 179, 8, 0.6)' : '0 4px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden', 
                backgroundColor: '#ffffff',
                position: 'relative'
              }}
            >
              {unlockedGoldFrames && (
                <span style={{ position: 'absolute', top: '4px', right: '6px', fontSize: '1.2rem', zIndex: 20 }}>👑</span>
              )}

              {/* Door & Photo Area */}
              <div style={{ position: 'relative', height: '180px', backgroundColor: '#1c1917' }}>
                <div 
                  className={`revealed-card ${isOpen ? (isTarget ? 'correct-glow' : 'wrong-shake') : ''}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    zIndex: 0
                  }}
                >
                  <img 
                    src={card.displayPhoto || 'https://via.placeholder.com/150'} 
                    alt={card.title} 
                    style={{
                      width: '65px',
                      height: '65px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #3b82f6',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}
                  />
                  <h4 style={{ margin: '6px 0 0 0', color: '#ffffff', fontSize: '0.85rem', textAlign: 'center' }}>{card.title}</h4>
                  {isOpen && isTarget && wonSticker && (
                    <div className="sticker-reward-pop" style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                      Got {wonSticker}!
                    </div>
                  )}
                </div>

                {/* 3D Door Overlay */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
                  <Door3DCard
                    doorNumber={index + 1}
                    isOpen={isOpen}
                    isKnocking={isKnocking}
                    onClick={() => handleDoorClick(card)}
                  />
                </div>
              </div>

              {/* Clue Section */}
              <div style={{ 
                backgroundColor: '#fffbeb', 
                borderTop: '2px solid #fde68a', 
                padding: '6px 8px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                minHeight: '44px'
              }}>
                <span style={{ fontSize: '0.9rem' }}>🕵️</span>
                <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '600', color: '#1f2937', lineHeight: '1.1' }}>
                    {card.displayFact || "No clue"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Play Next Round Button */}
      {openedDoorId && gameState === 'PLAYING' && (
        <div style={{ textAlign: 'center', marginTop: '1rem', animation: 'fadeIn 0.3s ease-out' }}>
          <button type="button" className="btn-primary" onClick={startNewRound} style={{ margin: '0 auto', fontSize: '0.95rem', padding: '0.5rem 1.25rem' }}>
            Next Round ➡️
          </button>
        </div>
      )}

      {/* --- VICTORY OVERLAY --- */}
      {gameState === 'VICTORY' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          zIndex: 9999,
          color: '#fff',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2.5rem', color: '#fde047', marginBottom: '0.5rem' }}>🎉 VICTORY! 🎉</h1>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>You identified everyone in the family!</p>

          {unlockedGoldFrames && (
            <p style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #facc15', color: '#facc15', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              👑 PERFECT RUN! Golden Card Frames Unlocked!
            </p>
          )}
          <button 
            className="btn-primary" 
            onClick={() => {
              restartGame();
              startNewRound();
            }}
            style={{ fontSize: '1.1rem', padding: '0.85rem 1.75rem' }}
          >
            Play Again
          </button>
        </div>
      )}

      {/* --- GAME OVER OVERLAY --- */}
      {gameState === 'GAME_OVER' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          zIndex: 9999,
          color: '#fff',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2.2rem', color: '#f87171', marginBottom: '0.5rem' }}>Out of Hearts! 💔</h1>
          <p style={{ fontSize: '1rem', color: '#d1d5db', marginBottom: '1.5rem' }}>Nice try! Give it another shot!</p>
          <button 
            className="btn-primary" 
            onClick={() => {
              restartGame();
              startNewRound();
            }}
            style={{ fontSize: '1.1rem', padding: '0.85rem 1.75rem' }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};