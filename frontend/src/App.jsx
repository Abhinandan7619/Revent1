import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── API Setup ───────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || '';
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });
const genSessionId = () => `sess_${Math.random().toString(36).substr(2, 9)}`;

// ─── Onboarding Images ────────────────────────────────────────────────────────
const OB_IMG_1 = 'https://static.prod-images.emergentagent.com/jobs/3a7aabd7-ac65-4387-a04d-71e9d7a67e94/images/495f31f40104506181840f8d09db6147e0cd97308962062671da0949bf0e2afd.png';
const OB_IMG_2 = 'https://static.prod-images.emergentagent.com/jobs/3a7aabd7-ac65-4387-a04d-71e9d7a67e94/images/b9bc9e2f41f42ec080879116d5a5a30ad43999aa74338a1cd54b1a95dd08377d.png';
const OB_IMG_3 = 'https://static.prod-images.emergentagent.com/jobs/3a7aabd7-ac65-4387-a04d-71e9d7a67e94/images/73f5948d0044bd8540cbb21b85a7e01c164258c5aef4d7145036030fa54bd8ee.png';

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_ROLES = [
  { id: 'Close Cousin', icon: '🤝', desc: 'Warm, relatable, emotionally supportive', color: '#a78bfa' },
  { id: 'Office Bro', icon: '💼', desc: 'Practical, slightly sarcastic', color: '#60a5fa' },
  { id: 'Childhood Buddy', icon: '🎮', desc: 'Nostalgic, loyal, casual', color: '#34d399' },
  { id: 'Chill Ex', icon: '😎', desc: 'Detached, objective, caring', color: '#fbbf24' },
  { id: 'Blunt Senior', icon: '👴', desc: 'Direct, no sugar-coating', color: '#f87171' },
  { id: 'Protective Sister', icon: '🛡️', desc: 'Defensive, fierce energy', color: '#f472b6' },
];

const TRAITS = [
  { id: 'Funny', emoji: '😂' }, { id: 'Savage', emoji: '🔪' },
  { id: 'Wise', emoji: '🧙' }, { id: 'Soft', emoji: '🌸' },
  { id: 'Dramatic', emoji: '🎭' }, { id: 'Sarcastic', emoji: '😏' },
  { id: 'Brutally Honest', emoji: '💯' }, { id: 'Motivator', emoji: '🚀' },
  { id: 'Filmy', emoji: '🎬' }, { id: 'Calm', emoji: '🧘' },
  { id: 'Talks A Lot', emoji: '🗣️' }, { id: 'Minimal Talker', emoji: '🤐' },
  { id: 'Protective', emoji: '🛡️' },
];

const ROLE_COLORS = {
  'Close Cousin': '#a78bfa', 'Office Bro': '#60a5fa', 'Childhood Buddy': '#34d399',
  'Chill Ex': '#fbbf24', 'Blunt Senior': '#f87171', 'Protective Sister': '#f472b6',
};

// Preset vibes for the character tab strip
const PRESET_VIBES = [
  { id: 'default', label: 'RE', emoji: null, color: '#a78bfa', config: {} },
  { id: 'vibe1', label: 'Vibe 1', emoji: '😿', color: '#a78bfa', config: { base_role: 'Close Cousin', traits: ['Soft'], energy: 35, quirks: [], memory_hook: '' } },
  { id: 'shadow', label: 'Shadow', emoji: '😈', color: '#f472b6', config: { base_role: 'Blunt Senior', traits: ['Sarcastic', 'Savage'], energy: 80, quirks: [], memory_hook: '' } },
  { id: 'logic', label: 'Logic', emoji: '🧐', color: '#60a5fa', config: { base_role: 'Office Bro', traits: ['Wise', 'Brutally Honest'], energy: 55, quirks: [], memory_hook: '' } },
];

// Emotion bar
const EMOTION_ITEMS = [
  { emoji: '😔', label: 'Sad', mode: 'HEAR_ME' },
  { emoji: '💀', label: 'Dead', mode: 'HEAR_ME' },
  { emoji: '🔥', label: 'Fired up', mode: 'BACK_ME' },
  { emoji: '😭', label: 'Crying', mode: 'HEAR_ME' },
  { emoji: '😤', label: 'Angry', mode: 'BACK_ME' },
  { emoji: '😮', label: 'Shocked', mode: 'AUTO' },
  { emoji: '🤔', label: 'Confused', mode: 'BE_REAL' },
];

const modeMeta = {
  BACK_ME: { label: 'BACK ME', emoji: '🔥' },
  HEAR_ME: { label: 'HEAR ME', emoji: '💙' },
  BE_REAL: { label: 'BE REAL', emoji: '🧠' },
  VAULT: { label: 'VAULT', emoji: '🔒' },
  GOSSIP: { label: 'GOSSIP', emoji: '🤫' },
  CRISIS: { label: 'CRISIS', emoji: '🛡️' },
  AUTO: { label: 'AUTO', emoji: '⚡' },
};

const WELCOME_MESSAGE = {
  role: 'ai',
  content: 'Hey. You showed up — that already took something. 💜\n\nThis is your space. Say whatever. I\'m not going anywhere.',
  mode: 'AUTO',
};

// ─── Window Width Hook ────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ─── Logo Icon ────────────────────────────────────────────────────────────────
const LogoIcon = ({ size = 'sm' }) => {
  const cfg = {
    lg: { dim: 80, lw: [34, 22, 28], lh: 3, gap: 5, pad: 16, cs: 20, cb: -6, cl: 10 },
    md: { dim: 46, lw: [20, 13, 16], lh: 2, gap: 4, pad: 10, cs: 12, cb: -4, cl: 6 },
    sm: { dim: 38, lw: [16, 10, 13], lh: 2, gap: 3, pad: 8, cs: 10, cb: -3, cl: 5 },
  }[size] || { dim: 38, lw: [16, 10, 13], lh: 2, gap: 3, pad: 8, cs: 10, cb: -3, cl: 5 };
  return (
    <div style={{
      width: cfg.dim, height: cfg.dim,
      background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.20)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.3)',
      flexShrink: 0, position: 'relative',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cfg.gap, padding: `0 ${cfg.pad}px`, width: '100%' }}>
        {cfg.lw.map((w, i) => (
          <div key={i} style={{
            height: cfg.lh, borderRadius: 4, width: w,
            background: i === 0 ? 'linear-gradient(90deg,#a78bfa,#34d399)'
              : i === 1 ? 'linear-gradient(90deg,#34d399,#60a5fa)'
                : 'linear-gradient(90deg,#f472b6,#a78bfa)',
          }} />
        ))}
      </div>
      <div style={{
        position: 'absolute', width: cfg.cs, height: cfg.cs,
        background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)',
        borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.18)',
        borderTop: 'none', borderRight: 'none',
        bottom: cfg.cb, left: cfg.cl,
      }} />
    </div>
  );
};

// ─── Typing Dots ──────────────────────────────────────────────────────────────
const TypingDots = ({ color = '#a78bfa' }) => (
  <div style={{ display: 'flex', gap: 4, padding: '12px 16px' }}>
    {[0, 1, 2].map(i => (
      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }} />
    ))}
  </div>
);

