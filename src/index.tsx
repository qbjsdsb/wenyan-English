import Loading from './components/Loading'
import './index.css'
import './wenyan.css'
import './composition-polish.css'
import './delight-polish.css'
import './experience-polish.css'
import { ErrorBook } from './pages/ErrorBook'
import { FriendLinks } from './pages/FriendLinks'
import MobilePage from './pages/Mobile'
import TypingPage from './pages/Typing'
import WenyanControlRuntime from '@/control/WenyanControlRuntime'
import { isOpenDarkModeAtom } from '@/store'
import { startLearningSync } from '@/sync/syncLearningEvents'
import 'animate.css'
import { useAtomValue } from 'jotai'
import React, { Suspense, lazy, useEffect, useState } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const OAuthConsentPage = lazy(() => import('./pages/OAuthConsent'))
const PreferencesPage = lazy(() => import('./pages/Preferences'))
const ReadingPage = lazy(() => import('./pages/Reading'))
const TodayPage = lazy(() => import('./pages/Today'))
const SyncPage = lazy(() => import('./pages/Sync'))

function Root() {
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
  }, [darkMode])

  useEffect(() => startLearningSync(), [])

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 600
      setIsMobile(isMobile)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/wenyan-English' : ''}>
        <WenyanControlRuntime />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/oauth/consent" element={<OAuthConsentPage />} />
            {isMobile ? (
              <Route path="/*" element={<Navigate to="/mobile" />} />
            ) : (
              <>
                <Route index element={<TypingPage />} />
                <Route path="/today" element={<TodayPage />} />
                <Route path="/reading/:contentId" element={<ReadingPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/error-book" element={<ErrorBook />} />
                <Route path="/friend-links" element={<FriendLinks />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/preferences" element={<PreferencesPage />} />
                <Route path="/*" element={<Navigate to="/" />} />
              </>
            )}
            <Route path="/mobile" element={<MobilePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </React.StrictMode>
  )
}

const container = document.getElementById('root')
container && createRoot(container).render(<Root />)
