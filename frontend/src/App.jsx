import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const API_URL = "http://localhost:8000";

// --- STATIC DATA ---
const BASE_ROLES = [
  { id: "Close Cousin", icon: "🤝", desc: "Warm, relatable, emotionally supportive", color: "#a78bfa" },
  { id: "Office Bro", icon: "💼", desc: "Practical, slightly sarcastic", color: "#60a5fa" },
  { id: "Childhood Buddy", icon: "🎮", desc: "Nostalgic, loyal, casual", color: "#34d399" },
  { id: "Chill Ex", icon: "😎", desc: "Detached, objective, caring", color: "#fbbf24" },
  { id: "Blunt Senior", icon: "👴", desc: "Direct, no sugar-coating", color: "#f87171" },
  { id: "Protective Sister", icon: "🛡️", desc: "Defensive, fierce energy", color: "#f472b6" },
];

const TRAITS = [
  { id: "Funny", emoji: "😂" }, { id: "Savage", emoji: "🔪" },
  { id: "Wise", emoji: "🧙" }, { id: "Soft", emoji: "🌸" },
  { id: "Dramatic", emoji: "🎭" }, { id: "Sarcastic", emoji: "😏" },
  { id: "Brutally Honest", emoji: "💯" }, { id: "Motivator", emoji: "🚀" },
  { id: "Filmy", emoji: "🎬" }, { id: "Calm", emoji: "🧘" }
];

const ROLE_COLORS = {
  "Close Cousin": "#a78bfa",
  "Office Bro": "#60a5fa",
  "Childhood Buddy": "#34d399",
  "Chill Ex": "#fbbf24",
  "Blunt Senior": "#f87171",
  "Protective Sister": "#f472b6",
};

// --- 3D AVATAR ---
function AvatarMesh({ color = '#a78bfa', energy = 50 }) {
  const meshRef = useRef();
  const ring1 = useRef();
  const ring2 = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const s = 0.5 + (energy / 100) * 1.5;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.5 * s;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    }
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
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color={c} transparent opacity={0.06} />
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

// --- LOGO ICON ---
const LogoIcon = ({ size = 'lg' }) => {
  const dim = size === 'lg' ? 80 : 38;
  const lineW = size === 'lg' ? [34, 22, 28] : [16, 10, 13];
  const lineH = size === 'lg' ? 3 : 2;
  const gap = size === 'lg' ? 5 : 3;
  return (
    <div style={{
      width: dim, height: dim,
      background: 'rgba(255,255,255,0.10)',
      backdropFilter: 'blur(16px)',
      borderRadius: '50%',
      border: '1.5px solid rgba(255,255,255,0.20)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.3)',
      flexShrink: 0, position: 'relative',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap, padding: size === 'lg' ? '0 16px' : '0 8px', width: '100%' }}>
        {lineW.map((w, i) => (
          <div key={i} style={{
            height: lineH, borderRadius: 4, width: w,
            background: i === 0 ? 'linear-gradient(90deg,#a78bfa,#34d399)'
              : i === 1 ? 'linear-gradient(90deg,#34d399,#60a5fa)'
                : 'linear-gradient(90deg,#f472b6,#a78bfa)'
          }} />
        ))}
      </div>
    </div>
  );
};

// --- TYPING DOTS ---
const TypingDots = ({ color = '#a78bfa' }) => (
  <div style={{ display: 'flex', gap: 4, padding: '12px 16px' }}>
    {[0, 1, 2].map(i => (
      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
        animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
      />
    ))}
  </div>
);

// --- MODE BADGE ---
const modeMeta = {
  BACK_ME: { label: 'BACK ME', emoji: '🔥' },
  HEAR_ME: { label: 'HEAR ME', emoji: '💙' },
  BE_REAL: { label: 'BE REAL', emoji: '🧠' },
  VAULT: { label: 'VAULT', emoji: '🔒' },
  GOSSIP: { label: 'GOSSIP', emoji: '🤫' },
  CRISIS: { label: 'CRISIS', emoji: '🛡️' },
};

