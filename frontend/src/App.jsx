import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Toaster, toast } from 'react-hot-toast';
import EmojiPicker from 'emoji-picker-react';

// ─── API ──────────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || '';
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });
const genSessionId = () => `sess_${Math.random().toString(36).substr(2,9)}_${Date.now().toString(36)}`;

// Persist view state across page reloads
const saveState = (key, val) => { try { sessionStorage.setItem(`rv_${key}`, JSON.stringify(val)); } catch {} };
const loadState = (key, fallback) => { try { const v = sessionStorage.getItem(`rv_${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_ROLES = [
  { id: 'Close Cousin',      icon: '🤝', desc: 'Warm, relatable, emotionally supportive', color: '#a78bfa' },
  { id: 'Office Bro',        icon: '💼', desc: 'Practical, slightly sarcastic',            color: '#60a5fa' },
  { id: 'Childhood Buddy',   icon: '🎮', desc: 'Nostalgic, loyal, casual',                 color: '#34d399' },
  { id: 'Chill Ex',          icon: '😎', desc: 'Detached, objective, caring',              color: '#fbbf24' },
  { id: 'Blunt Senior',      icon: '👴', desc: 'Direct, no sugar-coating',                 color: '#f87171' },
  { id: 'Sibling', icon: '🛡️', desc: 'Defensive, fierce energy',                color: '#f472b6' },
];
const TRAITS = [
  { id: 'Funny', emoji: '😂' }, { id: 'Savage', emoji: '🔪' },
  { id: 'Wise', emoji: '🧙' },  { id: 'Soft', emoji: '🌸' },
  { id: 'Dramatic', emoji: '🎭' }, { id: 'Sarcastic', emoji: '😏' },
  { id: 'Brutally Honest', emoji: '💯' }, { id: 'Motivator', emoji: '🚀' },
  { id: 'Filmy', emoji: '🎬' }, { id: 'Calm', emoji: '🧘' },
  { id: 'Talks A Lot', emoji: '🗣️' }, { id: 'Minimal Talker', emoji: '🤐' },
  { id: 'Protective', emoji: '🛡️' },
];
const GENDER_OPTIONS = [
  { id: 'female', emoji: '👧', label: 'Female' },
  { id: 'male', emoji: '👦', label: 'Male' },
  { id: 'neutral', emoji: '🧑', label: 'Neutral' },
];
const ROLE_COLORS = {
  'Close Cousin': '#a78bfa', 'Office Bro': '#60a5fa', 'Childhood Buddy': '#34d399',
  'Chill Ex': '#fbbf24', 'Blunt Senior': '#f87171', 'Sibling': '#f472b6',
};
const RE_DEFAULT = { id: 'default', label: 'Reva', emoji: null, color: '#a78bfa', config: {} };
const EMOTION_ITEMS = [
  { emoji: '😔', label: 'Sad',     mode: 'HEAR_ME' },
  { emoji: '💀', label: 'Dead',    mode: 'HEAR_ME' },
  { emoji: '🔥', label: 'Fired',   mode: 'BACK_ME' },
  { emoji: '😭', label: 'Crying',  mode: 'HEAR_ME' },
  { emoji: '😤', label: 'Angry',   mode: 'BACK_ME' },
  { emoji: '😮', label: 'Shocked', mode: 'AUTO'    },
  { emoji: '🤔', label: 'Confused',mode: 'BE_REAL' },
];
const modeMeta = {
  BACK_ME: { label: 'BACK ME', emoji: '🔥' },
  HEAR_ME: { label: 'HEAR ME', emoji: '💙' },
  BE_REAL: { label: 'BE REAL', emoji: '🧠' },
  VAULT:   { label: 'VAULT',   emoji: '🔒' },
  GOSSIP:  { label: 'GOSSIP',  emoji: '🤫' },
  CRISIS:  { label: 'CRISIS',  emoji: '🛡️' },
  AUTO:    { label: 'AUTO',    emoji: '⚡' },
};
const MODE_TRAY = [
  { id: 'AUTO', emoji: '⚡', name: 'AUTO MODE', shortDesc: 'Let Reva decide the vibe' },
  { id: 'HEAR_ME', emoji: '💙', name: 'HEAR ME', shortDesc: 'I just need someone to listen' },
  { id: 'BACK_ME', emoji: '🔥', name: 'BACK ME', shortDesc: 'Match my energy and hype me' },
  { id: 'BE_REAL', emoji: '🧠', name: 'BE REAL', shortDesc: 'Tell me what I need to hear' },
];
const formatTimestamp = (ts) => {
  if(!ts) return '';
  const date = new Date(ts);
  if(Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if(sameDay) return time;
  if(isYesterday) return `Yesterday ${time}`;
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
};
const sanitizeText = (text) => (text || '').replace(/<[^>]+>/g, '').trim();
const ensureMessage = (msg) => ({
  ...msg,
  content: sanitizeText(msg.content),
  timestamp: msg.timestamp || msg.created_at || msg.ts || msg.time || new Date().toISOString(),
});
const WELCOME_MESSAGE = {
  role: 'ai',
  content: 'Hey. You showed up — that already took something. 💜\n\nThis is your space. Say whatever. I\'m not going anywhere.',
  mode: 'AUTO',
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
const GT = (text) => (
  <span style={{ background: 'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
    {text}
  </span>
);

// A centered page wrapper — every "card" screen uses this
// Makes content truly center on all viewports
const PageCenter = ({ children, maxW = 480 }) => (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '32px 24px', overflowY: 'auto',
  }}>
    <div style={{ width: '100%', maxWidth: maxW }}>
      {children}
    </div>
  </div>
);

// ─── Shared styles ────────────────────────────────────────────────────────────
const btnPrimary = {
  width: '100%', padding: '15px 24px',
  background: 'linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)',
  color: '#fff', border: 'none', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 15,
  cursor: 'pointer', boxShadow: '0 4px 24px rgba(167,139,250,0.3)',
  transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const btnSecondary = {
  padding: '13px 28px', background: 'rgba(255,255,255,0.06)', color: '#a78bfa',
  border: '1px solid rgba(167,139,250,0.25)', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15, cursor: 'pointer',
  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
  transition: 'all 0.2s',
};
const btnDanger = {
  width: '100%', padding: '13px 28px',
  background: 'rgba(248,113,113,0.08)', color: '#f87171',
  border: '1px solid rgba(248,113,113,0.2)', borderRadius: 999,
  fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: 15,
  cursor: 'pointer', transition: 'all 0.2s',
};
const inputCss = {
  width: '100%', padding: '14px 18px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14, color: '#f8fafc',
  fontFamily: "'DM Sans',sans-serif", fontSize: 15, outline: 'none',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};
const textareaCss = {
  width: '100%', padding: '13px 16px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 14, color: '#f8fafc', fontFamily: "'DM Sans',sans-serif",
  fontSize: 14, outline: 'none', resize: 'none', minHeight: 44, maxHeight: 120,
  lineHeight: 1.5, backdropFilter: 'blur(16px)', boxSizing: 'border-box',
};
const sendBtn = {
  width: 44, height: 44, border: 'none', borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 20, color: '#fff',
  boxShadow: '0 4px 16px rgba(167,139,250,0.3)', flexShrink: 0,
};
const iconBtn = {
  width: 38, height: 38, background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 16, color: '#f8fafc',
  backdropFilter: 'blur(12px)', flexShrink: 0, transition: 'all 0.2s',
};
const topbar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(15,8,30,0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  flexShrink: 0,
};
const glass = {
  background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16, padding: '24px 20px',
};
const label = { fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: '#a78bfa', fontFamily: "'DM Sans',sans-serif", fontWeight: 500, marginBottom: 8 };
const sectionLabel = { fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(167,139,250,0.6)', fontFamily: "'DM Sans',sans-serif", fontWeight: 500, marginBottom: 10, marginTop: 16 };
const stepTitleStyle = { fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: -0.3 };
// ─── Logo ─────────────────────────────────────────────────────────────────────
const LogoIcon = ({ size = 'sm' }) => {
  const cfg = {
    lg: { dim: 80, lw: [34,22,28], lh: 3, gap: 5, pad: 16, cs: 20, cb: -6, cl: 10 },
    md: { dim: 46, lw: [20,13,16], lh: 2, gap: 4, pad: 10, cs: 12, cb: -4, cl: 6  },
    sm: { dim: 38, lw: [16,10,13], lh: 2, gap: 3, pad: 8,  cs: 10, cb: -3, cl: 5  },
  }[size] || { dim: 38, lw: [16,10,13], lh: 2, gap: 3, pad: 8, cs: 10, cb: -3, cl: 5 };
  return (
    <div style={{ width: cfg.dim, height: cfg.dim, background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(16px)', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.3)', flexShrink: 0, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cfg.gap, padding: `0 ${cfg.pad}px`, width: '100%' }}>
        {cfg.lw.map((w, i) => (
          <div key={i} style={{ height: cfg.lh, borderRadius: 4, width: w, background: i===0?'linear-gradient(90deg,#a78bfa,#34d399)':i===1?'linear-gradient(90deg,#34d399,#60a5fa)':'linear-gradient(90deg,#f472b6,#a78bfa)' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', width: cfg.cs, height: cfg.cs, background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(8px)', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.18)', borderTop: 'none', borderRight: 'none', bottom: cfg.cb, left: cfg.cl }} />
    </div>
  );
};

// ─── Typing dots ──────────────────────────────────────────────────────────────
const TypingDots = ({ color = '#a78bfa' }) => (
  <div style={{ display: 'flex', gap: 4, padding: '12px 16px' }}>
    {[0,1,2].map(i => (
      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: color }}
        animate={{ opacity: [0.2,1,0.2], scale: [0.8,1,0.8] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i*0.2 }} />
    ))}
  </div>
);

// ─── Coin badge ───────────────────────────────────────────────────────────────
const CoinBadge = ({ coins = 0, onClick }) => {
  const low = coins < 50;
  return (
    <motion.div data-testid="coin-badge" onClick={onClick}
      animate={low ? { scale:[1,1.06,1] } : {}} transition={low ? { duration: 2, repeat: Infinity } : {}}
      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: onClick?'pointer':'default', padding: '5px 10px', background: low?'rgba(248,113,113,0.08)':'rgba(167,139,250,0.08)', border:`1px solid ${low?'rgba(248,113,113,0.2)':'rgba(167,139,250,0.2)'}`, borderRadius: 99 }}>
      <span style={{ fontSize: 11, color: low?'#f87171':'#a78bfa' }}>✦</span>
      <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight: 700, fontSize: 12, color: low?'#f87171':'#a78bfa' }}>{(coins||0).toLocaleString()}</span>
    </motion.div>
  );
};

// ─── 3-D Avatar ───────────────────────────────────────────────────────────────
function AvatarMesh({ color='#a78bfa', energy=50 }) {
  const mesh=useRef(), r1=useRef(), r2=useRef();
  useFrame(st=>{
    const t=st.clock.elapsedTime, s=0.5+(energy/100)*1.5;
    if(mesh.current){mesh.current.rotation.y=t*0.5*s;mesh.current.rotation.x=Math.sin(t*0.3)*0.15;}
    if(r1.current)r1.current.rotation.x=t*0.7*s;
    if(r2.current)r2.current.rotation.y=t*0.9*s;
  });
  const c=new THREE.Color(color);
  return (
    <group>
      <mesh ref={mesh}><icosahedronGeometry args={[0.85,1]}/><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} roughness={0.2} metalness={0.7}/></mesh>
      <mesh ref={r1}><torusGeometry args={[1.25,0.022,8,64]}/><meshBasicMaterial color={c} transparent opacity={0.45}/></mesh>
      <mesh ref={r2} rotation={[Math.PI/4,0,0]}><torusGeometry args={[1.45,0.013,8,64]}/><meshBasicMaterial color={c} transparent opacity={0.25}/></mesh>
    </group>
  );
}
function Avatar3D({ color='#a78bfa', energy=50, height=160 }) {
  return (
    <div style={{ height }}>
      <Canvas camera={{ position:[0,0,3.5], fov:45 }}>
        <ambientLight intensity={0.3}/>
        <pointLight position={[3,3,3]} intensity={2} color={color}/>
        <pointLight position={[-3,-2,-3]} intensity={0.8} color="#34d399"/>
        <AvatarMesh color={color} energy={energy}/>
      </Canvas>
    </div>
  );
}

// ─── App background ───────────────────────────────────────────────────────────
const AppBg = ({ children }) => (
  <div 
    id="app-root" 
    style={{ 
      position:'fixed', 
      top:0, left:0, right:0, bottom:0, 
      width:'100%',
      height:'100%',
      overflow:'hidden', 
      background:'linear-gradient(145deg,#1a0533,#0a1a40 55%,#003328)', 
      fontFamily:"'DM Sans',sans-serif", 
      color:'#f8fafc' 
    }}
  >
    {/* Decorative circles - positioned absolutely within app-root */}
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
      <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.14),transparent)', top:'-20%', left:'-15%' }}/>
      <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,0.11),transparent)', bottom:'-15%', right:'-10%' }}/>
      <div style={{ position:'absolute', width:450, height:450, borderRadius:'50%', background:'radial-gradient(circle,rgba(96,165,250,0.08),transparent)', top:'35%', right:'5%' }}/>
    </div>
    {/* Main content layer */}
    <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
      {children}
    </div>
  </div>
);

// Full-screen wrapper for views
const wrapFull = { position:'absolute', top:0, left:0, right:0, bottom:0, display:'flex', flexDirection:'column', overflow:'hidden' };

// ─── Beta Welcome Modal ────────────────────────────────────────────────────────
const BetaWelcomeModal = ({ onDismiss }) => {
  const [count,setCount]=useState(0);
  useEffect(()=>{
    let n=0; const total=2000, steps=80, inc=total/steps;
    const t=setInterval(()=>{ n+=inc; if(n>=total){setCount(total);clearInterval(t);}else setCount(Math.floor(n)); },25);
    return()=>clearInterval(t);
  },[]);
  return (
    <motion.div data-testid="beta-welcome-modal" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,5,22,0.85)', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <motion.div initial={{scale:0.85,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:200,damping:22}}
        style={{ width:'100%', maxWidth:420, ...glass, padding:'44px 32px', textAlign:'center' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:24 }}><LogoIcon size="lg"/></div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:28, color:'#fff', letterSpacing:-0.5, marginBottom:12 }}>Congratulations!</div>
        <div style={{ fontSize:15, color:'rgba(248,250,252,0.6)', lineHeight:1.6, marginBottom:32 }}>You are selected for beta testing and received</div>
        <div style={{ marginBottom:8 }}>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:72, lineHeight:1, background:'linear-gradient(90deg,#a78bfa,#60a5fa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{count.toLocaleString()}</div>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:20, color:'#a78bfa', marginTop:4 }}>coins to Vent</div>
        </div>
        <div style={{ margin:'24px 0 32px', height:1, background:'linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent)' }}/>
        <div style={{ fontSize:13, color:'rgba(248,250,252,0.35)', marginBottom:28 }}>Your private space is ready. Say whatever. Reva is listening.</div>
        <button data-testid="beta-modal-dismiss-btn" onClick={onDismiss} style={btnPrimary}>Start Venting →</button>
      </motion.div>
    </motion.div>
  );
};

// ─── Coin toast ───────────────────────────────────────────────────────────────
const CoinToast = ({ toast }) => (
  <motion.div data-testid="coin-toast" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:10}}
    style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.25)', borderRadius:99, padding:'8px 20px', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', gap:8, fontSize:13, zIndex:150, color:'#f8fafc', whiteSpace:'nowrap' }}>
    <span style={{ color:'#a78bfa' }}>✦</span>
    <span>-{toast.deducted} coins · {toast.remaining?.toLocaleString()} remaining</span>
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  ONBOARDING FLOW SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. Splash ────────────────────────────────────────────────────────────────
const SplashScreen = ({ onDone }) => (
  <PageCenter maxW={480}>
    <div style={{ textAlign:'center' }}>
      <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} transition={{type:'spring',stiffness:180,damping:20}}
        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
        <LogoIcon size="lg"/>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:900, fontSize:56, color:'#fff', letterSpacing:-3, marginTop:24, lineHeight:1 }}>
          Re{GT('Vent')}
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, letterSpacing:4, color:'rgba(248,250,252,0.25)', textTransform:'uppercase', marginTop:12 }}>
          Re · In · Venting · Space
        </div>
      </motion.div>

      <div style={{ height:52 }}/>

      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.35,duration:0.6}}>
        <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:20, fontWeight:600, color:'rgba(248,250,252,0.7)', lineHeight:1.55 }}>
          Complain. Cry. Overreact.<br/>
          <span style={{ color:'#a78bfa' }}>We take it all.</span>
        </p>
        <p style={{ fontSize:13, color:'rgba(248,250,252,0.3)', marginTop:10 }}>
          A private emotional space powered by AI.
        </p>
      </motion.div>

      <div style={{ height:52 }}/>

      <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.55}}>
        <button data-testid="splash-begin-btn" onClick={onDone} style={btnPrimary}>
          Get Started →
        </button>
        <p style={{ fontSize:11, color:'rgba(248,250,252,0.18)', marginTop:16 }}>
          Your thoughts stay private. Always.
        </p>
      </motion.div>
    </div>
  </PageCenter>
);

// ─── 2. Auth (Login / Signup) ─────────────────────────────────────────────────
const AuthScreen = ({ onAuth }) => {
  const [mode,setMode]=useState('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const handleGoogle = () => {
    window.location.href=`https://auth.emergentagent.com/?redirect=${encodeURIComponent(window.location.origin)}`;
  };
  const handleSubmit = async () => {
    if(!email||!password){setError('Please fill in all fields');return;}
    if(mode==='signup'&&!name){setError('Please enter your alias');return;}
    setLoading(true);setError('');
    try{
      const res = await api.post(mode==='login'?'/api/auth/login':'/api/auth/register', mode==='login'?{email,password}:{email,password,name});
      onAuth(res.data);
    }catch(err){
      setError(err.response?.data?.detail||'Something went wrong. Try again.');
    }finally{setLoading(false);}
  };

  return (
    <PageCenter maxW={440}>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.5}}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}><LogoIcon size="lg"/></div>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:36, letterSpacing:-1.5, color:'#fff' }}>Re{GT('Vent')}</div>
          <div style={{ fontSize:10, letterSpacing:3, color:'rgba(248,250,252,0.25)', textTransform:'uppercase', marginTop:6 }}>Re · In · Venting · Space</div>
        </div>

        {/* Card */}
        <div style={{ ...glass, padding:'28px 24px' }}>
          {/* Tabs */}
          <div style={{ display:'flex', gap:4, padding:4, background:'rgba(255,255,255,0.04)', borderRadius:99, marginBottom:24, border:'1px solid rgba(255,255,255,0.06)' }}>
            {[['login','Sign In'],['signup','Sign Up']].map(([m,lbl])=>(
              <button data-testid={`auth-tab-${m}`} key={m} onClick={()=>{setMode(m);setError('');}} style={{ flex:1, padding:'9px 0', borderRadius:99, border:'none', background:mode===m?'rgba(167,139,250,0.15)':'none', color:mode===m?'#a78bfa':'rgba(248,250,252,0.4)', fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.2s', ...(mode===m&&{boxShadow:'0 0 0 1px rgba(167,139,250,0.3)'}) }}>{lbl}</button>
            ))}
          </div>

          {mode==='signup'&&(
            <div style={{ marginBottom:14 }}>
              <div style={label}>Your Alias</div>
              <input data-testid="auth-name-input" style={inputCss} type="text" placeholder="What should we call you?" maxLength={24} value={name} onChange={e=>setName(e.target.value)}/>
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <div style={label}>Email</div>
            <input data-testid="auth-email-input" style={inputCss} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
          </div>
          <div style={{ marginBottom:error?10:20 }}>
            <div style={label}>Password</div>
            <input data-testid="auth-password-input" style={inputCss} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
          </div>

          {error&&<p style={{ fontSize:12, color:'#f87171', marginBottom:12, textAlign:'center' }}>{error}</p>}

          <button data-testid="auth-submit-btn" onClick={handleSubmit} disabled={loading} style={{...btnPrimary,opacity:loading?0.7:1}}>
            {loading?'Please wait…':(mode==='login'?'Sign In':'Create Account')}
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0' }}>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }}/>
            <span style={{ fontSize:11, color:'rgba(248,250,252,0.25)', letterSpacing:1 }}>or</span>
            <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }}/>
          </div>

          <button data-testid="auth-google-btn" onClick={handleGoogle} style={btnSecondary}>
            <span style={{ fontWeight:800, fontSize:15, color:'#4285f4' }}>G</span>
            Continue with Google
          </button>
        </div>

        <p style={{ fontSize:11, color:'rgba(248,250,252,0.2)', textAlign:'center', marginTop:16 }}>
          Your thoughts stay private. No real info required.
        </p>
      </motion.div>
    </PageCenter>
  );
};

