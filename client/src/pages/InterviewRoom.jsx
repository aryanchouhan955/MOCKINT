import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useScribe, CommitStrategy } from '@elevenlabs/react'
import {
  getInterview,
  submitAnswer as apiSubmitAnswer,
  completeInterview as apiCompleteInterview,
  cancelInterview as apiCancelInterview,
  fetchTTSAudio,
  fetchSTTToken,
} from '../services/api'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'

// ─── Interview states ─────────────────────────────────────────────────────────
const STATE = {
  LOADING: 'loading',
  ACTIVE: 'active',
  SUBMITTING: 'submitting',
  COMPLETING: 'completing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ERROR: 'error',
  NOT_FOUND: 'not_found',
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useCountdown(startedAt, durationMinutes) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!startedAt || !durationMinutes) return

    const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000

    function tick() {
      const now = Date.now()
      const diff = Math.max(0, Math.floor((endTime - now) / 1000))
      setRemaining(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, durationMinutes])

  return remaining
}

function formatTime(seconds) {
  if (seconds === null) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Voice-answer error mapping ───────────────────────────────────────────────
// getUserMedia rejects with a DOMException whose `name` identifies the failure;
// ElevenLabs realtime STT errors surface as `{ error: <code> }` (see the Scribe
// event reference). Map both families to one actionable, user-facing message.
function microphoneErrorMessage(err) {
  const code = err?.name || err?.error || ''
  switch (code) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Microphone access was denied. Please allow microphone access in your browser settings and try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found. Please connect a microphone and try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your microphone is unavailable — it may be in use by another application.'
    case 'auth_error':
      return 'Voice answering could not be authenticated. Please try again.'
    case 'quota_exceeded':
      return 'Voice answering usage limit reached. You can continue by typing.'
    case 'rate_limited':
      return 'Too many voice-answer attempts. Please wait a moment and try again.'
    default:
      return 'Could not start voice answering. You can continue by typing.'
  }
}

