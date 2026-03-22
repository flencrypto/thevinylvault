// Install the localStorage polyfill for window.spark before React renders.
// The real @github/spark/spark import below may overwrite window.spark if we
// are inside the Spark runtime, and then installSparkPolyfill will replace
// just the KV layer with localStorage afterwards.
import { installSparkPolyfill } from './lib/spark-polyfill'

import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import "@github/spark/spark"

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Patch window.spark.kv with localStorage so data persists regardless of
// whether we are in the Spark runtime or on Netlify / GitHub Pages.
installSparkPolyfill()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
