import React, { useState } from 'react';
import { SoundCard } from '../../types';
import { useApiClient } from '../api/useApiClient';
import { exportCard, importCard } from '../utils/cardSharing';
import './__styles__/AdminView.css';

interface Props {
  cards: SoundCard[];
  onRefresh: () => void;
  onClose: () => void;
}

export const AdminView: React.FC<Props> = ({ cards, onRefresh, onClose }) => {
  // Authentication State
  const { apiFetch } = useApiClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Inspector & Modals State
  const [inspectingCard, setInspectingCard] = useState<SoundCard | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [factInput, setFactInput] = useState('');

  // Add Card Form State
  const [newTitle, setNewTitle] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newFact, setNewFact] = useState('');

  // Audio Recording & Upload State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [audioLabelInput, setAudioLabelInput] = useState('');
  const [isUploadingAudioFile, setIsUploadingAudioFile] = useState(false);

  const activeCard = inspectingCard
    ? cards.find((c) => c.id === inspectingCard.id) || null
    : null;

  // --- 1. PIN VERIFICATION ---
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/verify', {
        method: 'POST',
        body: JSON.stringify({ pin: pinInput }),
      });

      setIsUnlocked(true);
      setPinError(null);
    } catch (err) {
      setPinError('Incorrect PIN');
    }
  };

  // --- 2. CARD MANAGEMENT ---
  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append('title', newTitle);
      formData.append('relation', newRelation || '');
      formData.append('bg_color', '#ffffff');
      formData.append('fact', newFact || '');

      if (selectedFile) {
        formData.append('file', selectedFile);
      } else {
        formData.append('photo_url', newPhotoUrl || 'https://via.placeholder.com/150');
      }

      await apiFetch('/api/cards', {
        method: 'POST',
        body: formData,
      });

      setShowAddModal(false);
      setNewTitle('');
      setNewRelation('');
      setNewPhotoUrl('');
      setNewFact('');
      setSelectedFile(null);
      onRefresh();
    } catch (err) {
      alert('Failed to create card');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const importedCard = await importCard(file);

      // Post the imported card payload to backend
      await apiFetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedCard),
      });

      alert(`Successfully imported ${importedCard.title}! 🎉`);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to import card. Please ensure it is a valid card file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this person?')) return;
    try {
      await apiFetch(`/api/cards/${cardId}`, { method: 'DELETE' });
      setInspectingCard(null);
      onRefresh();
    } catch (err) {
      alert('Failed to delete card');
    }
  };

  // --- 3. PHOTO VAULT ACTIONS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCard || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingPhoto(true);
    try {
      await apiFetch(`/api/cards/${activeCard.id}/photos`, {
        method: 'POST',
        body: formData,
      });
      onRefresh();
    } catch (err) {
      alert('Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAddPhotoFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !photoUrlInput.trim()) return;

    const url = photoUrlInput.trim();
    const existingUrls = activeCard.photo_urls || (activeCard.photo_url ? [activeCard.photo_url] : []);
    const updatedUrls = existingUrls.includes(url) ? existingUrls : [...existingUrls, url];

    try {
      await apiFetch(`/api/cards/${activeCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: url,
          photo_urls: updatedUrls,
        }),
      });
      setPhotoUrlInput('');
      onRefresh();
    } catch (err) {
      alert('Failed to add photo URL');
    }
  };

  const handleDeletePhoto = async (urlToDelete: string) => {
    if (!activeCard) return;
    const currentPhotos = activeCard.photo_urls?.length 
      ? activeCard.photo_urls 
      : (activeCard.photo_url ? [activeCard.photo_url] : []);

    if (currentPhotos.length <= 1) {
      alert('Cards must keep at least one photo!');
      return;
    }
    if (!confirm('Delete this photo?')) return;

    const updatedUrls = currentPhotos.filter((url) => url !== urlToDelete);

    try {
      await apiFetch(`/api/cards/${activeCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_url: updatedUrls[0] || '',
          photo_urls: updatedUrls,
        }),
      });
      onRefresh();
    } catch (err) {
      alert('Failed to delete photo');
    }
  };

  // --- 4. CLUES & FACTS MANAGEMENT ---
  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !factInput.trim()) return;

    const text = factInput.trim();
    const existingFacts = activeCard.facts || (activeCard.fact ? [activeCard.fact] : []);
    const updatedFacts = [...existingFacts, text];

    try {
      await apiFetch(`/api/cards/${activeCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fact: text,
          facts: updatedFacts,
        }),
      });
      setFactInput('');
      onRefresh();
    } catch (err) {
      alert('Failed to add clue');
    }
  };

  const handleDeleteFact = async (indexToDelete: number) => {
    if (!activeCard) return;
    const existingFacts = activeCard.facts || (activeCard.fact ? [activeCard.fact] : []);
    const updatedFacts = existingFacts.filter((_, idx) => idx !== indexToDelete);

    try {
      await apiFetch(`/api/cards/${activeCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fact: updatedFacts[0] || '',
          facts: updatedFacts,
        }),
      });
      onRefresh();
    } catch (err) {
      alert('Failed to delete clue');
    }
  };

  // --- 5. AUDIO VAULT ACTIONS ---
  const handleDeleteAudioClip = async (clipId: string) => {
    if (!confirm('Delete this voice clip?')) return;
    try {
      await apiFetch(`/api/audio/${clipId}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      alert('Failed to delete clip');
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeCard || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingAudioFile(true);
    try {
      await apiFetch(`/api/cards/${activeCard.id}/audio`, {
        method: 'POST',
        body: formData,
      });
      onRefresh();
    } catch (err) {
      alert('Failed to upload audio file');
    } finally {
      setIsUploadingAudioFile(false);
    }
  };

  const handleAddAudioUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !audioUrlInput.trim()) return;

    try {
      await apiFetch(`/api/cards/${activeCard.id}/audio-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: audioUrlInput.trim(),
          label: audioLabelInput.trim() || 'External Clip',
        }),
      });
      setAudioUrlInput('');
      setAudioLabelInput('');
      onRefresh();
    } catch (err) {
      alert('Failed to add audio URL');
    }
  };

  // --- 6. LIVE AUDIO RECORDING ---
  const startRecording = async () => {
    if (!activeCard) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, `clip_${activeCard.id}.webm`);

        await apiFetch(`/api/cards/${activeCard.id}/audio`, {
          method: 'POST',
          body: formData,
        });

        setIsRecording(false);
        setRecordingSeconds(0);
        onRefresh();
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      setRecordingSeconds(0);
      const interval = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      setTimerInterval(interval);
    } catch (err) {
      alert('Microphone access is required to record audio clips!');
    }
  };

  const stopRecording = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
  };

  // --- VIEW 1: LOCKED (PIN GATE) ---
  if (!isUnlocked) {
    return (
      <div style={{ maxWidth: '360px', margin: '3rem auto', textAlign: 'center' }}>
        <div className="modal-card">
          <h3>🔒 Parent Access</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Enter PIN to access Admin Settings</p>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="****"
              autoFocus
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
            />
            {pinError && <div className="pin-error">{pinError}</div>}
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW 2: UNLOCKED ADMIN PANEL ---
  const currentPhotos = activeCard?.photo_urls?.length 
    ? activeCard.photo_urls 
    : (activeCard?.photo_url ? [activeCard.photo_url] : []);

  const currentFacts = activeCard?.facts?.length 
    ? activeCard.facts 
    : (activeCard?.fact ? [activeCard.fact] : []);

  const currentAudioClips = activeCard?.audio_clips?.length
    ? activeCard.audio_clips
    : (activeCard?.audio_urls || (activeCard?.audio_url ? [activeCard.audio_url] : [])).map((url, idx) => ({
        id: `clip-${idx}`,
        audio_url: url,
        label: `Voice Clip ${idx + 1}`
      }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>⚙️ Admin Control Panel</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click any card to add photos, clues, and voice clips</p>
        </div>
        <button className="btn-secondary" onClick={onClose}>
          Exit Admin
        </button>
      </div>

      {/* Grid of Cards */}
      <div className="soundboard-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="sound-card admin-inspect-card"
            style={{ backgroundColor: card.bg_color || '#ffffff', position: 'relative' }}
            onClick={() => setInspectingCard(card)}
          >
            <div className="admin-manage-badge">⚙️ Manage</div>
            <div className="card-photo-wrapper">
              <img src={card.photo_url || card.photo_urls?.[0]} alt={card.title} />
            </div>
            <div className="card-title">{card.title}</div>
            <div className="card-relation">{card.relation}</div>
          </div>
        ))}

        {/* Add Person Tile */}
        <div
          className="sound-card"
          style={{ border: '2px dashed var(--accent-primary)', justifyContent: 'center', minHeight: '200px', cursor: 'pointer' }}
          onClick={() => setShowAddModal(true)}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>➕</div>
          <div className="card-title" style={{ color: 'var(--accent-primary)' }}>
            Add Person
          </div>
        </div>

        {/* Import Person Tile */}
        <label
          className="sound-card"
          style={{ 
            border: '2px dashed #8b5cf6', 
            justifyContent: 'center', 
            minHeight: '200px', 
            cursor: 'pointer',
            margin: 0
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📥</div>
          <div className="card-title" style={{ color: '#8b5cf6' }}>
            Import Person
          </div>
          <input 
            type="file" 
            accept=".json" 
            style={{ display: 'none' }} 
            onChange={handleImportFile}
          />
        </label>
      </div>

      {/* INSPECTOR MODAL */}
      {activeCard && (
        <div className="modal-overlay" onClick={() => setInspectingCard(null)}>
          <div className="modal-card inspector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inspector-header">
              <h2>Manage {activeCard.title}</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  type="button"
                  className="btn-secondary-sm" 
                  onClick={() => exportCard(activeCard)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
                >
                  📤 Export Card
                </button>
                <button className="btn-danger-sm" onClick={() => handleDeleteCard(activeCard.id)}>
                  🗑️ Delete Person
                </button>
              </div>
            </div>

            {/* Photo Gallery Section */}
            <div className="inspector-section">
              <h3>🖼️ Photo Pool</h3>
              <p className="section-desc">Game will pick a random photo from this list every round</p>

              <div className="photo-gallery-grid">
                {currentPhotos.map((url, idx) => (
                  <div key={idx} className="gallery-item" style={{ position: 'relative' }}>
                    <img src={url} alt={`Photo ${idx + 1}`} />
                    <button
                      type="button"
                      className="btn-icon-danger"
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => handleDeletePhoto(url)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Photo Inputs */}
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="btn-secondary" style={{ cursor: 'pointer', margin: 0, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                    {isUploadingPhoto ? 'Uploading...' : '📁 Upload Local File'}
                    <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isUploadingPhoto} />
                  </label>
                </div>

                <form onSubmit={handleAddPhotoFromUrl} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    type="url"
                    placeholder="Or paste image URL (e.g. https://...)"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'left', letterSpacing: 'normal' }}
                  />
                  <button type="submit" className="btn-secondary-sm" disabled={!photoUrlInput.trim()}>
                    Add Photo
                  </button>
                </form>
              </div>
            </div>

            {/* Clues & Facts Section */}
            <div className="inspector-section">
              <h3>🕵️ Clue Pool</h3>
              <p className="section-desc">Game will pick a random clue from this list every round</p>

              {currentFacts.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                  No clues added yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {currentFacts.map((factText, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', flex: 1, textAlign: 'left', color: '#1f2937' }}>
                        {factText}
                      </span>
                      <button type="button" className="btn-icon-danger" onClick={() => handleDeleteFact(idx)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddFact} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Add a new clue (e.g. Loves eating pizza!)"
                  value={factInput}
                  onChange={(e) => setFactInput(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'left', letterSpacing: 'normal' }}
                />
                <button type="submit" className="btn-secondary-sm" disabled={!factInput.trim()}>
                  Add Clue
                </button>
              </form>
            </div>

            {/* Voice Clips Section */}
            <div className="inspector-section">
              <h3>🎤 Voice & Video Clips</h3>
              <p className="section-desc">Record, upload files (.mp3, .mp4), or paste URLs</p>

              {currentAudioClips.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '1rem' }}>
                  No voice clips added yet.
                </div>
              ) : (
                <div className="audio-clips-list" style={{ marginBottom: '1rem' }}>
                  {currentAudioClips.map((clip: any, idx: number) => (
                    <div key={clip.id || idx} className="audio-clip-row">
                      <button 
                        type="button" 
                        className="clip-play-btn" 
                        onClick={() => {
                          const audioPath = clip.audio_url || clip.url;
                          const fullUrl = audioPath?.startsWith('http') 
                            ? audioPath 
                            : `http://192.168.1.6:8000${audioPath}`;
                          new Audio(fullUrl).play();
                        }}
                      >
                        ▶️
                      </button>
                      <div className="clip-info">
                        <span className="clip-label">{clip.label || `Voice Clip ${idx + 1}`}</span>
                      </div>
                      <button type="button" className="btn-icon-danger" onClick={() => handleDeleteAudioClip(clip.id)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {/* Live Recording Button */}
                <div>
                  {isRecording ? (
                    <button type="button" className="btn-primary recording-active" onClick={stopRecording} style={{ width: '100%' }}>
                      <span className="recording-dot" /> ⏹️ Stop Recording ({recordingSeconds}s)
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" onClick={startRecording} style={{ width: '100%' }}>
                      🎤 Record Live Voice Clip
                    </button>
                  )}
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280' }}>— OR —</div>

                {/* Local File Picker (.mp3, .mp4, etc.) */}
                <label className="btn-secondary" style={{ cursor: 'pointer', textAlign: 'center', padding: '0.5rem' }}>
                  {isUploadingAudioFile ? 'Uploading File...' : '📁 Upload Audio/Video File (.mp3, .mp4)'}
                  <input 
                    type="file" 
                    accept="audio/*,video/mp4,video/*" 
                    onChange={handleAudioFileUpload} 
                    style={{ display: 'none' }} 
                    disabled={isUploadingAudioFile} 
                  />
                </label>

                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280' }}>— OR —</div>

                {/* URL Form */}
                <form onSubmit={handleAddAudioUrl} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Clip Label (e.g. Laughing)"
                    value={audioLabelInput}
                    onChange={(e) => setAudioLabelInput(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'left', letterSpacing: 'normal' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="url"
                      placeholder="Paste Audio/Video URL (https://...)"
                      value={audioUrlInput}
                      onChange={(e) => setAudioUrlInput(e.target.value)}
                      style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'left', letterSpacing: 'normal' }}
                    />
                    <button type="submit" className="btn-secondary-sm" disabled={!audioUrlInput.trim()}>
                      Add URL
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn-primary" onClick={() => setInspectingCard(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CARD MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Sound Card</h3>
            <form onSubmit={handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="Name (e.g. Auntie Sarah)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ fontSize: '1rem', letterSpacing: 'normal', textAlign: 'left' }}
                required
              />
              <input
                type="text"
                placeholder="Relation (e.g. Aunt)"
                value={newRelation}
                onChange={(e) => setNewRelation(e.target.value)}
                style={{ fontSize: '1rem', letterSpacing: 'normal', textAlign: 'left' }}
                required
              />
              <input
                type="text"
                placeholder="First Clue (optional)"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                style={{ fontSize: '1rem', letterSpacing: 'normal', textAlign: 'left' }}
              />
              {/* File Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label 
                  htmlFor="photo-upload" 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    textAlign: 'center'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {selectedFile ? selectedFile.name : 'Choose Photo File'}
                </label>

                {/* Hidden native input */}
                <input 
                  id="photo-upload" 
                  type="file" 
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                  }}
                />
              </div>

              {/* Divider */}
              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', margin: '0.25rem 0' }}>
                — OR —
              </div>

              {/* Photo URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <input
                  type="text"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  placeholder="Photo URL (disabled if file chosen)"
                  disabled={!!selectedFile}
                  style={{ 
                    fontSize: '1rem', 
                    letterSpacing: 'normal', 
                    textAlign: 'left',
                    opacity: selectedFile ? 0.5 : 1 
                  }}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};