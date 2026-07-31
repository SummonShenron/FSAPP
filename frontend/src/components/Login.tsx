import React from 'react';
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';

interface Props {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<Props> = ({ children }) => {
  return (
    <>
      {/* 1. Unauthenticated View */}
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
          <p style={{ marginBottom: '2rem', color: '#4b5563' }}>Sign in to access your family sound cards</p>
          <SignIn routing="path" path="/sign-in" />
        </div>
      </SignedOut>
      {/* 2. Authenticated View */}
      <SignedIn>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ margin: 0 }}>🔊 Family Soundboard</h2>
          <UserButton afterSignOutUrl="/" />
        </header>
        <main style={{ padding: '1.5rem' }}>
          {children}
        </main>
      </SignedIn>
    </>
  );
};