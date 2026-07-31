import React from 'react';
import { SoundCard } from '../../types';

interface Props {
  cards: SoundCard[];
}

export const SoundboardView: React.FC<Props> = ({ cards }) => {
  const handleCardTap = (card: SoundCard) => {
    if (!card.audio_url) return;
    const audio = new Audio(card.audio_url);
    audio.play();
  };

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', margin: '3rem 0', color: 'var(--text-muted)' }}>
        <h2>No sound cards available yet!</h2>
      </div>
    );
  }

  return (
    <div className="soundboard-grid">
      {cards.map((card) => (
        <div
          key={card.id}
          className="sound-card"
          style={{ backgroundColor: card.bg_color || '#ffffff' }}
          onClick={() => handleCardTap(card)}
        >
          <div className="card-photo-wrapper">
            <img src={card.photo_url} alt={card.title} />
          </div>
          <div className="card-title">{card.title}</div>
          <div className="card-relation">{card.relation}</div>
        </div>
      ))}
    </div>
  );
};