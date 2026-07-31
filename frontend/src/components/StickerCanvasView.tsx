import React, { useRef, useState, useEffect } from 'react';
import { Sticker } from '../stickers/Stickers';
import { useApiClient } from '../api/useApiClient';

interface PlacedSticker {
  id: string;
  icon: string;
  x: number;
  y: number;
  inventoryIndex: number;
}

interface StickerCanvasProps {
  inventory: Sticker[];
  onBackToGame: () => void;
}

export const StickerCanvas: React.FC<StickerCanvasProps> = ({ inventory = [], onBackToGame }) => {
  const { apiFetch } = useApiClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drawing & Sticker state
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<'DRAW' | 'STICKER'>('DRAW');
  const [selectedInventoryIndex, setSelectedInventoryIndex] = useState<number | null>(null);
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);

  // AI Beautify state
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [aiResultUrl, setAiResultUrl] = useState<string | null>(null);

  // --- 1. SINGLE-USE INVENTORY TRACKING ---
  const usedIndices = new Set(placedStickers.map((p) => p.inventoryIndex));

  // Filter out stickers that have already been placed on the canvas
  const availableInventory = inventory
    .map((sticker, index) => ({ sticker, index }))
    .filter(({ index }) => !usedIndices.has(index));
  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, xPercent: 0, yPercent: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Percentage coordinates for accurate HTML sticker overlay rendering
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    return { x, y, xPercent, yPercent };
    };
  // Group available stickers by ID to display duplicate badges (e.g., x2)
  const groupedStickers = availableInventory.reduce((acc, { sticker, index }) => {
    if (!acc[sticker.id]) {
      acc[sticker.id] = { sticker, indices: [] };
    }
    acc[sticker.id].indices.push(index);
    return acc;
  }, {} as Record<string, { sticker: Sticker; indices: number[] }>);

  const stickerList = Object.values(groupedStickers);

  // --- 2. SETUP CANVAS STYLES ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
  }, []);

  // --- 3. EXPORT CANVAS WITH STICKERS ---
  const exportCanvasWithStickers = (): string | null => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = mainCanvas.width;
    tempCanvas.height = mainCanvas.height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    // Fill white background for AI vision
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw black lines
    ctx.drawImage(mainCanvas, 0, 0);

    // Draw placed emoji stickers onto the canvas export
    ctx.font = '42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    placedStickers.forEach((item) => {
      ctx.fillText(item.icon, item.x, item.y);
    });

    return tempCanvas.toDataURL('image/png');
  };

  // --- 4. AI MAGIC BEAUTIFY HANDLER ---
  const handleBeautify = async () => {
    const imageBase64 = exportCanvasWithStickers();
    if (!imageBase64) return;

    setIsBeautifying(true);
    try {
      const res = await apiFetch('/api/beautify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
      });

      const data = await res.json();
      if (data.resultUrl) {
        setAiResultUrl(data.resultUrl);
      }
    } catch (err) {
      alert('Failed to bring drawing to life! Please try again.');
    } finally {
      setIsBeautifying(false);
    }
  };

  // --- 5. DRAWING & STICKER PLACEMENT LOGIC ---

    // Helper function to calculate scaled canvas coordinates
    const getCanvasCoords = (
    e: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
    ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 🎯 Calculate scaled coordinates
    const { x, y } = getCanvasCoords(e, canvas);

    // Sticker Mode: Place selected sticker
    if (activeTool === 'STICKER' && selectedInventoryIndex !== null) {
        const stickerToPlace = inventory[selectedInventoryIndex];
        if (!stickerToPlace) return;

        const newPlaced: PlacedSticker = {
        id: `placed-${Date.now()}`,
        icon: stickerToPlace.icon,
        x,
        y,
        inventoryIndex: selectedInventoryIndex,
        };

        setPlacedStickers((prev) => [...prev, newPlaced]);

        // Automatically select duplicate if available, otherwise switch back to drawing
        const remainingOfSameType = availableInventory.filter(
        (item) => item.sticker.id === stickerToPlace.id && item.index !== selectedInventoryIndex
        );

        if (remainingOfSameType.length > 0) {
        setSelectedInventoryIndex(remainingOfSameType[0].index);
        } else {
        setSelectedInventoryIndex(null);
        setActiveTool('DRAW');
        }
        return;
    }

    // Line Drawing Mode
    if (activeTool === 'DRAW') {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    }
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== 'DRAW') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 🎯 Calculate scaled coordinates
    const { x, y } = getCanvasCoords(e, canvas);

    ctx.lineTo(x, y);
    ctx.stroke();
    };

    const stopDrawing = () => {
    setIsDrawing(false);
    };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setPlacedStickers([]);
    setSelectedInventoryIndex(null);
    setActiveTool('DRAW');
  };

  const selectedSticker = selectedInventoryIndex !== null ? inventory[selectedInventoryIndex] : null;

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '1rem', textAlign: 'center' }}>
      
      {/* Top Header & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1f2937' }}>🎨 Doodle Board</h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
            {availableInventory.length} available / {inventory.length} total stickers
          </p>
        </div>
        <button onClick={onBackToGame} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
          🎮 Back to Game
        </button>
      </div>

      {/* Toolbar Controls */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'center',
        marginBottom: '1rem',
        backgroundColor: '#f3f4f6',
        padding: '0.5rem',
        borderRadius: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => {
            setActiveTool('DRAW');
            setSelectedInventoryIndex(null);
          }}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
            backgroundColor: activeTool === 'DRAW' ? '#3b82f6' : '#ffffff',
            color: activeTool === 'DRAW' ? '#ffffff' : '#374151',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          ✏️ Draw Lines
        </button>

        <button
          onClick={handleClearCanvas}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #fca5a5',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🧼 Clear Board
        </button>

        {/* 🌟 MAGIC BEAUTIFY BUTTON */}
        <button
          onClick={handleBeautify}
          disabled={isBeautifying}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            cursor: isBeautifying ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(236, 72, 153, 0.4)',
            opacity: isBeautifying ? 0.7 : 1
          }}
        >
          {isBeautifying ? '🪄 Creating Magic...' : '✨ Magic Beautify!'}
        </button>
      </div>

      {/* Sticker Tray */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        padding: '0.75rem',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        marginBottom: '1rem',
        minHeight: '60px',
        alignItems: 'center'
      }}>
        {stickerList.length === 0 ? (
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', width: '100%' }}>
            {inventory.length === 0 
              ? 'No stickers unlocked yet! Play the game to earn rewards.' 
              : 'All unlocked stickers are currently placed on the board!'}
          </span>
        ) : (
          stickerList.map(({ sticker, indices }) => {
            const targetIndex = indices[0];
            const isSelected = activeTool === 'STICKER' && selectedInventoryIndex === targetIndex;

            return (
              <button
                key={sticker.id}
                onClick={() => {
                  setSelectedInventoryIndex(isSelected ? null : targetIndex);
                  setActiveTool(isSelected ? 'DRAW' : 'STICKER');
                }}
                style={{
                  position: 'relative',
                  fontSize: '1.8rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '12px',
                  border: isSelected ? '3px solid #3b82f6' : '1px solid #e5e7eb',
                  backgroundColor: isSelected ? '#eff6ff' : '#f9fafb',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.1s ease'
                }}
              >
                {sticker.icon}

                {/* Badge showing duplicate count */}
                {indices.length > 1 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ec4899',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    padding: '1px 5px',
                    borderRadius: '10px',
                  }}>
                    x{indices.length}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Active Selection Banner */}
      {selectedSticker && (
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px dashed #f59e0b',
          borderRadius: '12px',
          padding: '0.4rem',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          color: '#92400e'
        }}>
          {selectedSticker.icon} Tap anywhere on the canvas to place this sticker!
        </div>
      )}

      {/* Interactive Drawing & Sticker Canvas Surface */}
      <div style={{ position: 'relative', width: '100%', height: '420px', userSelect: 'none' }}>
        
        {/* Render Placed Stickers using Percentage Positioning */}
        {placedStickers.map((item) => (
        <div
            key={item.id}
            style={{
            position: 'absolute',
            left: `${(item.x / 600) * 100}%`,
            top: `${(item.y / 420) * 100}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: '2.8rem',
            pointerEvents: 'none',
            zIndex: 10,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'
            }}
        >
            {item.icon}
        </div>
        ))}

        {/* HTML5 Canvas Surface */}
        <canvas
          ref={canvasRef}
          width={600}
          height={420}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
            border: '2px dashed #cbd5e1',
            borderRadius: '16px',
            touchAction: 'none', // Critical for preventing page scrolling on mobile/iOS
            cursor: activeTool === 'DRAW' ? 'crosshair' : 'pointer'
          }}
        />
      </div>

      {/* 🔮 BEAUTIFIED RESULT MODAL */}
      {aiResultUrl && (
        <div className="modal-overlay" onClick={() => setAiResultUrl(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '500px' }}>
            <h3>🖼️ Your Animated Masterpiece!</h3>
            <img
              src={aiResultUrl}
              alt="AI Generated Artwork"
              style={{ width: '100%', borderRadius: '12px', margin: '1rem 0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            />
            <div className="modal-actions" style={{ justifyContent: 'center', gap: '0.75rem' }}>
              <a
                href={aiResultUrl}
                download="my-drawing.jpg"
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', padding: '0.6rem 1.2rem' }}
              >
                ⬇️ Download Photo
              </a>
              <button className="btn-secondary" onClick={() => setAiResultUrl(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};