// ============================================================
// SCREEN: SPLASH
// ============================================================
const SplashScreen = ({ onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, []);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '40px 32px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <LogoIcon size="lg" />
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 44, color: '#fff', letterSpacing: -1, marginTop: 22 }}>
          Re<span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vent</span>
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: 3, color: 'rgba(248,250,252,0.25)', textTransform: 'uppercase', marginTop: 6 }}>
          Re · In · Venting · Space
        </div>
      </motion.div>
      <div style={{ height: 36 }} />
      <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
        style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, lineHeight: 1.75, color: 'rgba(248,250,252,0.5)', textAlign: 'center' }}>
        Complain. Cry. Overreact.<br />We take it all.
      </motion.p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        style={{ marginTop: 8, fontSize: 11, letterSpacing: 0.3, color: 'rgba(248,250,252,0.25)', textAlign: 'center' }}>
        A private emotional space powered by AI.
      </motion.p>
      <div style={{ height: 52 }} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} style={{ width: '100%' }}>
        <button onClick={onDone} style={btnPrimaryStyle}>Let's Begin</button>
      </motion.div>
    </div>
  );
};

// ============================================================
// SCREEN: ONBOARDING
// ============================================================
const OnboardingScreen = ({ onDone }) => {
  const [slide, setSlide] = useState(1);
  const slides = [
    {
      art: '🤝',
      title: '"Not everything needs to be \'healed.\'"',
      body: <>Sometimes you don't need advice. You need someone to say,<br /><span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 600 }}>"Yeah… that was stupid."</span></>,
      body2: <>We can be nice. We can be real. We can be <span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 600 }}>unfiltered.</span></>,
    },
    {
      logo: true,
      title: <>We <span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>know</span> when to.</>,
      modes: [
        { emoji: '💙', title: 'HEAR YOU', sub: "I'll just listen." },
        { emoji: '🔥', title: 'BACK YOU', sub: "I'll match your energy." },
        { emoji: '🧠', title: 'BE REAL', sub: "I'll say what needs to be said." },
      ],
    },
    {
      art: '🗑️',
      title: 'Be mad.\nWe can handle it.',
      body: <span style={{ color: '#f87171' }}>Shred it. Trash it. Say it out loud.</span>,
      body2: 'Specially designed release rooms inside.',
    },
  ];

  const s = slides[slide - 1];
  return (
    <div style={{ position: 'absolute', top: 16, right: 20, zIndex: 10 }}>
      <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'rgba(248,250,252,0.25)', fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', padding: '8px 12px' }}>Skip</button>
    </div>,
    <div key={slide} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '56px 28px 32px' }}>
      {s.art && (
        <div style={{ width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 4, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,rgba(167,139,250,0.12),transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          {s.art}
        </div>
      )}
      {s.logo && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <LogoIcon size="sm" />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, paddingTop: 16 }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, color: '#fff', letterSpacing: -0.5, lineHeight: 1.15, whiteSpace: 'pre-line' }}>{s.title}</div>
        {s.modes ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.modes.map(m => (
                <div key={m.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, backdropFilter: 'blur(16px)' }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 13 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(248,250,252,0.5)', marginTop: 1 }}>{m.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, letterSpacing: 0.3, color: 'rgba(248,250,252,0.25)', textAlign: 'center', marginTop: 16 }}>No sugarcoating unless you ask for it.</p>
          </>
        ) : (
          <>
            {s.body && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(248,250,252,0.5)' }}>{s.body}</p>}
            {s.body2 && <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(248,250,252,0.5)' }}>{s.body2}</p>}
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 28 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: slide === i ? 20 : 6, height: 6, borderRadius: 99, background: slide === i ? '#a78bfa' : 'rgba(255,255,255,0.15)', transition: 'all 0.3s', boxShadow: slide === i ? '0 0 8px rgba(167,139,250,0.5)' : 'none' }} />
          ))}
        </div>
        <button onClick={() => slide < 3 ? setSlide(slide + 1) : onDone()} style={{ ...btnPrimaryStyle, width: 'auto', padding: '12px 28px' }}>
          {slide < 3 ? 'Next →' : "Let's go →"}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// SCREEN: NAME