// ─── 3. Onboarding Slides ─────────────────────────────────────────────────────
const OnboardingScreen = ({ onDone }) => {
  const [slide,setSlide]=useState(1);

  const slides = [
    {
      accent: '#a78bfa',
      icon: '😤',
      iconBg: 'rgba(167,139,250,0.12)',
      title: '"Not everything needs to be healed."',
      body: 'Sometimes you don\'t need advice. You need someone to say,',
      highlight: '"Yeah… that was stupid."',
      sub: 'We can be nice. We can be real. We can be unfiltered.',
    },
    {
      accent: '#34d399',
      icon: '🎯',
      iconBg: 'rgba(52,211,153,0.12)',
      title: <>We {GT('know')} when to.</>,
      modes: [
        { emoji: '💙', title: 'HEAR YOU', sub: "I'll just listen." },
        { emoji: '🔥', title: 'BACK YOU', sub: "I'll match your energy." },
        { emoji: '🧠', title: 'BE REAL', sub: "I'll say what needs to be said." },
      ],
    },
    {
      accent: '#f472b6',
      icon: '✨',
      iconBg: 'rgba(244,114,182,0.12)',
      title: <>Create your {GT('own')} clans.</>,
      characters: true,
    },
  ];
  const s=slides[slide-1];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
      {/* Skip button */}
      <button data-testid="onboarding-skip-btn" onClick={onDone}
        style={{ position:'fixed', top:20, right:24, zIndex:10, background:'none', border:'none', color:'rgba(248,250,252,0.25)', fontFamily:"'DM Sans',sans-serif", fontSize:11, letterSpacing:2, textTransform:'uppercase', cursor:'pointer', padding:'8px 12px' }}>
        Skip
      </button>

      <AnimatePresence mode="wait">
        <motion.div key={slide} initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-24}} transition={{duration:0.28}}
          style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 32px 32px', maxWidth:560, width:'100%', alignSelf:'center' }}>

          {/* Icon */}
          <div style={{ width:80, height:80, borderRadius:24, background:s.iconBg, border:`1.5px solid ${s.accent}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, marginBottom:32, backdropFilter:'blur(16px)' }}>
            {s.icon}
          </div>

          {/* Title */}
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:28, color:'#fff', letterSpacing:-0.5, lineHeight:1.25, textAlign:'center', marginBottom:24, whiteSpace:'pre-line' }}>
            {s.title}
          </div>

          {/* Modes, characters, or body text */}
          {s.modes ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12, width:'100%' }}>
              {s.modes.map(m=>(
                <div key={m.title} style={{ display:'flex', alignItems:'center', gap:16, padding:'16px 20px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, backdropFilter:'blur(16px)' }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>{m.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, color:'#fff' }}>{m.title}</div>
                    <div style={{ fontSize:13, color:'rgba(248,250,252,0.5)', marginTop:2 }}>{m.sub}</div>
                  </div>
                </div>
              ))}
              <p style={{ fontSize:12, color:'rgba(248,250,252,0.25)', textAlign:'center', marginTop:8 }}>No sugarcoating unless you ask for it.</p>
            </div>
          ) : s.characters ? (
            <div style={{ display:'flex', flexDirection:'column', gap:14, width:'100%' }}>
              <p style={{ fontSize:15, lineHeight:1.7, color:'rgba(248,250,252,0.55)', textAlign:'center', marginBottom:4 }}>
                Beyond Reva, design up to <span style={{ color:'#f472b6', fontWeight:700 }}>3 custom clans</span> — each with their own vibe, traits, and energy.
              </p>
              {[
                { icon:'🤝', title:'Pick a base vibe', sub:'Close Cousin, Blunt Senior, Office Bro…' },
                { icon:'🎨', title:'Add personality traits', sub:'Funny, Savage, Wise, Soft — up to 4 traits' },
                { icon:'⚡', title:'Set the energy level', sub:'Chill to intense — you control the dial' },
              ].map(item=>(
                <div key={item.title} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:14, backdropFilter:'blur(16px)' }}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, color:'#fff' }}>{item.title}</div>
                    <div style={{ fontSize:12, color:'rgba(248,250,252,0.45)', marginTop:2 }}>{item.sub}</div>
                  </div>
                </div>
              ))}
              <p style={{ fontSize:12, color:'rgba(248,250,252,0.25)', textAlign:'center', marginTop:4 }}>You can delete and recreate anytime.</p>
            </div>
          ) : (
            <div style={{ textAlign:'center' }}>
              {s.body&&<p style={{ fontSize:16, lineHeight:1.7, color:'rgba(248,250,252,0.55)', marginBottom:8 }}>{s.body}</p>}
              {s.highlight&&<p style={{ fontSize:16, lineHeight:1.7, color:s.accent, fontWeight:600, marginBottom:16 }}>{s.highlight}</p>}
              {s.sub&&<p style={{ fontSize:14, lineHeight:1.7, color:'rgba(248,250,252,0.35)' }}>{s.sub}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 32px 36px', maxWidth:560, width:'100%', alignSelf:'center', boxSizing:'border-box' }}>
        <div style={{ display:'flex', gap:8 }}>
          {[1,2,3].map(i=>(
            <div key={i} onClick={()=>setSlide(i)} style={{ width:slide===i?28:8, height:8, borderRadius:99, background:slide===i?'#a78bfa':'rgba(255,255,255,0.15)', transition:'all 0.3s', cursor:'pointer', boxShadow:slide===i?'0 0 12px rgba(167,139,250,0.5)':'none' }}/>
          ))}
        </div>
        <button data-testid="onboarding-next-btn" onClick={()=>slide<3?setSlide(slide+1):onDone()}
          style={{ ...btnPrimary, width:'auto', padding:'12px 28px' }}>
          {slide<3?'Next →':"Let's go →"}
        </button>
      </div>
    </div>
  );
};

// ─── 4. Name Screen ───────────────────────────────────────────────────────────
const NameScreen = ({ onDone }) => {
  const [val,setVal]=useState('');
  return (
    <PageCenter maxW={440}>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4}}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:40 }}>
          <LogoIcon size="sm"/>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, letterSpacing:-0.5 }}>Re{GT('Vent')}</div>
        </div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:34, color:'#fff', letterSpacing:-0.5, lineHeight:1.2, marginBottom:10 }}>What should<br/>I call you?</div>
        <p style={{ color:'rgba(248,250,252,0.45)', fontSize:15, lineHeight:1.75, marginBottom:36 }}>No government names required.</p>
        <div style={{ marginBottom:12 }}>
          <div style={label}>Your Alias</div>
          <input data-testid="name-input" style={inputCss} type="text" placeholder="Your name… or alter ego" maxLength={24}
            value={val} onChange={e=>setVal(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&val.trim()&&onDone(val.trim())}/>
        </div>
        <button data-testid="name-continue-btn" style={btnPrimary} onClick={()=>val.trim()&&onDone(val.trim())}>Continue →</button>
        <p style={{ fontSize:11, color:'rgba(248,250,252,0.2)', textAlign:'center', marginTop:16 }}>This is your private space. No real info needed.</p>
      </motion.div>
    </PageCenter>
  );
};

// ─── 5. Language Screen ───────────────────────────────────────────────────────
const LanguageScreen = ({ onDone }) => {
  const [sel,setSel]=useState('Hindi');
  const langs=[
    { id:'English', label:'English' },
    { id:'Hindi',   label:'Hinglish' },
    { id:'Marathi', label:'मराठी + English' },
    { id:'Tamil',   label:'தமிழ் + English' },
    { id:'Kannada', label:'ಕನ್ನಡ + English' },
  ];
  return (
    <PageCenter maxW={440}>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4}}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:40 }}>
          <LogoIcon size="sm"/>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, letterSpacing:-0.5 }}>Re{GT('Vent')}</div>
        </div>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:34, color:'#fff', letterSpacing:-0.5, marginBottom:10 }}>How do you think?</div>
        <p style={{ color:'rgba(248,250,252,0.45)', fontSize:15, marginBottom:32 }}>Pick what feels natural.</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
          {langs.map(l=>(
            <div key={l.id} data-testid={`lang-option-${l.id}`} onClick={()=>setSel(l.id)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'15px 20px', background:sel===l.id?'rgba(167,139,250,0.08)':'rgba(255,255,255,0.05)', border:`1px solid ${sel===l.id?'rgba(167,139,250,0.35)':'rgba(255,255,255,0.06)'}`, borderRadius:14, cursor:'pointer', backdropFilter:'blur(16px)', transition:'all 0.2s' }}>
              <span style={{ fontFamily:"'Outfit',sans-serif", fontWeight:600, fontSize:15 }}>{l.label}</span>
              <span style={{ fontSize:16, opacity:sel===l.id?1:0, color:'#a78bfa', transition:'opacity 0.2s' }}>✓</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize:11, color:'rgba(248,250,252,0.25)', textAlign:'center', marginBottom:24 }}>You can switch anytime.</p>
        <button data-testid="lang-continue-btn" style={btnPrimary} onClick={()=>onDone(sel)}>Let's Go →</button>
      </motion.div>
    </PageCenter>
  );
};

// ─── Clan Creator ─────────────────────────────────────────────────────────────
const CharacterCreator = ({ onBack, onSave, language, editingCharacter }) => {
  const STEP_NODES = ['Persona','Identity','Traits','Character','Memory'];
  const PERSONAS_CREATOR = [
    { id:'Close Cousin',      emoji:'👨‍👩‍👧', desc:'Warm, relatable, family-like',             color:'#a78bfa' },
    { id:'Childhood Buddy',   emoji:'🎮',   desc:'Nostalgic, loyal, ride-or-die',            color:'#34d399' },
    { id:'Chill Ex',          emoji:'😎',   desc:'Detached, neutral, mature perspective',    color:'#fbbf24' },
    { id:'Blunt Senior',      emoji:'👴',   desc:'Direct, experienced, no sugar-coating',    color:'#f87171' },
    { id:'Sibling',           emoji:'👩‍❤️‍👩', desc:'Fierce, defensive, emotionally strong',   color:'#f472b6' },
    { id:'Office Bro',        emoji:'💼',   desc:'Practical, slightly sarcastic, work-aware',color:'#60a5fa' },
  ];
  const IDENTITY_SECTIONS = [
    { id:'support_style', label:'How they support you', opts:[
      { id:'hype',      emoji:'🔥', title:'Hype you up',            desc:'Always in your corner, no matter what' },
      { id:'listen',    emoji:'👂', title:'Just listen',             desc:'No fixing, no advice — just space' },
      { id:'tough',     emoji:'💪', title:'Tough love',              desc:'Calls you out when you need it' },
      { id:'humor',     emoji:'😄', title:'Laugh it off',            desc:'Makes everything feel lighter' },
    ]},
    { id:'comm_style', label:'Their signature move', opts:[
      { id:'texts',      emoji:'💬', title:'Short blunt texts',      desc:'Gets to the point, zero fluff' },
      { id:'latenight',  emoji:'🌙', title:'Late-night deep talks',  desc:'Best at 2AM when it gets real' },
      { id:'memes',      emoji:'😂', title:'Memes & reactions',      desc:'Communicates in feelings and humor' },
      { id:'voicenotes', emoji:'🎤', title:'Long voice notes',       desc:'Says everything that needs saying' },
    ]},
  ];
  const QUESTIONS = [
    { id:'meet',    type:'chips',   reva:"Tell me... how do you two know each other?",
      text:"How did you meet?",
      chips:['School / College','Work / Office','Online','Neighborhood','Family intro','Just happened'],
      skipFor:['Sibling','Close Cousin'] },
    { id:'support', type:'options', reva:"When you're having a rough day...",
      text:"What do they always say when you're stressed?",
      options:[
        { emoji:'💪', text:'"You got this. Stop doubting yourself."' },
        { emoji:'😭', text:'"Ugh same tbh. Life is rough."' },
        { emoji:'👂', text:'"Tell me everything. From the start."' },
        { emoji:'🧠', text:'"You\'re overthinking. Here\'s the plan."' },
      ] },
    { id:'secret',  type:'text',    reva:"What's something only they know about you?",
      text:"One thing only they know about you?",
      placeholder:"e.g. That I ugly cry at animated movies..." },
  ];

  // Initialize state with editingCharacter data if available
  const getInitialChar = () => {
    if (editingCharacter) {
      return {
        base_role: editingCharacter.base_role || '',
        name: editingCharacter.label || editingCharacter.name || '',
        gender: editingCharacter.gender || '',
        traits: editingCharacter.traits || [],
        energy: Math.round((editingCharacter.energy || 50) / 10),
        identity: {},
        qAnswers: {},
        story: editingCharacter.memory_hook || ''
      };
    }
    return { base_role:'', name:'', gender:'', traits:[], energy:5, identity:{}, qAnswers:{}, story:'' };
  };

  const [step, setStep] = useState(editingCharacter ? 1 : 1);
  const [qIdx, setQIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [char, setChar] = useState(getInitialChar);
  const isEditing = !!editingCharacter;

  const avatarColor = ROLE_COLORS[char.base_role] || '#a78bfa';
  const avatarPersona = PERSONAS_CREATOR.find(p=>p.id===char.base_role);
  const energyDesc = char.energy<=3 ? 'Low-key, calm, mostly observant.' : char.energy<=6 ? 'Balanced — calm but present.' : 'High-energy, expressive, always in motion.';

  const toggleTrait=(id)=>setChar(prev=>{
    if(prev.traits.includes(id)) return {...prev,traits:prev.traits.filter(t=>t!==id)};
    if(prev.traits.length>=5) return prev;
    return {...prev,traits:[...prev.traits,id]};
  });
  const setIdentity=(sid,oid)=>setChar(prev=>({...prev,identity:{...prev.identity,[sid]:oid}}));

  const canAdvance=()=>{
    if(step===1) return !!char.base_role;
    if(step===2) return !!char.name.trim() && !!char.gender;
    if(step===3) return char.traits.length>=2;
    if(step===4) return true;
    if(step===5){
      const q=QUESTIONS[qIdx];
      if(q.type==='chips') return !!char.qAnswers[q.id];
      if(q.type==='options') return !!char.qAnswers[q.id];
      if(q.type==='text') return (char.qAnswers[q.id]||'').trim().length>=3;
    }
    return true;
  };

  const handleBack=()=>{
    if(step===1){ onBack(); return; }
    if(step===5 && qIdx>0){ setQIdx(p=>p-1); return; }
    setStep(p=>p-1);
  };

  const handleNext=async()=>{
    if(step<4){ setStep(p=>p+1); return; }
    if(step===4){ setStep(5); setQIdx(0); return; }
    if(step===5){
      const filteredQuestions = QUESTIONS.filter(q => !q.skipFor || !q.skipFor.includes(char.base_role));
      if(qIdx<filteredQuestions.length-1){ setQIdx(p=>p+1); return; }
      await runAIGenerate(); return;
    }
  };

  const runAIGenerate=async()=>{
    setStep(6);
    const habits=Object.entries(char.identity).map(([sid,oid])=>{
      const sect=IDENTITY_SECTIONS.find(s=>s.id===sid);
      return sect?.opts.find(o=>o.id===oid)?.title||'';
    }).filter(Boolean);
    const draft=`${char.name} is a ${char.base_role} clan. Traits: ${char.traits.join(', ')}. Energy: ${char.energy}/10. Style: ${habits.join(', ')}. Background: ${Object.values(char.qAnswers).filter(v=>typeof v==='string').join('. ')}.`;
    try{
      const res=await api.post('/api/refine-backstory',{draft_text:draft,language});
      setChar(prev=>({...prev,story:res.data.refined_text}));
    }catch{
      setChar(prev=>({...prev,story:`${char.name} is the kind of person who shows up — not just when things are good, but especially when they're not.`}));
    }
    setStep(7);
  };

  const saveAndActivate=async()=>{
    setSaving(true);
    const habitsList=Object.entries(char.identity).map(([sid,oid])=>{
      const sect=IDENTITY_SECTIONS.find(s=>s.id===sid);
      return sect?.opts.find(o=>o.id===oid)?.title||'';
    }).filter(Boolean);
    try{
      const payload = {
        base_role:char.base_role, traits:char.traits, energy:char.energy*10,
        quirks:habitsList, memory_hook:char.story, label:char.name, name:char.name, gender:char.gender,
      };
      let res;
      if (isEditing && editingCharacter?.character_id) {
        // Update existing character
        res = await api.put(`/api/characters/${editingCharacter.character_id}`, payload);
      } else {
        // Create new character
        res = await api.post('/api/characters', payload);
      }
      onSave(res.data);
    }catch(err){ alert(err.response?.data?.detail||'Failed to save. Try again.'); }
    finally{ setSaving(false); }
  };

  // Shared creator styles
  const sLbl={ fontSize:10, letterSpacing:2.2, textTransform:'uppercase', color:'rgba(167,139,250,0.7)', fontFamily:"'DM Sans',sans-serif", fontWeight:500, marginBottom:8 };
  const glCard={ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:18 };
  const glCardSm={ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14 };
  const btnContinue={ width:'100%', padding:'14px 24px', background:'linear-gradient(135deg,#a78bfa,#60a5fa,#34d399)', color:'#fff', border:'none', borderRadius:14, fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:15, cursor:'pointer' };
  const btnBackStyle={ padding:'12px 20px', background:'transparent', border:'1px solid rgba(255,255,255,0.10)', borderRadius:999, color:'rgba(248,250,252,0.55)', fontFamily:"'Outfit',sans-serif", fontWeight:500, fontSize:14, cursor:'pointer', flexShrink:0 };
  const gradText={ background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.9)', backdropFilter:'blur(20px)', flexShrink:0 }}>
        <LogoIcon size="sm"/>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:15, ...gradText }}>
            {step===6?`Building ${char.name||'Clan'}…`:step===7?`Your Clan`:isEditing?'Edit Your Clan':'Create Your Clan'}
          </div>
        </div>
        {step<=5&&<div style={{ fontSize:11, color:'rgba(248,250,252,0.3)' }}>Step {step} of 5</div>}
        {/* Cancel button */}
        <button data-testid="creator-cancel-btn" onClick={onBack} title="Cancel and go back"
          style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(248,113,113,0.8)', fontSize:16, cursor:'pointer', flexShrink:0 }}>×</button>
      </div>

      {/* Step node progress (steps 1-5) */}
      {step<=5&&(
        <div style={{ display:'flex', alignItems:'flex-start', padding:'10px 16px 8px', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'rgba(10,5,22,0.5)', flexShrink:0, overflowX:'auto' }}>
          {STEP_NODES.map((lbl,idx)=>{
            const ns=idx+1; const isDone=step>ns; const isActive=step===ns;
            return (
              <React.Fragment key={lbl}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
                    border:isDone?'none':`1px solid ${isActive?'#a78bfa':'rgba(255,255,255,0.08)'}`,
                    background:isDone?'linear-gradient(135deg,#a78bfa,#34d399)':isActive?'rgba(167,139,250,0.15)':'rgba(255,255,255,0.04)',
                    color:isDone?'#fff':isActive?'#a78bfa':'rgba(248,250,252,0.25)' }}>
                    {isDone?'✓':ns}
                  </div>
                  <div style={{ fontSize:8, color:isActive?'#a78bfa':isDone?'rgba(248,250,252,0.5)':'rgba(248,250,252,0.2)', letterSpacing:0.3, whiteSpace:'nowrap' }}>{lbl}</div>
                </div>
                {idx<STEP_NODES.length-1&&(
                  <div style={{ flex:1, height:1, margin:'13px 4px 0', background:isDone?'linear-gradient(90deg,#a78bfa,#34d399)':'rgba(255,255,255,0.06)' }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={`${step}-${qIdx}`} initial={{opacity:0,x:14}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-14}} transition={{duration:0.18}}>

            {/* Step 1 — Persona */}
            {step===1&&(
              <div style={{ paddingTop:16 }}>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:5 }}>Who is <span style={gradText}>Reva</span> to you?</div>
                <div style={{ fontSize:13, color:'rgba(248,250,252,0.45)', marginBottom:16, lineHeight:1.5 }}>Pick a relationship type. This sets the entire tone of how Reva will show up for you.</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {PERSONAS_CREATOR.map(p=>(
                    <div key={p.id} onClick={()=>setChar(prev=>({...prev,base_role:p.id}))}
                      style={{ ...glCard, padding:'14px 12px', cursor:'pointer', position:'relative', transition:'all 0.2s',
                        ...(char.base_role===p.id?{border:`1px solid ${p.color}70`,background:`${p.color}18`}:{}) }}>
                      {char.base_role===p.id&&<div style={{ position:'absolute', top:8, right:8, width:18, height:18, borderRadius:'50%', background:'linear-gradient(135deg,#a78bfa,#34d399)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontWeight:700 }}>✓</div>}
                      <div style={{ fontSize:26, marginBottom:6 }}>{p.emoji}</div>
                      <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:12, color:'#fff', marginBottom:3 }}>{p.id}</div>
                      <div style={{ fontSize:10, color:'rgba(248,250,252,0.35)', lineHeight:1.4 }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Name + Gender */}
            {step===2&&(
              <div style={{ paddingTop:16 }}>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:5 }}>Name your <span style={gradText}>Clan</span></div>
                <div style={{ fontSize:13, color:'rgba(248,250,252,0.45)', marginBottom:20, lineHeight:1.5 }}>Give your clan a name and pick a gender. This shapes how Reva speaks and refers to itself.</div>
                <div style={sLbl}>What do you call them?</div>
                <input value={char.name} onChange={e=>setChar(prev=>({...prev,name:e.target.value}))} style={{ ...inputCss, marginBottom:6 }} type="text" placeholder="e.g. Rahul, Priya, Arjun, Meera…" maxLength={24}/>
                <div style={{ fontSize:11, color:'rgba(248,250,252,0.25)', marginBottom:20, paddingLeft:2 }}>Keep it personal — use a real name or nickname</div>
                <div style={sLbl}>Gender of this clan</div>
                <div style={{ display:'flex', gap:10 }}>
                  {GENDER_OPTIONS.map(opt=>(
                    <div key={opt.id} onClick={()=>setChar(prev=>({...prev,gender:opt.id}))}
                      style={{ flex:1, padding:'14px 10px', borderRadius:12, border:`1px solid ${char.gender===opt.id?'#a78bfa':'rgba(255,255,255,0.08)'}`, background:char.gender===opt.id?'rgba(167,139,250,0.12)':'rgba(255,255,255,0.03)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5, transition:'all 0.2s' }}>
                      <span style={{ fontSize:24 }}>{opt.emoji}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:char.gender===opt.id?'#a78bfa':'rgba(248,250,252,0.45)', fontFamily:"'Outfit',sans-serif" }}>{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — Traits + Energy */}
            {step===3&&(
              <div style={{ paddingTop:16 }}>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:5 }}>Pick <span style={gradText}>their traits</span></div>
                <div style={{ fontSize:13, color:'rgba(248,250,252,0.45)', marginBottom:10, lineHeight:1.5 }}>Choose 2–5 traits that define how this clan communicates.</div>
                <div style={{ fontSize:12, color:'rgba(167,139,250,0.7)', marginBottom:12 }}>{char.traits.length} of 5 selected</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
                  {TRAITS.map(t=>{
                    const isSel=char.traits.includes(t.id);
                    const isOff=!isSel&&char.traits.length>=5;
                    return (
                      <div key={t.id} onClick={()=>!isOff&&toggleTrait(t.id)}
                        style={{ padding:'8px 14px', borderRadius:99, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5,
                          cursor:isOff?'not-allowed':'pointer', transition:'all 0.15s', opacity:isOff?0.3:1,
                          border:`1px solid ${isSel?'rgba(167,139,250,0.6)':'rgba(255,255,255,0.08)'}`,
                          background:isSel?'rgba(167,139,250,0.13)':'rgba(255,255,255,0.04)',
                          color:isSel?'#fff':'rgba(248,250,252,0.45)' }}>
                        <span>{t.emoji}</span>{t.id}
                      </div>
                    );
                  })}
                </div>
                <div style={sLbl}>Energy level</div>
                <div style={{ ...glCardSm, padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:11, color:'rgba(248,250,252,0.35)', flexShrink:0 }}>Low</span>
                    <input type="range" min="1" max="10" value={char.energy} onChange={e=>setChar(prev=>({...prev,energy:parseInt(e.target.value)}))} style={{ flex:1, accentColor:'#a78bfa', cursor:'pointer' }}/>
                    <span style={{ fontSize:13, fontWeight:700, color:'#a78bfa', minWidth:18, textAlign:'right' }}>{char.energy}</span>
                    <span style={{ fontSize:11, color:'rgba(248,250,252,0.35)', flexShrink:0 }}>High</span>
                  </div>
                  <div style={{ fontSize:11, color:'rgba(248,250,252,0.4)' }}>{energyDesc}</div>
                </div>
                <div style={sLbl}>Reva's read on your choices</div>
                <div style={{ ...glCardSm, padding:'14px 16px', fontSize:12, color:char.traits.length>=2?'rgba(248,250,252,0.65)':'rgba(248,250,252,0.25)' }}>
                  {char.traits.length>=2
                    ? `${char.name||'Your clan'} comes through as ${char.traits.slice(0,3).join(', ')} with energy at ${char.energy}/10. This clan shows up with intention.`
                    : 'Select at least 2 traits to see your clan come to life…'}
                </div>
              </div>
            )}

            {/* Step 4 — Character Identity */}
            {step===4&&(
              <div style={{ paddingTop:16 }}>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:5 }}>Character <span style={gradText}>identity</span></div>
                <div style={{ fontSize:13, color:'rgba(248,250,252,0.45)', marginBottom:18, lineHeight:1.5 }}>What are their signature habits? These make Reva feel like a real person, not just an AI.</div>
                {IDENTITY_SECTIONS.map(section=>(
                  <div key={section.id} style={{ marginBottom:20 }}>
                    <div style={sLbl}>{section.label}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {section.opts.map(opt=>{
                        const isSel=char.identity[section.id]===opt.id;
                        return (
                          <div key={opt.id} onClick={()=>setIdentity(section.id,opt.id)}
                            style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', transition:'all 0.2s',
                              border:`1px solid ${isSel?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.07)'}`,
                              background:isSel?'rgba(167,139,250,0.10)':'rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{opt.emoji}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:600, fontSize:13, color:isSel?'#fff':'rgba(248,250,252,0.75)', marginBottom:2 }}>{opt.title}</div>
                              <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>{opt.desc}</div>
                            </div>
                            <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, marginTop:2, display:'flex', alignItems:'center', justifyContent:'center',
                              background:isSel?'linear-gradient(135deg,#a78bfa,#34d399)':'rgba(255,255,255,0.06)',
                              border:`1px solid ${isSel?'transparent':'rgba(255,255,255,0.12)'}` }}>
                              {isSel&&<span style={{ fontSize:9, color:'#fff', fontWeight:700 }}>✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 5 — Memory Hook Q&A */}
            {step===5&&(()=>{
              const filteredQuestions = QUESTIONS.filter(q => !q.skipFor || !q.skipFor.includes(char.base_role));
              const q = filteredQuestions[qIdx];
              if (!q) return null;
              
              // Filter chips based on persona
              let displayChips = q.chips;
              if (q.id === 'meet' && char.base_role === 'Childhood Buddy') {
                displayChips = q.chips.filter(c => c !== 'Work / Office');
              }
              
              return (
                <div style={{ paddingTop:16 }}>
                  <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:5 }}>Build the <span style={gradText}>memory</span></div>
                  <div style={{ fontSize:13, color:'rgba(248,250,252,0.45)', marginBottom:14 }}>A few quick questions. Reva uses these to feel real — not scripted.</div>
                  <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, marginBottom:6, overflow:'hidden' }}>
                    <motion.div animate={{ width:`${((qIdx+1)/filteredQuestions.length)*100}%` }} style={{ height:'100%', background:'linear-gradient(90deg,#a78bfa,#34d399)', borderRadius:99 }}/>
                  </div>
                  <div style={{ fontSize:11, color:'rgba(248,250,252,0.3)', textAlign:'right', marginBottom:14 }}>Question {qIdx+1} of {filteredQuestions.length}</div>
                  <div style={{ background:'rgba(167,139,250,0.08)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
                    <div style={{ fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'rgba(167,139,250,0.6)', marginBottom:4 }}>Reva says</div>
                    <div style={{ fontSize:13, color:'rgba(248,250,252,0.7)', lineHeight:1.5 }}>{q.reva}</div>
                  </div>
                  <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:600, fontSize:14, color:'#fff', marginBottom:12 }}>{q.text}</div>
                  {q.type==='chips'&&(
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {displayChips.map(chip=>{
                        const isSel=char.qAnswers[q.id]===chip;
                        return (
                          <div key={chip} onClick={()=>setChar(prev=>({...prev,qAnswers:{...prev.qAnswers,[q.id]:chip}}))}
                            style={{ padding:'8px 14px', borderRadius:99, fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 0.15s',
                              border:`1px solid ${isSel?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.08)'}`,
                              background:isSel?'rgba(167,139,250,0.12)':'rgba(255,255,255,0.04)',
                              color:isSel?'#fff':'rgba(248,250,252,0.5)' }}>
                            {chip}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.type==='options'&&(
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {q.options.map(opt=>{
                        const isSel=char.qAnswers[q.id]===opt.text;
                        return (
                          <div key={opt.text} onClick={()=>setChar(prev=>({...prev,qAnswers:{...prev.qAnswers,[q.id]:opt.text}}))}
                            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, cursor:'pointer', transition:'all 0.2s',
                              border:`1px solid ${isSel?'rgba(167,139,250,0.5)':'rgba(255,255,255,0.07)'}`,
                              background:isSel?'rgba(167,139,250,0.12)':'rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize:18, flexShrink:0 }}>{opt.emoji}</span>
                            <span style={{ flex:1, fontSize:13, color:isSel?'#fff':'rgba(248,250,252,0.6)' }}>{opt.text}</span>
                            <div style={{ width:16, height:16, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                              background:isSel?'linear-gradient(135deg,#a78bfa,#34d399)':'rgba(255,255,255,0.06)',
                              border:`1px solid ${isSel?'transparent':'rgba(255,255,255,0.12)'}` }}>
                              {isSel&&<span style={{ fontSize:8, color:'#fff' }}>✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.type==='text'&&(
                    <textarea value={char.qAnswers[q.id]||''} onChange={e=>setChar(prev=>({...prev,qAnswers:{...prev.qAnswers,[q.id]:e.target.value}}))}
                      style={{ ...inputCss, minHeight:100, resize:'none', lineHeight:1.6 }} placeholder={q.placeholder}/>
                  )}
                </div>
              );
            })()}

            {/* Step 6 — AI Generating */}
            {step===6&&(
              <div style={{ paddingTop:40, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:300, gap:20 }}>
                <div style={{ position:'relative', width:100, height:100 }}>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'linear-gradient(135deg,#a78bfa,#34d399)', opacity:0.15 }}/>
                  <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:'linear' }}
                    style={{ position:'absolute', inset:4, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#a78bfa', borderRightColor:'#34d399' }}/>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>✨</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:18, color:'#fff', marginBottom:6 }}>{char.name||'Reva'} is being born…</div>
                  <div style={{ fontSize:13, color:'rgba(248,250,252,0.4)' }}>Weaving your backstory with AI</div>
                </div>
              </div>
            )}

            {/* Step 7 — Complete */}
            {step===7&&(
              <div style={{ paddingTop:16 }}>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:22, color:'#fff', marginBottom:4 }}>
                  <span style={gradText}>Meet {char.name}.</span> 🎉
                </div>
                <div style={{ fontSize:13, color:'rgba(248,250,252,0.45)', marginBottom:16 }}>Your clan is ready. Here's who they are.</div>
                <div style={{ ...glCard, padding:'20px 18px', marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                    <div style={{ width:52, height:52, borderRadius:'50%', background:`${avatarColor}25`, border:`2px solid ${avatarColor}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
                      {avatarPersona?.emoji||'✨'}
                    </div>
                    <div>
                      <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:20, background:`linear-gradient(90deg,${avatarColor},#34d399)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{char.name}</div>
                      <div style={{ fontSize:11, color:'rgba(248,250,252,0.4)', marginTop:2 }}>{char.base_role} · {char.gender} · Energy {char.energy}/10</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                    {char.traits.map(t=>(
                      <span key={t} style={{ padding:'4px 10px', borderRadius:99, background:`${avatarColor}18`, border:`1px solid ${avatarColor}40`, fontSize:11, color:'rgba(248,250,252,0.75)' }}>
                        {TRAITS.find(x=>x.id===t)?.emoji} {t}
                      </span>
                    ))}
                  </div>
                  {char.story&&<div style={{ fontSize:13, color:'rgba(248,250,252,0.55)', lineHeight:1.7, padding:'12px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>{char.story}</div>}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={()=>{ setStep(1); setChar({base_role:'',name:'',gender:'',traits:[],energy:5,identity:{},qAnswers:{},story:''}); setQIdx(0); }}
                    style={{ ...btnBackStyle, flex:1, textAlign:'center' }}>Start over</button>
                  <button data-testid="launch-character-btn" onClick={saveAndActivate} disabled={saving}
                    style={{ ...btnContinue, flex:2, opacity:saving?0.7:1 }}>{saving?'Activating…':'Activate Clan ✨'}</button>
                </div>
                <div style={{ height:16 }}/>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav (steps 1–5 only) */}
      {step<=5&&(
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.9)', backdropFilter:'blur(16px)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleBack} style={btnBackStyle}>← Back</button>
            <button onClick={handleNext} disabled={!canAdvance()}
              style={{ ...btnContinue, flex:1, opacity:canAdvance()?1:0.35, cursor:canAdvance()?'pointer':'not-allowed' }}>
              {(()=>{
                const filteredQs = QUESTIONS.filter(q => !q.skipFor || !q.skipFor.includes(char.base_role));
                return step===5&&qIdx===filteredQs.length-1?'✨ Build my Clan':'Continue →';
              })()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Chat Bubbles ─────────────────────────────────────────────────────────────
const ChatBubble = ({ msg, isDesktop }) => {
  const meta = msg.mode ? modeMeta[msg.mode] : null;
  // Color scheme for different modes
  const modeColors = {
    BACK_ME: '#f87171',  // Red
    HEAR_ME: '#60a5fa',  // Blue
    BE_REAL: '#c084fc',  // Purple
    VAULT:   '#9ca3af',  // Gray
    CRISIS:  '#fbbf24',  // Yellow
    AUTO:    '#34d399',  // Green
  };
  const modeColor = msg.mode ? modeColors[msg.mode] : modeColors.AUTO;
  const isCrisisBubble = msg.role === 'ai' && msg.mode === 'CRISIS';
  const bubblePadding = isDesktop ? '12px 16px' : '10px 12px';
  const bubbleFontSize = isDesktop ? 14 : 13;
  const bubbleMaxWidth = isDesktop ? '82%' : '92%';
  const bubbleAlign = msg.role==='user' ? 'flex-end' : 'flex-start';
  const timestamp = formatTimestamp(msg.timestamp);
  const [hovered,setHovered] = useState(false);

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{type:'spring',stiffness:280,damping:28}}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{ display:'flex', flexDirection:'column', maxWidth:bubbleMaxWidth, alignSelf:bubbleAlign, position:'relative' }}>
      {timestamp&&(
        <div style={{ position:'absolute', top:-20, right:0, fontSize:10, color:'rgba(248,250,252,0.45)', opacity:hovered?1:0, transition:'opacity 0.2s', whiteSpace:'nowrap' }}>
          {timestamp}
        </div>
      )}
      {msg.role==='ai'&&meta&&(
        <div style={{ fontSize:10, letterSpacing:1.2, textTransform:'uppercase', marginBottom:5, paddingLeft:2 }}>
          <span style={{ color:'rgba(248,250,252,0.4)' }}>Reva · </span>
          <span style={{ color: modeColor, fontWeight:600 }}>{meta.label}</span>
        </div>
      )}
      {isCrisisBubble&&(
        <div style={{ marginBottom:8, padding:'10px 14px', borderRadius:10, background:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.35)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#fff', letterSpacing:0.3, marginBottom:4 }}>
            Please reach out — you don't have to go through this alone.
          </div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', lineHeight:1.6 }}>
            iCall: <span style={{ color:'#fff', fontWeight:600 }}>9152987821</span>{'  '}·{'  '}
            Vandrevala Foundation: <span style={{ color:'#fff', fontWeight:600 }}>1860-2662-345</span>
          </div>
        </div>
      )}
      {msg.role==='user'&&<div style={{ fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(248,250,252,0.25)', marginBottom:4, textAlign:'left', paddingLeft:2 }}>You</div>}
      <div style={{ padding:bubblePadding, fontSize:bubbleFontSize, lineHeight:1.7, backdropFilter:'blur(16px)', whiteSpace:'pre-wrap',
        ...(msg.role==='user'
          ?{background:'rgba(167,139,250,0.15)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:14}
          :msg.role==='system'
            ?{background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',borderRadius:12}
            :{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'2px 14px 14px 14px'})
      }}>{msg.content}</div>
    </motion.div>
  );
};
const GossipBubble = ({ msg, isDesktop }) => {
  const timestamp = formatTimestamp(msg.timestamp);
  const [hovered,setHovered]=useState(false);
  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{type:'spring',stiffness:280,damping:28}}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ display:'flex', flexDirection:'column', maxWidth:isDesktop ? '82%' : '95%', alignSelf:'flex-start', position:'relative' }}>
      {timestamp&&(
        <div style={{ position:'absolute', top:-18, right:0, fontSize:10, color:'rgba(248,250,252,0.45)', opacity:hovered?1:0, transition:'opacity 0.2s' }}>{timestamp}</div>
      )}
      {msg.role==='ai'&&(
        <div style={{ fontSize:10, letterSpacing:1.2, textTransform:'uppercase', marginBottom:5 }}>
          <span style={{ color:'rgba(251,191,36,0.5)' }}>Reva · </span>
          <span style={{ color:'#fbbf24', fontWeight:600 }}>GOSSIP</span>
        </div>
      )}
      {msg.role==='user'&&<div style={{ fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(248,250,252,0.25)', marginBottom:4, textAlign:'left' }}>You</div>}
      <div style={{ padding:isDesktop ? '12px 16px' : '10px 12px', fontSize:isDesktop ? 14 : 13, lineHeight:1.7, backdropFilter:'blur(16px)',
        ...(msg.role==='user'?{background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.22)',borderRadius:14}:{background:'rgba(251,191,36,0.04)',border:'1px solid rgba(251,191,36,0.12)',borderRadius:'2px 14px 14px 14px'})
      }}>{msg.content}</div>
    </motion.div>
  );
};

// ─── Emotion Bar ──────────────────────────────────────────────────────────────
const EmotionBar = ({ onEmotion, manualMode, isDesktop }) => {
  const [active,setActive]=useState(null);
  const handle=(item)=>{ setActive(item.emoji); onEmotion(item.mode); setTimeout(()=>setActive(null),800); };
  return (
    <div data-testid="emotion-bar" style={{ display:'flex', alignItems:'center', gap:4, padding: isDesktop ? '8px 14px' : '6px 10px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(10,5,22,0.6)', overflowX:'auto', flexShrink:0 }}>
      {EMOTION_ITEMS.map(item=>(
        <motion.button key={item.emoji} onClick={()=>handle(item)} whileTap={{scale:0.8}} title={item.label}
          style={{ width: isDesktop ? 38 : 34, height: isDesktop ? 38 : 34, borderRadius: isDesktop ? 10 : 9, border:`1px solid ${active===item.emoji?'rgba(167,139,250,0.4)':'rgba(255,255,255,0.06)'}`, background:active===item.emoji?'rgba(167,139,250,0.15)':'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize: isDesktop ? 18 : 16, flexShrink:0, transition:'all 0.15s' }}>
          {item.emoji}
        </motion.button>
      ))}
      <div style={{ marginLeft:'auto', fontSize: isDesktop ? 9 : 8, color:'rgba(255,255,255,0.2)', letterSpacing:1, textTransform:'uppercase', whiteSpace:'nowrap', paddingLeft:8 }}>
        {manualMode==='AUTO'?'auto mode':modeMeta[manualMode]?.label}
      </div>
    </div>
  );
};

// ─── Character Tab Strip ──────────────────────────────────────────────────────
const CharacterTabStrip = ({ activeVibe, setActiveVibe, onOpenCreator, characters }) => {
  const canCreate = characters.length < 3;
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'0 4px', scrollbarWidth:'none', flexShrink:0 }}>
      {/* RE default */}
      <motion.button data-testid="vibe-tab-default" onClick={()=>setActiveVibe('default')} whileTap={{scale:0.9}}
        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 8px', borderRadius:12, border:`1.5px solid ${activeVibe==='default'?'#a78bfa60':'rgba(255,255,255,0.07)'}`, background:activeVibe==='default'?'#a78bfa18':'rgba(255,255,255,0.04)', cursor:'pointer', minWidth:54, transition:'all 0.2s', flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:'50%', background:activeVibe==='default'?'#a78bfa25':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, border:`1px solid ${activeVibe==='default'?'#a78bfa50':'rgba(255,255,255,0.08)'}` }}>🤖</div>
        <span style={{ fontSize:9, fontWeight:600, color:activeVibe==='default'?'#a78bfa':'rgba(248,250,252,0.4)', letterSpacing:0.5, whiteSpace:'nowrap' }}>Reva</span>
      </motion.button>
      {/* User characters */}
      {characters.map(c=>{
        const color = ROLE_COLORS[c.base_role]||'#a78bfa';
        const icon = BASE_ROLES.find(r=>r.id===c.base_role)?.icon||'✨';
        return (
          <motion.button key={c.character_id} data-testid={`vibe-tab-${c.character_id}`} onClick={()=>setActiveVibe(c.character_id)} whileTap={{scale:0.9}}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 8px', borderRadius:12, border:`1.5px solid ${activeVibe===c.character_id?color+'60':'rgba(255,255,255,0.07)'}`, background:activeVibe===c.character_id?color+'18':'rgba(255,255,255,0.04)', cursor:'pointer', minWidth:54, transition:'all 0.2s', flexShrink:0 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:activeVibe===c.character_id?color+'25':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, border:`1px solid ${activeVibe===c.character_id?color+'50':'rgba(255,255,255,0.08)'}` }}>{icon}</div>
            <span style={{ fontSize:9, fontWeight:600, color:activeVibe===c.character_id?color:'rgba(248,250,252,0.4)', letterSpacing:0.5, whiteSpace:'nowrap', maxWidth:50, overflow:'hidden', textOverflow:'ellipsis' }}>{c.label||c.base_role}</span>
          </motion.button>
        );
      })}
      {canCreate&&(
        <motion.button data-testid="create-character-btn" onClick={onOpenCreator} whileTap={{scale:0.9}}
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 8px', borderRadius:12, border:'1.5px dashed rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.02)', cursor:'pointer', minWidth:54, flexShrink:0 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'rgba(255,255,255,0.3)' }}>+</div>
          <span style={{ fontSize:9, fontWeight:600, color:'rgba(248,250,252,0.25)', letterSpacing:0.5, whiteSpace:'nowrap' }}>Create</span>
        </motion.button>
      )}
    </div>
  );
};

// ─── Gossip Floating Button ───────────────────────────────────────────────────
const GossipFloatingBtn = ({ onClick, isDesktop }) => (
  <motion.button data-testid="gossip-floating-btn" onClick={onClick} whileHover={{scale:1.05}} whileTap={{scale:0.95}}
    style={{ position:'absolute', right:14, bottom: isDesktop ? 68 : 8, zIndex:10, width: isDesktop ? 60 : 48, height: isDesktop ? 60 : 48, borderRadius: isDesktop ? 16 : 14, background:'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.1))', border:'1.5px solid rgba(251,191,36,0.35)', backdropFilter:'blur(16px)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, cursor:'pointer', boxShadow:'0 4px 20px rgba(251,191,36,0.2)' }}>
    <span style={{ fontSize: isDesktop ? 22 : 18 }}>🤫</span>
    <span style={{ fontSize:7, fontWeight:700, color:'#fbbf24', letterSpacing:0.5, fontFamily:"'Outfit',sans-serif", textTransform:'uppercase' }}>Gossip</span>
  </motion.button>
);

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
const DesktopSidebar = ({ authUser, activeVibe, setActiveVibe, characters, onOpenCreator, onDeleteCharacter, onEditCharacter, onOpenSettings, onOpenGossip, language, setLanguage, startNewSession, chatSessions, activeSessionId, onSwitchSession, onDeleteSession, onRenameSession }) => {
  // Companions = chat sessions (max 2)
  const companions = chatSessions || [];
  const canCreateCompanion = companions.length < 2;
  
  // Clans = characters (max 3)
  const canCreateClan = characters.length < 3;
  
  // State for renaming companions
  const [renamingId, setRenamingId] = React.useState(null);
  const [renameVal, setRenameVal] = React.useState('');
  const [showNewCompanionInput, setShowNewCompanionInput] = React.useState(false);
  const [newCompanionName, setNewCompanionName] = React.useState('');

  const handleRenameStart = (s) => { setRenamingId(s.session_id); setRenameVal(s.title||'Companion'); };
  const handleRenameSubmit = (sid) => { onRenameSession(sid, renameVal); setRenamingId(null); };
  const handleNewCompanion = () => {
    if(!canCreateCompanion){ return; }
    setShowNewCompanionInput(true); setNewCompanionName('');
  };
  const handleNewCompanionSubmit = () => {
    const t = newCompanionName.trim() || 'New Companion';
    startNewSession(t); setShowNewCompanionInput(false); setNewCompanionName('');
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', padding:'20px 16px', overflowY:'auto', borderRight:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.6)', backdropFilter:'blur(20px)' }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:24, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <LogoIcon size="sm"/>
        <div>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:16, background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ReVent</div>
          <div style={{ fontSize:8, color:'rgba(248,250,252,0.2)', letterSpacing:2, textTransform:'uppercase' }}>Re · In · Venting · Space</div>
        </div>
      </div>
      
      {/* User info */}
      {authUser&&(
        <div style={{ padding:'16px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>😤</div>
            <div>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, color:'#fff' }}>{authUser.name}</div>
              <div style={{ fontSize:10, color:'rgba(248,250,252,0.35)' }}>Beta Tester</div>
            </div>
          </div>
          <CoinBadge coins={authUser.coins} onClick={onOpenSettings}/>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════════
          COMPANIONS SECTION (Chat Sessions) - Max 2
      ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(52,211,153,0.6)', textTransform:'uppercase', marginTop:16, marginBottom:10 }}>Companions</div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {companions.map(s=>{
          const isActive = s.session_id === activeSessionId;
          return (
            <div key={s.session_id} style={{ display:'flex', alignItems:'center', gap:0 }}>
              {renamingId===s.session_id?(
                <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                  onBlur={()=>handleRenameSubmit(s.session_id)}
                  onKeyDown={e=>{ if(e.key==='Enter')handleRenameSubmit(s.session_id); if(e.key==='Escape')setRenamingId(null); }}
                  style={{ flex:1, background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:'10px 0 0 10px', outline:'none', color:'#fff', fontSize:12, padding:'10px 12px', fontFamily:"'Outfit',sans-serif" }}/>
              ):(
                <motion.button data-testid={`sidebar-companion-${s.session_id}`} onClick={()=>onSwitchSession(s.session_id)} whileTap={{scale:0.97}}
                  style={{ flex:1, display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'10px 0 0 10px', border:`1px solid ${isActive?'rgba(52,211,153,0.35)':'rgba(255,255,255,0.05)'}`, borderRight:'none', background:isActive?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)', cursor:'pointer', transition:'all 0.2s', textAlign:'left' }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:isActive?'rgba(52,211,153,0.2)':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>💬</div>
                  <span style={{ fontSize:12, fontWeight:isActive?600:400, color:isActive?'#fff':'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title||'Companion'}</span>
                  {isActive&&<span style={{ marginLeft:'auto', color:'#34d399', fontSize:10 }}>●</span>}
                </motion.button>
              )}
              {/* Edit button */}
              <button onClick={()=>handleRenameStart(s)} title="Edit name"
                style={{ padding:'10px 8px', border:`1px solid ${isActive?'rgba(52,211,153,0.35)':'rgba(255,255,255,0.05)'}`, borderLeft:'none', borderRight:'none', background:isActive?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:11, color:'rgba(167,139,250,0.6)', transition:'all 0.2s', display:'flex', alignItems:'center' }}>✎</button>
              {/* Delete button */}
              <button data-testid={`delete-companion-${s.session_id}`} onClick={()=>onDeleteSession(s.session_id)} title="Delete companion"
                style={{ padding:'10px 8px', borderRadius:'0 10px 10px 0', border:`1px solid ${isActive?'rgba(52,211,153,0.35)':'rgba(255,255,255,0.05)'}`, borderLeft:'none', background:isActive?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:12, color:'rgba(248,113,113,0.6)', transition:'all 0.2s', display:'flex', alignItems:'center' }}>×</button>
            </div>
          );
        })}
        
        {/* Create Companion button - only visible when < 2 */}
        {showNewCompanionInput?(
          <div style={{ display:'flex', gap:4, marginTop:4 }}>
            <input autoFocus value={newCompanionName} onChange={e=>setNewCompanionName(e.target.value)} placeholder="Companion name…"
              onKeyDown={e=>{ if(e.key==='Enter')handleNewCompanionSubmit(); if(e.key==='Escape'){setShowNewCompanionInput(false);} }}
              style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:8, padding:'8px 10px', color:'#fff', fontSize:12, outline:'none', fontFamily:"'Outfit',sans-serif" }}/>
            <button onClick={handleNewCompanionSubmit} style={{ background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:8, color:'#34d399', fontSize:12, padding:'0 12px', cursor:'pointer' }}>+</button>
          </div>
        ):canCreateCompanion&&(
          <motion.button data-testid="sidebar-create-companion-btn" onClick={handleNewCompanion} whileTap={{scale:0.97}}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:10, border:'1px dashed rgba(52,211,153,0.3)', background:'transparent', cursor:'pointer', marginTop:4, width:'100%' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(52,211,153,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'rgba(52,211,153,0.5)', flexShrink:0 }}>+</div>
            <span style={{ fontSize:12, fontWeight:600, color:'rgba(52,211,153,0.5)', fontFamily:"'Outfit',sans-serif" }}>Create Companion</span>
          </motion.button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CLANS SECTION (Characters) - Max 3
      ═══════════════════════════════════════════════════════════════════════ */}
      <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(167,139,250,0.5)', textTransform:'uppercase', marginTop:20, marginBottom:10 }}>Clans</div>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {characters.map(c=>{
          const color = ROLE_COLORS[c.base_role]||'#a78bfa';
          const icon = BASE_ROLES.find(r=>r.id===c.base_role)?.icon||'✨';
          const isActive = activeVibe===c.character_id;
          return (
            <div key={c.character_id} style={{ display:'flex', alignItems:'center', gap:0 }}>
              <motion.button data-testid={`sidebar-clan-${c.character_id}`} onClick={()=>setActiveVibe(c.character_id)} whileTap={{scale:0.97}}
                style={{ flex:1, display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'10px 0 0 10px', border:`1px solid ${isActive?color+'50':'rgba(255,255,255,0.05)'}`, borderRight:'none', background:isActive?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', transition:'all 0.2s', textAlign:'left' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:isActive?color+'20':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{icon}</div>
                <span style={{ fontSize:12, fontWeight:600, color:isActive?'#fff':'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.label||c.base_role}</span>
                {isActive&&<span style={{ marginLeft:'auto', color, fontSize:10 }}>●</span>}
              </motion.button>
              {/* Edit button - opens clan creator with existing data */}
              <button data-testid={`edit-clan-${c.character_id}`} onClick={()=>onEditCharacter&&onEditCharacter(c.character_id)} title="Edit clan"
                style={{ padding:'10px 8px', border:`1px solid ${isActive?color+'50':'rgba(255,255,255,0.05)'}`, borderLeft:'none', borderRight:'none', background:isActive?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:11, color:'rgba(167,139,250,0.6)', transition:'all 0.2s', display:'flex', alignItems:'center' }}>✎</button>
              {/* Delete button */}
              <button data-testid={`delete-clan-${c.character_id}`} onClick={()=>onDeleteCharacter(c.character_id)} title="Delete clan"
                style={{ padding:'10px 8px', borderRadius:'0 10px 10px 0', border:`1px solid ${isActive?color+'50':'rgba(255,255,255,0.05)'}`, borderLeft:'none', background:isActive?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:12, color:'rgba(248,113,113,0.6)', transition:'all 0.2s', display:'flex', alignItems:'center' }}>×</button>
            </div>
          );
        })}
        
        {/* Create Clan button - only visible when < 3 */}
        {canCreateClan&&(
          <motion.button data-testid="sidebar-create-clan-btn" onClick={onOpenCreator} whileTap={{scale:0.97}}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderRadius:10, border:'1px dashed rgba(167,139,250,0.3)', background:'transparent', cursor:'pointer', marginTop:4, width:'100%' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(167,139,250,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'rgba(167,139,250,0.5)', flexShrink:0 }}>+</div>
            <span style={{ fontSize:12, fontWeight:600, color:'rgba(167,139,250,0.5)', fontFamily:"'Outfit',sans-serif" }}>Create Clan</span>
          </motion.button>
        )}
      </div>

      {/* Gossip Room */}
      <div style={{ marginTop:16, borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:16 }}>
        <motion.button data-testid="sidebar-gossip-btn" onClick={onOpenGossip} whileTap={{scale:0.97}}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, border:'1px solid rgba(251,191,36,0.2)', background:'rgba(251,191,36,0.05)', cursor:'pointer' }}>
          <span style={{ fontSize:20 }}>🤫</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#fbbf24', fontFamily:"'Outfit',sans-serif" }}>Gossip Room</div>
            <div style={{ fontSize:10, color:'rgba(251,191,36,0.5)' }}>No receipts · No logs</div>
          </div>
        </motion.button>
      </div>
      
      {/* Language */}
      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(167,139,250,0.5)', textTransform:'uppercase', marginBottom:8 }}>Language</div>
        <div style={{ position:'relative' }}>
          <select value={language} onChange={e=>setLanguage(e.target.value)} style={{ width:'100%', appearance:'none', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', padding:'9px 28px 9px 12px', borderRadius:10, color:'#fff', fontSize:12, outline:'none', cursor:'pointer' }}>
            <option value="Hindi">Hinglish</option><option value="English">English</option>
            <option value="Marathi">Marathi</option><option value="Tamil">Tanglish</option><option value="Kannada">Kanglish</option>
          </select>
          <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:9, color:'rgba(248,250,252,0.3)', pointerEvents:'none' }}>▾</span>
        </div>
      </div>
      
      <div style={{ flex:1 }}/>
      
      {/* Settings */}
      <motion.button data-testid="sidebar-settings-btn" onClick={onOpenSettings} whileTap={{scale:0.97}}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.03)', cursor:'pointer', marginTop:16, width:'100%' }}>
        <span style={{ fontSize:16 }}>⚙️</span>
        <span style={{ fontSize:13, color:'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>Settings</span>
      </motion.button>
    </div>
  );
};

// ─── Mobile Drawer ───────────────────────────────────────────────────────────
const MobileDrawer = ({ isOpen, onClose, authUser, activeVibe, setActiveVibe, characters, onOpenCreator, onDeleteCharacter, onEditCharacter, onOpenSettings, onOpenGossip, language, setLanguage, startNewSession, chatSessions, activeSessionId, onSwitchSession, onDeleteSession, onRenameSession }) => {
  // Companions = chat sessions (max 2)
  const companions = chatSessions || [];
  const canCreateCompanion = companions.length < 2;
  
  // Clans = characters (max 3)
  const canCreateClan = characters.length < 3;
  
  // State for renaming companions
  const [renamingId, setRenamingId] = React.useState(null);
  const [renameVal, setRenameVal] = React.useState('');

  const handleRenameStart = (s) => { setRenamingId(s.session_id); setRenameVal(s.title||'Companion'); };
  const handleRenameSubmit = (sid) => { onRenameSession(sid, renameVal); setRenamingId(null); };

  if(!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}/>
      {/* Drawer */}
      <motion.div initial={{x:'-100%'}} animate={{x:0}} exit={{x:'-100%'}} transition={{type:'spring',stiffness:300,damping:30}}
        style={{ position:'fixed', top:0, left:0, bottom:0, width:'80%', maxWidth:300, zIndex:101, background:'rgba(15,8,32,0.98)', backdropFilter:'blur(24px)', borderRight:'1px solid rgba(255,255,255,0.08)', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <LogoIcon size="sm"/>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:16, background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ReVent</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:16, cursor:'pointer' }}>×</button>
        </div>

        {/* User info */}
        {authUser&&(
          <div style={{ padding:'8px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>😤</div>
              <div>
                <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:13, color:'#fff' }}>{authUser.name}</div>
                <div style={{ fontSize:10, color:'rgba(248,250,252,0.35)' }}>Beta Tester</div>
              </div>
            </div>
            <CoinBadge coins={authUser.coins} onClick={()=>{onOpenSettings();onClose();}}/>
          </div>
        )}

        <div style={{ padding:'0 16px', flex:1 }}>
          {/* ═══════════════════════════════════════════════════════════════════════
              COMPANIONS SECTION (Chat Sessions) - Max 2
          ═══════════════════════════════════════════════════════════════════════ */}
          <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(52,211,153,0.6)', textTransform:'uppercase', marginTop:14, marginBottom:8 }}>Companions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {companions.map(s=>{
              const isActive = s.session_id === activeSessionId;
              return (
                <div key={s.session_id} style={{ display:'flex', alignItems:'center', gap:0 }}>
                  {renamingId===s.session_id?(
                    <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                      onBlur={()=>handleRenameSubmit(s.session_id)}
                      onKeyDown={e=>{ if(e.key==='Enter')handleRenameSubmit(s.session_id); if(e.key==='Escape')setRenamingId(null); }}
                      style={{ flex:1, background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:'10px 0 0 10px', outline:'none', color:'#fff', fontSize:12, padding:'9px 10px', fontFamily:"'Outfit',sans-serif" }}/>
                  ):(
                    <motion.button onClick={()=>{onSwitchSession(s.session_id);onClose();}} whileTap={{scale:0.97}}
                      style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderRadius:'10px 0 0 10px', border:`1px solid ${isActive?'rgba(52,211,153,0.35)':'rgba(255,255,255,0.05)'}`, borderRight:'none', background:isActive?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)', cursor:'pointer', textAlign:'left' }}>
                      <div style={{ width:26, height:26, borderRadius:'50%', background:isActive?'rgba(52,211,153,0.2)':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>💬</div>
                      <span style={{ fontSize:12, fontWeight:isActive?600:400, color:isActive?'#fff':'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title||'Companion'}</span>
                    </motion.button>
                  )}
                  {/* Edit button */}
                  <button onClick={()=>handleRenameStart(s)} title="Edit name"
                    style={{ padding:'9px 7px', border:`1px solid ${isActive?'rgba(52,211,153,0.35)':'rgba(255,255,255,0.05)'}`, borderLeft:'none', borderRight:'none', background:isActive?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:10, color:'rgba(167,139,250,0.6)' }}>✎</button>
                  {/* Delete button */}
                  <button onClick={()=>onDeleteSession(s.session_id)} title="Delete companion"
                    style={{ padding:'9px 7px', borderRadius:'0 10px 10px 0', border:`1px solid ${isActive?'rgba(52,211,153,0.35)':'rgba(255,255,255,0.05)'}`, borderLeft:'none', background:isActive?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:12, color:'rgba(248,113,113,0.6)' }}>×</button>
                </div>
              );
            })}
            
            {/* Create Companion button - only visible when < 2 */}
            {canCreateCompanion&&(
              <motion.button onClick={()=>{startNewSession();onClose();}} whileTap={{scale:0.97}}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:10, border:'1px dashed rgba(52,211,153,0.3)', background:'transparent', cursor:'pointer', marginTop:4, width:'100%' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(52,211,153,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'rgba(52,211,153,0.5)', flexShrink:0 }}>+</div>
                <span style={{ fontSize:11, fontWeight:600, color:'rgba(52,211,153,0.5)', fontFamily:"'Outfit',sans-serif" }}>Create Companion</span>
              </motion.button>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              CLANS SECTION (Characters) - Max 3
          ═══════════════════════════════════════════════════════════════════════ */}
          <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(167,139,250,0.5)', textTransform:'uppercase', marginTop:16, marginBottom:8 }}>Clans</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {characters.map(c=>{
              const color = ROLE_COLORS[c.base_role]||'#a78bfa';
              const icon = BASE_ROLES.find(r=>r.id===c.base_role)?.icon||'✨';
              const isActive = activeVibe===c.character_id;
              return (
                <div key={c.character_id} style={{ display:'flex', alignItems:'center', gap:0 }}>
                  <motion.button onClick={()=>{setActiveVibe(c.character_id);onClose();}} whileTap={{scale:0.97}}
                    style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'9px 10px', borderRadius:'10px 0 0 10px', border:`1px solid ${isActive?color+'50':'rgba(255,255,255,0.05)'}`, borderRight:'none', background:isActive?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:isActive?color+'20':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>{icon}</div>
                    <span style={{ fontSize:12, fontWeight:600, color:isActive?'#fff':'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.label||c.base_role}</span>
                  </motion.button>
                  {/* Edit button - opens clan creator with existing data */}
                  <button onClick={()=>{onEditCharacter&&onEditCharacter(c.character_id);onClose();}} title="Edit clan"
                    style={{ padding:'9px 7px', border:`1px solid ${isActive?color+'50':'rgba(255,255,255,0.05)'}`, borderLeft:'none', borderRight:'none', background:isActive?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:10, color:'rgba(167,139,250,0.6)' }}>✎</button>
                  {/* Delete button */}
                  <button onClick={()=>{onDeleteCharacter(c.character_id);onClose();}} title="Delete clan"
                    style={{ padding:'9px 7px', borderRadius:'0 10px 10px 0', border:`1px solid ${isActive?color+'50':'rgba(255,255,255,0.05)'}`, borderLeft:'none', background:isActive?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:12, color:'rgba(248,113,113,0.6)' }}>×</button>
                </div>
              );
            })}
            
            {/* Create Clan button - only visible when < 3 */}
            {canCreateClan&&(
              <motion.button onClick={()=>{onOpenCreator();onClose();}} whileTap={{scale:0.97}}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:10, border:'1px dashed rgba(167,139,250,0.3)', background:'transparent', cursor:'pointer', marginTop:4, width:'100%' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(167,139,250,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'rgba(167,139,250,0.5)', flexShrink:0 }}>+</div>
                <span style={{ fontSize:11, fontWeight:600, color:'rgba(167,139,250,0.5)', fontFamily:"'Outfit',sans-serif" }}>Create Clan</span>
              </motion.button>
            )}
          </div>

          {/* Gossip Room */}
          <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <motion.button onClick={()=>{onOpenGossip();onClose();}} whileTap={{scale:0.97}}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, border:'1px solid rgba(251,191,36,0.2)', background:'rgba(251,191,36,0.05)', cursor:'pointer' }}>
              <span style={{ fontSize:20 }}>🤫</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#fbbf24', fontFamily:"'Outfit',sans-serif" }}>Gossip Room</div>
                <div style={{ fontSize:10, color:'rgba(251,191,36,0.5)' }}>No receipts · No logs</div>
              </div>
            </motion.button>
          </div>

          {/* Language */}
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(167,139,250,0.5)', textTransform:'uppercase', marginBottom:8 }}>Language</div>
            <div style={{ position:'relative' }}>
              <select value={language} onChange={e=>setLanguage(e.target.value)} style={{ width:'100%', appearance:'none', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', padding:'9px 28px 9px 12px', borderRadius:10, color:'#fff', fontSize:12, outline:'none', cursor:'pointer' }}>
                <option value="Hindi">Hinglish</option><option value="English">English</option>
                <option value="Marathi">Marathi</option><option value="Tamil">Tanglish</option><option value="Kannada">Kanglish</option>
              </select>
              <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:9, color:'rgba(248,250,252,0.3)', pointerEvents:'none' }}>▾</span>
            </div>
          </div>
        </div>

        {/* Settings at bottom */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.06)', marginTop:8 }}>
          <motion.button onClick={()=>{onOpenSettings();onClose();}} whileTap={{scale:0.97}}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.03)', cursor:'pointer', width:'100%' }}>
            <span style={{ fontSize:16 }}>⚙️</span>
            <span style={{ fontSize:13, color:'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>Settings</span>
          </motion.button>
        </div>
      </motion.div>
    </>
  );
};

// ─── Chat Interface ───────────────────────────────────────────────────────────
const ChatInterface = ({ activeVibe, setActiveVibe, setView, characters, onOpenCreator, onDeleteCharacter, onEditCharacter, intensity, baseline, manualMode, setManualMode, authUser, messages, input, setInput, sendMessage, loading, scrollRef, language, setLanguage, isDesktop, onOpenGossip, startNewSession, chatSessions, sessionId, onSwitchSession, onDeleteSession, onRenameSession, onOpenSettings }) => {
  const activeChar = characters.find(c=>c.character_id===activeVibe);
  const accentColor = activeChar ? (ROLE_COLORS[activeChar.base_role]||'#a78bfa') : '#a78bfa';
  const lastAiMsg = [...messages].reverse().find(m=>m.role==='ai');
  const isCrisis = lastAiMsg?.mode === 'CRISIS';
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [modeDropdownOpen, setModeDropdownOpen] = React.useState(false);
  const modeTrayRef = React.useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const messagesWrapperRef = React.useRef(null);
  const emojiPickerRef = React.useRef(null);

  React.useEffect(()=>{
    const handleOutside = (event) => { if(modeTrayRef.current && !modeTrayRef.current.contains(event.target)) { setModeDropdownOpen(false); } };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  },[]);
  const currentMode = MODE_TRAY.find(m=>m.id===manualMode) || MODE_TRAY[0];
  const handleModeSelect = (modeId) => {
    if(isCrisis) return;
    if(modeId===manualMode){ setModeDropdownOpen(false); return; }
    setManualMode(modeId);
    setModeDropdownOpen(false);
    const selected = MODE_TRAY.find(m=>m.id===modeId);
    if(selected){
      toast.success(`Switched to ${selected.name}`, { icon: selected.emoji });
    }
  };
  React.useEffect(()=>{
    setModeDropdownOpen(false);
  },[manualMode]);
  React.useEffect(()=>{
    if(!showEmojiPicker) return;
    const handler = (event) => {
      if(emojiPickerRef.current && !emojiPickerRef.current.contains(event.target) && !event.target.closest('[data-testid="emoji-button"]')){
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  },[showEmojiPicker]);
  const handleScroll = () => {
    const el = messagesWrapperRef.current;
    if(!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setShowScrollToBottom(scrollHeight - scrollTop - clientHeight > 120);
  };
  const scrollToBottom = () => {
    if(messagesWrapperRef.current){
      messagesWrapperRef.current.scrollTo({ top: messagesWrapperRef.current.scrollHeight, behavior: 'smooth' });
      setShowScrollToBottom(false);
    }
    if(scrollRef.current){
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  React.useEffect(()=>{
    scrollToBottom();
  },[messages, loading]);

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', position:'relative' }}>
      {/* Mobile Drawer */}
      {!isDesktop&&(
        <AnimatePresence>
          {drawerOpen&&(
            <MobileDrawer isOpen={drawerOpen} onClose={()=>setDrawerOpen(false)}
              authUser={authUser} activeVibe={activeVibe} setActiveVibe={setActiveVibe}
              characters={characters} onOpenCreator={onOpenCreator} onDeleteCharacter={onDeleteCharacter} onEditCharacter={onEditCharacter}
              onOpenSettings={onOpenSettings||(() => setView('settings'))} onOpenGossip={onOpenGossip||(() => setView('gossip_chat'))}
              language={language} setLanguage={setLanguage}
              startNewSession={startNewSession} chatSessions={chatSessions} activeSessionId={sessionId}
              onSwitchSession={onSwitchSession} onDeleteSession={onDeleteSession} onRenameSession={onRenameSession}/>
          )}
        </AnimatePresence>
      )}

      {/* Topbar */}
      <div style={topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:8, cursor: !isDesktop ? 'pointer' : 'default' }} onClick={!isDesktop ? ()=>setDrawerOpen(true) : undefined}>
          <LogoIcon size="sm"/>
          <div>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Reva</div>
            <div style={{ fontSize:9, color:'rgba(248,250,252,0.3)', display:'flex', alignItems:'center', gap:3 }}>
              <span style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:'#34d399' }}/>Online
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {authUser&&<CoinBadge coins={authUser.coins} onClick={onOpenSettings||(() => setView('settings'))}/>}
          {!isDesktop&&(
            <button onClick={onOpenGossip||(() => setView('gossip_chat'))} style={{ ...iconBtn, width:34, height:34, fontSize:16, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)' }}>🤫</button>
          )}
          <button data-testid="chat-settings-btn" onClick={onOpenSettings||(() => setView('settings'))} style={{ ...iconBtn, width:34, height:34, fontSize:14 }}>⚙️</button>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display:'flex', justifyContent:'center', padding: isDesktop ? '12px 0 8px' : '8px 0', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.5)', flexShrink:0 }}>
        <div ref={modeTrayRef} style={{ width:'100%', maxWidth:isDesktop?380:'100%', position:'relative' }}>
          <button data-testid="mode-selector-btn"
            disabled={isCrisis}
            onClick={()=>setModeDropdownOpen(prev=>!prev)}
            style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
              padding: isDesktop ? '10px 18px' : '8px 14px',
              borderRadius:14, border:'1px solid rgba(255,255,255,0.12)',
              background:isCrisis?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.03)',
              color:'#fff', cursor:isCrisis?'not-allowed':'pointer', fontFamily:"'Outfit',sans-serif",
              fontWeight:600, fontSize:isDesktop?14:13, letterSpacing:0.5, gap:12,
              justifyContent:'space-between',
            }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:isDesktop?18:16 }}>{currentMode?.emoji}</span>
              <div style={{ textAlign:'left', lineHeight:1 }}>
                <div style={{ fontSize:isDesktop?14:13 }}>{currentMode?.name}</div>
                <div style={{ fontSize:10, letterSpacing:1, color:'rgba(248,250,252,0.6)' }}>{currentMode?.shortDesc}</div>
              </div>
            </div>
            <span style={{ fontSize:18 }}>{modeDropdownOpen?'▲':'▼'}</span>
          </button>
          {modeDropdownOpen && !isCrisis && (
            <div style={{
              position:'absolute', top:'110%', left:0, right:0, background:'rgba(10,5,22,0.9)', border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:14, marginTop:8, padding:'10px 0', boxShadow:'0 12px 30px rgba(0,0,0,0.35)', zIndex:10, maxHeight:220, overflowY:'auto'
            }}>
              {MODE_TRAY.map(opt=>(
                <button key={opt.id} data-testid={`mode-option-${opt.id}`}
                  onClick={()=>handleModeSelect(opt.id)}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 18px',
                    background:manualMode===opt.id?'rgba(167,139,250,0.15)':'transparent',
                    border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)',
                    color:'#fff', cursor:'pointer', textAlign:'left', fontFamily:"'Outfit',sans-serif", fontSize:13,
                    justifyContent:'space-between',
                  }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>{opt.name}</div>
                    <div style={{ fontSize:11, color:'rgba(248,250,252,0.5)' }}>{opt.shortDesc}</div>
                  </div>
                  <span style={{ fontSize:18 }}>{opt.emoji}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats — inline on mobile */}
      <div style={{ display:'flex', gap: isDesktop ? 8 : 6, padding: isDesktop ? '6px 14px' : '4px 10px', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'rgba(10,5,22,0.3)', flexShrink:0 }}>
        {[{lbl:'INTENSITY',val:intensity,color:'#fbbf24'},{lbl:'MOOD',val:baseline,color:'#34d399'}].map(s=>(
          <div key={s.lbl} style={{ flex:1, padding: isDesktop ? '5px 10px' : '3px 8px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2, fontSize: isDesktop ? 8 : 7, letterSpacing: isDesktop ? 2 : 1.5, fontWeight:700, color:s.color, textTransform:'uppercase' }}>
              <span>{s.lbl}</span><span>{s.val}/10</span>
            </div>
            <div style={{ height:2, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
              <motion.div animate={{ width:`${s.val*10}%` }} style={{ height:'100%', background:s.color, borderRadius:99 }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div style={{ position:'relative', flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
        <div data-testid="chat-messages" ref={messagesWrapperRef} onScroll={handleScroll}
          style={{ flex:1, overflowY:'auto', padding: isDesktop ? '16px 16px 8px' : '12px 10px 8px', display:'flex', flexDirection:'column', gap: isDesktop ? 12 : 8 }}>
          {messages.map((msg,i)=><ChatBubble key={i} msg={msg} isDesktop={isDesktop}/>)}
          {loading&&(
            <div style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.18)' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontSize:11, letterSpacing:1.5, textTransform:'uppercase', color:'#fbbf24' }}>{activeVibe === 'default' ? 'Reva' : (activeChar ? (activeChar.label || 'Reva') : 'Reva')}</span>
                <span style={{ fontSize:13, color:'#f8fafc' }}>is typing</span>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[0,1,2].map(n=>(
                  <motion.span key={n} style={{ width:6, height:6, borderRadius:'50%', background:'#fbbf24' }}
                    animate={{ opacity:[0.2,1,0.2], y:[0,-6,0] }} transition={{ duration:1.2, repeat:Infinity, delay:n*0.15 }}/>
                ))}
              </div>
            </div>
          )}
          <div ref={scrollRef}/>
        </div>
        {showScrollToBottom && (
          <button onClick={scrollToBottom}
            style={{ position:'absolute', right:16, bottom:isDesktop?120:120, background:'linear-gradient(135deg,#34d399,#60a5fa)', border:'none', color:'#fff', borderRadius:999, width:44, height:44, fontSize:24, boxShadow:'0 6px 18px rgba(0,0,0,0.3)', cursor:'pointer' }}>
            ↓
          </button>
        )}
      </div>

      {/* Emotion bar removed as per user request */}

      {/* Input */}
      <div style={{ padding: isDesktop ? '10px 14px' : '8px 10px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.8)', backdropFilter:'blur(16px)', flexShrink:0, position:'relative' }}>
        {isDesktop&&<GossipFloatingBtn onClick={()=>setView('gossip_chat')} isDesktop={isDesktop}/>}
        <div style={{ display:'flex', gap:8, paddingRight: isDesktop ? 80 : 0, alignItems:'flex-end', position:'relative' }}>
          <button data-testid="emoji-button" onClick={()=>setShowEmojiPicker(prev=>!prev)}
            style={{ width:44, height:44, borderRadius:12, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.04)', color:'#fbbf24', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            😊
          </button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} style={{ position:'absolute', bottom:56, left:0, zIndex:20, boxShadow:'0 12px 30px rgba(0,0,0,0.35)', borderRadius:14, overflow:'hidden' }}>
              <EmojiPicker
                onEmojiClick={(emojiData)=>{ setInput(prev=>prev+emojiData.emoji); setShowEmojiPicker(false); }}
                theme="dark"
                searchDisabled={false}
                skinTonesDisabled
                width={320}
              />
            </div>
          )}
          <textarea data-testid="chat-input" style={{ ...textareaCss, flex:1, fontSize: isDesktop ? 14 : 15, padding: isDesktop ? '13px 16px' : '11px 14px', borderRadius:14, resize:'none', minHeight: isDesktop ? 46 : 44, maxHeight: isDesktop ? 120 : 100 }} value={input} onChange={e=>setInput(e.target.value)} placeholder="Just say it…" rows={1}
            onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }}/>
          <button data-testid="chat-send-btn" onClick={sendMessage} style={{ ...sendBtn, background:`linear-gradient(135deg,${accentColor},#34d399)` }}>↑</button>
        </div>
      </div>
    </div>
  );
};

// ─── Gossip Interface ─────────────────────────────────────────────────────────
const GossipInterface = ({ setView, authUser, messages, input, setInput, sendMessage, loading, scrollRef, isDesktop }) => (
  <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: isDesktop ? '14px 20px' : '10px 10px', borderBottom:'1px solid rgba(251,191,36,0.1)', background:'rgba(8,5,18,0.9)', backdropFilter:'blur(20px)', flexShrink:0, gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding: isDesktop ? '4px 10px' : '4px 8px', borderRadius:99, background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', fontSize: isDesktop ? 10 : 9, letterSpacing:1.5, textTransform:'uppercase', color:'#fbbf24' }}>
          <motion.div style={{ width:6, height:6, borderRadius:'50%', background:'#fbbf24' }} animate={{opacity:[1,0.3,1]}} transition={{duration:1,repeat:Infinity}}/>GOSSIP MODE
        </div>
        {isDesktop&&<span style={{ fontSize:10, color:'rgba(248,250,252,0.25)' }}>RAM only · No storage</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {authUser&&<CoinBadge coins={authUser.coins}/>}
        <button data-testid="gossip-exit-btn" onClick={()=>setView('chat')} style={{ display:'flex', alignItems:'center', gap:6, padding: isDesktop ? '7px 14px' : '7px 10px', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.18)', borderRadius:99, color:'#fbbf24', fontSize: isDesktop ? 11 : 10, cursor:'pointer', whiteSpace:'nowrap' }}>
          Exit & Dissolve
        </button>
      </div>
    </div>
    <div style={{ margin: isDesktop ? '10px 16px 0' : '8px 10px 0', padding: isDesktop ? '10px 14px' : '8px 10px', background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.12)', borderRadius:14, display:'flex', alignItems:'center', gap:10, fontSize: isDesktop ? 12 : 11, color:'rgba(251,191,36,0.7)', flexShrink:0 }}>
      <span>⚠️</span><span>This conversation will vanish when you exit. No logs. No memory. No receipts.</span>
    </div>
    <div data-testid="gossip-messages" style={{ flex:1, overflowY:'auto', padding: isDesktop ? '16px' : '12px 10px', display:'flex', flexDirection:'column', gap: isDesktop ? 14 : 10 }}>
      {messages.length===0&&(
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', opacity:0.4, paddingTop:30 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🤫</div>
          <p style={{ fontSize:13, color:'rgba(248,250,252,0.5)', textAlign:'center' }}>Okay, just between us.<br/>Say whatever. Zero receipts.</p>
        </div>
      )}
      {messages.map((msg,i)=><GossipBubble key={i} msg={msg} isDesktop={isDesktop}/>)}
      {loading&&<div style={{ alignSelf:'flex-start' }}><div style={{ background:'rgba(251,191,36,0.04)', border:'1px solid rgba(251,191,36,0.12)', borderRadius:'2px 14px 14px 14px' }}><TypingDots color="#fbbf24"/></div></div>}
      <div ref={scrollRef}/>
    </div>
    <div style={{ padding: isDesktop ? '14px 20px' : '10px 10px', borderTop:'1px solid rgba(251,191,36,0.08)', background:'rgba(8,5,18,0.8)', backdropFilter:'blur(16px)', flexShrink:0 }}>
      <div style={{ display:'flex', gap:8 }}>
        <textarea data-testid="gossip-input" style={{ ...textareaCss, flex:1, borderColor:'rgba(251,191,36,0.15)', fontSize: isDesktop ? 14 : 15, padding: isDesktop ? '13px 16px' : '11px 14px' }} value={input} onChange={e=>setInput(e.target.value)} placeholder="Off the record…" rows={1}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }}/>
        <button data-testid="gossip-send-btn" onClick={sendMessage} style={{ ...sendBtn, background:'linear-gradient(135deg,#fbbf24,#f59e0b)' }}>↑</button>
      </div>
    </div>
  </div>
);

// ─── Settings Screen ──────────────────────────────────────────────────────────
const SettingsScreen = ({ authUser, onBack, language, setLanguage, onLogout, isDesktop }) => {
  const COIN_PACKS=[
    {coins:40,price:'₹49',label:'Starter',badge:null},{coins:100,price:'₹99',label:'Core',badge:'Popular'},
    {coins:220,price:'₹199',label:'Value',badge:'Best Value'},{coins:600,price:'₹499',label:'Power',badge:null},
    {coins:2000,price:'₹999',label:'Mega',badge:null},
  ];
  return (
    <div data-testid="settings-screen" style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={topbar}>
        <button data-testid="settings-back-btn" onClick={onBack} style={iconBtn}>←</button>
        <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:16 }}>Settings</div>
        <div style={{ width:38 }}/>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding: isDesktop ? '0 16px 32px' : '0 10px 24px' }}>
        <div style={sectionLabel}>// User Profile</div>
        <div style={{ ...glass, padding: isDesktop ? '16px 20px' : '12px 14px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, minWidth:0 }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>😤</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{authUser?.name||'User'}</div>
              <div style={{ fontSize:11, color:'rgba(248,250,252,0.4)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{authUser?.email||''}</div>
            </div>
          </div>
          <CoinBadge coins={authUser?.coins||0}/>
        </div>
        <div style={sectionLabel}>// Recharge Coins</div>
        <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill,minmax(130px,1fr))' : 'repeat(2,minmax(0,1fr))', gap:10, marginBottom:8 }}>
          {COIN_PACKS.map(pack=>(
            <div key={pack.coins} data-testid={`coin-pack-${pack.label}`} style={{ ...glass, padding:'16px 12px', textAlign:'center', position:'relative' }}>
              {pack.badge&&<div style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', background:'linear-gradient(90deg,#a78bfa,#34d399)', padding:'2px 10px', borderRadius:99, fontSize:9, fontWeight:700, whiteSpace:'nowrap', color:'#fff' }}>{pack.badge}</div>}
              <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:26, background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:2 }}>{pack.coins}</div>
              <div style={{ fontSize:10, color:'rgba(248,250,252,0.35)', marginBottom:6 }}>coins</div>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:15, marginBottom:8 }}>{pack.price}</div>
              <button style={{ ...btnPrimary, padding:'7px 12px', fontSize:12 }}>Get</button>
            </div>
          ))}
        </div>
        <p style={{ fontSize:11, color:'rgba(248,250,252,0.25)', marginBottom:8 }}>2 coins per session · Crisis mode is always free</p>
        <div style={sectionLabel}>// Preferences</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ ...glass, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:18 }}>🌐</span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:14 }}>Language</span>
            </div>
            <div style={{ position:'relative' }}>
              <select value={language} onChange={e=>setLanguage(e.target.value)} style={{ appearance:'none', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', padding:'7px 28px 7px 12px', borderRadius:10, color:'#fff', fontSize:13, outline:'none', cursor:'pointer', maxWidth:110 }}>
                <option value="Hindi">Hinglish</option><option value="English">English</option>
                <option value="Marathi">Marathi</option><option value="Tamil">Tamil</option><option value="Kannada">Kannada</option>
              </select>
              <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:9, color:'rgba(248,250,252,0.3)', pointerEvents:'none' }}>▾</span>
            </div>
          </div>
          <div style={{ ...glass, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:18 }}>🔒</span>
              <div>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:14 }}>Privacy & Data</div>
                <div style={{ fontSize:11, color:'rgba(248,250,252,0.35)' }}>Zero-retention in Gossip Mode</div>
              </div>
            </div>
            <span style={{ color:'rgba(248,250,252,0.25)', fontSize:16 }}>›</span>
          </div>
        </div>
        <div style={{ marginTop:28 }}>
          <button data-testid="settings-logout-btn" onClick={onLogout} style={btnDanger}>Log Out</button>
        </div>
        <div style={{ textAlign:'center', marginTop:20 }}>
          <span style={{ fontSize:10, color:'rgba(248,250,252,0.15)', letterSpacing:1 }}>ReVent v1.0 — Gradient Glass</span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
function App() {
  // Auth
  const [authUser,setAuthUser]=useState(null);
  const [showBetaModal,setShowBetaModal]=useState(false);

  // View — null = loading, 'splash' = unauthenticated landing
  // Restore from sessionStorage to survive page reloads
  const [view,setViewRaw]=useState(()=>loadState('view',null));
  const [askAliasAfterOnboarding,setAskAliasAfterOnboarding]=useState(false);
  const setView=(v)=>{ saveState('view',v); setViewRaw(v); };

  // Chat state
  const [messages,setMessages]=useState([]);
  const [gossipMessages,setGossipMessages]=useState([]);
  const [input,setInput]=useState('');
  const [gossipInput,setGossipInput]=useState('');
  const [sessionId,setSessionIdRaw]=useState(()=>loadState('sessionId',genSessionId()));
  const setSessionId=(v)=>{ saveState('sessionId',v); setSessionIdRaw(v); };
  const [gossipSessionId,setGossipSessionId]=useState(genSessionId);
  const [manualMode,setManualMode]=useState('AUTO');
  const [language,setLanguage]=useState('Hindi');
  const [intensity,setIntensity]=useState(0);
  const [baseline,setBaseline]=useState(5);
  const [userName,setUserName]=useState('User');
  const [activeVibe,setActiveVibeRaw]=useState(()=>loadState('activeVibe','default'));
  const setActiveVibe=(v)=>{ saveState('activeVibe',v); setActiveVibeRaw(v); };
  const [characters,setCharacters]=useState([]);
  const [editingCharacter,setEditingCharacter]=useState(null);
  const [loading,setLoading]=useState(false);
  const [gossipLoading,setGossipLoading]=useState(false);
  const [coinToast,setCoinToast]=useState(null);
  const [chatSessions,setChatSessions]=useState([]);

  const scrollRef=useRef(null);
  const gossipScrollRef=useRef(null);
  const coinToastRef=useRef(null);
  const windowWidth=useWindowWidth();
  const isDesktop=windowWidth>=768;
  const containerMaxWidth = isDesktop ? 1200 : windowWidth >= 769 ? 768 : '100%';
  const containerPadding = isDesktop ? 32 : windowWidth >= 769 ? 24 : 16;
  const chatLayoutStyle = {
    width: '100%',
    maxWidth: containerMaxWidth,
    margin: '0 auto',
    padding: containerPadding,
    boxSizing: 'border-box',
    height: '100%',
    display: 'flex',
    flexDirection: isDesktop ? 'row' : 'column',
    gap: isDesktop ? 32 : 0,
  };
  const sidebarWrapperStyle = { width: isDesktop ? 240 : '100%', flexShrink: 0, height: '100%' };
  const chatWrapperStyle = {
    flex: 1,
    minWidth: 0,
    maxWidth: isDesktop ? 800 : '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  // Load chat history for current session from DB
  const loadChatHistory=async(sid)=>{
    if(!sid)return false;
    try{
      const res=await api.get(`/api/chat/history/${sid}`);
      const msgs=(res.data||[]).map(m=>ensureMessage({role:m.role==='ai'?'ai':'user',content:m.content,mode:m.mode}));
      if(msgs.length>0){ setMessages(msgs); return true; }
    }catch{}
    return false;
  };

  // Load sessions list for current vibe
  const loadSessions=async(vibeId='default')=>{
    try{
      const res=await api.get('/api/chat/sessions',{params:{vibe_id:vibeId}});
      setChatSessions(res.data||[]);
      return res.data||[];
    }catch{ return []; }
  };

  // Run auth check — restore state from session if available
  useEffect(()=>{
    const hash=window.location.hash;
    if(hash?.includes('session_id=')){
      const params=new URLSearchParams(hash.slice(1));
      const sid=params.get('session_id');
      if(sid){handleGoogleCallback(sid);return;}
    }
    checkAuth();
  },[]);

  // Auto-scroll to bottom of chat messages - use block:'nearest' to prevent scrolling parent containers
  useEffect(()=>{
    if(scrollRef.current) {
      try {
        const parent = scrollRef.current.parentElement;
        if(parent) parent.scrollTop = parent.scrollHeight;
      } catch(e) {}
    }
  },[messages]);
  
  useEffect(()=>{
    if(gossipScrollRef.current) {
      try {
        const parent = gossipScrollRef.current.parentElement;
        if(parent) parent.scrollTop = parent.scrollHeight;
      } catch(e) {}
    }
  },[gossipMessages]);
  
  useEffect(()=>{
    const h=(e)=>{ if(e.target.tagName==='TEXTAREA'){e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';} };
    document.addEventListener('input',h);
    return()=>document.removeEventListener('input',h);
  },[]);

  // Reload sessions whenever vibe or view changes (ensures sidebar stays in sync)
  useEffect(()=>{
    if(authUser && (view==='chat'||view==='creator')){
      loadSessions(activeVibe);
    }
  },[activeVibe, view, authUser]);

  const checkAuth=async()=>{
    const savedView = loadState('view', null);
    try{
      const res=await api.get('/api/auth/me');
      const user=res.data;
      setAuthUser(user);
      setUserName(user.name||'User');
      setLanguage(user.language||'Hindi');
      const needsAliasAfterOnboarding = Boolean(user.google_id);
      setAskAliasAfterOnboarding(needsAliasAfterOnboarding);
      // Load characters
      try{ const cRes=await api.get('/api/characters'); setCharacters(cRes.data); }catch{}

      if(user.onboarding_complete){
        const currentSessionId = loadState('sessionId', null);
        const currentVibe = loadState('activeVibe', 'default');
        let sessions = await loadSessions(currentVibe);

        let loaded = false;
        if(currentSessionId && sessions.some(s=>s.session_id===currentSessionId)){
          loaded = await loadChatHistory(currentSessionId);
        } else if(currentSessionId && !sessions.some(s=>s.session_id===currentSessionId)){
          // Session ID exists locally but not in DB — try to load history and register it
          loaded = await loadChatHistory(currentSessionId);
          if(loaded && sessions.length < 2){
            try{
              await api.post('/api/chat/sessions',{session_id:currentSessionId,vibe_id:currentVibe,title:'My Chats'});
              sessions = await loadSessions(currentVibe);
            }catch{}
          }
        }
        if(!loaded && sessions.length>0){
          const latest = sessions[0];
          setSessionId(latest.session_id);
          loaded = await loadChatHistory(latest.session_id);
        }

        if(!loaded){
          // No history found — start fresh with welcome
          const newSid = genSessionId();
          setSessionId(newSid);
          // Register this new session in DB so it shows in sidebar
          if(sessions.length < 2){
            try{
              await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:currentVibe,title:'My Chats'});
              await loadSessions(currentVibe);
            }catch{}
          }
          try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
        }

        const defaultView = needsAliasAfterOnboarding ? 'name' : (savedView && ['chat','settings','creator','gossip_chat'].includes(savedView) ? savedView : 'chat');
        setView(defaultView);
      }else{
        setView('onboarding');
      }
    }catch{
      setAuthUser(null);
      setView('splash');
    }
  };

  const handleGoogleCallback=async(sid)=>{
    try{
      const res=await api.get('/api/auth/google-session',{params:{session_id:sid}});
      window.history.replaceState({},'',(window.location.pathname));
      const user=res.data.user;
      setAuthUser(user);
      setUserName(user.name||'User');
      setLanguage(user.language||'Hindi');
      setAskAliasAfterOnboarding(true);
      try{ const cRes=await api.get('/api/characters'); setCharacters(cRes.data); }catch{}
      if(user.onboarding_complete){ setView('name'); }
      else{ setView('onboarding'); }
    }catch{
      setAuthUser(null);
      setView('splash');
    }
  };

  // Splash "Get Started" click — only shown to unauthenticated users
  const handleSplashDone=()=>{ setView('auth'); };

  // Called after login or signup
  const handleAuth=async(user)=>{
    const needsAliasAfterOnboarding = Boolean(user.google_id);
    setAskAliasAfterOnboarding(needsAliasAfterOnboarding);
    setAuthUser(user);
    setUserName(user.name||'User');
    setLanguage(user.language||'Hindi');
    try{ const cRes=await api.get('/api/characters'); setCharacters(cRes.data); }catch{}
    if(user.is_first_login){
      setShowBetaModal(true);
      try{ await api.post('/api/auth/mark-first-login'); }catch{}
      setAuthUser(prev=>prev?{...prev,is_first_login:false}:prev);
    }else{
      if(user.onboarding_complete){
        // Load chat sessions and welcome messages
        const sessions = await loadSessions('default');
        let loaded = false;
        if(sessions.length>0){
          setSessionId(sessions[0].session_id);
          loaded = await loadChatHistory(sessions[0].session_id);
        }
        if(!loaded){
          const newSid = genSessionId();
          setSessionId(newSid);
          if(sessions.length < 2){
            try{ await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:'default',title:'Companion'}); await loadSessions('default'); }catch{}
          }
          try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
        }
        setView(needsAliasAfterOnboarding ? 'name' : 'chat');
      } else {
        setView('onboarding');
      }
    }
  };

  const handleBetaModalDismiss=()=>{
    setShowBetaModal(false);
    setView('onboarding');
  };

  // When switching vibes, load the correct chat history
  const switchVibe=async(vibeId)=>{
    setActiveVibe(vibeId);
    setMessages([]);
    const sessions = await loadSessions(vibeId);
    if(sessions.length>0){
      const latest = sessions[0];
      setSessionId(latest.session_id);
      await loadChatHistory(latest.session_id);
    } else {
      // New session for this vibe
      const newSid = genSessionId();
      setSessionId(newSid);
      try{ await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:vibeId,title:'Companion'}); await loadSessions(vibeId); }catch{}
      if(vibeId==='default'){
        try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
      } else {
        setMessages([{role:'ai',content:'Hey! Ready to talk? 😊',mode:'AUTO'}]);
      }
    }
    // Exit any other view (like creator) and go to chat
    if(view !== 'chat') {
      setEditingCharacter(null);
      setView('chat');
    }
  };

  const getPersonaConfig=()=>{
    const char = characters.find(c=>c.character_id===activeVibe);
    if(char) return { base_role:char.base_role, traits:char.traits, energy:char.energy, quirks:char.quirks, memory_hook:char.memory_hook, label:char.label };
    return {};
  };

  const showCoinNotif=(deducted,remaining)=>{
    if(coinToastRef.current)clearTimeout(coinToastRef.current);
    setCoinToast({deducted,remaining});
    coinToastRef.current=setTimeout(()=>setCoinToast(null),3000);
  };

  const sendMessage=async()=>{
    const sanitizedInput = sanitizeText(input);
    if(!sanitizedInput||loading)return;
    const userMsg={role:'user',content:sanitizedInput,timestamp:new Date().toISOString()};
    setMessages(prev=>[...prev,userMsg]);
    setInput('');
    setLoading(true);
    try{
      const res=await api.post('/api/chat',{message:userMsg.content,session_id:sessionId,language,manual_mode:manualMode,persona_config:getPersonaConfig(),force_vault:false});
      const aiMsg=ensureMessage({role:'ai',content:res.data.response,mode:res.data.mode||'AUTO'});
      setMessages(prev=>[...prev,aiMsg]);
      setIntensity(res.data.intensity_score||0);
      setBaseline(res.data.emotional_baseline||5);
      if(res.data.coins_remaining!==undefined)setAuthUser(prev=>prev?{...prev,coins:res.data.coins_remaining}:prev);
      if(res.data.coins_deducted>0)showCoinNotif(res.data.coins_deducted,res.data.coins_remaining);
    }catch{
      setMessages(prev=>[...prev,ensureMessage({role:'system',content:'⚠️ Connection failed. Try again.'})]);
    }finally{setLoading(false);}
  };

  const sendGossipMessage=async()=>{
    const sanitizedGossip = sanitizeText(gossipInput);
    if(!sanitizedGossip||gossipLoading)return;
    const userMsg={role:'user',content:sanitizedGossip,timestamp:new Date().toISOString()};
    setGossipMessages(prev=>[...prev,userMsg]);
    setGossipInput('');
    setGossipLoading(true);
    try{
      const res=await api.post('/api/chat',{message:userMsg.content,session_id:gossipSessionId,language,manual_mode:'GOSSIP',persona_config:{},force_vault:true});
      setGossipMessages(prev=>[...prev,ensureMessage({role:'ai',content:res.data.response,mode:'GOSSIP'})]);
    }catch{
      setGossipMessages(prev=>[...prev,ensureMessage({role:'system',content:'⚠️ Connection failed.'})]);
    }finally{setGossipLoading(false);}
  };

  const handleLogout=async()=>{
    try{await api.post('/api/auth/logout');}catch{}
    setAuthUser(null);setCharacters([]);
    sessionStorage.clear();
    setView('splash');
  };

  const handleLangDone=async(lang)=>{
    setLanguage(lang);
    try{
      const res=await api.post('/api/user/update-profile',{name:userName,language:lang,onboarding_complete:true});
      setAuthUser(res.data);
    }catch{}
    // Generate a new session and auto-trigger onboarding message
    const newSid = genSessionId();
    setSessionId(newSid);
    // Register session in DB so it shows in sidebar
    try{ await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:'default',title:'Companion'}); await loadSessions('default'); }catch{}
    // Load personalized welcome
    try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
    setView('chat');
    // Auto-trigger onboarding chat: send a "hey" to get the consent question
    setTimeout(async()=>{
      try{
        const res=await api.post('/api/chat',{message:'hey',session_id:newSid,language:lang,manual_mode:'AUTO',persona_config:{}});
        if(res.data.response){
          setMessages(prev=>[...prev,{role:'ai',content:res.data.response,mode:res.data.mode||'AUTO'}]);
        }
      }catch{}
    },800);
  };

  const openGossip=()=>{ setGossipMessages([]);setGossipSessionId(genSessionId());setView('gossip_chat'); };
  const openCreator=()=>{ if(characters.length>=3)return; setEditingCharacter(null); setView('creator'); };
  const editCharacter=(charId)=>{
    const charToEdit = characters.find(c=>c.character_id===charId);
    if(charToEdit) { setEditingCharacter(charToEdit); setView('creator'); }
  };
  const handleCharacterSaved=(newChar)=>{
    if(editingCharacter) {
      // Updating existing character - replace in array
      setCharacters(prev=>prev.map(c=>c.character_id===newChar.character_id?newChar:c));
    } else {
      // Creating new character - add to array
      setCharacters(prev=>[...prev,newChar]);
    }
    setEditingCharacter(null);
    setActiveVibe(newChar.character_id);
    const newSid=genSessionId();
    setSessionId(newSid);
    setMessages([{role:'ai',content:'Hey! Ready to talk? 😊',mode:'AUTO'}]);
    setView('chat');
  };
  const handleDeleteCharacter=async(charId)=>{
    try{
      await api.delete(`/api/characters/${charId}`);
      setCharacters(prev=>prev.filter(c=>c.character_id!==charId));
      if(activeVibe===charId){
        setActiveVibe('default');
        // Load RE default sessions
        const sessions = await loadSessions('default');
        if(sessions.length>0){
          setSessionId(sessions[0].session_id);
          await loadChatHistory(sessions[0].session_id);
        } else {
          const newSid=genSessionId();
          setSessionId(newSid);
          try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
        }
      }
    }catch{}
  };

  const startNewSession=async(title)=>{
    const newSid=genSessionId();
    const sessionTitle=title||'New Chat';
    try{
      await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:activeVibe,title:sessionTitle});
    }catch(e){
      if(e?.response?.status===400){ alert('You already have 2 sessions. Delete one to create a new chat.'); return; }
    }
    setSessionId(newSid);
    setMessages([]);
    await loadSessions(activeVibe);
    if(activeVibe==='default'){
      try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
    } else {
      setMessages([{role:'ai',content:'Hey! Ready to talk? 😊',mode:'AUTO'}]);
    }
  };

  const switchSession=async(sid)=>{
    if(sid===sessionId && view==='chat')return;
    setSessionId(sid);
    setMessages([]);
    await loadChatHistory(sid);
    // Exit any other view (like creator) and go to chat
    if(view !== 'chat') {
      setEditingCharacter(null);
      setView('chat');
    }
  };

  const deleteSession=async(sid)=>{
    try{
      await api.delete(`/api/chat/sessions/${sid}`);
      const sessions=await loadSessions(activeVibe);
      if(sid===sessionId){
        if(sessions.length>0){
          setSessionId(sessions[0].session_id);
          await loadChatHistory(sessions[0].session_id);
        } else {
          setSessionId(genSessionId());
          setMessages([]);
          if(activeVibe==='default'){
            try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([ensureMessage(WELCOME_MESSAGE)]); }
          }
        }
      }
    }catch{}
  };

  const renameSession=async(sid,newTitle)=>{
    if(!newTitle.trim())return;
    try{
      await api.patch(`/api/chat/sessions/${sid}`,{title:newTitle.trim()});
      await loadSessions(activeVibe);
    }catch{}
  };

  const chatViewProps={
    activeVibe,setActiveVibe:switchVibe,
    setView:(v)=>{ if(v==='gossip_chat'){openGossip();return;} setView(v); },
    characters,onOpenCreator:openCreator,onDeleteCharacter:handleDeleteCharacter,onEditCharacter:editCharacter,
    intensity,baseline,manualMode,setManualMode,authUser,
    messages,input,setInput,sendMessage,loading,scrollRef,
    language,setLanguage,isDesktop,
    startNewSession,chatSessions,sessionId,
    onOpenGossip:openGossip,onSwitchSession:switchSession,
    onDeleteSession:deleteSession,onRenameSession:renameSession,
    onOpenSettings:()=>setView('settings'),
  };

  // Page transition variants
  const fadeIn  = { initial:{opacity:0},        animate:{opacity:1},        exit:{opacity:0},        transition:{duration:0.3} };
  const slideUp = { initial:{opacity:0,y:30},   animate:{opacity:1,y:0},    exit:{opacity:0,y:-20},  transition:{type:'spring',stiffness:260,damping:28} };
  const slideR  = { initial:{x:'100%'},          animate:{x:0},              exit:{x:'100%'},         transition:{type:'spring',stiffness:260,damping:28} };

  return (
    <AppBg>
      <Toaster position="top-center" toastOptions={{ style: { background: 'rgba(15,8,32,0.95)', color: '#f8fafc', border: '1px solid rgba(167,139,250,0.4)', fontFamily: "'Outfit',sans-serif" }, duration: 2000 }} />
      {/* Loading state while checking auth */}
      {view===null&&(
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <LogoIcon size="lg"/>
        </div>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {showBetaModal&&<BetaWelcomeModal onDismiss={handleBetaModalDismiss}/>}
      </AnimatePresence>
      <AnimatePresence>
        {coinToast&&<CoinToast toast={coinToast}/>}
      </AnimatePresence>

      {/* Onboarding flow — animated transitions */}
      <AnimatePresence mode="wait">
        {view==='splash'&&(
          <motion.div key="splash" style={wrapFull} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.3}}>
            <SplashScreen onDone={handleSplashDone}/>
          </motion.div>
        )}
        {view==='auth'&&(
          <motion.div key="auth" style={wrapFull} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,transition:{duration:0}}}>
            <AuthScreen onAuth={handleAuth}/>
          </motion.div>
        )}
        {view==='onboarding'&&(
          <motion.div key="ob" style={wrapFull} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,transition:{duration:0}}}>
            <OnboardingScreen onDone={()=>setView(askAliasAfterOnboarding?'name':'lang')}/>
          </motion.div>
        )}
        {view==='name'&&(
          <motion.div key="name" style={wrapFull} initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} exit={{opacity:0,transition:{duration:0}}}>
            <NameScreen onDone={n=>{setUserName(n);setView('lang');}}/>
          </motion.div>
        )}
        {view==='lang'&&(
          <motion.div key="lang" style={wrapFull} initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} exit={{opacity:0,transition:{duration:0}}}>
            <LanguageScreen onDone={handleLangDone}/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main app views — NO animations, render instantly */}
      {view==='chat'&&(
        <div style={wrapFull}>
          <div style={chatLayoutStyle}>
            {isDesktop&&(
              <div style={sidebarWrapperStyle}>
                <DesktopSidebar authUser={authUser} activeVibe={activeVibe} setActiveVibe={switchVibe} characters={characters} onOpenCreator={openCreator} onDeleteCharacter={handleDeleteCharacter} onEditCharacter={editCharacter} onOpenSettings={()=>setView('settings')} onOpenGossip={openGossip} language={language} setLanguage={setLanguage} startNewSession={startNewSession} chatSessions={chatSessions} activeSessionId={sessionId} onSwitchSession={switchSession} onDeleteSession={deleteSession} onRenameSession={renameSession}/>
              </div>
            )}
            <div style={chatWrapperStyle}>
              <ChatInterface {...chatViewProps}/>
            </div>
          </div>
        </div>
      )}

      {view==='gossip_chat'&&(
        <div style={wrapFull}>
          <GossipInterface setView={v=>setView(v==='chat'?'chat':v)} authUser={authUser} messages={gossipMessages} input={gossipInput} setInput={setGossipInput} sendMessage={sendGossipMessage} loading={gossipLoading} scrollRef={gossipScrollRef} isDesktop={isDesktop}/>
        </div>
      )}

      {view==='creator'&&(
        <div style={wrapFull}>
          {isDesktop?(
            <div style={{ display:'flex', height:'100%' }}>
              <div style={{ width:240, flexShrink:0, height:'100%' }}>
                <DesktopSidebar authUser={authUser} activeVibe={activeVibe} setActiveVibe={switchVibe} characters={characters} onOpenCreator={openCreator} onDeleteCharacter={handleDeleteCharacter} onEditCharacter={editCharacter} onOpenSettings={()=>setView('settings')} onOpenGossip={openGossip} language={language} setLanguage={setLanguage} startNewSession={startNewSession} chatSessions={chatSessions} activeSessionId={sessionId} onSwitchSession={switchSession} onDeleteSession={deleteSession} onRenameSession={renameSession}/>
              </div>
              <div style={{ flex:1, overflow:'hidden', position:'relative', height:'100%' }}>
                <CharacterCreator onBack={()=>{setEditingCharacter(null);setView('chat');}} onSave={handleCharacterSaved} language={language} isDesktop={isDesktop} editingCharacter={editingCharacter}/>
              </div>
            </div>
          ):(
            <CharacterCreator onBack={()=>setView('chat')} onSave={handleCharacterSaved} language={language} isDesktop={isDesktop}/>
          )}
        </div>
      )}

      {view==='settings'&&(
        <div style={wrapFull}>
          <SettingsScreen authUser={authUser} onBack={()=>setView('chat')} language={language} setLanguage={setLanguage} onLogout={handleLogout} isDesktop={isDesktop}/>
        </div>
      )}
    </AppBg>
  );
}

export default App;
