from pathlib import Path

path = Path('src/pages/Reading/index.tsx')
text = path.read_text()

old_refs = """  const passageIdentity = passage ? `${passage.id}:${passage.version}` : ''
  const passageIdentityRef = useRef(passageIdentity)
  const latestPassageIdentityRef = useRef(passageIdentity)
  latestPassageIdentityRef.current = passageIdentity
"""
new_refs = """  const passageIdentity = passage ? `${passage.id}:${passage.version}` : ''
  const passageIdentityRef = useRef(passageIdentity)
  const attemptGenerationRef = useRef(0)
"""
assert old_refs in text
text = text.replace(old_refs, new_refs, 1)

old_identity = """    if (passageIdentityRef.current === passageIdentity) return
    passageIdentityRef.current = passageIdentity
    const nextOwner = getLocalLearningOwnerId()
"""
new_identity = """    if (passageIdentityRef.current === passageIdentity) return
    passageIdentityRef.current = passageIdentity
    attemptGenerationRef.current += 1
    const nextOwner = getLocalLearningOwnerId()
"""
assert old_identity in text
text = text.replace(old_identity, new_identity, 1)

old_owner = """      if (nextOwner === ownerUserId) return
      const nextDraft = passage ? readDraft(passage.id, passage.version, nextOwner) : undefined
      setOwnerUserId(nextOwner)
"""
new_owner = """      if (nextOwner === ownerUserId) return
      attemptGenerationRef.current += 1
      const nextDraft = passage ? readDraft(passage.id, passage.version, nextOwner) : undefined
      setOwnerUserId(nextOwner)
"""
assert old_owner in text
text = text.replace(old_owner, new_owner, 1)

old_submit = """    const submittedPassageIdentity = passageIdentity
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
"""
new_submit = """    const submittedGeneration = attemptGenerationRef.current
    const submittedOwnerUserId = ownerUserId
    const submissionStillCurrent = () => (
      attemptGenerationRef.current === submittedGeneration
      && passageIdentityRef.current === passageIdentity
      && getLocalLearningOwnerId() === submittedOwnerUserId
    )
    setBusy(true)
    setError('')
    try {
      const saved = await saveReadingAttempt(passage, answers, Math.max(0, Date.now() - startedAt), submittedOwnerUserId)
      if (!submissionStillCurrent()) return
      try {
        window.localStorage.removeItem(draftKey(passage.id, passage.version, submittedOwnerUserId))
      } catch {
        // Draft cleanup is best-effort and only runs for the still-current attempt.
      }
      setSummary(saved)
"""
assert old_submit in text
text = text.replace(old_submit, new_submit, 1)

path.write_text(text)