// ─── Coin Badge ───────────────────────────────────────────────────────────────
const CoinBadge = ({ coins = 0, onClick }) => {
  const low = coins < 50;
  return (
    <motion.div data-testid="coin-badge" onClick={onClick}
      animate={low ? { scale: [1, 1.06, 1] } : {}}
      transition={low ? { duration: 2, repeat: Infinity } : {}}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, cursor: onClick ? 'pointer' : 'default',
        padding: '5px 10px',
        background: low ? 'rgba(248,113,113,0.08)' : 'rgba(167,139,250,0.08)',
        border: `1px solid ${low ? 'rgba(248,113,113,0.2)' : 'rgba(167,139,250,0.2)'}`,
        borderRadius: 99,
      }}>
      <span style={{ fontSize: 11, color: low ? '#f87171' : '#a78bfa' }}>✦</span>
      <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, color: low ? '#f87171' : '#a78bfa' }}>
        {(coins || 0).toLocaleString()}
      </span>
    </motion.div>
  );
};

// ─── 3D Avatar ────────────────────────────────────────────────────────────────
function AvatarMesh({ color = '#a78bfa', energy = 50 }) {
  const meshRef = useRef();
  const ring1 = useRef();
  const ring2 = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = 0.5 + (energy / 100) * 1.5;
    if (meshRef.current) { meshRef.current.rotation.y = t * 0.5 * s; meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.15; }
    if (ring1.current) ring1.current.rotation.x = t * 0.7 * s;
    if (ring2.current) ring2.current.rotation.y = t * 0.9 * s;
  });
  const c = new THREE.Color(color);
  return (
    <group>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} roughness={0.2} metalness={0.7} />
      </mesh>
      <mesh ref={ring1}>
        <torusGeometry args={[1.25, 0.022, 8, 64]} />
        <meshBasicMaterial color={c} transparent opacity={0.45} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[1.45, 0.013, 8, 64]} />
        <meshBasicMaterial color={c} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}
function Avatar3D({ color = '#a78bfa', energy = 50, height = 160 }) {
  return (
    <div style={{ height }}>
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[3, 3, 3]} intensity={2} color={color} />
        <pointLight position={[-3, -2, -3]} intensity={0.8} color="#34d399" />
        <AvatarMesh color={color} energy={energy} />
      </Canvas>
    </div>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const btnPrimaryStyle = {
  width: '100%', padding: '15px 24px',
  background: 'linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)',
  color: '#fff', border: 'none', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15,
  cursor: 'pointer', boxShadow: '0 4px 24px rgba(167,139,250,0.3)',
  transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const btnSecondaryStyle = {
  padding: '13px 28px', background: 'rgba(255,255,255,0.06)', color: '#a78bfa',
  border: '1px solid rgba(167,139,250,0.25)', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15, cursor: 'pointer',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
  transition: 'all 0.2s',
};
const btnDangerStyle = {
  width: '100%', padding: '13px 28px',
  background: 'rgba(248,113,113,0.08)', color: '#f87171',
  border: '1px solid rgba(248,113,113,0.2)', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15,
  cursor: 'pointer', transition: 'all 0.2s',
};
const inputStyle = {
  width: '100%', padding: '14px 18px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14, color: '#f8fafc',
  fontFamily: "'DM Sans',sans-serif", fontSize: 15, outline: 'none',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};
const textareaStyle = {
  width: '100%', padding: '13px 16px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14, color: '#f8fafc', fontFamily: "'DM Sans',sans-serif",
  fontSize: 14, outline: 'none', resize: 'none', minHeight: 44, maxHeight: 120,
  lineHeight: 1.5, backdropFilter: 'blur(16px)', boxSizing: 'border-box',
};
const sendBtnStyle = {
  width: 44, height: 44, border: 'none', borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 20, color: '#fff',
  boxShadow: '0 4px 16px rgba(167,139,250,0.3)', flexShrink: 0,
};
const iconBtnStyle = {
  width: 38, height: 38, background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 16, color: '#f8fafc',
  backdropFilter: 'blur(12px)', flexShrink: 0, transition: 'all 0.2s',
};
const topbarStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(15,8,30,0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  flexShrink: 0,
};
const glassCard = {
  background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16, padding: '24px 20px',
};
const labelStyle = {
  fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
  color: '#a78bfa', fontFamily: "'DM Sans',sans-serif", fontWeight: 500, marginBottom: 8,
};
const sectionLabelStyle = {
  fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
  color: 'rgba(167,139,250,0.6)', fontFamily: "'DM Sans',sans-serif",
  fontWeight: 500, marginBottom: 10, marginTop: 16,
};
const stepTitle = { fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: -0.3 };
const GT = (text) => (
  <span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
    {text}
  </span>
);

// ─── App Background ───────────────────────────────────────────────────────────
const AppBg = ({ children }) => (
  <div style={{
    width: '100vw', height: '100vh', position: 'fixed', inset: 0, overflow: 'hidden',
    background: 'linear-gradient(145deg,#1a0533,#0a1a40 55%,#003328)',
    display: 'flex', flexDirection: 'column',
    fontFamily: "'DM Sans',sans-serif", color: '#f8fafc',
  }}>
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.14),transparent)', top: '-20%', left: '-15%' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,0.11),transparent)', bottom: '-15%', right: '-10%' }} />
      <div style={{ position: 'absolute', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(96,165,250,0.08),transparent)', top: '35%', right: '5%' }} />
    </div>
    <div style={{ flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  </div>
);

// ─── Loading Screen ────────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}>
      <LogoIcon size="md" />
    </motion.div>
    <p style={{ fontSize: 11, letterSpacing: 2.5, color: 'rgba(248,250,252,0.25)', textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif" }}>
      Loading
    </p>
  </div>
);

// ─── Auth Screen ──────────────────────────────────────────────────────────────
const AuthScreen = ({ onAuth }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = () => {
    const redirectUrl = window.location.origin;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    if (mode === 'signup' && !name) { setError('Please enter your alias'); return; }
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login' ? { email, password } : { email, password, name };
      const res = await api.post(endpoint, payload);
      onAuth(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <LogoIcon size="lg" />
          </div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: -1.5, color: '#fff' }}>
            Re{GT('Vent')}
          </div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(248,250,252,0.25)', textTransform: 'uppercase', marginTop: 6 }}>
            Re · In · Venting · Space
          </div>
        </div>

        <div style={{ ...glassCard, padding: '28px 24px' }}>
          <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 99, marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
            {[['login', 'Sign In'], ['signup', 'Sign Up']].map(([m, label]) => (
              <button data-testid={`auth-tab-${m}`} key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '9px 0', borderRadius: 99, border: 'none',
                background: mode === m ? 'rgba(167,139,250,0.15)' : 'none',
                color: mode === m ? '#a78bfa' : 'rgba(248,250,252,0.4)',
                fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer',
                transition: 'all 0.2s',
                ...(mode === m && { boxShadow: '0 0 0 1px rgba(167,139,250,0.3)' }),
              }}>{label}</button>
            ))}
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Your Alias</div>
              <input data-testid="auth-name-input" style={inputStyle} type="text" placeholder="What should we call you?" maxLength={24} value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Email</div>
            <input data-testid="auth-email-input" style={inputStyle} type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom: error ? 10 : 20 }}>
            <div style={labelStyle}>Password</div>
            <input data-testid="auth-password-input" style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 12, textAlign: 'center' }}>{error}</p>}

          <button data-testid="auth-submit-btn" onClick={handleSubmit} disabled={loading} style={{ ...btnPrimaryStyle, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Please wait…' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', letterSpacing: 1 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>

          <button data-testid="auth-google-btn" onClick={handleGoogle} style={btnSecondaryStyle}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#4285f4' }}>G</span>
            Continue with Google
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.2)', textAlign: 'center', marginTop: 16 }}>
          Your thoughts stay private. No real info required.
        </p>
      </motion.div>
    </div>
  );
};

