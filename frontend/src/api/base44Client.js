// Local drop-in replacement for @base44/sdk client.
// Exposes the same surface used across the codebase:
//   base44.auth.me()   |  base44.auth.logout()    | base44.auth.redirectToLogin()
//   base44.entities.<Name>.list(sort, limit)
//   base44.entities.<Name>.get(id)
//   base44.entities.<Name>.filter(query)
//   base44.entities.<Name>.create(data)
//   base44.entities.<Name>.update(id, patch)
//   base44.entities.<Name>.delete(id)
//   base44.functions.invoke(name, payload)
//
// All calls go to our FastAPI backend under ${REACT_APP_BACKEND_URL}/api/*

import axios from 'axios'

const BACKEND_URL =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  ''

const TOKEN_KEY = 'aegis_access_token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch (e) {
    return null
  }
}

export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch (e) {
    /* noop */
  }
}

const http = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Unwrap data for consumers
const unwrap = (res) => res.data

const ENTITY_NAMES = [
  'Agent',
  'AgentExecution',
  'AuditEvent',
  'FactionResonance',
  'KnowledgeDocument',
  'MemoryNode',
  'MonetaryProposal',
  'Skill',
  'SkillExecution',
  'UserPriceAlert',
]

const makeEntityClient = (name) => ({
  async list(sort = '', limit = 100) {
    const params = {}
    if (sort) params.sort = sort
    if (limit) params.limit = limit
    return http.get(`/entities/${name}/list`, { params }).then(unwrap)
  },
  async get(id) {
    return http.get(`/entities/${name}/${id}`).then(unwrap)
  },
  async filter(query = {}, sort = '', limit = 100) {
    return http
      .post(`/entities/${name}/filter`, { query, sort, limit })
      .then(unwrap)
  },
  async create(data) {
    return http.post(`/entities/${name}`, data).then(unwrap)
  },
  async update(id, patch) {
    return http.put(`/entities/${name}/${id}`, patch).then(unwrap)
  },
  async delete(id) {
    return http.delete(`/entities/${name}/${id}`).then(unwrap)
  },
  // Polling-based subscribe that mimics base44 realtime event shape.
  // Callback receives: { type: 'create' | 'update' | 'delete', data: <doc> }
  subscribe(callback, intervalMs = 5000) {
    if (typeof callback !== 'function') return () => {}
    let stopped = false
    let prev = new Map() // id -> doc

    const fetchAndDiff = async () => {
      if (stopped) return
      try {
        const docs = await http
          .get(`/entities/${name}/list`, { params: { limit: 200 } })
          .then(unwrap)
        const next = new Map()
        for (const d of docs || []) {
          const key = d.id || d.node_id || d.event_id
          if (!key) continue
          next.set(key, d)
          if (!prev.has(key)) {
            // First load: still emit as 'create' so downstream charts get data
            callback({ type: 'create', data: d })
          } else {
            const oldDoc = prev.get(key)
            if (JSON.stringify(oldDoc) !== JSON.stringify(d)) {
              callback({ type: 'update', data: d })
            }
          }
        }
        for (const [key, oldDoc] of prev.entries()) {
          if (!next.has(key)) callback({ type: 'delete', data: oldDoc })
        }
        prev = next
      } catch (e) {
        // silent
      }
    }
    fetchAndDiff()
    const id = setInterval(fetchAndDiff, intervalMs)
    return () => {
      stopped = true
      clearInterval(id)
    }
  },
})

const entities = ENTITY_NAMES.reduce((acc, n) => {
  acc[n] = makeEntityClient(n)
  return acc
}, {})

const auth = {
  async me() {
    return http.get('/auth/me').then(unwrap)
  },
  async login(email, password) {
    const res = await http.post('/auth/login', { email, password }).then(unwrap)
    if (res?.access_token) setToken(res.access_token)
    return res
  },
  async register(email, password, full_name) {
    const res = await http
      .post('/auth/register', { email, password, full_name })
      .then(unwrap)
    if (res?.access_token) setToken(res.access_token)
    return res
  },
  logout() {
    setToken(null)
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  },
  redirectToLogin() {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  },
}

const functions = {
  async invoke(name, payload) {
    const res = await http.post(`/functions/invoke/${name}`, payload || {})
    // base44 pages use `res.data.xxx`, so mimic axios-style { data: ... }
    return { data: res.data }
  },
}

// Integrations.Core shim — InvokeLLM routes to our gemmaChat, UploadFile returns a data URL.
const integrations = {
  Core: {
    async InvokeLLM({ prompt, model, system_prompt, messages, add_context_from_internet } = {}) {
      const msgs =
        Array.isArray(messages) && messages.length
          ? messages
          : [{ role: 'user', content: String(prompt || '') }]
      const res = await http
        .post('/functions/invoke/gemmaChat', {
          messages: msgs,
          system_prompt,
          model,
        })
        .then(unwrap)
      return res?.content || res?.reply || ''
    },
    async UploadFile({ file } = {}) {
      // Local-only: turn the file into a data URL so the UI can preview it.
      if (!file) return { file_url: '', name: '', size: 0 }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
      })
      return { file_url: dataUrl, name: file.name, size: file.size, type: file.type }
    },
  },
}

export const base44 = { auth, entities, functions, integrations }
export default base44
