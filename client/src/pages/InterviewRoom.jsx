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
import { ThemeToggle } from '../components/ThemeToggle'
import '../styles/InterviewRoom.css'

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

  // ── Skip question ────────────────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    if (submittingRef.current) return
    if (isVoiceActive || isVoiceBusy) {
      setAnswerError('Please stop voice answering before skipping.')
      return
    }
    submittingRef.current = true
    setPageState(STATE.SUBMITTING)
    setAnswerError('')

    const { data, error } = await apiSubmitAnswer(id, { answer: '(skipped)' }, token)

    submittingRef.current = false

    if (error) {
      setAnswerError(error)
      setPageState(STATE.ACTIVE)
      return
    }

    const payload = data.data

    if (payload.status === 'ready_to_complete') {
      setAnswer('')
      setPageState(STATE.ACTIVE)
      setConfirmDialog('end')
      return
    }

    setCurrentQuestion(payload.question)
    setQuestionsAsked(payload.questionsAsked)
    setAnswer('')
    setPageState(STATE.ACTIVE)
  }, [id, token, isVoiceActive, isVoiceBusy])


  // ─── Render states ──────────────────────────────────────────────────────────

  if (pageState === STATE.LOADING) {
    return (
      <div className="ir-loading-page">
        <div className="ir-loading-content">
          <div className="ir-loading-spinner" />
          <p className="ir-loading-text">Loading interview…</p>
        </div>
      </div>
    )
  }

  if (pageState === STATE.NOT_FOUND) {
    return (
      <div className="ir-error-page">
        <div className="ir-error-content">
          <p className="ir-error-404">404</p>
          <p className="ir-error-desc">Interview not found.</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (pageState === STATE.ERROR) {
    return (
      <div className="ir-error-page">
        <div className="ir-error-content">
          <p className="ir-error-title">Something went wrong</p>
          <p className="ir-error-desc">{errorMessage}</p>
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (pageState === STATE.COMPLETED) {
    return (
      <div className="ir-error-page">
        <div className="ir-error-content">
          <div className="ir-success-icon">✓</div>
          <p className="ir-success-title">Interview Complete</p>
          <p className="ir-error-desc">
            Your feedback is being prepared. Redirecting…
          </p>
        </div>
      </div>
    )
  }

  if (pageState === STATE.CANCELLED) {
    return (
      <div className="ir-error-page">
        <div className="ir-error-content">
          <p className="ir-success-title">Interview Cancelled</p>
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
        onError={() => { if (audioUrl) { setAudioState('error'); console.error('Audio playback error') } }}
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

      <div className="ir-container">
        {/* ── Sticky Top Header ── */}
        <header className="ir-header">
          {/* Row 1: MOCKINT (left) · Role (center) · Difficulty + Timer (right) */}
          <div className="ir-header-top">

            {/* Left: Brand */}
            <div className="ir-brand-group">
              <span className="ir-brand">MOCKINT</span>
            </div>

            {/* Center: Target Role */}
            <div className="ir-header-center">
              {interview?.role && (
                <span className="ir-role-centered">{interview.role}</span>
              )}
            </div>

            {/* Right: Difficulty + Theme toggle + Timer */}
            <div className="ir-header-right">
              {interview?.difficulty && (
                <DifficultyBadge difficulty={interview.difficulty} />
              )}
              <ThemeToggle />
              <div className={`ir-timer-box ${timerColor}`}>
                <svg className="ir-timer-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>{timerExpired ? <span className="text-rose-400">Time&apos;s up</span> : formatTime(remaining)}</span>
              </div>
            </div>

          </div>
          {/* Row 2: progress */}
          <div className="ir-progress-row">
            <p className="ir-progress-text">
              Question {questionsAsked} of {totalQuestions}
            </p>
            <div className="ir-progress-bar-bg">
              <div
                className="ir-progress-bar-fill"
                style={{ width: `${Math.min(100, (questionsAsked / (interview?.questionCount || 1)) * 100)}%` }}
              />
            </div>
            <p className="ir-progress-remaining">
              {Math.max(0, (interview?.questionCount ?? 0) - questionsAsked)} remaining
            </p>
          </div>
        </header>

        {/* ── Main two-column area ── */}
        <main className="ir-main">
          <div className="ir-grid">

            {/* LEFT — Interviewer Panel */}
            <div className="ir-panel">
              {/* Label */}
              <div className="ir-panel-label-row">
                <span className="ir-panel-label-dot bg-primary/60" />
                <span className="ir-panel-label-text">Interviewer</span>
                {audioState === 'playing' && (
                  <span className="ir-panel-status-active text-primary">Speaking…</span>
                )}
                {audioState === 'loading' && (
                  <span className="ir-panel-status-loading">Loading audio…</span>
                )}
              </div>

              {/* Avatar */}
              <div className="ir-avatar-wrapper">
                <div className={`ir-avatar ${audioState === 'playing' ? 'border-primary avatar-speaking' : 'border-border'}`}>
                  <svg className="ir-avatar-icon text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15a2.25 2.25 0 01.217 3.424l-2.644 2.585A2.25 2.25 0 0115.75 21.75H8.25a2.25 2.25 0 01-1.623-.691L3.983 18.474A2.25 2.25 0 014.2 15m15.6 0H4.2" />
                  </svg>
                  {audioState === 'playing' && (
                    <span className="ir-avatar-bars">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`inline-block w-1 rounded-full bg-primary bar-${i}`} style={{ height: '100%', transformOrigin: 'bottom' }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Question / Subtitles */}
              <div className="ir-content-col">
                {currentQuestion?.topic && (
                  <span className="ir-topic">{currentQuestion.topic}</span>
                )}
                <div className="ir-text-box">
                  <p className="ir-text">
                    {currentQuestion?.text ?? 'Loading question…'}
                  </p>
                </div>

                {/* TTS Controls */}
                {currentQuestion?.text && (
                  <div className="ir-controls-row">
                    <Button variant="outline" size="sm" onClick={toggleAudio} disabled={audioState === 'loading' || !audioUrl} className="ir-control-btn">
                      {audioState === 'loading' ? (
                        <><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />Loading…</>
                      ) : audioState === 'playing' ? (
                        <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><rect x="5" y="4" width="3" height="12" rx="1"/><rect x="12" y="4" width="3" height="12" rx="1"/></svg>Pause</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>Play</>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={replayAudio} disabled={audioState === 'loading' || !audioUrl} className="ir-control-btn">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Replay
                    </Button>
                    {autoplayBlocked && <p className="text-xs text-amber-500 font-medium">Click Play to hear the question.</p>}
                    {audioState === 'error' && <p className="text-xs text-destructive">Audio unavailable.</p>}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — User Panel */}
            <div className="ir-panel">
              {/* Label */}
              <div className="ir-panel-label-row">
                <span className={`ir-panel-label-dot ${isVoiceActive ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <span className="ir-panel-label-text">You</span>
                {isVoiceActive && (
                  <span className="ir-panel-status-active text-emerald-400">
                    {scribe.status === 'transcribing' ? 'Listening…' : 'Recording…'}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div className="ir-avatar-wrapper">
                <div className={`ir-avatar ${isVoiceActive ? 'border-emerald-400 avatar-listening' : 'border-border'}`}>
                  <svg className="ir-avatar-icon text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  {isVoiceActive && (
                    <span className="ir-avatar-bars">
                      {[1,2,3,4,5].map(i => (
                        <span key={i} className={`inline-block w-1 rounded-full bg-emerald-400 bar-${i}`} style={{ height: '100%', transformOrigin: 'bottom' }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {voiceError && <p className="text-sm text-destructive">{voiceError}</p>}

              {/* Answer Area — text box first */}
              <div className="ir-answer-col">
                <label htmlFor="answer-input" className="ir-answer-label-row">
                  <span>Your Answer</span>
                  <span className="ir-answer-hint">Ctrl+Enter to submit</span>
                </label>

                {isVoiceActive ? (
                  <div className="ir-voice-box">
                    <div className="ir-voice-status-row">
                      <span className="ir-voice-dot" />
                      <span className="text-xs text-muted-foreground">{scribe.status === 'transcribing' ? 'Listening…' : 'Recording…'}</span>
                    </div>
                    {scribe.committedTranscripts.map((t) => (
                      <span key={t.id} className="text-foreground">{t.text} </span>
                    ))}
                    <span className="text-muted-foreground italic">
                      {scribe.partialTranscript || (scribe.committedTranscripts.length ? '' : 'Start speaking…')}
                    </span>
                  </div>
                ) : (
                  <textarea
                    id="answer-input"
                    placeholder="Type your answer here…"
                    value={answer}
                    onChange={(e) => { setAnswer(e.target.value); if (answerError) setAnswerError('') }}
                    disabled={isSubmitting || timerExpired}
                    className="ir-textarea"
                  />
                )}

                <div className="ir-footer-info">
                  <div>{answerError && <p className="text-sm text-destructive">{answerError}</p>}</div>
                  <p className={`text-xs tabular-nums ${answer.length > 2800 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                    {answer.length} / 3000
                  </p>
                </div>

                {/* Voice Controls — below text box, aligned with interviewer's Play/Replay */}
                <div className="ir-user-controls-row">
                  {!isVoiceActive && (
                    <Button variant="secondary" size="sm" onClick={handleStartVoice} disabled={isSubmitting || timerExpired || isVoiceBusy} className="ir-control-btn">
                      {isVoiceBusy ? (
                        <><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />{scribe.status === 'connecting' ? 'Connecting…' : 'Requesting mic…'}</>
                      ) : (
                        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>Start Voice Answer</>
                      )}
                    </Button>
                  )}
                  {isVoiceActive && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => scribe.clearTranscripts()} disabled={isStoppingVoice} className="ir-control-btn">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                        Retry
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancelVoice} disabled={isStoppingVoice} className="ir-control-btn text-muted-foreground">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleFinishVoice} disabled={isStoppingVoice} className="ir-control-btn bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                        {isStoppingVoice ? (
                          <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Stopping…</>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="2"/></svg>Stop Voice Answer</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Sticky Bottom Bar ── */}
        <div className="ir-bottom-bar">
          <div className="ir-bottom-bar-inner">

            {/* 1 — Cancel Interview: red circular phone-cut icon */}
            <button
              id="cancel-interview"
              onClick={() => setConfirmDialog('cancel')}
              disabled={isSubmitting}
              className="ir-action-btn ir-action-cancel"
              title="Cancel Interview"
            >
              <span className="ir-action-circle ir-action-circle-cancel">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.712 4.33a9.027 9.027 0 011.652 1.306c.51.51.944 1.064 1.306 1.652M16.712 4.33l-3.448 4.138m3.448-4.138a9 9 0 00-12.728 0l4.138 3.448M4.33 7.288L7.777 10.736M4.33 7.288a9.027 9.027 0 00-1.652 1.652l4.138 3.448M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="ir-action-label">Cancel</span>
            </button>

            {/* 2 — End Interview: yellow circular finish flag */}
            <button
              id="end-interview"
              onClick={() => setConfirmDialog('end')}
              disabled={isSubmitting}
              className="ir-action-btn ir-action-end"
              title="End Interview"
            >
              <span className="ir-action-circle ir-action-circle-end">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </span>
              <span className="ir-action-label">End</span>
            </button>

            <div className="ir-action-divider" />

            {/* 3 — Skip Answer */}
            <button
              id="skip-question"
              onClick={handleSkip}
              disabled={isSubmitting || timerExpired}
              className="ir-action-btn ir-action-skip"
              title="Skip Answer"
            >
              <span className="ir-action-circle ir-action-circle-skip">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811V8.69zM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061a1.125 1.125 0 01-1.683-.977V8.69z" />
                </svg>
              </span>
              <span className="ir-action-label">Skip</span>
            </button>

            {/* 4 — Submit Answer */}
            <button
              id="submit-answer"
              onClick={handleSubmitAnswer}
              disabled={isSubmitting || timerExpired || isVoiceActive || isVoiceBusy}
              className="ir-action-btn ir-action-submit"
              title="Submit Answer"
            >
              <span className="ir-action-circle ir-action-circle-submit">
                {isSubmitting ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                )}
              </span>
              <span className="ir-action-label ir-action-label-submit">{isSubmitting ? 'Generating…' : 'Submit'}</span>
            </button>

          </div>
        </div>
      </div>
    </>
  )
}