// ─── Beta Welcome Modal ────────────────────────────────────────────────────────
const BetaWelcomeModal = ({ onDismiss }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let n = 0;
    const total = 2000;
    const steps = 80;
    const inc = total / steps;
    const timer = setInterval(() => {
      n += inc;
      if (n >= total) { setCount(total); clearInterval(timer); }
      else setCount(Math.floor(n));
    }, 25);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div data-testid="beta-welcome-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(10,5,22,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        style={{ width: '100%', maxWidth: 420, ...glassCard, padding: '44px 32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <LogoIcon size="lg" />
        </div>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 28, color: '#fff', letterSpacing: -0.5, marginBottom: 12 }}>
          Congratulations!
        </div>
        <div style={{ fontSize: 15, color: 'rgba(248,250,252,0.6)', lineHeight: 1.6, marginBottom: 32 }}>
          You are selected for beta testing and received
        </div>
        <div style={{ marginBottom: 8 }}>
          <motion.div
            style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: 72, lineHeight: 1, background: 'linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {count.toLocaleString()}
          </motion.div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 20, color: '#a78bfa', marginTop: 4 }}>coins to Vent</div>
        </div>
        <div style={{ margin: '24px 0 32px', height: 1, background: 'linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent)' }} />
        <div style={{ fontSize: 13, color: 'rgba(248,250,252,0.35)', marginBottom: 28 }}>
          Your private space is ready. Say whatever. RE is listening.
        </div>
        <button data-testid="beta-modal-dismiss-btn" onClick={onDismiss} style={btnPrimaryStyle}>
          Start Venting →
        </button>
      </motion.div>
    </motion.div>
  );
};

// ─── Coin Toast ───────────────────────────────────────────────────────────────
const CoinToast = ({ toast }) => (
  <motion.div data-testid="coin-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
    style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)',
      borderRadius: 99, padding: '8px 20px', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, zIndex: 150,
      color: '#f8fafc', whiteSpace: 'nowrap',
    }}>
    <span style={{ color: '#a78bfa' }}>✦</span>
    <span>-{toast.deducted} coins · {toast.remaining?.toLocaleString()} remaining</span>
  </motion.div>
);

// ─── Splash Screen ────────────────────────────────────────────────────────────
const SplashScreen = ({ onDone }) => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center' }}>
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 20 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <LogoIcon size="lg" />
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 48, color: '#fff', letterSpacing: -2, marginTop: 24, lineHeight: 1 }}>
          Re{GT('Vent')}
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: 3, color: 'rgba(248,250,252,0.25)', textTransform: 'uppercase', marginTop: 10 }}>
          Re · In · Venting · Space
        </div>
      </motion.div>

      <div style={{ height: 48 }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <p style={{ fontFamily: "'Outfit',sans-serif", fontSize: 22, fontWeight: 600, color: 'rgba(248,250,252,0.75)', lineHeight: 1.5 }}>
          Complain. Cry. Overreact.<br /><span style={{ color: '#a78bfa' }}>We take it all.</span>
        </p>
        <p style={{ fontSize: 13, color: 'rgba(248,250,252,0.3)', lineHeight: 1.6 }}>
          A private emotional space powered by AI.
        </p>
      </motion.div>

      <div style={{ height: 56 }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ width: '100%', maxWidth: 360 }}>
        <button data-testid="splash-begin-btn" onClick={onDone} style={btnPrimaryStyle}>Let's Begin →</button>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{ marginTop: 20, fontSize: 11, color: 'rgba(248,250,252,0.15)', letterSpacing: 1 }}>
        Your thoughts stay private. Always.
      </motion.p>
    </div>
  );
};

// ─── Onboarding Screen ────────────────────────────────────────────────────────
const OnboardingScreen = ({ onDone }) => {
  const [slide, setSlide] = useState(1);
  const slides = [
    {
      img: OB_IMG_1,
      title: '"Not everything needs to be healed."',
      body: <>Sometimes you don't need advice. You need someone to say,<br />{GT('"Yeah… that was stupid."')}</>,
      body2: <>We can be nice. We can be real. We can be {GT('unfiltered.')}</>,
    },
    {
      img: OB_IMG_2,
      title: <>We {GT('know')} when to.</>,
      modes: [
        { emoji: '💙', title: 'HEAR YOU', sub: "I'll just listen." },
        { emoji: '🔥', title: 'BACK YOU', sub: "I'll match your energy." },
        { emoji: '🧠', title: 'BE REAL', sub: "I'll say what needs to be said." },
      ],
    },
    {
      img: OB_IMG_3,
      title: 'Be mad.\nWe can handle it.',
      body: <span style={{ color: '#f87171' }}>Shred it. Trash it. Say it out loud.</span>,
      body2: 'Specially designed release rooms inside.',
    },
  ];
  const s = slides[slide - 1];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <button data-testid="onboarding-skip-btn" onClick={onDone}
        style={{ position: 'absolute', top: 16, right: 20, zIndex: 10, background: 'none', border: 'none', color: 'rgba(248,250,252,0.25)', fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', padding: '8px 12px' }}>
        Skip
      </button>

      <AnimatePresence mode="wait">
        <motion.div key={slide} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Hero Image */}
          <div style={{ position: 'relative', height: '42%', minHeight: 200, flexShrink: 0, overflow: 'hidden' }}>
            <img src={s.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: 'linear-gradient(to bottom, transparent, #0a1228)' }} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: '20px 28px 0', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 26, color: '#fff', letterSpacing: -0.5, lineHeight: 1.2, whiteSpace: 'pre-line' }}>{s.title}</div>
            {s.modes ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {s.modes.map(m => (
                    <div key={m.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, backdropFilter: 'blur(16px)' }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{m.emoji}</span>
                      <div>
                        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13 }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(248,250,252,0.5)', marginTop: 1 }}>{m.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', textAlign: 'center' }}>No sugarcoating unless you ask for it.</p>
              </>
            ) : (
              <>
                {s.body && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(248,250,252,0.55)' }}>{s.body}</p>}
                {s.body2 && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(248,250,252,0.4)' }}>{s.body2}</p>}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ padding: '16px 28px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: slide === i ? 20 : 6, height: 6, borderRadius: 99, background: slide === i ? '#a78bfa' : 'rgba(255,255,255,0.15)', transition: 'all 0.3s', boxShadow: slide === i ? '0 0 8px rgba(167,139,250,0.5)' : 'none' }} />
          ))}
        </div>
        <button data-testid="onboarding-next-btn" onClick={() => slide < 3 ? setSlide(slide + 1) : onDone()} style={{ ...btnPrimaryStyle, width: 'auto', padding: '12px 28px' }}>
          {slide < 3 ? 'Next →' : "Let's go →"}
        </button>
      </div>
    </div>
  );
};

// ─── Name Screen ──────────────────────────────────────────────────────────────
const NameScreen = ({ onDone }) => {
  const [val, setVal] = useState('');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <LogoIcon size="sm" />
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: -0.5 }}>Re{GT('Vent')}</div>
      </div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 1.2 }}>What should<br />I call you?</div>
      <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: 14, lineHeight: 1.75, textAlign: 'center', marginTop: 10 }}>No government names required.</p>
      <div style={{ height: 36 }} />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={labelStyle}>Your Alias</div>
          <input data-testid="name-input" style={inputStyle} type="text" placeholder="Your name… or alter ego" maxLength={24}
            value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && val.trim() && onDone(val.trim())} />
        </div>
        <button data-testid="name-continue-btn" style={btnPrimaryStyle} onClick={() => val.trim() && onDone(val.trim())}>Continue</button>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', textAlign: 'center', marginTop: 16 }}>This is your private space. No real info needed.</p>
    </div>
  );
};

