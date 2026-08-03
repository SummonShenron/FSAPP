import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { SoundCard } from '../../types';
import './__styles__/GameView.css';
import { useGameEngine } from '../api/useGameEngine';
import { playModifiedAudio, VoiceFilter } from '../utils/audioFilters';
import { PivotControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type MonsterFeature = 'SILHOUETTE' | 'EYE' | 'CLAW' | 'WARNING' | 'FOG';

interface Props {
  cards: SoundCard[];
  onRewardSticker: (cardId: string, stickerEmoji: string) => void;
  engine: ReturnType<typeof useGameEngine>;
  gameScreen: 'START' | 'PLAYING';
  setGameScreen: (screen: 'START' | 'PLAYING') => void;
}

export interface DoorColor {
  background: string;
  border: string;
  highlight: string;
}

interface Door3DCardProps {
  isOpen: boolean;
  isAjar?: boolean;
  isKnocking: boolean;
  onClick: () => void;
  doorNumber: number;
  color?: DoorColor;
  monsterFeature?: MonsterFeature;
}

interface RoundCard extends SoundCard {
  displayPhoto: string;
  displayFact: string;
}

// ----------------------------------------------------
// Silly Monster Definitions
// ----------------------------------------------------
interface SillyMonster {
  id: string;
  name: string;
  avatar: string;
  soundUrl: string;
  quote: string;
  clue: string;
}

export const DOOR_COLORS: DoorColor[] = [
  { background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)', border: '#1e40af', highlight: '#60a5fa' }, // Blue
  { background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)', border: '#991b1b', highlight: '#fca5a5' }, // Red
  { background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', border: '#065f46', highlight: '#6ee7b7' }, // Green
  { background: 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)', border: '#5b21b6', highlight: '#c4b5fd' }, // Purple
  { background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)', border: '#92400e', highlight: '#fde68a' }, // Orange/Gold
  { background: 'linear-gradient(180deg, #ec4899 0%, #db2777 100%)', border: '#9d174d', highlight: '#fbcfe8' }, // Pink
  { background: 'linear-gradient(180deg, #06b6d4 0%, #0891b2 100%)', border: '#164e63', highlight: '#67e8f9' }, // Cyan
];

const SILLY_MONSTERS: SillyMonster[] = [
  {
    id: 'm1',
    name: 'Giggles the Blob',
    avatar: '👾',
    soundUrl: '/blob-scare.mp3',
    quote: 'BOO! Gotcha!',
    clue: 'Loves purple jelly & tickles!',
  },
  {
    id: 'm2',
    name: 'Barnaby Big-Mouth',
    avatar: '👹',
    soundUrl: '/mixkit-beast-long-roar-306.wav',
    quote: 'RAWR! (Gimme cookies!)',
    clue: 'Always hungry for chocolate chip cookies!',
  },
  {
    id: 'm3',
    name: 'Snicker-Doodle',
    avatar: '👽',
    soundUrl: '/mixkit-little-devil-laughing-413.wav',
    quote: 'TEE-HEE! Wrong door!',
    clue: 'Wears polka dot socks everywhere!',
  },
  {
    id: 'm4',
    name: 'Fuzzy Wuzzy',
    avatar: '👺',
    soundUrl: '/mixkit-monster-scream-1961.wav',
    quote: 'BOING! Not here!',
    clue: 'Loves to jump on trampolines!',
  },
  {
    id: 'm5',
    name: 'Bubbles the Yeti',
    avatar: '👻',
    soundUrl: '/mixkit-air-whoosh-1491.wav',
    quote: 'WOOSH! Secret Monster!',
    clue: 'Enjoys warm bubble baths!',
  },
];

type DoorSlot = (
  | { type: 'PERSON'; id: string; card: RoundCard; displayFact: string; color: DoorColor }
  | { type: 'MONSTER'; id: string; monster: SillyMonster; displayFact: string; color: DoorColor }
) & { monsterFeature: MonsterFeature };

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
  
  const SWING_ANGLE = Math.PI * 0.77; 
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
// Door Component
// ----------------------------------------------------
export const CSSDoorCard: React.FC<Door3DCardProps> = ({
  isOpen,
  isAjar = false,
  isKnocking = false,
  onClick,
  doorNumber,
  color = DOOR_COLORS[0],
  monsterFeature,
}) => {
  const doorState = isOpen ? 'open' : isAjar ? 'ajar' : 'closed';

  return (
    <div
      onClick={onClick}
      className={`css-door-container ${isKnocking ? 'knocking' : ''}`}
      style={{ position: 'relative' }} // Ensure the mask positions correctly inside the container
    >
      {/* ✨ NEW: Black interior mask to hide the monster until opened */}
      <div
        className="doorway-interior-mask"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'black',
          zIndex: 1, // Sits behind the door panel, but in front of the monster
          transition: 'opacity 0.3s ease',
          opacity: isOpen ? 0 : 1, // Fades away when the door opens!
          pointerEvents: 'none', // Prevents this layer from blocking clicks
        }}
      >
        {/* ✨ FIXED: Positioned perfectly inside the black doorway */}
        {isAjar && !isOpen && (
          <div
            className="eyes-in-shadow"
            style={{
              position: 'absolute',
              left: '85%',
              top: '50%',
              transform: 'translate(-50%, -50%)', // Centers the eyes perfectly
              fontSize: '2.5rem', // Ensures they are large enough to see
              zIndex: 2,
            }}
          >
            👀
          </div>
        )}
      </div>

      {/* The 3D Door Panel */}
      <div
        className={`css-door-panel ${doorState}`}
        style={{
          background: color.background,
          borderColor: color.border,
          borderRightColor: color.highlight,
          zIndex: 5, // Ensures the door sits above the black interior mask
        }}
      >
        {doorNumber && (
          <div className="door-number-overlay-badge">
            Door #{doorNumber}
          </div>
        )}

        {/* {!isOpen && monsterFeature === 'SILHOUETTE' && (
          <div className="door-window-arch">
            <div className="shadow-silhouette">👹</div>
          </div>
        )} */}

        {!isOpen && monsterFeature === 'EYE' ? (
          <div className="keyhole-eye-container">
            <div className="monster-pupil" />
          </div>
        ) : (
          !isOpen && <span className="css-door-knob" />
        )}

        {!isOpen && monsterFeature === 'WARNING' && (
          <div className="monster-warning-sticker">KEEP OUT!</div>
        )}

        {!isOpen && monsterFeature === 'CLAW' && (
          <div className="bottom-monster-peek">👾</div>
        )}
{/* 
        {!isOpen && monsterFeature === 'FOG' && (
          <div className="bottom-smoke-puff">💨 💨</div>
        )} */}
      </div>
    </div>
  );
};

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
    resetAllProgress,
  } = engine;
  const API_BASE_URL =
    import.meta.env.VITE_API_URL ||
    (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '192.168.1.6'
      ? 'http://192.168.1.6:8000'
      : 'https://fsapp-ci88.onrender.com');
  const resolveAudioUrl = (audioPath: string) => {
    if (!audioPath) return '';
    
    if (audioPath.startsWith('http')) {
      // If it's an external link (not hosted on your server), wrap it in the proxy
      if (!audioPath.startsWith(API_BASE_URL) && !audioPath.startsWith(window.location.origin)) {
        return `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(audioPath)}`;
      }
      return audioPath;
    }
    
    return `${API_BASE_URL}${audioPath.startsWith('/') ? '' : '/'}${audioPath}`;
  };
  const playPublicSound = (audioPath: string, volume = 0.5) => {
    const audio = new Audio(audioPath);
    audio.volume = volume;
    audio.play().catch(() => {});
  };
  const playMonsterDoorSound = (audioUrl: string) => {
    const finalUrl = audioUrl.startsWith('/')
      ? new URL(audioUrl, window.location.origin).toString()
      : resolveAudioUrl(audioUrl);
    const audio = new Audio(finalUrl);
    audio.volume = 0.55;
    audio.play().catch(() => {});
  };
  const playRoundTransitionSound = () => {
    playPublicSound('/mixkit-arrow-whoosh-1491.wav', 0.35);
  };
  const playDoorRevealSound = () => {
    playPublicSound('/mixkit-cinematic-wind-swoosh-1471.wav', 0.35);
  };
  const playDoorOpenSound = () => {
    playPublicSound('/mixkit-creaky-door-open-195.wav', 0.45);
  };
  const playDoorShutSound = () => {
    playPublicSound('/mixkit-automatic-door-shut-204.wav', 0.45);
  };
  const playCorrectDoorSound = () => {
    playPublicSound('/mixkit-one-man-clapping-482.wav', 0.55);
  };
  const [targetCard, setTargetCard] = useState<RoundCard | null>(null);
  const [doorSlots, setDoorSlots] = useState<DoorSlot[]>([]);
  const [activeFilter, setActiveFilter] = useState<VoiceFilter>('normal');
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const [isKnocking, setIsKnocking] = useState(false);
  const [wonSticker, setWonSticker] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'START' | 'GAME'>('START');
  const [showNewGameWarning, setShowNewGameWarning] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const WHOOSH_SOUND_URL = '/whoosh.mp3';
  const [roundKey, setRoundKey] = useState<number>(1);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [ajarDoorId, setAjarDoorId] = useState<string | null>(null);
  const startNewRound = () => {
    // 1. Guard clause: ensure we have cards to play with
    if (cards.length < 1) return;

    playDoorRevealSound();

    // Increment round key to force animation reset
    setRoundKey(prev => prev + 1);
    
    // 2. Pick 1 random person from family sound cards
    const randomPersonCard = cards[Math.floor(Math.random() * cards.length)];
    const allPhotos = (randomPersonCard.photo_urls && randomPersonCard.photo_urls.length > 0)
      ? randomPersonCard.photo_urls
      : (randomPersonCard.photo_url ? [randomPersonCard.photo_url] : ['https://via.placeholder.com/150']);
    const randomPhoto = allPhotos[Math.floor(Math.random() * allPhotos.length)];

    const allFacts = (randomPersonCard.facts && randomPersonCard.facts.length > 0)
      ? randomPersonCard.facts
      : (randomPersonCard.fact ? [randomPersonCard.fact] : ['No clue provided']);
    const randomFact = allFacts[Math.floor(Math.random() * allFacts.length)];

    const personRoundCard: RoundCard = {
      ...randomPersonCard,
      displayPhoto: randomPhoto,
      displayFact: randomFact,
    };

    // 3. Pick 2 unique random trickster monsters
    const shuffledMonsters = [...SILLY_MONSTERS].sort(() => 0.5 - Math.random());
    const selectedMonsters = shuffledMonsters.slice(0, 2);

    // 4. Gather fake family clues for the monster doors to disguise them!
    const allOtherFacts = cards
      .filter(c => c.id !== randomPersonCard.id)
      .flatMap(c => (c.facts && c.facts.length > 0) ? c.facts : (c.fact ? [c.fact] : []));
    
    let fakeFactsPool = [...allOtherFacts];
    if (fakeFactsPool.length < 2) {
      fakeFactsPool = [
        ...fakeFactsPool, 
        "Loves to eat pizza!", 
        "Always wearing silly hats", 
        "Loves playing hide and seek", 
        "Can run super fast!"
      ];
    }
    fakeFactsPool.sort(() => 0.5 - Math.random());

    // 5. Pick 3 unique random door colors & feature details
    const shuffledColors = [...DOOR_COLORS].sort(() => 0.5 - Math.random());
    const ALL_FEATURES: MonsterFeature[] = ['SILHOUETTE', 'EYE', 'CLAW', 'WARNING', 'FOG'];
    const shuffledFeatures = [...ALL_FEATURES].sort(() => 0.5 - Math.random());

    // 6. Assemble the 3 door slots with features and colors
    const personSlot: DoorSlot = {
      type: 'PERSON',
      id: personRoundCard.id,
      card: personRoundCard,
      displayFact: personRoundCard.displayFact,
      color: shuffledColors[0],
      monsterFeature: shuffledFeatures[0],
    };

    const monsterSlots: DoorSlot[] = selectedMonsters.map((monster, index) => ({
      type: 'MONSTER',
      id: monster.id,
      monster,
      displayFact: fakeFactsPool[index] || "Loves telling silly jokes!", 
      color: shuffledColors[index + 1],
      monsterFeature: shuffledFeatures[index + 1],
    }));

    // 7. Shuffle all slots together & set state
    const allSlots = [personSlot, ...monsterSlots].sort(() => 0.5 - Math.random());
    const randomFilter = VOICE_FILTERS[Math.floor(Math.random() * VOICE_FILTERS.length)];

    setDoorSlots(allSlots);
    setTargetCard(personRoundCard);
    setActiveFilter(randomFilter);
    setSelectedDoorId(null);
    setWonSticker(null);
    setIsKnocking(false);
  };
  const handleNextRound = () => {
    if (isExiting) return; // Prevent double-clicking during animation
    playRoundTransitionSound();
    setIsExiting(true);
    // Wait for exit animation & stagger delay to complete (approx 550ms)
    setTimeout(() => {
      startNewRound();
      setIsExiting(false);
    }, 700);
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
    const fullAudioUrl = resolveAudioUrl(audioPath);

    const audio = playModifiedAudio(fullAudioUrl, activeFilter);

    if (audio) {
      audio.onended = () => setIsKnocking(false);
    } else {
      setTimeout(() => setIsKnocking(false), 1200);
    }
  };

  const WRONG_DOOR_SCARE_SOUNDS = [
    'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2218/2218-preview.mp3',
    'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  ];

  const playWrongDoorScare = (monsterId?: string) => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  const derivedIndex = monsterId
    ? [...monsterId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3
    : Math.floor(Math.random() * 3);

  if (derivedIndex === 0) {
    // 1) Sharp buzz
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();

    oscA.type = 'sawtooth';
    oscB.type = 'square';

    oscA.frequency.setValueAtTime(260, ctx.currentTime);
    oscA.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.24);

    oscB.frequency.setValueAtTime(180, ctx.currentTime);
    oscB.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 0.24);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.28);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(master);

    oscA.start();
    oscB.start();
    oscA.stop(ctx.currentTime + 0.28);
    oscB.stop(ctx.currentTime + 0.28);
  } else if (derivedIndex === 1) {
    // 2) Wobble whine
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(56, ctx.currentTime + 0.32);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.32);
    filter.Q.value = 0.9;

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(master);

    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } else {
    // 3) Gritty screech
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) {
      channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / channel.length, 2);
    }

    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    noise.buffer = noiseBuffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(900, ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.28);

    noiseGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);

    noise.start();
    noise.stop(ctx.currentTime + 0.28);
  }
};

  const handleDoorClick = (slot: DoorSlot) => {
    if (selectedDoorId || gameState !== 'PLAYING') return;

    playDoorOpenSound();
    setSelectedDoorId(slot.id);
    setIsKnocking(false);

    if (slot.type === 'PERSON') {
      submitGuess(true, slot.card.id);
      playCorrectDoorSound();
      const clips = (slot.card as any).audio_clips || [];
      const audioPath = clips.length > 0 ? clips[0].audio_url : (slot.card as any).audio_url;

      if (audioPath) {
        const fullUrl = resolveAudioUrl(audioPath);
        playModifiedAudio(fullUrl, 'normal');
      }

      const reward = STICKERS[Math.floor(Math.random() * STICKERS.length)];
      setWonSticker(reward);
      onRewardSticker(slot.card.id, reward);
    } else {
      submitGuess(false);
      playMonsterDoorSound(slot.monster.soundUrl);
    }
  };

  useEffect(() => {
    // Don't trigger while the start screen is visible, the game isn't playing,
    // a door is open, or we are transitioning.
    if (currentScreen !== 'GAME' || gameState !== 'PLAYING' || selectedDoorId !== null || isExiting) {
      setAjarDoorId(null);
      return;
    }
    const ajarInterval = setInterval(() => {
      // 40% chance to trigger every 3 seconds
      if (Math.random() > 0.6 && doorSlots.length > 0) {
        // Pick a random door slot
        const randomSlot = doorSlots[Math.floor(Math.random() * doorSlots.length)];
        setAjarDoorId(randomSlot.id);
        playDoorOpenSound();

        // Snap the door shut after 1.5 seconds
        setTimeout(() => {
          setAjarDoorId(null);
          playDoorShutSound();
        }, 1500);
      }
    }, 3000);

    return () => clearInterval(ajarInterval);
  }, [doorSlots, currentScreen, gameState, selectedDoorId, isExiting]);
  
  // --- START SCREEN VIEW ---
  if (currentScreen === 'START') {
    return (
      <div className="start-screen-container">
        {/* Floating Background Stickers */}
        <div className="bg-sticker bg-sticker-1">⭐</div>
        <div className="bg-sticker bg-sticker-2">🦄</div>
        <div className="bg-sticker bg-sticker-3">🎉</div>
        <div className="bg-sticker bg-sticker-4">🚀</div>
        <div className="bg-sticker bg-sticker-5">👑</div>
        <div className="bg-sticker bg-sticker-6">🌈</div>

        {/* Center Door */}
        <div className="start-screen-door-wrapper">
          <div className="ajar-door-frame">
            <div className="eyes-in-shadow">👀</div>
            <div className="ajar-door-panel">
              <span className="ajar-door-knob">🟡</span>
            </div>
          </div>
        </div>

        {/* Title & Buttons */}
        <div className="start-screen-controls">
          <div>
            <h1 className="start-screen-title">Who's Behind the Door? 🚪</h1>
            <p className="start-screen-subtitle">Listen closely to the voice! Watch out for goofy monsters!</p>
          </div>

          <div className="start-screen-btn-group">
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => setShowNewGameWarning(true)}
            >
              ✨ New Game
            </button>

            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => setCurrentScreen('GAME')}
              style={{ padding: '0.85rem 1.5rem', fontSize: '1.05rem', cursor: 'pointer' }}
            >
              ▶️ Continue ({inventory.length} Stickers)
            </button>

            {/* How to Play Collapsible */}
            <div className="how-to-play-container">
              <button 
                type="button" 
                className="how-to-play-toggle"
                onClick={() => setShowHowToPlay(!showHowToPlay)}
              >
                <span>❓ How to Play</span>
                <span>{showHowToPlay ? '▲' : '▼'}</span>
              </button>

              {showHowToPlay && (
                <div className="how-to-play-content">
                  <p>
                    <strong>1. Listen:</strong> Click <strong>Knock & Listen</strong> to hear who is hiding.
                  </p>
                  <p>
                    <strong>2. Clues:</strong> Read the clues under each door.
                  </p>
                  <p>
                    <strong>3. Watch Out:</strong> Only 1 door has your family member—the other 2 have goofy monsters!
                  </p>
                </div>
              )}
              {/* ✨ NEW: Cost-Sensitive Infrastructure Notice */}
            <div style={{
              marginTop: '1rem',
              padding: '0.8rem 1rem',
              borderRadius: 8,
              background: 'linear-gradient(90deg, rgba(255,249,230,1) 0%, rgba(255,243,230,1) 100%)',
              border: '1px solid #f59e0b',
              color: '#92400e',
              textAlign: 'left',
              fontSize: '0.82rem',
              lineHeight: '1.4'
            }}>
              <strong>Server Notice:</strong> We run on cost‑sensitive infrastructure. If sounds or round actions take a moment to load after inactivity, the backend server may be waking up. Please wait 30–60 seconds if a request hangs!
            </div>
            </div>
          </div>
        </div>

        {showNewGameWarning && (
          <div className="warning-modal-overlay">
            <div className="warning-modal-content">
              <h2 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.5rem' }}>⚠️ Start Fresh?</h2>
              <p style={{ color: '#475569', marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: '1.4' }}>
                This will reset your hearts and clear <strong>all your collected stickers</strong> back to zero!
              </p>
              <p style={{ color: '#475569', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.4' }}>
                To keep your current stickers, select <strong>Continue</strong> instead.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowNewGameWarning(false)}
                  style={{ padding: '0.6rem 1rem' }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setShowNewGameWarning(false);
                    resetAllProgress();
                    startNewRound();
                    setCurrentScreen('GAME');
                  }}
                  style={{ padding: '0.6rem 1rem', background: '#ef4444', borderColor: '#dc2626' }}
                >
                  Reset Game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- GAME PLAYING VIEW ---
  return (
    <div className="knock-game-container" style={{ maxWidth: '650px', margin: '0 auto', padding: '0.5rem', position: 'relative', overflowX: 'hidden' }}> 
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

      {/* 3-Column 3D Doors Grid */}
      <div className="doors-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        {doorSlots.map((slot, index) => {
          // If ANY door was selected, swing ALL of them open so the user can see everything!
          const isRevealed = selectedDoorId !== null;
          
          // But only apply the glowing/shaking effect to the ONE door they actually clicked.
          const isClicked = selectedDoorId === slot.id; 
          const isPerson = slot.type === 'PERSON';

          return (
            <div 
              key={`round-${roundKey}-door-${slot.id}`} 
              className={isExiting ? 'door-slide-exit' : 'door-slide-enter'}
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

              {/* Behind Door Area */}
              <div style={{ position: 'relative', height: '180px', backgroundColor: '#1c1917' }}>
                <div 
                  className={`revealed-card ${isClicked ? (isPerson ? 'correct-glow' : 'wrong-shake') : ''}`}
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
                  {isPerson ? (
                    // PERSON REVEAL
                    <>
                      <img 
                        src={slot.card.displayPhoto} 
                        alt={slot.card.title} 
                        style={{
                          width: '65px',
                          height: '65px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #3b82f6',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                        }}
                      />
                      <h4 style={{ margin: '6px 0 0 0', color: '#ffffff', fontSize: '0.85rem', textAlign: 'center' }}>{slot.card.title}</h4>
                      {isClicked && wonSticker && (
                        <div className="sticker-reward-pop" style={{ marginTop: '4px', fontSize: '0.75rem', color: '#facc15' }}>
                          Got {wonSticker}!
                        </div>
                      )}
                    </>
                  ) : (
                    // MONSTER JUMP SCARE REVEAL
                    <div className="monster-reveal-pop" style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '3rem', display: 'block', animation: 'monsterBounce 0.5s infinite alternate' }}>
                        {slot.monster.avatar}
                      </span>
                      <h4 style={{ margin: '4px 0 2px 0', color: '#f87171', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        {slot.monster.name}
                      </h4>
                      <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.65rem', fontStyle: 'italic', lineHeight: '1.1' }}>
                        "{slot.monster.quote}"
                      </p>
                    </div>
                  )}
                </div>

                {/* 3D Door Overlay */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
                  <CSSDoorCard
                    doorNumber={index + 1}
                    isOpen={isRevealed && !isExiting}
                    isAjar={ajarDoorId === slot.id}
                    isKnocking={isKnocking}
                    color={slot.color}
                    monsterFeature={slot.monsterFeature}
                    onClick={() => handleDoorClick(slot)}
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
                    {slot.displayFact}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Play Next Round Button */}
      {selectedDoorId && gameState === 'PLAYING' && (
        <div style={{ textAlign: 'center', marginTop: '1rem', animation: 'fadeIn 0.3s ease-out' }}>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleNextRound}
            disabled={isExiting}
            style={{ margin: '0 auto', fontSize: '0.95rem', padding: '0.5rem 1.25rem', cursor: 'pointer' }}
          >
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
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>You identified everyone and outsmarted all the monsters!</p>

          {unlockedGoldFrames && (
            <p style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #facc15', color: '#facc15', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              👑 PERFECT RUN! Golden Card Frames Unlocked!
            </p>
          )}
          <button 
            className="btn-primary" 
            onClick={() => {
              restartGame();
              handleNextRound();
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
          <p style={{ fontSize: '1rem', color: '#d1d5db', marginBottom: '1.5rem' }}>The monsters tricked you! Give it another shot!</p>
          <button 
            className="btn-primary" 
            onClick={() => {
              restartGame();
              handleNextRound();
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