import { useState } from 'react'
import VinylVaultApp from '@/components/VinylVaultApp'
import SplashScreen from '@/components/SplashScreen'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return showSplash ? (
    <SplashScreen onComplete={() => setShowSplash(false)} />
  ) : (
    <VinylVaultApp />
  )
}

export default App
