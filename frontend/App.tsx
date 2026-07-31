import React, { useState, useEffect } from 'react';
import { SoundCard } from './types'; 
import { SoundboardView } from './src/components/SoundboardView';
import { KnockGame } from './src/components/GameView';
import { AdminView } from './src/components/AdminView';
import { StickerAlbum } from './src/components/StickerAlbumView';
import { useGameEngine } from './src/api/useGameEngine'; 
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { useApiClient } from './src/api/useApiClient'; // If this is inside src/api/, change to './src/api/useApiClient'
import './index.css';
import { StickerCanvas } from './src/components/StickerCanvasView'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GAME' | 'ALBUM' | 'CANVAS'>('GAME');
  const { apiFetch } = useApiClient();
  const [cards, setCards] = useState<SoundCard[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // 1. Persist sticker placements in state across tab switches
  const [cardDecorations, setCardDecorations] = useState<Record<string, number[]>>({});

  // 2. Game engine
  const gameEngine = useGameEngine(cards);
  const { inventory, resetAllProgress } = gameEngine;

  const fetchCards = async () => {
    try {
      const data = await apiFetch('/api/cards');
      if (data) {
        setCards(data); // Directly set the Array(5) into state!
      }
    } catch (err) {
      console.error('Failed to fetch cards:', err);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  return (
    <>
      <SignedOut>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f3f4f6',
          padding: '1rem'
        }}>
          <h1 style={{ marginBottom: '0.5rem', color: '#1f2937' }}>🔊 Family Soundboard</h1>
          <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>Sign in to play and manage your family soundboard</p>
          <SignIn />
        </div>
      </SignedOut>

      <SignedIn>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb'
        }}>
          {!isAdminOpen && (
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '12px' }}>
              <button
                onClick={() => setActiveTab('GAME')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'GAME' ? '#ffffff' : 'transparent',
                  boxShadow: activeTab === 'GAME' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: activeTab === 'GAME' ? '#1f2937' : '#6b7280'
                }}
              >
                🎮 Play Game
              </button>
              <button
                onClick={() => setActiveTab('ALBUM')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'ALBUM' ? '#ffffff' : 'transparent',
                  boxShadow: activeTab === 'ALBUM' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: activeTab === 'ALBUM' ? '#1f2937' : '#6b7280'
                }}
              >
                📖 Sticker Book ({inventory.length})
              </button>
              <button
                onClick={() => setActiveTab('CANVAS')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'CANVAS' ? '#ffffff' : 'transparent',
                  boxShadow: activeTab === 'CANVAS' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: activeTab === 'CANVAS' ? '#1f2937' : '#6b7280'
                }}
              >
                🎨 Doodle Board
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setIsAdminOpen(!isAdminOpen)}
            >
              {isAdminOpen ? '🎮 Back to Game' : '⚙️ Parent Admin'}
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main style={{ padding: '1.5rem' }}>
          {isAdminOpen ? (
            <AdminView 
              cards={cards} 
              onRefresh={fetchCards} 
              onClose={() => setIsAdminOpen(false)} 
            />
          ) : (
            <>
              {activeTab === 'GAME' && (
                <KnockGame 
                  cards={cards}
                  engine={gameEngine} 
                  onRewardSticker={(cardId: string, sticker: any) => {
                    console.log('Reward earned:', cardId, sticker);
                  }}
                />
              )}
              {activeTab === 'ALBUM' && (
                <StickerAlbum 
                  inventory={inventory} 
                  cards={cards} 
                  cardDecorations={cardDecorations}
                  onUpdateDecorations={setCardDecorations}
                  onBackToGame={() => setActiveTab('GAME')} 
                  onRestartGame={() => {
                    setCardDecorations({});
                    resetAllProgress();
                  }}
                />
              )}  
              {activeTab === 'CANVAS' && (
                <StickerCanvas 
                  inventory={inventory} 
                  onBackToGame={() => setActiveTab('GAME')} 
                />
              )}
            </>
          )}
        </main>
      </SignedIn>
    </>
  );
};

export default App;