// ─── Confirmation dialog ──────────────────────────────────────────────────────
function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel, isLoading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
            Go back
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />
                {confirmLabel}…
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────
function DifficultyBadge({ difficulty }) {
  const colors = {
    easy: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    hard: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  }
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${
        colors[difficulty] || 'text-muted-foreground border-border'
      }`}
    >
      {difficulty}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InterviewRoom() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()

  // Core interview state
  const [pageState, setPageState] = useState(STATE.LOADING)
  const [interview, setInterview] = useState(null) // full interview metadata
  const [currentQuestion, setCurrentQuestion] = useState(null) // { text, topic, difficulty }
  const [questionsAsked, setQuestionsAsked] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  // Answer form
  const [answer, setAnswer] = useState('')
  const [answerError, setAnswerError] = useState('')

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(null) // null | 'end' | 'cancel'
  const [dialogLoading, setDialogLoading] = useState(false)

  // Prevent stale double-submission
  const submittingRef = useRef(false)

  // TTS Audio State
  const audioRef = useRef(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [audioState, setAudioState] = useState('idle') // idle | loading | playing | paused | error
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  useEffect(() => {
    if (!currentQuestion?.text) return

    let isSubscribed = true
    let currentUrl = null
    const text = currentQuestion.text

    async function loadAudio() {
      try {
        setAudioState('loading')
        setAutoplayBlocked(false)
        const url = await fetchTTSAudio(text, token)
        
        if (!isSubscribed) {
          URL.revokeObjectURL(url)
          return
        }

        currentUrl = url
        setAudioUrl(url)
      } catch (err) {
        if (isSubscribed) setAudioState('error')
        console.error('TTS fetch error:', err)
      }
    }

    loadAudio()

    return () => {
      isSubscribed = false
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
        setAudioUrl(null)
      }
      setAudioState('idle')
    }
  }, [currentQuestion?.text, token])

  // Play audio automatically when URL is set
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(err => {
        console.warn('Autoplay blocked:', err)
        setAutoplayBlocked(true)
        setAudioState('paused')
      })
    }
  }, [audioUrl])

  function toggleAudio() {
    if (!audioRef.current || !audioUrl) return
    if (audioState === 'playing') {
      audioRef.current.pause()
    } else {
      setAutoplayBlocked(false)
      audioRef.current.play().catch(err => console.error(err))
    }
  }

  function replayAudio() {
    if (!audioRef.current || !audioUrl) return
    setAutoplayBlocked(false)
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(err => console.error(err))
  }

  // ─── Voice Answer (ElevenLabs Scribe realtime STT) ─────────────────────────
  // commitStrategy MUST be VAD for live microphone input — the default is
  // MANUAL, which never fires committed transcripts for a continuous mic
  // stream. The `microphone` option below only accepts echoCancellation /
  // noiseSuppression / autoGainControl — there is no system-audio option here,
  // this is mic-only by design (per the spec's "user's microphone" requirement).
  const [isRequestingVoice, setIsRequestingVoice] = useState(false)
  const [isStoppingVoice, setIsStoppingVoice] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  // Bumped on every start/stop/cancel/unmount so a slow-to-resolve token
  // fetch or connect() from an earlier click can never touch state for a
  // session the user (or the component) has already moved past.
  const voiceSessionIdRef = useRef(0)

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onAuthError: () => {
      setVoiceError('Voice answering could not be authenticated. Please try again.')
    },
    onError: (err) => {
      console.error('STT error:', err)
      setVoiceError(microphoneErrorMessage(err))
    },
  })

  // Per the SDK: status transitions from "connected" to "transcribing" once
  // speech/VAD activity is detected, so both must count as "active" or the
  // UI would flicker/reset mid-session.
  const isVoiceActive = scribe.status === 'connected' || scribe.status === 'transcribing'
  const isVoiceBusy = isRequestingVoice || scribe.status === 'connecting'

  const handleStartVoice = useCallback(async () => {
    if (isVoiceBusy || isVoiceActive) return // never open a second session

    if (audioState === 'playing' && audioRef.current) {
      audioRef.current.pause()
    }
    setAnswerError('')
    setVoiceError('')
    scribe.clearTranscripts()

    const mySession = ++voiceSessionIdRef.current
    setIsRequestingVoice(true)

    const { data, error } = await fetchSTTToken(token)

    // The user may have cancelled, stopped, or the component may have
    // unmounted while the token request was in flight — ignore a stale start.
    if (mySession !== voiceSessionIdRef.current) return

    if (error || !data?.token) {
      setIsRequestingVoice(false)
      setVoiceError('Could not start voice answering. You can continue by typing.')
      return
    }

    try {
      await scribe.connect({
        token: data.token,
        // `microphone` is the only audio-source this SDK exposes — it always
        // resolves to navigator.mediaDevices.getUserMedia({ audio: true }).
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      if (mySession !== voiceSessionIdRef.current) {
        // Superseded while connecting (Cancel/Stop/unmount happened
        // meanwhile) — tear the just-opened session back down.
        scribe.disconnect()
        return
      }
    } catch (err) {
      if (mySession === voiceSessionIdRef.current) {
        setVoiceError(microphoneErrorMessage(err))
      }
    } finally {
      if (mySession === voiceSessionIdRef.current) setIsRequestingVoice(false)
    }
  }, [isVoiceBusy, isVoiceActive, audioState, scribe, token])

  const handleFinishVoice = useCallback(() => {
    if (!isVoiceActive || isStoppingVoice) return
    setIsStoppingVoice(true)
    voiceSessionIdRef.current++ // invalidate any start still in flight
    scribe.disconnect()
    const fullText = scribe.committedTranscripts.map((t) => t.text).join(' ').trim()
    if (fullText) {
      setAnswer((prev) => (prev ? `${prev} ${fullText}` : fullText))
      setAnswerError('')
    }
    scribe.clearTranscripts()
    setIsStoppingVoice(false)
  }, [isVoiceActive, isStoppingVoice, scribe])

  const handleCancelVoice = useCallback(() => {
    voiceSessionIdRef.current++ // invalidate any start still in flight
    setVoiceError('')
    scribe.disconnect()
    scribe.clearTranscripts()
  }, [scribe])

  // Defensive cleanup: release the mic/WebSocket if the component unmounts
  // (navigation away, submit redirect, etc.) while a voice answer is active.
  useEffect(() => {
    return () => {
      voiceSessionIdRef.current++
      if (scribe.status === 'connected' || scribe.status === 'transcribing' || scribe.status === 'connecting') {
        scribe.disconnect()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Timer
  const remaining = useCountdown(interview?.startedAt, interview?.duration)

  // ── Load interview on mount / page refresh ──────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data, error } = await getInterview(id, token)

      if (error) {
        if (error.toLowerCase().includes('not found') || error.includes('400')) {
          setPageState(STATE.NOT_FOUND)
        } else {
          setErrorMessage(error)
          setPageState(STATE.ERROR)
        }
        return
      }

      const iv = data.data
      setInterview(iv)

      // Restore current question from conversation
      const interviewerMsgs = iv.conversation.filter((m) => m.role === 'interviewer')
      const latestQuestion = interviewerMsgs[interviewerMsgs.length - 1] ?? null
      setCurrentQuestion(latestQuestion)
      setQuestionsAsked(iv.questionsAsked ?? interviewerMsgs.length)

      // Map backend status → page state
      if (iv.status === 'in_progress') {
        setPageState(STATE.ACTIVE)
      } else if (iv.status === 'completed') {
        setPageState(STATE.COMPLETED)
      } else if (iv.status === 'cancelled') {
        setPageState(STATE.CANCELLED)
      } else {
        // 'created' or unknown — treat as active for safety
        setPageState(STATE.ACTIVE)
      }
    }

    load()
  }, [id, token])

  // ── Submit Answer ───────────────────────────────────────────────────────────
  const handleSubmitAnswer = useCallback(async () => {
    if (submittingRef.current) return // prevent double-submission
    if (isVoiceActive || isVoiceBusy) {
      setAnswerError('Please stop voice answering before submitting.')
      return
    }
    if (!answer.trim()) {
      setAnswerError('Please write an answer before submitting.')
      return
    }
    if (answer.trim().length > 3000) {
      setAnswerError('Answer is too long (maximum 3000 characters).')
      return
    }

    submittingRef.current = true
    setPageState(STATE.SUBMITTING)
    setAnswerError('')

    const { data, error } = await apiSubmitAnswer(id, { answer: answer.trim() }, token)

    submittingRef.current = false

    if (error) {
      setAnswerError(error)
      setPageState(STATE.ACTIVE)
      return
    }

    const payload = data.data

    // Backend signals interview limit reached — prompt user to complete
    if (payload.status === 'ready_to_complete') {
      setAnswer('')
      setPageState(STATE.ACTIVE)
      // Show completion dialog automatically
      setConfirmDialog('end')
      return
    }

    // Normal: new question received
    setCurrentQuestion(payload.question)
    setQuestionsAsked(payload.questionsAsked)
    setAnswer('')
    setPageState(STATE.ACTIVE)
  }, [answer, id, token, isVoiceActive, isVoiceBusy])

  // ── Complete Interview ──────────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    setDialogLoading(true)
    const { data, error } = await apiCompleteInterview(id, token)
    setDialogLoading(false)

    if (error) {
      setConfirmDialog(null)
      setAnswerError(error)
      return
    }

    setInterview((prev) => ({ ...prev, status: 'completed' }))
    setPageState(STATE.COMPLETED)
    setConfirmDialog(null)
    // Navigate to feedback page (Chunk 3)
    navigate(`/interview/${id}/feedback`, { 
      replace: true, 
      state: { interview: { ...interview, status: 'completed', feedback: data.data.feedback } } 
    })
  }, [id, token, navigate])

  // ── Cancel Interview ────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    setDialogLoading(true)
    const { data, error } = await apiCancelInterview(id, token)
    setDialogLoading(false)

    if (error) {
      setConfirmDialog(null)
      setAnswerError(error)
      return
    }

    setPageState(STATE.CANCELLED)
    setConfirmDialog(null)
    navigate(`/interview/${id}/feedback`, { 
      replace: true, 
      state: { interview: { ...interview, status: 'cancelled', feedback: data.data?.feedback } } 
    })
  }, [id, token, navigate])

  // ── Timer expiry handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (remaining === 0 && pageState === STATE.ACTIVE) {
      // Time is up — the backend will enforce this on next answer submission.
      // Show the end dialog as a nudge.
      setConfirmDialog('end')
    }
  }, [remaining, pageState])

  // ── Keyboard shortcut: Ctrl+Enter to submit ─────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (pageState === STATE.ACTIVE && answer.trim()) {
          handleSubmitAnswer()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pageState, answer, handleSubmitAnswer])

  // ─── Render states ──────────────────────────────────────────────────────────

  if (pageState === STATE.LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading interview…</p>
        </div>
      </div>
    )
  }

  if (pageState === STATE.NOT_FOUND) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <p className="text-4xl font-bold text-foreground">404</p>
          <p className="text-muted-foreground">Interview not found.</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (pageState === STATE.ERROR) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-foreground font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (pageState === STATE.COMPLETED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-3xl">✓</div>
          <p className="text-foreground font-semibold">Interview Complete</p>
          <p className="text-sm text-muted-foreground">
            Your feedback is being prepared. Redirecting…
          </p>
        </div>
      </div>
    )
  }

  if (pageState === STATE.CANCELLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-foreground font-semibold">Interview Cancelled</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // ─── Active / Submitting state ──────────────────────────────────────────────
  const isSubmitting = pageState === STATE.SUBMITTING
  const totalQuestions = interview?.questionCount ?? '?'
  const timerExpired = remaining === 0
  const timerColor =
    remaining !== null && remaining < 60
      ? 'text-rose-400'
      : remaining !== null && remaining < 180
      ? 'text-amber-400'
      : 'text-muted-foreground'

  return (
    <>
      <audio 
        ref={audioRef}
        src={audioUrl || undefined} 
        onPlay={() => setAudioState('playing')}
        onPause={() => setAudioState('paused')}
        onEnded={() => setAudioState('idle')}
        onError={(e) => {
          if (audioUrl) {
             setAudioState('error')
             console.error('Audio playback error')
          }
        }}
        className="hidden"
      />

      {/* Confirm dialogs */}
      {confirmDialog === 'end' && (
        <ConfirmDialog
          title="End interview?"
          description="This will submit your current session for feedback. You won't be able to continue answering."
          confirmLabel="End Interview"
          onConfirm={handleComplete}
          onCancel={() => setConfirmDialog(null)}
          isLoading={dialogLoading}
        />
      )}
      {confirmDialog === 'cancel' && (
        <ConfirmDialog
          title="Cancel interview?"
          description="Your progress will be lost. This action cannot be undone."
          confirmLabel="Cancel Interview"
          onConfirm={handleCancel}
          onCancel={() => setConfirmDialog(null)}
          isLoading={dialogLoading}
        />
      )}

      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold tracking-tight text-foreground">
                AI Interviewer
              </span>
              {interview?.role && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                    {interview.role}
                  </span>
                </>
              )}
              {interview?.difficulty && (
                <DifficultyBadge difficulty={interview.difficulty} />
              )}
            </div>

            {/* Timer */}
            <div className={`text-sm font-mono tabular-nums font-medium ${timerColor}`}>
              {timerExpired ? (
                <span className="text-rose-400">Time&apos;s up</span>
              ) : (
                formatTime(remaining)
              )}
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 flex flex-col gap-8">
          {/* Progress */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
              Question {questionsAsked} of {totalQuestions}
            </p>
            {/* Progress bar */}
            <div className="flex-1 mx-6 h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (questionsAsked / (interview?.questionCount || 1)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.max(0, (interview?.questionCount ?? 0) - questionsAsked)} remaining
            </p>
          </div>

          {/* Question */}
          <div className="rounded-lg border border-border bg-card p-6">
            {currentQuestion?.topic && (
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                {currentQuestion.topic}
              </p>
            )}
            <p className="text-base sm:text-lg text-foreground leading-relaxed whitespace-pre-wrap">
              {currentQuestion?.text ?? 'Loading question…'}
            </p>

            {/* TTS Controls */}
            {currentQuestion?.text && (
              <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={toggleAudio}
                    disabled={audioState === 'loading' || !audioUrl}
                  >
                    {audioState === 'loading' ? 'Loading audio...' : (audioState === 'playing' ? '⏸ Pause' : '🔊 Play')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={replayAudio}
                    disabled={audioState === 'loading' || !audioUrl}
                  >
                    🔁 Replay
                  </Button>
                </div>
                {autoplayBlocked && (
                  <p className="text-xs text-amber-500 font-medium">Click Play to hear the question.</p>
                )}
                {audioState === 'error' && (
                  <p className="text-xs text-destructive">Audio unavailable.</p>
                )}
              </div>
            )}
          </div>

          {/* Answer area */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="answer-input" className="text-sm font-medium text-foreground">
                Your Answer
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (Ctrl+Enter to submit)
                </span>
              </label>

              {!isVoiceActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartVoice}
                  disabled={isSubmitting || timerExpired || isVoiceBusy}
                >
                  {isVoiceBusy
                    ? (scribe.status === 'connecting' ? 'Connecting…' : 'Requesting microphone…')
                    : '🎙 Start Voice Answer'}
                </Button>
              )}
              {isVoiceActive && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelVoice} disabled={isStoppingVoice}>
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => scribe.clearTranscripts()}
                    disabled={isStoppingVoice}
                  >
                    Try Again
                  </Button>
                  <Button size="sm" onClick={handleFinishVoice} disabled={isStoppingVoice}>
                    {isStoppingVoice ? 'Stopping…' : '⏹ Stop Voice Answer'}
                  </Button>
                </div>
              )}
            </div>

            {voiceError && (
              <p className="text-sm text-destructive">{voiceError}</p>
            )}

            {/* Voice-answer live transcript view (replaces the textarea while recording) */}
            {isVoiceActive ? (
              <div className="min-h-[180px] p-3 rounded-md border border-primary bg-card text-sm leading-relaxed overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    {scribe.status === 'transcribing' ? 'Listening…' : 'Recording…'}
                  </span>
                </div>
                {scribe.committedTranscripts.map((t) => (
                  <span key={t.id} className="text-foreground">{t.text} </span>
                ))}
                <span className="text-muted-foreground italic">
                  {scribe.partialTranscript || (scribe.committedTranscripts.length ? '' : 'Start speaking…')}
                </span>
              </div>
            ) : (
              <Textarea
                id="answer-input"
                placeholder="Type your answer here…"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value)
                  if (answerError) setAnswerError('')
                }}
                disabled={isSubmitting || timerExpired}
                className="min-h-[180px] text-sm leading-relaxed"
              />
            )}

            <div className="flex items-center justify-between">
              <div>
                {answerError && (
                  <p className="text-sm text-destructive">{answerError}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {answer.length} / 3000
              </p>
            </div>

            <Button
              id="submit-answer"
              onClick={handleSubmitAnswer}
              disabled={isSubmitting || timerExpired || isVoiceActive || isVoiceBusy}
              className="w-full sm:w-auto sm:self-end"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Generating next question…
                </span>
              ) : (
                'Submit Answer'
              )}
            </Button>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
            <button
              id="cancel-interview"
              onClick={() => setConfirmDialog('cancel')}
              disabled={isSubmitting}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Cancel interview
            </button>

            <Button
              id="end-interview"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialog('end')}
              disabled={isSubmitting}
            >
              End Interview
            </Button>
          </div>
        </main>
      </div>
    </>
  )
}