// ─── Language Screen ──────────────────────────────────────────────────────────
const LanguageScreen = ({ onDone }) => {
  const [sel, setSel] = useState('Hindi');
  const langs = [
    { id: 'English', label: 'English' },
    { id: 'Hindi', label: 'Hinglish' },
    { id: 'Marathi', label: 'मराठी + English' },
    { id: 'Tamil', label: 'தமிழ் + English' },
    { id: 'Kannada', label: 'ಕನ್ನಡ + English' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
        <LogoIcon size="sm" />
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: -0.5 }}>Re{GT('Vent')}</div>
      </div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, color: '#fff', textAlign: 'center', letterSpacing: -0.5 }}>How do you think?</div>
      <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: 14, textAlign: 'center', marginTop: 10 }}>Pick what feels natural.</p>
      <div style={{ height: 24 }} />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {langs.map(l => (
          <div key={l.id} data-testid={`lang-option-${l.id}`} onClick={() => setSel(l.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', background: sel === l.id ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${sel === l.id ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, cursor: 'pointer', backdropFilter: 'blur(16px)', transition: 'all 0.2s' }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15 }}>{l.label}</span>
            <span style={{ fontSize: 16, opacity: sel === l.id ? 1 : 0, color: '#a78bfa', transition: 'opacity 0.2s' }}>✓</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', textAlign: 'center', marginTop: 14 }}>You can switch anytime.</p>
      <div style={{ height: 28 }} />
      <button data-testid="lang-continue-btn" style={btnPrimaryStyle} onClick={() => onDone(sel)}>Let's Go</button>
    </div>
  );
};

// ─── Character Creator ────────────────────────────────────────────────────────
const CharacterCreator = ({ onBack, myCharacter, setMyCharacter, language, onStart }) => {
  const [step, setStep] = useState(1);
  const [tempChar, setTempChar] = useState(myCharacter);
  const [quirkInput, setQuirkInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const avatarColor = ROLE_COLORS[tempChar.base_role] || '#a78bfa';

  const toggleTrait = (id) => {
    if (tempChar.traits.includes(id)) setTempChar({ ...tempChar, traits: tempChar.traits.filter(t => t !== id) });
    else if (tempChar.traits.length < 4) setTempChar({ ...tempChar, traits: [...tempChar.traits, id] });
  };

  const addQuirk = () => {
    if (quirkInput && tempChar.quirks.length < 2) {
      setTempChar({ ...tempChar, quirks: [...tempChar.quirks, quirkInput] });
      setQuirkInput('');
    }
  };

  const refineBackstory = async () => {
    if (!tempChar.memory_hook) return;
    setIsRefining(true);
    try {
      const res = await api.post('/api/refine-backstory', { draft_text: tempChar.memory_hook, language });
      setTempChar({ ...tempChar, memory_hook: res.data.refined_text });
    } catch (e) { console.error(e); }
    finally { setIsRefining(false); }
  };

  const saveAndExit = () => { setMyCharacter(tempChar); onStart(); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={topbarStyle}>
        <button onClick={onBack} style={iconBtnStyle}>←</button>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16 }}>Design Persona</div>
          <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.25)' }}>Craft your AI companion</div>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ position: 'relative', background: 'linear-gradient(to bottom,rgba(10,5,25,0.9),rgba(10,5,25,0.4))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 128, height: 128, borderRadius: '50%', background: avatarColor, filter: 'blur(48px)', opacity: 0.15 }} />
        </div>
        <Avatar3D color={avatarColor} energy={tempChar.energy} height={160} />
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span>{BASE_ROLES.find(r => r.id === tempChar.base_role)?.icon}</span>
          <span style={{ color: avatarColor }}>{tempChar.base_role}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '14px 16px 8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 99, background: step >= i ? avatarColor : 'rgba(255,255,255,0.08)', transition: 'all 0.4s' }} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} style={{ paddingTop: 8 }}>
            {step === 1 && (
              <>
                <div style={stepTitle}>Choose a Vibe</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  {BASE_ROLES.map(role => (
                    <button key={role.id} data-testid={`role-${role.id}`} onClick={() => setTempChar({ ...tempChar, base_role: role.id })}
                      style={{ padding: '14px 12px', borderRadius: 14, border: `1px solid ${tempChar.base_role === role.id ? role.color + '60' : 'rgba(255,255,255,0.07)'}`, background: tempChar.base_role === role.id ? role.color + '18' : 'rgba(255,255,255,0.03)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{role.icon}</div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12 }}>{role.id}</div>
                      <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.35)', marginTop: 2 }}>{role.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div style={stepTitle}>Add Flavor</div>
                <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.3)', marginTop: 4, marginBottom: 12 }}>Pick up to 4 traits</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TRAITS.map(t => (
                    <button key={t.id} onClick={() => toggleTrait(t.id)}
                      style={{ padding: '8px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', border: `1px solid ${tempChar.traits.includes(t.id) ? avatarColor + '70' : 'rgba(255,255,255,0.08)'}`, background: tempChar.traits.includes(t.id) ? avatarColor + '20' : 'rgba(255,255,255,0.04)', color: tempChar.traits.includes(t.id) ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'all 0.15s' }}>
                      <span>{t.emoji}</span> {t.id}
                    </button>
                  ))}
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div style={stepTitle}>Energy Level</div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', marginTop: 12 }}>
                  <div style={{ fontSize: 52, marginBottom: 20 }}>{tempChar.energy > 70 ? '🔥' : tempChar.energy < 40 ? '🧘' : '🙂'}</div>
                  <input type="range" min="0" max="100" value={tempChar.energy}
                    onChange={e => setTempChar({ ...tempChar, energy: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: avatarColor }} />
                  <div style={{ marginTop: 12, fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, color: avatarColor }}>{tempChar.energy}% Intensity</div>
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <div style={stepTitle}>Quirks</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 10 }}>
                  <input style={{ ...inputStyle, flex: 1, padding: '12px 14px' }} type="text" value={quirkInput}
                    onChange={e => setQuirkInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuirk()}
                    placeholder="e.g. Always starts with 'Listen…'" />
                  <button onClick={addQuirk} style={{ padding: '12px 16px', background: avatarColor, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tempChar.quirks.map(q => (
                    <div key={q} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: 13, color: 'rgba(248,250,252,0.6)' }}>
                      <span>{q}</span>
                      <button onClick={() => setTempChar({ ...tempChar, quirks: tempChar.quirks.filter(x => x !== q) })} style={{ background: 'none', border: 'none', color: 'rgba(248,250,252,0.3)', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 5 && (
              <>
                <div style={stepTitle}>Backstory</div>
                <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.3)', marginTop: 4, marginBottom: 12 }}>Write a rough idea, then hit the wand ✨</p>
                <div style={{ position: 'relative' }}>
                  <textarea style={{ ...inputStyle, minHeight: 120, resize: 'none', lineHeight: 1.6 }}
                    value={tempChar.memory_hook} onChange={e => setTempChar({ ...tempChar, memory_hook: e.target.value })}
                    placeholder="e.g. We survived high school together…" />
                  <button onClick={refineBackstory} disabled={isRefining || !tempChar.memory_hook}
                    style={{ position: 'absolute', bottom: 12, right: 12, width: 36, height: 36, borderRadius: 8, background: avatarColor, border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', opacity: (!isRefining && tempChar.memory_hook) ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isRefining ? '⟳' : '✨'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        {step < 5 ? (
          <button onClick={() => setStep(step + 1)} style={{ ...btnPrimaryStyle, background: `linear-gradient(90deg,${avatarColor},#34d399)` }}>Next Step →</button>
        ) : (
          <button data-testid="launch-character-btn" onClick={saveAndExit} style={{ ...btnPrimaryStyle, background: `linear-gradient(90deg,${avatarColor},#34d399)` }}>Launch Character ✨</button>
        )}
      </div>
    </div>
  );
};

// ─── Chat Bubbles ─────────────────────────────────────────────────────────────
const ChatBubble = ({ msg }) => {
  const meta = msg.mode ? modeMeta[msg.mode] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
      {msg.role === 'ai' && meta && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.35)', marginBottom: 4, paddingLeft: 2 }}>
          RE · {meta.emoji} {meta.label}
        </div>
      )}
      {msg.role === 'user' && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.25)', marginBottom: 4, textAlign: 'right', paddingRight: 2 }}>You</div>
      )}
      <div style={{
        padding: '12px 16px', fontSize: 14, lineHeight: 1.7, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        whiteSpace: 'pre-wrap',
        ...(msg.role === 'user'
          ? { background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '14px 2px 14px 14px' }
          : msg.role === 'system'
            ? { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12 }
            : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '2px 14px 14px 14px' }),
      }}>
        {msg.content}
      </div>
    </motion.div>
  );
};