// ============================================================
const NameScreen = ({ onDone }) => {
  const [val, setVal] = useState('');
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <LogoIcon size="sm" />
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: -0.5 }}>
          Re<span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vent</span>
        </div>
      </div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, color: '#fff', textAlign: 'center', letterSpacing: -0.5, lineHeight: 1.15 }}>What should<br />I call you?</div>
      <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: 14, lineHeight: 1.75, textAlign: 'center', marginTop: 10 }}>No government names required.</p>
      <div style={{ height: 36 }} />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: '#a78bfa', fontFamily: "'DM Sans',sans-serif", fontWeight: 500, marginBottom: 8 }}>Your alias</div>
          <input
            style={inputStyle}
            type="text" placeholder="Your name… or alter ego" maxLength={24}
            value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && val.trim() && onDone(val.trim())}
          />
        </div>
        <button style={btnPrimaryStyle} onClick={() => val.trim() && onDone(val.trim())}>Continue</button>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', textAlign: 'center', marginTop: 16 }}>This is your private space. No real info needed.</p>
    </div>
  );
};

// ============================================================
// SCREEN: LANGUAGE
// ============================================================
const LanguageScreen = ({ onDone }) => {
  const [sel, setSel] = useState('Hindi');
  const langs = [
    { id: 'Hindi', label: 'Hinglish' },
    { id: 'English', label: 'English' },
    { id: 'Marathi', label: 'मराठी + English' },
    { id: 'Tamil', label: 'தமிழ் + English' },
    { id: 'Kannada', label: 'ಕನ್ನಡ + English' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <LogoIcon size="sm" />
        <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: -0.5 }}>
          Re<span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vent</span>
        </div>
      </div>
      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 30, color: '#fff', textAlign: 'center', letterSpacing: -0.5 }}>How do you think?</div>
      <p style={{ color: 'rgba(248,250,252,0.5)', fontSize: 14, textAlign: 'center', marginTop: 10 }}>Pick what feels natural.</p>
      <div style={{ height: 24 }} />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {langs.map(l => (
          <div key={l.id} onClick={() => setSel(l.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', background: sel === l.id ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.05)', border: `1px solid ${sel === l.id ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 14, cursor: 'pointer', backdropFilter: 'blur(16px)', transition: 'all 0.2s' }}>
            <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15 }}>{l.label}</span>
            <span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 16, opacity: sel === l.id ? 1 : 0, transition: 'opacity 0.2s' }}>✓</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'rgba(248,250,252,0.25)', textAlign: 'center', marginTop: 14 }}>You can switch anytime.</p>
      <div style={{ height: 28 }} />
      <button style={btnPrimaryStyle} onClick={() => onDone(sel)}>Let's Go</button>
    </div>
  );
};

// ============================================================
// CHARACTER CREATOR
// ============================================================
const CharacterCreator = ({ setView, myCharacter, setMyCharacter, language }) => {
  const [step, setStep] = useState(1);
  const [tempChar, setTempChar] = useState(myCharacter);
  const [quirkInput, setQuirkInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  const avatarColor = ROLE_COLORS[tempChar.base_role] || '#a78bfa';

  const toggleTrait = (id) => {
    if (tempChar.traits.includes(id)) {
      setTempChar({ ...tempChar, traits: tempChar.traits.filter(t => t !== id) });
    } else {
      if (tempChar.traits.length < 4) setTempChar({ ...tempChar, traits: [...tempChar.traits, id] });
    }
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
      const res = await axios.post(`${API_URL}/refine-backstory`, { draft_text: tempChar.memory_hook, language });
      setTempChar({ ...tempChar, memory_hook: res.data.refined_text });
    } catch (e) { console.error(e); }
    finally { setIsRefining(false); }
  };

  const saveAndExit = () => { setMyCharacter(tempChar); setView('character_chat'); };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,8,30,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <button onClick={() => setView('home')} style={{ ...iconBtnStyle }}>←</button>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 16, color: '#fff' }}>Design Persona</div>
          <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.25)', letterSpacing: 0.5 }}>Craft your AI companion</div>
        </div>
      </div>

      {/* 3D Avatar */}
      <div style={{ position: 'relative', background: 'linear-gradient(to bottom, rgba(10,5,25,0.9), rgba(10,5,25,0.4))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 128, height: 128, borderRadius: '50%', background: avatarColor, filter: 'blur(48px)', opacity: 0.15 }} />
        </div>
        <Avatar3D color={avatarColor} energy={tempChar.energy} height={160} />
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', padding: '5px 12px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          <span>{BASE_ROLES.find(r => r.id === tempChar.base_role)?.icon}</span>
          <span style={{ color: avatarColor }}>{tempChar.base_role}</span>
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 16px 8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 99, background: step >= i ? avatarColor : 'rgba(255,255,255,0.08)', transition: 'all 0.4s', boxShadow: step === i ? `0 0 8px ${avatarColor}` : 'none' }} />
        ))}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} style={{ paddingTop: 8 }}>

            {step === 1 && (
              <>
                <div style={stepTitle}>Choose a Vibe</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                  {BASE_ROLES.map(role => (
                    <button key={role.id} onClick={() => setTempChar({ ...tempChar, base_role: role.id })}
                      style={{ padding: '14px 12px', borderRadius: 14, border: `1px solid ${tempChar.base_role === role.id ? role.color + '60' : 'rgba(255,255,255,0.07)'}`, background: tempChar.base_role === role.id ? role.color + '18' : 'rgba(255,255,255,0.03)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', boxShadow: tempChar.base_role === role.id ? `0 0 18px ${role.color}22` : 'none' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{role.icon}</div>
                      <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 12, color: '#fff' }}>{role.id}</div>
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
                    style={{ width: '100%', accentColor: avatarColor }}
                  />
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
                    placeholder="e.g. Uses emojis often" />
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
                    placeholder="e.g. We survived high school together…"
                  />
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

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        {step < 5 ? (
          <button onClick={() => setStep(step + 1)} style={{ ...btnPrimaryStyle, background: `linear-gradient(90deg,${avatarColor},#34d399)` }}>
            Next Step →
          </button>
        ) : (
          <button onClick={saveAndExit} style={{ ...btnPrimaryStyle, background: `linear-gradient(90deg,${avatarColor},#34d399)` }}>
            Launch Character ✨
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================
// CHAT INTERFACE (Standard + Character)
// ============================================================
const ChatInterface = ({ isCharacterMode, setView, myCharacter, intensity, baseline, manualMode, setManualMode, language, setLanguage, messages, input, setInput, sendMessage, loading, scrollRef }) => {
  const accentColor = isCharacterMode ? (ROLE_COLORS[myCharacter.base_role] || '#a78bfa') : '#a78bfa';
  const role = BASE_ROLES.find(r => r.id === myCharacter?.base_role);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,8,30,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setView('home')} style={iconBtnStyle}>←</button>
          {isCharacterMode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: `1.5px solid ${accentColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{role?.icon}</div>
              <div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, background: `linear-gradient(90deg,${accentColor},#34d399)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{myCharacter.base_role}</div>
                <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.3)', letterSpacing: 0.5 }}>● Online · Listening</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LogoIcon size="sm" />
              <div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 14, background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RE(bot)</div>
                <div style={{ fontSize: 10, color: 'rgba(248,250,252,0.3)', letterSpacing: 0.5 }}>● Online · Listening</div>
              </div>
            </div>
          )}
        </div>
        {/* Lang selector */}
        <div style={{ position: 'relative' }}>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            style={{ appearance: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 28px 6px 10px', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}>
            <option value="Hindi">Hinglish</option>
            <option value="Marathi">Marathi</option>
            <option value="Tamil">Tanglish</option>
            <option value="Kannada">Kanglish</option>
            <option value="English">English</option>
          </select>
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'rgba(248,250,252,0.3)', pointerEvents: 'none' }}>▾</span>
        </div>
      </div>

      {/* Mode chips - standard only */}
      {!isCharacterMode && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.5)', backdropFilter: 'blur(16px)', overflowX: 'auto', flexShrink: 0 }}>
          {[
            { id: 'AUTO', label: '⚡ AUTO' },
            { id: 'HEAR_ME', label: '💙 HEAR ME' },
            { id: 'BACK_ME', label: '🔥 BACK ME' },
            { id: 'BE_REAL', label: '🧠 BE REAL' },
          ].map(m => (
            <button key={m.id} onClick={() => setManualMode(m.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, border: `1px solid ${manualMode === m.id ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.06)'}`, background: manualMode === m.id ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', fontSize: 12, fontWeight: 500, color: manualMode === m.id ? '#a78bfa' : 'rgba(248,250,252,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s', backdropFilter: 'blur(16px)' }}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(10,5,22,0.3)', flexShrink: 0 }}>
        {[
          { label: 'INTENSITY', val: intensity, color: '#fbbf24' },
          { label: 'MOOD', val: baseline, color: '#34d399' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 9, letterSpacing: 2, fontWeight: 700, color: s.color, textTransform: 'uppercase' }}>
              <span>{s.label}</span><span>{s.val}/10</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${s.val * 10}%` }} style={{ height: '100%', background: s.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.35, paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{isCharacterMode ? role?.icon : '🤝'}</div>
            <p style={{ fontSize: 13, color: 'rgba(248,250,252,0.5)', textAlign: 'center' }}>Hey. You showed up — that already took something.<br />This is your space. Say whatever.</p>
          </div>
        )}
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

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,22,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea style={{ ...textareaStyle, flex: 1 }}
            id="chat-in" value={input} onChange={e => setInput(e.target.value)} placeholder="Just say it…" rows={1}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button onClick={sendMessage} style={{ ...sendBtnStyle, background: `linear-gradient(135deg,${accentColor},#34d399)` }}>↑</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// GOSSIP INTERFACE
// ============================================================
const GossipInterface = ({ setView, language, setLanguage, messages, input, setInput, sendMessage, loading, scrollRef, vaultMode, setVaultMode }) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    {/* Topbar */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(251,191,36,0.1)', background: 'rgba(8,5,18,0.9)', backdropFilter: 'blur(20px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fbbf24' }}>
          <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          GOSSIP MODE
        </div>
        <span style={{ fontSize: 10, color: 'rgba(248,250,252,0.25)' }}>RAM only · No storage</span>
      </div>
      <button onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: 99, color: '#fbbf24', fontSize: 11, letterSpacing: 0.5, cursor: 'pointer', backdropFilter: 'blur(16px)' }}>
        🚨 Exit & Dissolve
      </button>
    </div>

    {/* Vault/lang row */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid rgba(251,191,36,0.06)', background: 'rgba(8,5,18,0.7)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
      <button onClick={() => setVaultMode(!vaultMode)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: `1px solid ${vaultMode ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`, background: vaultMode ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)', fontSize: 11, color: vaultMode ? '#a78bfa' : 'rgba(248,250,252,0.35)', cursor: 'pointer', transition: 'all 0.2s' }}>
        🔒 {vaultMode ? 'VAULT ON' : 'Vault Off'}
      </button>
      <div style={{ position: 'relative' }}>
        <select value={language} onChange={e => setLanguage(e.target.value)}
          style={{ appearance: 'none', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 24px 6px 10px', borderRadius: 10, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}>
          <option value="Hindi">Hinglish</option>
          <option value="Marathi">Marathi</option>
          <option value="Tamil">Tanglish</option>
          <option value="Kannada">Kanglish</option>
          <option value="English">English</option>
        </select>
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'rgba(248,250,252,0.3)', pointerEvents: 'none' }}>▾</span>
      </div>
    </div>

    {/* Warning banner */}
    <div style={{ margin: '10px 16px 0', padding: '10px 14px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'rgba(251,191,36,0.7)', flexShrink: 0 }}>
      <span>⚠️</span>
      <span>This conversation will vanish when you exit. No logs. No memory. No receipts.</span>
    </div>

    {/* Messages */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {messages.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.4, paddingTop: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🤫</div>
          <p style={{ fontSize: 13, color: 'rgba(248,250,252,0.5)', textAlign: 'center' }}>Okay, just between us.<br />Say whatever. Zero receipts.</p>
        </div>
      )}
      {messages.map((msg, i) => <GossipBubble key={i} msg={msg} />)}
      {loading && (
        <div style={{ alignSelf: 'flex-start' }}>
          <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: '2px 14px 14px 14px', backdropFilter: 'blur(16px)' }}>
            <TypingDots color="#fbbf24" />
          </div>
        </div>
      )}
      <div ref={scrollRef} />
    </div>

    {/* Input */}
    <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(251,191,36,0.08)', background: 'rgba(8,5,18,0.8)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea style={{ ...textareaStyle, flex: 1, borderColor: 'rgba(251,191,36,0.15)' }}
          value={input} onChange={e => setInput(e.target.value)} placeholder="Off the record…" rows={1}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
        />
        <button onClick={sendMessage} style={{ ...sendBtnStyle, background: 'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>↑</button>
      </div>
    </div>
  </div>
);

// ============================================================
// BUBBLE COMPONENTS
// ============================================================
const ChatBubble = ({ msg }) => {
  const meta = msg.mode ? modeMeta[msg.mode] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
      {msg.role === 'ai' && meta && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.35)', marginBottom: 4, paddingLeft: 2 }}>
          RE(bot) · {meta.emoji} {meta.label}
        </div>
      )}
      {msg.role === 'user' && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.25)', marginBottom: 4, textAlign: 'right', paddingRight: 2 }}>You</div>
      )}
      <div style={{
        padding: '11px 15px', fontSize: 14, lineHeight: 1.65, backdropFilter: 'blur(16px)',
        ...(msg.role === 'user' ? {
          background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: '14px 2px 14px 14px',
        } : {
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '2px 14px 14px 14px',
        })
      }}>
        {msg.content}
      </div>
    </motion.div>
  );
};

const GossipBubble = ({ msg }) => {
  const meta = msg.mode ? modeMeta[msg.mode] : null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
      {msg.role === 'ai' && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(251,191,36,0.5)', marginBottom: 4 }}>
          RE(bot) · GOSSIP {meta ? `· ${meta.emoji} ${meta.label}` : '· OFF RECORD'}
        </div>
      )}
      {msg.role === 'user' && (
        <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.25)', marginBottom: 4, textAlign: 'right' }}>You</div>
      )}
      <div style={{
        padding: '11px 15px', fontSize: 14, lineHeight: 1.65, backdropFilter: 'blur(16px)',
        ...(msg.role === 'user' ? {
          background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.22)',
          borderRadius: '14px 2px 14px 14px',
        } : {
          background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.12)',
          borderRadius: '2px 14px 14px 14px',
        })
      }}>
        {msg.content}
      </div>
    </motion.div>
  );
};

// ============================================================
// HOME SCREEN
// ============================================================
const HomeScreen = ({ setView, setMessages, setVaultMode, userName }) => {
  const cards = [
    { id: 'standard_chat', emoji: '⚡', title: 'Quick Support', sub: 'Auto-Detect Mode', color: '#a78bfa', delay: 0.1 },
    { id: 'creator', emoji: '✨', title: 'Build a Friend', sub: 'Design Your AI Companion', color: '#34d399', delay: 0.2 },
    { id: 'gossip_chat', emoji: '🤫', title: 'Gossip Room', sub: 'Off the record · No receipts', color: '#fbbf24', delay: 0.3 },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 0 0' }}>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,8,30,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoIcon size="sm" />
          <div>
            <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 14, background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ReVent</div>
            <div style={{ fontSize: 9, color: 'rgba(248,250,252,0.25)', letterSpacing: 2, textTransform: 'uppercase' }}>Re · In · Venting · Space</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, backdropFilter: 'blur(12px)' }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 13, color: '#fff' }}>{userName}</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: '28px 20px 16px' }}>
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(248,250,252,0.25)', marginBottom: 8, fontFamily: "'DM Sans',sans-serif" }}>Your private space</div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: -0.5, lineHeight: 1.15, color: '#fff' }}>
            What do you<br />need right now?
          </div>
        </motion.div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cards.map(card => (
          <motion.button key={card.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: card.delay, duration: 0.4 }}
            onClick={() => { setMessages([]); if (card.id === 'gossip_chat') setVaultMode(false); setView(card.id); }}
            style={{ width: '100%', padding: '16px', background: `rgba(255,255,255,0.04)`, border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', backdropFilter: 'blur(16px)', transition: 'all 0.2s', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = card.color + '40'; e.currentTarget.style.background = card.color + '08'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: card.color + '18', border: `1px solid ${card.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {card.emoji}
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}>{card.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(248,250,252,0.4)', marginTop: 2 }}>{card.sub}</div>
              </div>
            </div>
            <span style={{ color: 'rgba(248,250,252,0.2)', fontSize: 16 }}>›</span>
          </motion.button>
        ))}

        {/* Bottom note */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.3, color: 'rgba(248,250,252,0.15)' }}>No logs. No judgement. Just vibes.</span>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,5,25,0.7)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <button style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 0', cursor: 'pointer', background: 'none', border: 'none', color: '#a78bfa' }}>
          <span style={{ fontSize: 20 }}>💬</span>
          <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#a78bfa' }}>Vent</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================
