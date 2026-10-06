import type { TypingState } from '@/pages/Typing/store/type'
import type { InfoPanelType, PronunciationType } from '@/typings'
import { useCallback } from 'react'

// Wenyan keeps the original telemetry function signatures as compatibility shims
// so upstream UI code does not need a wide refactor. All functions are intentionally
// local no-ops: personal study behavior is not sent to Mixpanel or another third party.

export type starAction = 'star' | 'dismiss'
export function recordStarAction(action: starAction) {
  void action
}

export type openInfoPanelLocation = 'footer' | 'resultScreen'
export function recordOpenInfoPanelAction(type: InfoPanelType, location: openInfoPanelLocation) {
  void type
  void location
}

export type shareType = 'open' | 'download'
export function recordShareAction(type: shareType) {
  void type
}

export type analysisType = 'open'
export function recordAnalysisAction(type: analysisType) {
  void type
}

export type errorBookType = 'open' | 'detail'
export function recordErrorBookAction(type: errorBookType) {
  void type
}

export type donateCardInfo = {
  type: 'donate' | 'dismiss'
  chapterNumber: number
  wordNumber: number
  sumWrongCount: number
  dayFromFirstWord: number
  dayFromQwerty: number
  amount: number
}

export function reportDonateCard(info: donateCardInfo) {
  void info
}

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

export function useMixPanelWordLogUploader(typingState: TypingState) {
  void typingState
  return useCallback(
    (wordLog: { headword: string; timeStart: string; timeEnd: string; countInput: number; countCorrect: number; countTypo: number }) => {
      void wordLog
    },
    [],
  )
}

export function useMixPanelChapterLogUploader(typingState: TypingState) {
  void typingState
  return useCallback(() => undefined, [])
}

export function recordDataAction(info: {
  type: 'export' | 'import'
  size: number
  wordCount: number
  chapterCount: number
}) {
  void info
}

export function getUtcStringForMixpanel() {
  const now = new Date()
  const isoString = now.toISOString()
  return isoString.substring(0, 19).replace('T', ' ')
}