const GossipBubble = ({ msg }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 28 }}
    style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
    {msg.role === 'ai' && <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(251,191,36,0.5)', marginBottom: 4 }}>RE · GOSSIP</div>}
    {msg.role === 'user' && <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.25)', marginBottom: 4, textAlign: 'right' }}>You</div>}
    <div style={{
      padding: '12px 16px', fontSize: 14, lineHeight: 1.7, backdropFilter: 'blur(16px)',
      ...(msg.role === 'user'
        ? { background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '14px 2px 14px 14px' }
        : { background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: '2px 14px 14px 14px' }),
    }}>
      {msg.content}
    </div>
  </motion.div>
);

// ─── Emotion Bar ──────────────────────────────────────────────────────────────
const EmotionBar = ({ onEmotion, manualMode }) => {
  const [active, setActive] = useState(null);
  const handle = (item) => {
    setActive(item.emoji);
    onEmotion(item.mode);
    setTimeout(() => setActive(null), 800);
  };
  return (
    <div data-testid="emotion-bar" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(10,5,22,0.6)', overflowX: 'auto', flexShrink: 0 }}>
      {EMOTION_ITEMS.map(item => (
        <motion.button key={item.emoji} onClick={() => handle(item)}
          whileTap={{ scale: 0.8 }}
          title={item.label}
          style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${active === item.emoji ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`, background: active === item.emoji ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18, flexShrink: 0, transition: 'all 0.15s' }}>
          {item.emoji}
        </motion.button>
      ))}
      <div style={{ marginLeft: 'auto', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', paddingLeft: 8 }}>
        {manualMode === 'AUTO' ? 'auto mode' : modeMeta[manualMode]?.label}
      </div>
    </div>
  );
};

// ─── Character Tab Strip ──────────────────────────────────────────────────────
const CharacterTabStrip = ({ activeVibe, setActiveVibe, onOpenCreator, myCharacter }) => {
  const vibes = [
    ...PRESET_VIBES,
    ...(myCharacter?.memory_hook || myCharacter?.traits?.length ? [{ id: 'custom', label: 'Mine', emoji: BASE_ROLES.find(r => r.id === myCharacter?.base_role)?.icon || '✨', color: ROLE_COLORS[myCharacter?.base_role] || '#a78bfa', config: myCharacter }] : []),
  ];
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 4px', scrollbarWidth: 'none', msOverflowStyle: 'none', flexShrink: 0 }}>
      {vibes.map(v => (
        <motion.button key={v.id} data-testid={`vibe-tab-${v.id}`} onClick={() => setActiveVibe(v.id)}
          whileTap={{ scale: 0.9 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 8px', borderRadius: 12, border: `1.5px solid ${activeVibe === v.id ? v.color + '60' : 'rgba(255,255,255,0.07)'}`, background: activeVibe === v.id ? v.color + '18' : 'rgba(255,255,255,0.04)', cursor: 'pointer', minWidth: 54, transition: 'all 0.2s', flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: activeVibe === v.id ? v.color + '25' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: v.emoji ? 15 : 10, border: `1px solid ${activeVibe === v.id ? v.color + '50' : 'rgba(255,255,255,0.08)'}` }}>
            {v.emoji || <LogoIcon size="sm" />}
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, color: activeVibe === v.id ? v.color : 'rgba(248,250,252,0.4)', letterSpacing: 0.5, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif" }}>{v.label}</span>
        </motion.button>
      ))}
      {/* Create button */}
      <motion.button data-testid="create-character-btn" onClick={onOpenCreator}
        whileTap={{ scale: 0.9 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 8px', borderRadius: 12, border: '1.5px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', minWidth: 54, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>+</div>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(248,250,252,0.25)', letterSpacing: 0.5, whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif" }}>Create</span>
      </motion.button>
    </div>
  );
};

// ─── Gossip Floating Button ───────────────────────────────────────────────────
const GossipFloatingBtn = ({ onClick }) => (
  <motion.button data-testid="gossip-floating-btn" onClick={onClick}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    style={{ position: 'absolute', right: 14, bottom: 68, zIndex: 10, width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.1))', border: '1.5px solid rgba(251,191,36,0.35)', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', boxShadow: '0 4px 20px rgba(251,191,36,0.2)' }}>
    <span style={{ fontSize: 22 }}>🤫</span>
    <span style={{ fontSize: 7, fontWeight: 700, color: '#fbbf24', letterSpacing: 0.5, fontFamily: "'Outfit',sans-serif", textTransform: 'uppercase' }}>Gossip</span>
  </motion.button>
);

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
const DesktopSidebar = ({ authUser, activeVibe, setActiveVibe, myCharacter, onOpenCreator, onOpenSettings, onOpenGossip, language, setLanguage }) => {
  const currentVibe = [...PRESET_VIBES, { id: 'custom', label: 'Mine', color: ROLE_COLORS[myCharacter?.base_role] || '#a78bfa' }].find(v => v.id === activeVibe) || PRESET_VIBES[0];
  const vibes = [
    ...PRESET_VIBES,
    ...(myCharacter?.memory_hook || myCharacter?.traits?.length ? [{ id: 'custom', label: 'Mine', emoji: BASE_ROLES.find(r => r.id === myCharacter?.base_role)?.icon || '✨', color: ROLE_COLORS[myCharacter?.base_role] || '#a78bfa' }] : []),
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 16px', gap: 0, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.6)', backdropFilter: 'blur(20px)' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <LogoIcon size="sm" />
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 16, background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ReVent</div>
          <div style={{ fontSize: 8, color: 'rgba(248,250,252,0.2)', letterSpacing: 2, textTransform: 'uppercase' }}>Re · In · Venting · Space</div>
        </div>
      </div>

      {/* User info */}
      {authUser && (
        <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>😤</div>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13, color: '#fff' }}>{authUser.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.35)' }}>Beta Tester</div>
            </div>
          </div>
          <CoinBadge coins={authUser.coins} onClick={onOpenSettings} />
        </div>
      )}

      {/* Companion label */}
      <div style={{ fontSize: 9, letterSpacing: 2.5, color: 'rgba(167,139,250,0.5)', textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif", marginTop: 16, marginBottom: 10 }}>Companion</div>

      {/* Vibe list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {vibes.map(v => (
          <motion.button key={v.id} data-testid={`sidebar-vibe-${v.id}`} onClick={() => setActiveVibe(v.id)}
            whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${activeVibe === v.id ? v.color + '50' : 'rgba(255,255,255,0.05)'}`, background: activeVibe === v.id ? v.color + '15' : 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: activeVibe === v.id ? v.color + '20' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
              {v.emoji || '🤖'}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: activeVibe === v.id ? '#fff' : 'rgba(248,250,252,0.5)', fontFamily: "'Outfit',sans-serif" }}>{v.label}</span>
            {activeVibe === v.id && <span style={{ marginLeft: 'auto', color: v.color, fontSize: 12 }}>●</span>}
          </motion.button>
        ))}
        <motion.button data-testid="sidebar-create-btn" onClick={onOpenCreator} whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)', background: 'transparent', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>+</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(248,250,252,0.3)', fontFamily: "'Outfit',sans-serif" }}>Create Persona</span>
        </motion.button>
      </div>

      {/* Gossip Room */}
      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
        <motion.button data-testid="sidebar-gossip-btn" onClick={onOpenGossip} whileTap={{ scale: 0.97 }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.05)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <span style={{ fontSize: 20 }}>🤫</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', fontFamily: "'Outfit',sans-serif" }}>Gossip Room</div>
            <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.5)' }}>No receipts · No logs</div>
          </div>
        </motion.button>
      </div>

      {/* Language selector */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: 2.5, color: 'rgba(167,139,250,0.5)', textTransform: 'uppercase', fontFamily: "'DM Sans',sans-serif", marginBottom: 8 }}>Language</div>
        <div style={{ position: 'relative' }}>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            style={{ width: '100%', appearance: 'none', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '9px 28px 9px 12px', borderRadius: 10, color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            <option value="Hindi">Hinglish</option>
            <option value="English">English</option>
            <option value="Marathi">Marathi</option>
            <option value="Tamil">Tanglish</option>
            <option value="Kannada">Kanglish</option>
          </select>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'rgba(248,250,252,0.3)', pointerEvents: 'none' }}>▾</span>
        </div>
      </div>

      {/* Spacer + Settings */}
      <div style={{ flex: 1 }} />
      <motion.button data-testid="sidebar-settings-btn" onClick={onOpenSettings} whileTap={{ scale: 0.97 }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', marginTop: 16, width: '100%', transition: 'all 0.2s' }}>
        <span style={{ fontSize: 16 }}>⚙️</span>
        <span style={{ fontSize: 13, color: 'rgba(248,250,252,0.5)', fontFamily: "'Outfit',sans-serif", fontWeight: 600 }}>Settings</span>
      </motion.button>
    </div>
  );
};

