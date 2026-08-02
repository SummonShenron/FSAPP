// Helper: Convert a URL/Blob path to a Base64 string
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Could not convert media to Base64, keeping raw URL", err);
    return url;
  }
}

// Export a single card to a downloadable .json file
export const exportCard = async (card: any) => {
  // Convert main photo or photo array to Base64
  let base64Photos: string[] = [];
  if (card.photo_urls && card.photo_urls.length > 0) {
    base64Photos = await Promise.all(card.photo_urls.map((url: string) => urlToBase64(url)));
  } else if (card.photo_url) {
    const photo64 = await urlToBase64(card.photo_url);
    base64Photos = [photo64];
  }

  // Convert audio clips to Base64
  let base64Clips: any[] = [];
  if (card.audio_clips && card.audio_clips.length > 0) {
    base64Clips = await Promise.all(
      card.audio_clips.map(async (clip: any) => ({
        ...clip,
        audio_url: await urlToBase64(clip.audio_url),
      }))
    );
  } else if (card.audio_url) {
    const audio64 = await urlToBase64(card.audio_url);
    base64Clips = [{ audio_url: audio64 }];
  }

  // Package everything into an export object
  const exportData = {
    type: 'WHO_IS_BEHIND_THE_DOOR_CARD', // Unique identifier tag
    version: '1.0',
    card: {
      ...card,
      photo_urls: base64Photos,
      photo_url: base64Photos[0] || '',
      audio_clips: base64Clips,
    },
  };

  // Trigger file download in browser / device
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${card.title.replace(/\s+/g, '_')}_card.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import card from a user-selected File object
export const importCard = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Safety check to make sure it's a card for our game
        if (json.type !== 'WHO_IS_BEHIND_THE_DOOR_CARD' || !json.card) {
          throw new Error('Invalid card file format!');
        }

        // Generate a fresh unique ID so it doesn't collide with existing cards
        const newCard = {
          ...json.card,
          id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        };

        resolve(newCard);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};