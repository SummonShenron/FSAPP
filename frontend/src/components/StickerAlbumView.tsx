import React, { useState } from 'react';
import { Sticker, StickerRarity } from '../stickers/Stickers';
import { SoundCard } from '../../types';

interface StickerAlbumProps {
  inventory: Sticker[];
  cards: SoundCard[];
  cardDecorations?: Record<string, number[]>;
  onUpdateDecorations: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
  onBackToGame: () => void;
  onRestartGame: () => void;
}

export const StickerAlbum: React.FC<StickerAlbumProps> = ({
  inventory = [],
  cards = [],
  cardDecorations = {},
  onUpdateDecorations = () => {},
  onBackToGame,
  onRestartGame
}) => {
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState<number | null>(null);

  // 1. Get all inventory indices already pinned onto cards
  const safeDecorations = cardDecorations || {};
  const placedIndices = new Set(Object.values(safeDecorations).flat());

  // 2. Filter available inventory to items that HAVEN'T been placed yet
  const availableInventory = inventory
    .map((sticker, index) => ({ sticker, index }))
    .filter(({ index }) => !placedIndices.has(index));

  // 3. Group AVAILABLE stickers by unique ID while preserving exact inventory indices
  const groupedStickers = availableInventory.reduce((acc, { sticker, index }) => {
    if (!acc[sticker.id]) {
      acc[sticker.id] = { sticker, indices: [] };
    }
    acc[sticker.id].indices.push(index);
    return acc;
  }, {} as Record<string, { sticker: Sticker; indices: number[] }>);

  const stickerList = Object.values(groupedStickers);

  // 4. Pin the selected sticker onto a card
  const handleStickToCard = (cardId: string) => {
    if (selectedInventoryIndex === null) return;

    onUpdateDecorations((prev = {}) => ({
      ...prev,
      [cardId]: [...(prev[cardId] || []), selectedInventoryIndex],
    }));

    // Deselect after placing
    setSelectedInventoryIndex(null);
  };

  const handleRestartConfirm = () => {
    if (window.confirm("Restart game with full lives? WARNING: You will lose all your collected stickers! 🗑️")) {
      onRestartGame();
      onBackToGame();
    }
  };

  const selectedSticker = selectedInventoryIndex !== null ? inventory[selectedInventoryIndex] : null;

  const renderRaritySection = (rarity: StickerRarity, title: string, colorClass: string) => {
    const items = stickerList.filter((item) => item.sticker.rarity === rarity);

    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: colorClass, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title} ({items.length})
        </h3>
        {items.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>No available stickers in this tier!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
            {items.map(({ sticker, indices }) => {
              // Take the first available unplaced inventory index for this sticker type
              const targetIndex = indices[0];
              const isSelected = selectedInventoryIndex === targetIndex;

              return (
                <button
                  key={sticker.id}
                  onClick={() => setSelectedInventoryIndex(isSelected ? null : targetIndex)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem',
                    borderRadius: '16px',
                    backgroundColor: isSelected ? '#fef08a' : '#ffffff',
                    border: isSelected ? '3px solid #eab308' : '2px solid #f3f4f6',
                    boxShadow: isSelected ? '0 4px 12px rgba(234, 179, 8, 0.4)' : '0 2px 8px rgba(0,0,0,0.05)',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '2.2rem' }}>{sticker.icon}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#374151', marginTop: '4px' }}>
                    {sticker.name}
                  </span>

                  {/* Show count of available duplicates */}
                  {indices.length > 1 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      backgroundColor: '#ec4899',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '12px',
                    }}>
                      x{indices.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', margin: 0, color: '#1f2937' }}>📖 Sticker Scrapbook</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
            {availableInventory.length} available / {inventory.length} total stickers
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleRestartConfirm}
            style={{
              fontSize: '0.85rem',
              padding: '0.6rem 0.9rem',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              borderRadius: '12px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🔄 Restart Game
          </button>

          <button
            onClick={onBackToGame}
            className="btn-primary"
            style={{ fontSize: '0.9rem', padding: '0.6rem 1rem' }}
          >
            🎮 Back to Game
          </button>
        </div>
      </div>

      {/* Active Selection Banner */}
      {selectedSticker && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '2px dashed #f59e0b',
          borderRadius: '16px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          animation: 'popIn 0.2s ease-out'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#92400e', fontSize: '0.95rem' }}>
            {selectedSticker.icon} Tap a card below to place this sticker!
          </p>
        </div>
      )}

      {/* Sticker Categories */}
      <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '20px', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
        {renderRaritySection('LEGENDARY', '👑 Legendary Stickers', '#d97706')}
        {renderRaritySection('RARE', '🚀 Rare Stickers', '#7c3aed')}
        {renderRaritySection('COMMON', '⭐ Common Stickers', '#2563eb')}
      </div>

      {/* Decoration Board */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem' }}>
        🖼️ Decorate Your Family Cards
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
        {cards.map((card) => {
          const placedIndicesOnCard = safeDecorations[card.id] || [];

          return (
            <div
              key={card.id}
              onClick={() => handleStickToCard(card.id)}
              style={{
                position: 'relative',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '0.75rem',
                border: selectedInventoryIndex !== null ? '3px dashed #10b981' : '1px solid #e5e7eb',
                textAlign: 'center',
                cursor: selectedInventoryIndex !== null ? 'pointer' : 'default',
                boxShadow: selectedInventoryIndex !== null ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 2px 6px rgba(0,0,0,0.05)',
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <img
                src={card.photo_url || card.photo_urls?.[0] || 'https://via.placeholder.com/100'}
                alt={card.title}
                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', marginTop: '6px', color: '#374151' }}>
                {card.title}
              </span>

              {/* Render placed stickers */}
              {placedIndicesOnCard.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
                  {placedIndicesOnCard.map((inventoryIdx, i) => (
                    <span key={i} style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
                      {inventory[inventoryIdx]?.icon}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};