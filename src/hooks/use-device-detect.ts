import { useState, useEffect } from 'react'

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouchDevice: boolean
  isPWA: boolean
  isIOS: boolean
  isAndroid: boolean
}

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true

  const width = window.innerWidth
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024
  const isDesktop = width >= 1024

  return { isMobile, isTablet, isDesktop, isTouchDevice, isPWA, isIOS, isAndroid }
}

export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => getDeviceInfo())

  useEffect(() => {
    const updateDeviceInfo = () => setDeviceInfo(getDeviceInfo())

    // Listen to viewport resizes so isMobile/isTablet/isDesktop stay in sync
    window.addEventListener('resize', updateDeviceInfo)

    // Keep existing media query listener for compatibility with prior behavior
    const mql = window.matchMedia('(max-width: 1023px)')
    mql.addEventListener('change', updateDeviceInfo)

    return () => {
      window.removeEventListener('resize', updateDeviceInfo)
      mql.removeEventListener('change', updateDeviceInfo)
    }
  }, [])

  return deviceInfo
}
