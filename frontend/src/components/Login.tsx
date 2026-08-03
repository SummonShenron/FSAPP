import React, { useState, createContext, useContext } from 'react';
import { SignedIn, SignedOut, SignIn, UserButton } from '@clerk/clerk-react';

interface Props {
  children: React.ReactNode;
}

// Context so child components/hooks can check if the current session is a Guest
interface GuestContextType {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

export const GuestContext = createContext<GuestContextType>({
  isGuest: false,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
});

export const useGuest = () => useContext(GuestContext);

export const AuthGuard: React.FC<Props> = ({ children }) => {
  // INITIALIZE FROM LOCAL STORAGE: This is what makes guest mode survive a page refresh!
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('guest_token') === 'guest-sandbox-token';
  });

  const enterGuestMode = () => {
    localStorage.setItem('guest_token', 'guest-sandbox-token');
    setIsGuest(true);
  };

  const exitGuestMode = () => {
    localStorage.removeItem('guest_token');
    setIsGuest(false);
  };

  // 1. GUEST MODE VIEW (Bypasses Clerk authentication)
  if (isGuest) {
    return (
      <GuestContext.Provider 
        value={{ 
          isGuest: true, 
          enterGuestMode, 
          exitGuestMode 
        }}
      >
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 2rem',
          backgroundColor: '#eff6ff',
          borderBottom: '1px solid #bfdbfe'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, color: '#1e40af' }}>🔊 Family Soundboard</h2>
            <span style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 'bold',
              letterSpacing: '0.05em'
            }}>
              GUEST DEMO MODE
            </span>
          </div>
          <button
            onClick={exitGuestMode}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            Sign In / Exit Guest
          </button>
        </header>

        <main style={{ padding: '1.5rem' }}>
          {children}
        </main>
      </GuestContext.Provider>
    );
  }

  // 2. STANDARD CLERK AUTHENTICATED / UNAUTHENTICATED VIEW
  return (
    <GuestContext.Provider 
      value={{ 
        isGuest: false, 
        enterGuestMode, 
        exitGuestMode 
      }}
    >
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
          <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>Sign in to access your family sound cards</p>
          
          {/* Clerk Login Box */}
          <SignIn routing="path" path="/sign-in" />

          {/* Guest Login Section */}
          <div style={{
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '1.25rem',
            width: '100%',
            maxWidth: '400px'
          }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>Want to try the app without signing in?</p>
            <button
              onClick={enterGuestMode}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '1rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'background-color 0.2s'
              }}
            >
              🎮 Continue as Guest
            </button>
          </div>
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
          <h2 style={{ margin: 0 }}>🔊 Family Soundboard</h2>
          <UserButton afterSignOutUrl="/" />
        </header>
        <main style={{ padding: '1.5rem' }}>
          {children}
        </main>
      </SignedIn>
    </GuestContext.Provider>
  );
};