from pathlib import Path

path = Path('src/pages/Reading/index.tsx')
text = path.read_text()

needle = """  const passageIdentity = passage ? `${passage.id}:${passage.version}` : ''
  const passageIdentityRef = useRef(passageIdentity)

  useEffect(() => {
"""
replacement = """  const passageIdentity = passage ? `${passage.id}:${passage.version}` : ''
  const passageIdentityRef = useRef(passageIdentity)
  const latestPassageIdentityRef = useRef(passageIdentity)
  latestPassageIdentityRef.current = passageIdentity

  useEffect(() => {
"""
assert needle in text
text = text.replace(needle, replacement, 1)

old_submit = """  const submit = async () => {
    if (busy || summary) return
    if (getLocalLearningOwnerId() !== ownerUserId) {
      setError('账号已经切换。这次阅读不会提交到新的账号；请重新打开当前阅读。')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await saveReadingAttempt(passage, answers, Math.max(0, Date.now() - startedAt), ownerUserId)
      setSummary(saved)
      window.localStorage.removeItem(draftKey(passage.id, passage.version, ownerUserId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法保存这次阅读。')
    } finally {
      setBusy(false)
    }
  }
"""
new_submit = """  const submit = async () => {
    if (busy || summary) return
    if (getLocalLearningOwnerId() !== ownerUserId) {
      setError('账号已经切换。这次阅读不会提交到新的账号；请重新打开当前阅读。')
      return
    }
    const submittedPassageIdentity = passageIdentity
    const submittedOwnerUserId = ownerUserId
    const submissionStillCurrent = () => (
      latestPassageIdentityRef.current === submittedPassageIdentity
      && getLocalLearningOwnerId() === submittedOwnerUserId
    )
    setBusy(true)
    setError('')
    try {
      const saved = await saveReadingAttempt(passage, answers, Math.max(0, Date.now() - startedAt), submittedOwnerUserId)
      try {
        window.localStorage.removeItem(draftKey(passage.id, passage.version, submittedOwnerUserId))
      } catch {
        // A stale or blocked draft store must not overwrite the current passage UI.
      }
      if (!submissionStillCurrent()) return
      setSummary(saved)
    } catch (cause) {
      if (!submissionStillCurrent()) return
      setError(cause instanceof Error ? cause.message : '暂时无法保存这次阅读。')
    } finally {
      if (submissionStillCurrent()) setBusy(false)
    }
  }
"""
assert old_submit in text
text = text.replace(old_submit, new_submit, 1)

path.write_text(text)
