const BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Helper: perform a fetch and return { data, error }.
 * Never throws — callers should check the error field.
 */
async function apiFetch(path, options = {}) {
  try {
    // Destructure headers out so ...rest does NOT overwrite the merged headers object
    const { headers: extraHeaders, ...rest } = options
    const res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    })

    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('ai_interviewer_token')
        window.location.href = '/login'
        return { data: null, error: 'Session expired. Please log in again.' }
      }
      const message =
        json.message || json.error || `Request failed (${res.status})`
      console.error(`[API] ${options.method || 'GET'} ${path} →`, res.status, message)
      return { data: null, error: message }
    }

    return { data: json, error: null }
  } catch (err) {
    console.error(`[API] Network error on ${path}:`, err)
    return { data: null, error: 'Unable to connect to the server. Please try again.' }
  }
}

/**
 * POST /auth/signup
 * @param {{ name: string, email: string, password: string }} data
 */
export async function signup(data) {
  return apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * POST /auth/login
 * @param {{ email: string, password: string }} data
 */
export async function login(data) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * GET /users/me — requires a valid JWT
 * @param {string} token
 */
export async function getCurrentUser(token) {
  return apiFetch('/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// ─── Interview API ────────────────────────────────────────────────────────────

/**
 * POST /interviews — create a new interview and receive the first question
 * @param {{ resume: string, role: string, difficulty: string, questionCount: number, duration: number }} data
 * @param {string} token
 */
export async function createInterview(data, token) {
  return apiFetch('/interviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
}

/**
 * GET /interviews/:id — fetch interview state (used on page load / refresh)
 * @param {string} id
 * @param {string} token
 */
export async function getInterview(id, token) {
  return apiFetch(`/interviews/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * POST /interviews/:id/answer — submit an answer, get the next question
 * @param {string} id
 * @param {{ answer: string }} data
 * @param {string} token
 */
export async function submitAnswer(id, data, token) {
  return apiFetch(`/interviews/${id}/answer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
}

/**
 * POST /interviews/:id/complete — mark interview as complete, get feedback
 * @param {string} id
 * @param {string} token
 */
export async function completeInterview(id, token) {
  return apiFetch(`/interviews/${id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * POST /interviews/:id/cancel — cancel an active interview
 * @param {string} id
 * @param {string} token
 */
export async function cancelInterview(id, token) {
  return apiFetch(`/interviews/${id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * GET /interviews — fetch user's interview history
 * @param {string} token
 */
export async function getInterviewHistory(token) {
  return apiFetch('/interviews', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/**
 * POST /tts — fetch ElevenLabs audio stream
 * We return an ObjectURL for the Blob so it can be played immediately
 */
export async function fetchTTSAudio(text, token) {
  const res = await fetch(`${BASE_URL}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    throw new Error(`TTS failed: ${res.status}`)
  }

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * GET /voice/stt-token — fetch single-use token for ElevenLabs Scribe
 */
export async function fetchSTTToken(token) {
  const { data, error } = await apiFetch('/voice/stt-token', {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (error) {
    throw new Error(error)
  }
  
  return data.token
}