// ─── Chat Interface ───────────────────────────────────────────────────────────
const ChatInterface = ({ activeVibe, setActiveVibe, setView, myCharacter, onOpenCreator, intensity, baseline, manualMode, setManualMode, authUser, messages, input, setInput, sendMessage, loading, scrollRef, language, setLanguage, isDesktop }) => {
  const currentVibe = [...PRESET_VIBES, { id: 'custom', label: 'Mine', color: ROLE_COLORS[myCharacter?.base_role] || '#a78bfa', emoji: BASE_ROLES.find(r => r.id === myCharacter?.base_role)?.icon }].find(v => v.id === activeVibe) || PRESET_VIBES[0];
  const accentColor = currentVibe?.color || '#a78bfa';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div style={topbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoIcon size="sm" />
          <div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RE</div>
            <div style={{ fontSize: 9, color: 'rgba(248,250,252,0.3)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} />
              Online · Listening
            </div>
          </div>
        </div>

        {/* Character tab strip - only on mobile (desktop shows in sidebar) */}
        {!isDesktop && (
          <div style={{ flex: 1, overflow: 'hidden', padding: '0 8px' }}>
            <CharacterTabStrip activeVibe={activeVibe} setActiveVibe={setActiveVibe} onOpenCreator={onOpenCreator} myCharacter={myCharacter} />
          </div>
        )}

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {authUser && <CoinBadge coins={authUser.coins} onClick={() => setView('settings')} />}
          <button data-testid="chat-settings-btn" onClick={() => setView('settings')} style={{ ...iconBtnStyle, fontSize: 14 }}>⚙️</button>
        </div>
      </div>

      {/* Mode chips */}
      <div data-testid="mode-chips" style={{ display: 'flex', gap: 6, padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.5)', backdropFilter: 'blur(16px)', overflowX: 'auto', flexShrink: 0 }}>
        {[{ id: 'AUTO', label: '⚡ AUTO' }, { id: 'HEAR_ME', label: '💙 HEAR ME' }, { id: 'BACK_ME', label: '🔥 BACK ME' }, { id: 'BE_REAL', label: '🧠 BE REAL' }].map(m => (
          <button key={m.id} data-testid={`mode-chip-${m.id}`} onClick={() => setManualMode(m.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, border: `1px solid ${manualMode === m.id ? accentColor + '55' : 'rgba(255,255,255,0.06)'}`, background: manualMode === m.id ? accentColor + '18' : 'rgba(255,255,255,0.04)', fontSize: 12, fontWeight: 500, color: manualMode === m.id ? accentColor : 'rgba(248,250,252,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s', backdropFilter: 'blur(16px)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(10,5,22,0.3)', flexShrink: 0 }}>
        {[{ label: 'INTENSITY', val: intensity, color: '#fbbf24' }, { label: 'MOOD', val: baseline, color: '#34d399' }].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '5px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 8, letterSpacing: 2, fontWeight: 700, color: s.color, textTransform: 'uppercase' }}>
              <span>{s.label}</span><span>{s.val}/10</span>
            </div>
            <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${s.val * 10}%` }} style={{ height: '100%', background: s.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div data-testid="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px 14px 14px 14px', backdropFilter: 'blur(16px)' }}>
              <TypingDots color={accentColor} />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Emotion bar */}
      <EmotionBar onEmotion={setManualMode} manualMode={manualMode} />

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.8)', backdropFilter: 'blur(16px)', flexShrink: 0, position: 'relative' }}>
        <GossipFloatingBtn onClick={() => setView('gossip_chat')} />
        <div style={{ display: 'flex', gap: 8, paddingRight: 80 }}>
          <textarea data-testid="chat-input" style={{ ...textareaStyle, flex: 1 }}
            value={input} onChange={e => setInput(e.target.value)} placeholder="Just say it…" rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
          <button data-testid="chat-send-btn" onClick={sendMessage} style={{ ...sendBtnStyle, background: `linear-gradient(135deg,${accentColor},#34d399)` }}>↑</button>
        </div>
      </div>
    </div>
  );
};

// ─── Gossip Interface ─────────────────────────────────────────────────────────
const GossipInterface = ({ setView, authUser, messages, input, setInput, sendMessage, loading, scrollRef }) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(251,191,36,0.1)', background: 'rgba(8,5,18,0.9)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fbbf24' }}>
          <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          GOSSIP MODE
        </div>
        <span style={{ fontSize: 10, color: 'rgba(248,250,252,0.25)' }}>RAM only · No storage</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {authUser && <CoinBadge coins={authUser.coins} />}
        <button data-testid="gossip-exit-btn" onClick={() => setView('chat')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: 99, color: '#fbbf24', fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(16px)' }}>
          Exit & Dissolve
        </button>
      </div>
    </div>

    <div style={{ margin: '10px 16px 0', padding: '10px 14px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(251,191,36,0.7)', flexShrink: 0 }}>
      <span>⚠️</span>
      <span>This conversation will vanish when you exit. No logs. No memory. No receipts.</span>
    </div>

    <div data-testid="gossip-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {messages.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4, paddingTop: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🤫</div>
          <p style={{ fontSize: 13, color: 'rgba(248,250,252,0.5)', textAlign: 'center' }}>Okay, just between us.<br />Say whatever. Zero receipts.</p>
        </div>
      )}
      {messages.map((msg, i) => <GossipBubble key={i} msg={msg} />)}
      {loading && (
        <div style={{ alignSelf: 'flex-start' }}>
          <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: '2px 14px 14px 14px' }}>
            <TypingDots color="#fbbf24" />
          </div>
        </div>
      )}
      <div ref={scrollRef} />
    </div>

    <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(251,191,36,0.08)', background: 'rgba(8,5,18,0.8)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea data-testid="gossip-input" style={{ ...textareaStyle, flex: 1, borderColor: 'rgba(251,191,36,0.15)' }}
          value={input} onChange={e => setInput(e.target.value)} placeholder="Off the record…" rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
        <button data-testid="gossip-send-btn" onClick={sendMessage} style={{ ...sendBtnStyle, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>↑</button>
      </div>
    </div>
  </div>
);

// ─── Settings Screen ──────────────────────────────────────────────────────────
const SettingsScreen = ({ authUser, onBack, language, setLanguage, onLogout }) => {
  const COIN_PACKS = [
    { coins: 40, price: '₹49', label: 'Starter', badge: null },
    { coins: 100, price: '₹99', label: 'Core', badge: 'Popular' },
    { coins: 220, price: '₹199', label: 'Value', badge: 'Best Value' },
    { coins: 600, price: '₹499', label: 'Power', badge: null },
    { coins: 2000, price: '₹999', label: 'Mega', badge: null },
  ];

  return (
    <div data-testid="settings-screen" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={topbarStyle}>
        <button data-testid="settings-back-btn" onClick={onBack} style={iconBtnStyle}>←</button>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16 }}>Settings</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 32px' }}>
        <div style={sectionLabelStyle}>// User Profile</div>
        <div style={{ ...glassCard, padding: '16px 20px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>😤</div>
            <div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15 }}>{authUser?.name || 'User'}</div>
              <div style={{ fontSize: 11, color: 'rgba(248,250,252,0.4)', marginTop: 2 }}>{authUser?.email || ''}</div>
            </div>
          </div>
          <CoinBadge coins={authUser?.coins || 0} />
        </div>

        <div style={sectionLabelStyle}>// Recharge Coins</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 8 }}>
          {COIN_PACKS.map(pack => (
            <div key={pack.coins} data-testid={`coin-pack-${pack.label}`} style={{ ...glassCard, padding: '16px 12px', textAlign: 'center', position: 'relative' }}>
              {pack.badge && (
                <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,#a78bfa,#34d399)', padding: '2px 10px', borderRadius: 99, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', color: '#fff' }}>
                  {pack.badge}
                </div>
              )}
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 26, background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 2 }}>{pack.coins}</div>
              <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.35)', marginBottom: 6 }}>coins</div>
              <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{pack.price}</div>
              <button style={{ ...btnPrimaryStyle, padding: '7px 16px', fontSize: 12 }}>Get</button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', marginBottom: 8 }}>2 coins per session · Crisis mode is always free</p>

        <div style={sectionLabelStyle}>// Preferences</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...glassCard, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>🌐</span>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 14 }}>Language</span>
            </div>
            <div style={{ position: 'relative' }}>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                style={{ appearance: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', padding: '7px 28px 7px 12px', borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="Hindi">Hinglish</option>
                <option value="English">English</option>
                <option value="Marathi">Marathi</option>
                <option value="Tamil">Tamil</option>
                <option value="Kannada">Kannada</option>
              </select>
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'rgba(248,250,252,0.3)', pointerEvents: 'none' }}>▾</span>
            </div>
          </div>
          <div style={{ ...glassCard, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 500, fontSize: 14 }}>Privacy & Data</div>
                <div style={{ fontSize: 11, color: 'rgba(248,250,252,0.35)' }}>Zero-retention in Gossip Mode</div>
              </div>
            </div>
            <span style={{ color: 'rgba(248,250,252,0.25)', fontSize: 16 }}>›</span>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <button data-testid="settings-logout-btn" onClick={onLogout} style={btnDangerStyle}>Log Out</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 10, color: 'rgba(248,250,252,0.15)', letterSpacing: 1 }}>ReVent v1.0 — Gradient Glass</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [authUser, setAuthUser] = useState(undefined);
  const [view, setView] = useState('loading');
  const [showBetaModal, setShowBetaModal] = useState(false);
  const [postModalView, setPostModalView] = useState('splash');

  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [gossipMessages, setGossipMessages] = useState([]);
  const [input, setInput] = useState('');
  const [gossipInput, setGossipInput] = useState('');
  const [sessionId, setSessionId] = useState(genSessionId);
  const [gossipSessionId, setGossipSessionId] = useState(genSessionId);
  const [manualMode, setManualMode] = useState('AUTO');
  const [language, setLanguage] = useState('Hindi');
  const [intensity, setIntensity] = useState(0);
  const [baseline, setBaseline] = useState(5);
  const [userName, setUserName] = useState('User');
  const [activeVibe, setActiveVibe] = useState('default');
  const [myCharacter, setMyCharacter] = useState({ base_role: 'Close Cousin', traits: [], energy: 50, quirks: [], memory_hook: '' });
  const [loading, setLoading] = useState(false);
  const [gossipLoading, setGossipLoading] = useState(false);
  const [coinToast, setCoinToast] = useState(null);
  const scrollRef = useRef(null);
  const gossipScrollRef = useRef(null);
  const coinToastRef = useRef(null);
  const windowWidth = useWindowWidth();
  const isDesktop = windowWidth >= 768;

  useEffect(() => {
    const hash = window.location.hash;
    if (hash?.includes('session_id=')) {
      const params = new URLSearchParams(hash.slice(1));
      const sid = params.get('session_id');
      if (sid) { handleGoogleCallback(sid); return; }
    }
    checkAuth();
  }, []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { gossipScrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [gossipMessages]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'TEXTAREA') {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
      }
    };
    document.addEventListener('input', handler);
    return () => document.removeEventListener('input', handler);
  }, []);

  const checkAuth = async () => {
    try {
      const res = await api.get('/api/auth/me');
      handleUserLoaded(res.data);
    } catch {
      setAuthUser(null);
      setView('auth');
    }
  };

  const handleGoogleCallback = async (sid) => {
    try {
      const res = await api.get('/api/auth/google-session', { params: { session_id: sid } });
      window.history.replaceState({}, '', window.location.pathname);
      handleUserLoaded(res.data.user);
    } catch {
      setAuthUser(null);
      setView('auth');
    }
  };

  const handleUserLoaded = async (user) => {
    setAuthUser(user);
    setUserName(user.name || 'User');
    setLanguage(user.language || 'Hindi');
    if (user.is_first_login) {
      // Show beta modal FIRST — splash will open after modal is dismissed
      const nextView = user.onboarding_complete ? 'chat' : 'splash';
      setPostModalView(nextView);
      setShowBetaModal(true);
      try { await api.post('/api/auth/mark-first-login'); } catch {}
      setAuthUser(prev => prev ? { ...prev, is_first_login: false } : prev);
      // Do NOT setView here — BetaWelcomeModal.onDismiss will handle it
    } else {
      setView(user.onboarding_complete ? 'chat' : 'splash');
    }
  };

  const handleAuth = (user) => handleUserLoaded(user);

  const getPersonaConfig = () => {
    if (activeVibe === 'custom') return myCharacter;
    const preset = PRESET_VIBES.find(v => v.id === activeVibe);
    return preset?.config || {};
  };

  const showCoinNotif = (deducted, remaining) => {
    if (coinToastRef.current) clearTimeout(coinToastRef.current);
    setCoinToast({ deducted, remaining });
    coinToastRef.current = setTimeout(() => setCoinToast(null), 3000);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/api/chat', {
        message: userMsg.content, session_id: sessionId, language,
        manual_mode: manualMode, persona_config: getPersonaConfig(),
        force_vault: false,
      });
      setMessages(prev => [...prev, { role: 'ai', content: res.data.response, mode: res.data.mode }]);
      setIntensity(res.data.intensity_score || 0);
      setBaseline(res.data.emotional_baseline || 5);
      if (res.data.coins_remaining !== undefined) {
        setAuthUser(prev => prev ? { ...prev, coins: res.data.coins_remaining } : prev);
      }
      if (res.data.coins_deducted > 0) showCoinNotif(res.data.coins_deducted, res.data.coins_remaining);
    } catch {
      setMessages(prev => [...prev, { role: 'system', content: '⚠️ Connection failed. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendGossipMessage = async () => {
    if (!gossipInput.trim() || gossipLoading) return;
    const userMsg = { role: 'user', content: gossipInput };
    setGossipMessages(prev => [...prev, userMsg]);
    setGossipInput('');
    setGossipLoading(true);
    try {
      const res = await api.post('/api/chat', {
        message: userMsg.content, session_id: gossipSessionId, language,
        manual_mode: 'GOSSIP', persona_config: {},
        force_vault: true,
      });
      setGossipMessages(prev => [...prev, { role: 'ai', content: res.data.response, mode: 'GOSSIP' }]);
    } catch {
      setGossipMessages(prev => [...prev, { role: 'system', content: '⚠️ Connection failed. Try again.' }]);
    } finally {
      setGossipLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    setAuthUser(null);
    setView('auth');
  };

  const handleLangDone = async (lang) => {
    setLanguage(lang);
    try {
      const res = await api.post('/api/user/update-profile', { name: userName, language: lang, onboarding_complete: true });
      setAuthUser(res.data);
    } catch {}
    setView('chat'); // Go directly to chat
  };

  const openGossip = () => {
    setGossipMessages([]);
    setGossipSessionId(genSessionId());
    setView('gossip_chat');
  };

  const openCreator = () => {
    setView('creator');
  };

  const wrapFull = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' };
  const wrapCard = (maxW) => ({
    position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
    width: '100%', maxWidth: maxW, display: 'flex', flexDirection: 'column',
  });

  const chatProps = {
    activeVibe, setActiveVibe,
    setView: (v) => {
      if (v === 'gossip_chat') { openGossip(); return; }
      setView(v);
    },
    myCharacter,
    onOpenCreator: openCreator,
    intensity, baseline,
    manualMode, setManualMode,
    authUser,
    messages, input, setInput, sendMessage,
    loading, scrollRef,
    language, setLanguage,
    isDesktop,
  };

  return (
    <AppBg>
      <AnimatePresence>
        {showBetaModal && <BetaWelcomeModal onDismiss={() => { setShowBetaModal(false); setView(postModalView); }} />}
      </AnimatePresence>

      <AnimatePresence>
        {coinToast && <CoinToast toast={coinToast} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'loading' && (
          <motion.div key="loading" style={wrapFull} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoadingScreen />
          </motion.div>
        )}
        {view === 'auth' && (
          <motion.div key="auth" style={wrapFull} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthScreen onAuth={handleAuth} />
          </motion.div>
        )}
        {view === 'splash' && (
          <motion.div key="splash" style={wrapCard(520)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SplashScreen onDone={() => setView('onboarding')} />
          </motion.div>
        )}
        {view === 'onboarding' && (
          <motion.div key="ob" style={wrapFull} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OnboardingScreen onDone={() => setView('name')} />
          </motion.div>
        )}
        {view === 'name' && (
          <motion.div key="name" style={wrapCard(480)} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <NameScreen onDone={n => { setUserName(n); setView('lang'); }} />
          </motion.div>
        )}
        {view === 'lang' && (
          <motion.div key="lang" style={wrapCard(480)} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <LanguageScreen onDone={handleLangDone} />
          </motion.div>
        )}

        {/* MAIN CHAT VIEW - Full screen with optional sidebar on desktop */}
        {view === 'chat' && (
          <motion.div key="chat" style={wrapFull} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {isDesktop ? (
              <div style={{ display: 'flex', height: '100%' }}>
                <div style={{ width: 240, flexShrink: 0 }}>
                  <DesktopSidebar
                    authUser={authUser}
                    activeVibe={activeVibe}
                    setActiveVibe={setActiveVibe}
                    myCharacter={myCharacter}
                    onOpenCreator={openCreator}
                    onOpenSettings={() => setView('settings')}
                    onOpenGossip={openGossip}
                    language={language}
                    setLanguage={setLanguage}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  <ChatInterface {...chatProps} />
                </div>
              </div>
            ) : (
              <ChatInterface {...chatProps} />
            )}
          </motion.div>
        )}

        {view === 'gossip_chat' && (
          <motion.div key="gossip" style={wrapFull} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <GossipInterface
              setView={(v) => { setView(v === 'chat' ? 'chat' : v); }}
              authUser={authUser}
              messages={gossipMessages}
              input={gossipInput}
              setInput={setGossipInput}
              sendMessage={sendGossipMessage}
              loading={gossipLoading}
              scrollRef={gossipScrollRef}
            />
          </motion.div>
        )}

        {view === 'creator' && (
          <motion.div key="creator" style={wrapFull} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            {isDesktop ? (
              <div style={{ display: 'flex', height: '100%' }}>
                <div style={{ width: 240, flexShrink: 0 }}>
                  <DesktopSidebar
                    authUser={authUser}
                    activeVibe={activeVibe}
                    setActiveVibe={setActiveVibe}
                    myCharacter={myCharacter}
                    onOpenCreator={openCreator}
                    onOpenSettings={() => setView('settings')}
                    onOpenGossip={openGossip}
                    language={language}
                    setLanguage={setLanguage}
                  />
                </div>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                  <CharacterCreator
                    onBack={() => setView('chat')}
                    myCharacter={myCharacter}
                    setMyCharacter={setMyCharacter}
                    language={language}
                    onStart={() => { setActiveVibe('custom'); setView('chat'); }}
                  />
                </div>
              </div>
            ) : (
              <CharacterCreator
                onBack={() => setView('chat')}
                myCharacter={myCharacter}
                setMyCharacter={setMyCharacter}
                language={language}
                onStart={() => { setActiveVibe('custom'); setView('chat'); }}
              />
            )}
          </motion.div>
        )}

        {view === 'settings' && (
          <motion.div key="settings" style={wrapFull} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <SettingsScreen authUser={authUser} onBack={() => setView('chat')} language={language} setLanguage={setLanguage} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </AppBg>
  );
}

export default App;
