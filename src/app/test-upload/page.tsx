'use client'

/**
 * DIAGNOSTIC PAGE — /test-upload
 *
 * Completely isolated from locale routing, auth middleware, and app styles.
 * Purpose: identify the exact failure layer in the Supabase Storage upload.
 * DELETE THIS FILE before deploying to production.
 */

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// ── Helpers ────────────────────────────────────────────────────────────────

function mask(value: string): string {
  if (!value || value.length < 12) return '(empty or too short)'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function ts(): string {
  return `[${new Date().toISOString()}]`
}

// ── Types ──────────────────────────────────────────────────────────────────

interface LogEntry {
  time: string
  layer: string
  status: 'ok' | 'warn' | 'error' | 'info'
  data: unknown
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TestUploadPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [running, setRunning] = useState(false)

  function log(layer: string, status: LogEntry['status'], data: unknown) {
    setLogs((prev) => [...prev, { time: ts(), layer, status, data }])
  }

  async function runDiagnostic(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLogs([])
    setRunning(true)

    // ── LAYER 0: Environment variables ─────────────────────────────────
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

    log('ENV', url ? 'ok' : 'error', {
      NEXT_PUBLIC_SUPABASE_URL: url ? `${url.slice(0, 30)}...` : '(MISSING)',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: key ? mask(key) : '(MISSING)',
      key_format: key.startsWith('eyJ') ? 'JWT (legacy)' : key.startsWith('sb_publishable_') ? 'sb_publishable (new format)' : 'UNKNOWN',
    })

    if (!url || !key) {
      log('ENV', 'error', 'Aborting — missing env vars. Check .env.local and restart dev server.')
      setRunning(false)
      return
    }

    // ── LAYER 1: SDK instantiation ──────────────────────────────────────
    const supabase = createBrowserClient(url, key)
    log('SDK', 'ok', {
      package: '@supabase/ssr createBrowserClient',
      url_used: url,
      key_used: mask(key),
    })

    // ── LAYER 2: Session ────────────────────────────────────────────────
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      log('AUTH/getSession', 'error', { message: sessionError.message, status: sessionError.status })
    } else if (!session) {
      log('AUTH/getSession', 'warn', 'Session is NULL — user is not authenticated or cookie is missing')
    } else {
      const expiresAt = new Date(session.expires_at! * 1000).toISOString()
      const isExpired = Date.now() > session.expires_at! * 1000
      log('AUTH/getSession', isExpired ? 'warn' : 'ok', {
        user_id: session.user.id,
        email: session.user.email,
        expires_at: expiresAt,
        is_expired: isExpired,
        token_type: session.token_type,
        access_token_preview: `${session.access_token.slice(0, 20)}...`,
      })
    }

    // ── LAYER 3: getUser() — server-validated ───────────────────────────
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      log('AUTH/getUser', 'error', { message: userError.message, status: userError.status })
    } else if (!user) {
      log('AUTH/getUser', 'error', 'user is NULL — JWT rejected by Supabase server')
    } else {
      log('AUTH/getUser', 'ok', { user_id: user.id, email: user.email, role: user.role })
    }

    if (!user) {
      log('ABORT', 'error', 'Cannot upload without authenticated user. Fix auth layer first.')
      setRunning(false)
      return
    }

    // ── LAYER 4: CORS preflight probe ───────────────────────────────────
    const storageEndpoint = `${url}/storage/v1/object/invoices/${user.id}/probe-test.bin`
    try {
      const probe = await fetch(storageEndpoint, {
        method: 'OPTIONS',
        headers: { Origin: window.location.origin },
      })
      log('CORS/preflight', 'ok', {
        status: probe.status,
        headers: {
          'access-control-allow-origin': probe.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': probe.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': probe.headers.get('access-control-allow-headers'),
        },
      })
    } catch (corsErr) {
      log('CORS/preflight', 'error', {
        message: corsErr instanceof Error ? corsErr.message : String(corsErr),
        note: 'This usually means the Supabase URL is wrong or network is blocked.',
      })
    }

    // ── LAYER 5: Raw fetch upload (bypasses Supabase SDK) ──────────────
    const rawPath = `${user.id}/diag-${Date.now()}.${file.name.split('.').pop() ?? 'bin'}`
    const rawUrl = `${url}/storage/v1/object/invoices/${rawPath}`

    log('STORAGE/raw-fetch', 'info', {
      method: 'POST',
      url: rawUrl,
      file: { name: file.name, type: file.type, size: file.size },
    })

    try {
      const rawRes = await fetch(rawUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? key}`,
          'x-upsert': 'false',
          'Content-Type': file.type,
        },
        body: file,
      })

      const rawBody = await rawRes.text()
      log('STORAGE/raw-fetch', rawRes.ok ? 'ok' : 'error', {
        status: rawRes.status,
        statusText: rawRes.statusText,
        body: (() => { try { return JSON.parse(rawBody) } catch { return rawBody } })(),
        headers: {
          'content-type': rawRes.headers.get('content-type'),
        },
      })
    } catch (rawErr) {
      log('STORAGE/raw-fetch', 'error', {
        message: rawErr instanceof Error ? rawErr.message : String(rawErr),
      })
    }

    // ── LAYER 6: Supabase SDK upload ────────────────────────────────────
    const sdkPath = `${user.id}/diag-sdk-${Date.now()}.${file.name.split('.').pop() ?? 'bin'}`

    log('STORAGE/sdk-upload', 'info', {
      bucket: 'invoices',
      path: sdkPath,
      contentType: file.type,
    })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(sdkPath, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      log('STORAGE/sdk-upload', 'error', {
        message: uploadError.message,
        // StorageError exposes these — cast to access them
        statusCode: (uploadError as unknown as Record<string, unknown>).statusCode,
        error: (uploadError as unknown as Record<string, unknown>).error,
        cause: (uploadError as unknown as Record<string, unknown>).cause,
        stack: (uploadError as unknown as Record<string, unknown>).stack,
      })
    } else {
      log('STORAGE/sdk-upload', 'ok', {
        path: uploadData?.path,
        fullPath: uploadData?.fullPath,
        id: uploadData?.id,
      })
    }

    setRunning(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const colors: Record<LogEntry['status'], string> = {
    ok: '#22c55e',
    warn: '#f59e0b',
    error: '#ef4444',
    info: '#60a5fa',
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', background: '#0a0a0a', color: '#e5e5e5', minHeight: '100vh' }}>
      <h1 style={{ color: '#a78bfa', marginBottom: '0.5rem' }}>🔬 Supabase Storage — Diagnostic Page</h1>
      <p style={{ color: '#555', marginBottom: '2rem', fontSize: '0.85rem' }}>
        /test-upload · isolated · no styles · no locale · DELETE BEFORE PRODUCTION
      </p>

      <input
        type="file"
        accept="image/*,application/pdf"
        disabled={running}
        onChange={runDiagnostic}
        style={{
          display: 'block',
          marginBottom: '2rem',
          padding: '0.5rem',
          background: '#1a1a1a',
          border: '1px solid #333',
          color: '#e5e5e5',
          cursor: running ? 'wait' : 'pointer',
        }}
      />

      {running && (
        <p style={{ color: '#f59e0b', marginBottom: '1rem' }}>⏳ Running diagnostic...</p>
      )}

      {logs.length > 0 && (
        <div>
          {logs.map((entry, i) => (
            <div key={i} style={{ marginBottom: '1rem', borderLeft: `3px solid ${colors[entry.status]}`, paddingLeft: '1rem' }}>
              <div style={{ color: colors[entry.status], fontWeight: 'bold', marginBottom: '0.25rem' }}>
                {entry.time} [{entry.layer}] {entry.status.toUpperCase()}
              </div>
              <pre style={{
                background: '#111',
                padding: '0.75rem',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '0.8rem',
                color: entry.status === 'error' ? '#fca5a5' : '#d4d4d4',
                margin: 0,
              }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          ))}

          <div style={{ marginTop: '2rem', padding: '1rem', background: '#111', borderRadius: '4px' }}>
            <p style={{ color: '#888', marginBottom: '0.5rem', fontSize: '0.8rem' }}>RAW JSON (para pegar en el issue):</p>
            <textarea
              readOnly
              value={JSON.stringify(logs, null, 2)}
              style={{ width: '100%', height: '200px', background: '#0a0a0a', color: '#555', border: '1px solid #222', padding: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