// SHARED STYLES
// ============================================================
const btnPrimaryStyle = {
  width: '100%', padding: '15px 24px',
  background: 'linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)',
  color: '#fff', border: 'none', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15,
  letterSpacing: -0.2, cursor: 'pointer',
  boxShadow: '0 4px 24px rgba(167,139,250,0.3)',
  transition: 'all 0.2s',
};
const inputStyle = {
  width: '100%', padding: '14px 18px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14, color: '#f8fafc',
  fontFamily: "'DM Sans',sans-serif", fontSize: 15,
  outline: 'none', backdropFilter: 'blur(16px)',
  boxSizing: 'border-box',
};
const textareaStyle = {
  width: '100%', padding: '13px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14, color: '#f8fafc',
  fontFamily: "'DM Sans',sans-serif", fontSize: 14,
  outline: 'none', resize: 'none', minHeight: 44, maxHeight: 120, lineHeight: 1.5,
  backdropFilter: 'blur(16px)', boxSizing: 'border-box',
};
const sendBtnStyle = {
  width: 44, height: 44, border: 'none', borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 20, color: '#fff',
  boxShadow: '0 4px 16px rgba(167,139,250,0.3)',
  flexShrink: 0, transition: 'all 0.2s',
};
const iconBtnStyle = {
  width: 44, height: 44, background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 18, color: '#f8fafc',
  backdropFilter: 'blur(16px)', flexShrink: 0,
};
const stepTitle = { fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: -0.3 };

