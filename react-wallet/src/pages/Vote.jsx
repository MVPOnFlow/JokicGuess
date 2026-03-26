import React, { useState, useRef } from 'react';

const candidates = [
  { key: 'jokic',   name: 'Nikola Jokić', team: 'DEN', emoji: '🃏', isJokic: true },
  { key: 'embiid',  name: 'Victor Wembanyama',  team: 'SAS', emoji: '👽' },
  { key: 'sga',     name: 'Shai Gilgeous-Alexander', team: 'OKC', emoji: '⛈️' },
  { key: 'luka',    name: 'Luka Dončić',   team: 'LAL', emoji: '🪄' },
  { key: 'giannis', name: 'Jalen Brown', team: 'BOS', emoji: '☘️' },
];

const styles = {
  wrapper: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '0 1rem 3rem',
  },
  hero: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  trophy: {
    fontSize: '3.5rem',
    lineHeight: 1,
    marginBottom: '0.5rem',
  },
  title: {
    color: '#FDB927',
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '0.35rem',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '0.92rem',
    lineHeight: 1.5,
  },
  card: {
    background: '#1C2A3A',
    border: '1px solid #273549',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  cardHeader: {
    background: '#0E2240',
    padding: '0.85rem 1.25rem',
    borderBottom: '1px solid #273549',
  },
  cardTitle: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    margin: 0,
  },
  cardBody: {
    padding: '1.25rem',
  },
  /* vote buttons */
  btnGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  btn: (isJokic) => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.9rem 1.25rem',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '1rem',
    transition: 'transform 0.15s, box-shadow 0.2s',
    ...(isJokic
      ? {
          background: 'linear-gradient(135deg, #FDB927, #e5a520)',
          color: '#0E2240',
          boxShadow: '0 4px 16px rgba(253,185,39,0.3)',
        }
      : {
          background: 'rgba(255,255,255,0.06)',
          color: '#9CA3AF',
          border: '1px solid #273549',
        }),
  }),
  btnEmoji: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  btnInfo: {
    textAlign: 'left',
  },
  btnName: {
    display: 'block',
    lineHeight: 1.2,
  },
  btnTeam: (isJokic) => ({
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 500,
    opacity: 0.7,
    color: isJokic ? '#0E2240' : '#6B7280',
  }),
  /* results */
  resultRow: (pct, isJokic) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.75rem 1rem',
    borderRadius: 10,
    marginBottom: '0.6rem',
    position: 'relative',
    overflow: 'hidden',
    background: isJokic
      ? 'rgba(253,185,39,0.12)'
      : 'rgba(255,255,255,0.04)',
    border: isJokic
      ? '1px solid rgba(253,185,39,0.3)'
      : '1px solid #273549',
  }),
  resultBar: (pct, isJokic) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: `${pct}%`,
    background: isJokic
      ? 'linear-gradient(90deg, rgba(253,185,39,0.25), rgba(253,185,39,0.08))'
      : 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
  }),
  resultEmoji: {
    fontSize: '1.35rem',
    zIndex: 1,
    flexShrink: 0,
  },
  resultName: (isJokic) => ({
    flex: 1,
    fontWeight: isJokic ? 700 : 500,
    color: isJokic ? '#FDB927' : '#9CA3AF',
    fontSize: '0.92rem',
    zIndex: 1,
  }),
  resultPct: (isJokic) => ({
    fontWeight: 700,
    fontSize: '1rem',
    color: isJokic ? '#FDB927' : '#4B5563',
    zIndex: 1,
    minWidth: 48,
    textAlign: 'right',
  }),
  confetti: {
    textAlign: 'center',
    fontSize: '1.5rem',
    marginBottom: '0.75rem',
    letterSpacing: '0.25em',
  },
  resultHeading: {
    textAlign: 'center',
    color: '#FDB927',
    fontWeight: 700,
    fontSize: '1.1rem',
    marginBottom: '1.25rem',
  },
  footer: {
    textAlign: 'center',
    color: '#4B5563',
    fontSize: '0.78rem',
    marginTop: '1rem',
  },
};

export default function Vote() {
  const [hasVoted, setHasVoted] = useState(false);
  const refs = {
    embiid:  useRef(null),
    sga:     useRef(null),
    luka:    useRef(null),
    giannis: useRef(null),
  };

  const handleJokicVote = () => setHasVoted(true);

  const dodge = (key) => {
    const el = refs[key]?.current;
    if (!el) return;
    const x = Math.floor(Math.random() * 200) - 100;
    const y = Math.floor(Math.random() * 200) - 100;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };

  return (
    <div style={styles.wrapper}>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.trophy}>🏆</div>
        <h1 style={styles.title}>Who Is the Only True MVP?</h1>
        <p style={styles.subtitle}>
          Cast your vote below.<br />
          The winner decides which moments the project collects.
        </p>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h5 style={styles.cardTitle}>
            {hasVoted ? '📊 Results' : '🗳️ Cast Your Vote'}
          </h5>
        </div>
        <div style={styles.cardBody}>
          {!hasVoted ? (
            <div style={styles.btnGrid}>
              {candidates.map((c) => {
                const isJ = !!c.isJokic;
                return (
                  <button
                    key={c.key}
                    ref={isJ ? undefined : refs[c.key]}
                    style={styles.btn(isJ)}
                    onClick={isJ ? handleJokicVote : undefined}
                    onMouseEnter={isJ ? undefined : () => dodge(c.key)}
                    onMouseOver={isJ ? (e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(253,185,39,0.45)';
                    } : undefined}
                    onMouseOut={isJ ? (e) => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(253,185,39,0.3)';
                    } : undefined}
                  >
                    <span style={styles.btnEmoji}>{c.emoji}</span>
                    <span style={styles.btnInfo}>
                      <span style={styles.btnName}>{c.name}</span>
                      <span style={styles.btnTeam(isJ)}>{c.team}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={styles.confetti}>🎉🏀🃏🏀🎉</div>
              <div style={styles.resultHeading}>The People Have Spoken</div>
              {candidates.map((c) => {
                const pct = c.isJokic ? 100 : 0;
                const isJ = !!c.isJokic;
                return (
                  <div key={c.key} style={styles.resultRow(pct, isJ)}>
                    <div style={styles.resultBar(pct, isJ)} />
                    <span style={styles.resultEmoji}>{c.emoji}</span>
                    <span style={styles.resultName(isJ)}>{c.name}</span>
                    <span style={styles.resultPct(isJ)}>{pct}%</span>
                  </div>
                );
              })}
              <p style={styles.footer}>
                Voting is closed. Thanks for participating!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
