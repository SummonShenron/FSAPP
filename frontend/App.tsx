import React, { useState, useEffect } from 'react';
import { SoundCard } from './types'; 
import { KnockGame } from './src/components/GameView';
import { AdminView } from './src/components/AdminView';
import { StickerAlbum } from './src/components/StickerAlbumView';
import { useGameEngine } from './src/api/useGameEngine'; 
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';
import { useApiClient } from './src/api/useApiClient';
import './index.css';
import { StickerCanvas } from './src/components/StickerCanvasView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GAME' | 'ALBUM' | 'CANVAS'>('GAME');
  const { apiFetch } = useApiClient();
  const [cards, setCards] = useState<SoundCard[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [gameScreen, setGameScreen] = useState<'START' | 'PLAYING'>('START');
  const [cardDecorations, setCardDecorations] = useState<Record<string, number[]>>({});
  
  // 🔑 Guest Mode state initialized from localStorage to survive refreshes
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('guest_token') === 'guest-sandbox-token';
  });

  const gameEngine = useGameEngine(cards);
  const { inventory, resetAllProgress, savedCardIds, addSticker } = gameEngine;

  const fetchCards = async () => {
    try {
      const data = await apiFetch('/api/cards');
      if (data) {
        setCards(data);
      }
    } catch (err) {
      console.error('Failed to fetch cards:', err);
    }
  };

  // 🔑 Trigger fetchCards whenever `isGuest` changes
  useEffect(() => {
    fetchCards();
  }, [isGuest]);

  // Helper function: standard game layout (Header + Active Tab Content)
  const renderAppContent = () => (
    <>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        backgroundColor: isGuest ? '#eff6ff' : '#ffffff',
        borderBottom: isGuest ? '1px solid #bfdbfe' : '1px solid #e5e7eb'
      }}>
        {!isAdminOpen && (
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => {
                setActiveTab('GAME');
                setGameScreen('START');
              }}
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
          {/* 🔑 Unlocked Admin View for Guests/Recruiters */}
          <button 
            className="btn-secondary" 
            onClick={() => setIsAdminOpen(!isAdminOpen)}
          >
            {isAdminOpen ? '🎮 Back to Game' : '⚙️ Admin View'}
          </button>

          {isGuest ? (
            <button 
              onClick={() => {
                localStorage.removeItem('guest_token');
                setIsGuest(false);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontWeight: 'bold',
                cursor: 'pointer',
                color: '#334155'
              }}
            >
              Exit Guest Mode
            </button>
          ) : (
            <UserButton afterSignOutUrl="/" />
          )}
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
                gameScreen={gameScreen}   
                setGameScreen={setGameScreen}
                onRewardSticker={(cardId: string, sticker: any) => {
                  console.log('Reward earned:', cardId, sticker);
                  addSticker(sticker);
                }}
              />
            )}
            {activeTab === 'ALBUM' && (
              <StickerAlbum 
                inventory={gameEngine.inventory} 
                cards={cards} 
                savedCardIds={gameEngine.savedCardIds}
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
                inventory={gameEngine.inventory} 
                onBackToGame={() => setActiveTab('GAME')} 
              />
            )}
          </>
        )}
      </main>
    </>
  );

  // Single main component return
  return (
    <>
      {/* 1. GUEST MODE ACTIVE */}
      {isGuest && renderAppContent()}

      {/* 2. AUTHENTICATED / SIGN-IN MODE */}
      {!isGuest && (
        <>
          <SignedOut>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              backgroundColor: '#f3f4f6',
              padding: '1rem',
              boxSizing: 'border-box'
            }}>
              {/* Page Title & Subtitle */}
              <h1 style={{ margin: '0 0 0.25rem 0', color: '#1f2937', fontSize: '1.75rem' }}>🔊 Family Soundboard</h1>
              <p style={{ margin: '0 0 1rem 0', color: '#4b5563', fontSize: '0.9rem' }}>Sign in to play and manage your family soundboard</p>
              
              {/* Compact Clerk Sign-In Panel */}
              <SignIn 
                appearance={{
                  elements: {
                    cardBox: { boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', borderRadius: '12px' },
                    card: { padding: '1.25rem 1.5rem', gap: '0.75rem' },
                    headerTitle: { display: 'none' },
                    headerSubtitle: { display: 'none' },
                    header: { padding: '0', margin: '0' },
                    socialButtonsBlockButton: { minHeight: '38px' },
                    formFieldInput: { minHeight: '38px' },
                    formButtonPrimary: { minHeight: '38px' },
                    dividerRow: { margin: '0.5rem 0' },
                    formFieldRow: { marginBottom: '0.5rem' },
                    footer: { padding: '0.75rem 0 0 0', marginTop: '0' },
                    footerAction: { marginTop: '0' }
                  }
                }}
              />

              {/* Guest / Recruiter Mode Section */}
              <div style={{
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                borderTop: '1px solid #e5e7eb',
                paddingTop: '1rem',
                width: '100%',
                maxWidth: '380px'
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                  Recruiters / Trial access:
                </p>
                <button
                  onClick={() => {
                    localStorage.setItem('guest_token', 'guest-sandbox-token');
                    setIsGuest(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  🎮 Play Demo as Guest (Recruiter Mode)
                </button>
              </div>
            </div>
          </SignedOut>

          <SignedIn>
            {renderAppContent()}
          </SignedIn>
        </>
      )}
    </>
  );
};

export default App;