import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import VinylasisApp from '@/components/VinylVaultApp'
import SplashScreen from '@/components/SplashScreen'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      {showSplash ? (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <VinylasisApp />
      )}
      <Analytics />
    </>
  )
}

export default App
