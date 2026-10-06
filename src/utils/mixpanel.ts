import type { TypingState } from '@/pages/Typing/store/type'
import type { InfoPanelType, PronunciationType } from '@/typings'
import { useCallback } from 'react'

// Wenyan keeps the original telemetry function signatures as compatibility shims
// so upstream UI code does not need a wide refactor. All functions are intentionally
// local no-ops: personal study behavior is not sent to Mixpanel or another third party.

export type starAction = 'star' | 'dismiss'
export function recordStarAction(_action: starAction) {}

export type openInfoPanelLocation = 'footer' | 'resultScreen'
export function recordOpenInfoPanelAction(_type: InfoPanelType, _location: openInfoPanelLocation) {}

export type shareType = 'open' | 'download'
export function recordShareAction(_type: shareType) {}

export type analysisType = 'open'
export function recordAnalysisAction(_type: analysisType) {}

export type errorBookType = 'open' | 'detail'
export function recordErrorBookAction(_type: errorBookType) {}

export type donateCardInfo = {
  type: 'donate' | 'dismiss'
  chapterNumber: number
  wordNumber: number
  sumWrongCount: number
  dayFromFirstWord: number
  dayFromQwerty: number
  amount: number
}

export function reportDonateCard(_info: donateCardInfo) {}

export type ModeInfo = {
  modeDictation: boolean
  modeDark: boolean
  modeShuffle: boolean
  enabledKeyboardSound: boolean
  enabledPhotonicsSymbol: boolean
  enabledSingleWordLoop: boolean
  pronunciationAuto: boolean
  pronunciationOption: PronunciationType | 'none'
}

export type WordLogUpload = ModeInfo & {
  headword: string
  timeStart: string
  timeEnd: string
  countInput: number
  countCorrect: number
  countTypo: number
  order: number
  chapter: string
  wordlist: string
}

export type ChapterLogUpload = ModeInfo & {
  chapter: string
  wordlist: string
  timeEnd: string
  duration: number
  countInput: number
  countCorrect: number
  countTypo: number
}

export function useMixPanelWordLogUploader(_typingState: TypingState) {
  return useCallback(
    (_wordLog: { headword: string; timeStart: string; timeEnd: string; countInput: number; countCorrect: number; countTypo: number }) => {},
    [],
  )
}

export function useMixPanelChapterLogUploader(_typingState: TypingState) {
  return useCallback(() => {}, [])
}

export function recordDataAction(_info: {
  type: 'export' | 'import'
  size: number
  wordCount: number
  chapterCount: number
}) {}

export function getUtcStringForMixpanel() {
  const now = new Date()
  const isoString = now.toISOString()
  return isoString.substring(0, 19).replace('T', ' ')
}
