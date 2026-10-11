from pathlib import Path

path = Path('src/pages/Reading/index.tsx')
text = path.read_text()

text = text.replace(
    "import { useEffect, useMemo, useState } from 'react'",
    "import { useEffect, useMemo, useRef, useState } from 'react'",
)

needle = """  const [summary, setSummary] = useState<ReadingAttemptSummary>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const ownerChanged = () => {
"""
replacement = """  const [summary, setSummary] = useState<ReadingAttemptSummary>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const passageIdentity = passage ? `${passage.id}:${passage.version}` : ''
  const passageIdentityRef = useRef(passageIdentity)

  useEffect(() => {
    if (passageIdentityRef.current === passageIdentity) return
    passageIdentityRef.current = passageIdentity
    const nextOwner = getLocalLearningOwnerId()
    const nextDraft = passage ? readDraft(passage.id, passage.version, nextOwner) : undefined
    setOwnerUserId(nextOwner)
    setStartedAt(nextDraft?.startedAt ?? Date.now())
    setAnswers(nextDraft?.answers ?? [])
    setSummary(undefined)
    setBusy(false)
    setError('')
  }, [passage, passageIdentity])

  useEffect(() => {
    const ownerChanged = () => {
"""
assert needle in text
text = text.replace(needle, replacement, 1)

path.write_text(text)
