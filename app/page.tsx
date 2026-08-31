import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 700, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 36, marginBottom: 10 }}>Find the cheapest way to fly</h1>
      <p style={{ fontSize: 18, color: '#555', marginBottom: 30 }}>
        Compare flight prices from Vienna, Bratislava, Budapest, and Košice —
        all in one search. Stop checking four sites separately.
      </p>

      <Link
        href="/search"
        style={{
          display: 'inline-block',
          padding: '14px 28px',
          fontSize: 18,
          backgroundColor: '#0070f3',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 'bold',
        }}
      >
        Search flights →
      </Link>

      <div style={{ marginTop: 60, textAlign: 'left' }}>
        <h2 style={{ fontSize: 22, marginBottom: 15 }}>How it works</h2>
        <ol style={{ fontSize: 16, color: '#444', lineHeight: 1.8 }}>
          <li>Enter where you want to go</li>
          <li>We check prices from all 4 nearby airports</li>
          <li>We show you the cheapest option, sorted by price</li>
        </ol>
      </div>
    </div>
  )
}
