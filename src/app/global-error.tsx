'use client'

import Link from 'next/link'

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Algo salio mal - Maissi</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f0f2f5' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#f0f2f5',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e9edef',
              padding: '2.5rem 2rem',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <img
              src="/maissi-logo.svg"
              alt="Maissi"
              style={{ height: '2.5rem', marginBottom: '1.5rem' }}
            />

            <h1
              style={{
                color: '#111b21',
                fontSize: '1.375rem',
                fontWeight: 600,
                margin: '0 0 0.75rem 0',
              }}
            >
              Algo salio mal
            </h1>

            <p
              style={{
                color: '#667781',
                fontSize: '0.9375rem',
                margin: '0 0 2rem 0',
                lineHeight: 1.5,
              }}
            >
              Estamos trabajando en ello. Por favor intenta de nuevo.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => reset()}
                style={{
                  backgroundColor: '#00a884',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  flex: 1,
                  maxWidth: '180px',
                }}
              >
                Intentar de nuevo
              </button>

              <Link
                href="/"
                style={{
                  backgroundColor: 'transparent',
                  color: '#111b21',
                  border: '1px solid #e9edef',
                  borderRadius: '8px',
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  flex: 1,
                  maxWidth: '180px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
