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
import { isOpenDarkModeAtom, reviewModeInfoAtom } from '@/store'
import { useLearningOwner } from '@/hooks/useLearningOwner'
import { startLearningSync } from '@/sync/syncLearningEvents'
import 'animate.css'
import { useAtom, useAtomValue } from 'jotai'
import React, { Suspense, lazy, useEffect } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const PracticePage = lazy(() => import('./pages/Practice'))
const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const OAuthConsentPage = lazy(() => import('./pages/OAuthConsent'))
const PreferencesPage = lazy(() => import('./pages/Preferences'))
const SemanticPage = lazy(() => import('./pages/Semantic'))
const SemanticCheckPage = lazy(() => import('./pages/SemanticCheck'))
const ReadingPage = lazy(() => import('./pages/Reading'))
const TodayPage = lazy(() => import('./pages/Today'))
const SyncPage = lazy(() => import('./pages/Sync'))

function Root() {
  const owner = useLearningOwner()
  const [review, setReview] = useAtom(reviewModeInfoAtom)
  useEffect(() => {
    const origin = review.reviewRecord?.origin
    if (origin && review.reviewRecord?.ownerUserId !== owner) {
      setReview({ isReviewMode: false, reviewRecord: undefined })
    }
  }, [owner, review, setReview])
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
  }, [darkMode])

  useEffect(() => startLearningSync(), [])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/wenyan-English' : ''}>
        <WenyanControlRuntime />
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/oauth/consent" element={<OAuthConsentPage />} />
            <Route index element={<TypingPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/semantic/:runId" element={<SemanticPage />} />
            <Route path="/semantic-check/:runId" element={<SemanticCheckPage />} />
            <Route path="/reading/:contentId" element={<ReadingPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/error-book" element={<ErrorBook />} />
            <Route path="/friend-links" element={<FriendLinks />} />
            <Route path="/sync" element={<SyncPage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/mobile" element={<MobilePage />} />
            <Route path="/*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </React.StrictMode>
  )
}

const container = document.getElementById('root')
container && createRoot(container).render(<Root />)
