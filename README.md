# 🔊 Family Soundboard

An interactive, family-focused soundboard game built with **React**, **Vite**, **Python**, **MongoDB Atlas**, and **Clerk Auth**. 

Designed as a Progressive Web App (PWA) so family members can install it directly onto their mobile home screens, record custom voice clips, guess family members, and earn sticker rewards!

---

## Features

- **Interactive Door-Knocking Game (`KnockGame`)**: Kids knock on virtual doors, listen to voice clips, read family clues, and guess who is behind the door to earn rewards and keep their lives intact.
- **Sticker Album & Scrapbook (`StickerAlbum`)**: Earn common, rare, and legendary stickers as game rewards. Drag and stick unlocked stickers onto family cards to decorate them!
- **PIN-Protected Parent Admin (`AdminView`)**: 
  - Manage family cards (add, edit, delete).
  - Add multiple clues and photo gallery options for each family member.
  - **Live In-Browser Voice Recorder**: Record audio clips directly via the Web MediaRecorder API straight into MongoDB.
- **Authentication**: Powered by Clerk for secure family access.
- **Mobile & PWA Ready**: Optimized for iOS Safari and Android Chrome with "Add to Home Screen" support for full-screen mobile play.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, CSS3
- **Authentication**: `@clerk/clerk-react`
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (Cloud Database)
- **Deployment**: Vercel (Frontend) + Render (Backend)

---

## Project Structure

```text
family-soundboard/
├── frontend/                # Vite React Application
│   ├── src/
│   │   ├── api/            # Custom API hooks & fetch clients
│   │   ├── components/     # Game, Admin, and Sticker Album views
│   │   ├── stickers/       # Sticker data definitions & assets
│   │   ├── App.tsx         # Main App layout & tab navigation
│   │   └── main.tsx        # React entry point with Clerk Provider
│   ├── types.ts            # SoundCard & application interfaces
│   ├── package.json
│   └── vite.config.ts
│
└── backend/                 # Express API Server
    ├── models/             # MongoDB Mongoose schemas (Cards, Audio, Users)
    ├── routes/             # API routes (/api/cards, /api/admin, /api/audio)
    ├── server.js           # Express app entry point
    └── package.json