// ============================================================
// MAIN APP
// ============================================================
function App() {
  const [view, setView] = useState('splash');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId] = useState(`sess_${Math.random().toString(36).substr(2, 9)}`);
  const [manualMode, setManualMode] = useState('AUTO');
  const [language, setLanguage] = useState('Hindi');
  const [intensity, setIntensity] = useState(0);
  const [baseline, setBaseline] = useState(5);
  const [userName, setUserName] = useState('User');
  const [myCharacter, setMyCharacter] = useState({
    base_role: 'Office Bro', traits: [], energy: 50, quirks: [], memory_hook: '', fixed_mode: 'AUTO'
  });
  const [vaultMode, setVaultMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Auto-resize textareas
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

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const activeMode = view === 'gossip_chat' ? 'GOSSIP' : (view === 'character_chat' ? 'AUTO' : manualMode);
      const activeConfig = view === 'character_chat' ? myCharacter : {};
      const res = await axios.post(`${API_URL}/chat`, {
        message: userMsg.content, session_id: sessionId, language,
        manual_mode: activeMode, persona_config: activeConfig,
        emotional_baseline: baseline, force_vault: view === 'gossip_chat' && vaultMode
      });
      setMessages(prev => [...prev, { role: 'ai', content: res.data.response, mode: res.data.mode }]);
      setIntensity(res.data.intensity_score);
      setBaseline(res.data.emotional_baseline);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: '⚠️ Connection failed. Check backend.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sharedProps = { messages, input, setInput, sendMessage, loading, scrollRef, language, setLanguage };

  return (
    <div style={{ width: '100%', height: '100vh', background: '#000', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{
        width: '100%', maxWidth: 420, height: '100%',
        background: 'linear-gradient(145deg,#1a0533,#0a1a40 50%,#003328)',
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans',sans-serif", color: '#f8fafc',
      }}>
        {/* Animated bg orbs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.18), transparent)', top: '-10%', left: '-10%' }} />
          <div style={{ position: 'absolute', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.14), transparent)', bottom: '-10%', right: '-10%' }} />
          <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.10), transparent)', top: '40%', right: '-5%' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {view === 'splash' && (
              <motion.div key="splash" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <SplashScreen onDone={() => setView('onboarding')} />
              </motion.div>
            )}
            {view === 'onboarding' && (
              <motion.div key="ob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button onClick={() => setView('name')} style={{ position: 'absolute', top: 16, right: 20, zIndex: 10, background: 'none', border: 'none', color: 'rgba(248,250,252,0.25)', fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', padding: '8px 12px' }}>Skip</button>
                <OnboardingScreen onDone={() => setView('name')} />
              </motion.div>
            )}
            {view === 'name' && (
              <motion.div key="name" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
                <NameScreen onDone={n => { setUserName(n); setView('lang'); }} />
              </motion.div>
            )}
            {view === 'lang' && (
              <motion.div key="lang" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
                <LanguageScreen onDone={l => { setLanguage(l); setView('home'); }} />
              </motion.div>
            )}
            {view === 'home' && (
              <motion.div key="home" style={{ flex: 1, display: 'flex', flexDirection: 'column' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HomeScreen setView={setView} setMessages={setMessages} setVaultMode={setVaultMode} userName={userName} />
              </motion.div>
            )}
            {view === 'creator' && (
              <motion.div key="creator" style={{ position: 'absolute', inset: 0 }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
                <CharacterCreator setView={setView} myCharacter={myCharacter} setMyCharacter={setMyCharacter} language={language} />
              </motion.div>
            )}
            {view === 'gossip_chat' && (
              <motion.div key="gossip" style={{ position: 'absolute', inset: 0 }} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
                <GossipInterface setView={setView} {...sharedProps} vaultMode={vaultMode} setVaultMode={setVaultMode} />
              </motion.div>
            )}
            {(view === 'standard_chat' || view === 'character_chat') && (
              <motion.div key="chat" style={{ position: 'absolute', inset: 0 }} initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
                <ChatInterface isCharacterMode={view === 'character_chat'} setView={setView} myCharacter={myCharacter}
                  intensity={intensity} baseline={baseline} manualMode={manualMode} setManualMode={setManualMode}
                  {...sharedProps} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default App;
