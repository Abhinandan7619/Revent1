import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  { id: 'Protective Sister', icon: '🛡️', desc: 'Defensive, fierce energy',                color: '#f472b6' },
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
const ROLE_COLORS = {
  'Close Cousin': '#a78bfa', 'Office Bro': '#60a5fa', 'Childhood Buddy': '#34d399',
  'Chill Ex': '#fbbf24', 'Blunt Senior': '#f87171', 'Protective Sister': '#f472b6',
};
const RE_DEFAULT = { id: 'default', label: 'RE', emoji: null, color: '#a78bfa', config: {} };
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
const stepTitle = { fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: -0.3 };

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
        <div style={{ fontSize:13, color:'rgba(248,250,252,0.35)', marginBottom:28 }}>Your private space is ready. Say whatever. RE is listening.</div>
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
      title: <>Create your {GT('own')} companions.</>,
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
                Beyond RE, design up to <span style={{ color:'#f472b6', fontWeight:700 }}>3 custom personas</span> — each with their own vibe, traits, and energy.
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

// ─── Character Creator ────────────────────────────────────────────────────────
const CharacterCreator = ({ onBack, onSave, language, isDesktop }) => {
  const [step,setStep]=useState(1);
  const [tempChar,setTempChar]=useState({ base_role:'Close Cousin', traits:[], energy:50, quirks:[], memory_hook:'', label:'' });
  const [quirkInput,setQuirkInput]=useState('');
  const [isRefining,setIsRefining]=useState(false);
  const [saving,setSaving]=useState(false);
  const avatarColor=ROLE_COLORS[tempChar.base_role]||'#a78bfa';

  const toggleTrait=(id)=>{
    if(tempChar.traits.includes(id)) setTempChar({...tempChar,traits:tempChar.traits.filter(t=>t!==id)});
    else if(tempChar.traits.length<4) setTempChar({...tempChar,traits:[...tempChar.traits,id]});
  };
  const addQuirk=()=>{ if(quirkInput&&tempChar.quirks.length<2){setTempChar({...tempChar,quirks:[...tempChar.quirks,quirkInput]});setQuirkInput('');} };
  const refineBackstory=async()=>{
    if(!tempChar.memory_hook)return;
    setIsRefining(true);
    try{ const res=await api.post('/api/refine-backstory',{draft_text:tempChar.memory_hook,language}); setTempChar({...tempChar,memory_hook:res.data.refined_text}); }catch{}
    finally{setIsRefining(false);}
  };
  const saveAndExit=async()=>{
    setSaving(true);
    try{
      const res=await api.post('/api/characters',{...tempChar, label: tempChar.base_role});
      onSave(res.data);
    }catch(err){
      alert(err.response?.data?.detail||'Failed to save character');
    }finally{setSaving(false);}
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={topbar}>
        <button onClick={onBack} style={iconBtn}>←</button>
        <div><div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:16 }}>Design Persona</div><div style={{ fontSize:10, color:'rgba(248,250,252,0.25)' }}>Craft your AI companion</div></div>
        <div style={{ width:38 }}/>
      </div>
      <div style={{ position:'relative', background:'linear-gradient(to bottom,rgba(10,5,25,0.9),rgba(10,5,25,0.4))', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}><div style={{ width:128, height:128, borderRadius:'50%', background:avatarColor, filter:'blur(48px)', opacity:0.15 }}/></div>
        <Avatar3D color={avatarColor} energy={tempChar.energy} height={isDesktop ? 160 : 130}/>
        <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(12px)', padding:'5px 12px', borderRadius:99, border:'1px solid rgba(255,255,255,0.1)', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
          <span>{BASE_ROLES.find(r=>r.id===tempChar.base_role)?.icon}</span>
          <span style={{ color:avatarColor }}>{tempChar.base_role}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:4, padding: isDesktop ? '14px 16px 8px' : '10px 12px 6px' }}>
        {[1,2,3,4,5].map(i=>(<div key={i} style={{ height:3, flex:1, borderRadius:99, background:step>=i?avatarColor:'rgba(255,255,255,0.08)', transition:'all 0.4s' }}/>))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding: isDesktop ? '8px 16px 16px' : '6px 12px 12px' }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.18}} style={{ paddingTop:8 }}>
            {step===1&&(
              <>
                <div style={stepTitle}>Choose a Vibe</div>
                <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap:10, marginTop:12 }}>
                  {BASE_ROLES.map(role=>(
                    <button key={role.id} data-testid={`role-${role.id}`} onClick={()=>setTempChar({...tempChar,base_role:role.id})}
                      style={{ padding:'14px 12px', borderRadius:14, border:`1px solid ${tempChar.base_role===role.id?role.color+'60':'rgba(255,255,255,0.07)'}`, background:tempChar.base_role===role.id?role.color+'18':'rgba(255,255,255,0.03)', textAlign:'left', cursor:'pointer', transition:'all 0.2s' }}>
                      <div style={{ fontSize:24, marginBottom:6 }}>{role.icon}</div>
                      <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:12 }}>{role.id}</div>
                      <div style={{ fontSize:10, color:'rgba(248,250,252,0.35)', marginTop:2 }}>{role.desc}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
            {step===2&&(
              <>
                <div style={stepTitle}>Add Flavor</div>
                <p style={{ fontSize:11, color:'rgba(248,250,252,0.3)', marginTop:4, marginBottom:12 }}>Pick up to 4 traits</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {TRAITS.map(t=>(
                    <button key={t.id} onClick={()=>toggleTrait(t.id)}
                      style={{ padding:'8px 14px', borderRadius:99, fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:5, cursor:'pointer', border:`1px solid ${tempChar.traits.includes(t.id)?avatarColor+'70':'rgba(255,255,255,0.08)'}`, background:tempChar.traits.includes(t.id)?avatarColor+'20':'rgba(255,255,255,0.04)', color:tempChar.traits.includes(t.id)?'#fff':'rgba(255,255,255,0.45)', transition:'all 0.15s' }}>
                      <span>{t.emoji}</span>{t.id}
                    </button>
                  ))}
                </div>
              </>
            )}
            {step===3&&(
              <>
                <div style={stepTitle}>Energy Level</div>
                <div style={{ background:'rgba(255,255,255,0.03)', padding:'24px 20px', borderRadius:14, border:'1px solid rgba(255,255,255,0.06)', textAlign:'center', marginTop:12 }}>
                  <div style={{ fontSize:52, marginBottom:20 }}>{tempChar.energy>70?'🔥':tempChar.energy<40?'🧘':'🙂'}</div>
                  <input type="range" min="0" max="100" value={tempChar.energy} onChange={e=>setTempChar({...tempChar,energy:parseInt(e.target.value)})} style={{ width:'100%', accentColor:avatarColor }}/>
                  <div style={{ marginTop:12, fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, color:avatarColor }}>{tempChar.energy}% Intensity</div>
                </div>
              </>
            )}
            {step===4&&(
              <>
                <div style={stepTitle}>Quirks</div>
                <div style={{ display:'flex', gap:8, marginTop:12, marginBottom:10 }}>
                  <input style={{ ...inputCss, flex:1, padding:'12px 14px' }} type="text" value={quirkInput} onChange={e=>setQuirkInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addQuirk()} placeholder="e.g. Always starts with 'Listen…'"/>
                  <button onClick={addQuirk} style={{ padding:'12px 16px', background:avatarColor, border:'none', borderRadius:10, color:'#fff', fontWeight:800, fontSize:18, cursor:'pointer' }}>+</button>
                </div>
                {tempChar.quirks.map(q=>(
                  <div key={q} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, fontSize:13, color:'rgba(248,250,252,0.6)', marginBottom:8 }}>
                    <span>{q}</span>
                    <button onClick={()=>setTempChar({...tempChar,quirks:tempChar.quirks.filter(x=>x!==q)})} style={{ background:'none', border:'none', color:'rgba(248,250,252,0.3)', cursor:'pointer', fontSize:16 }}>×</button>
                  </div>
                ))}
              </>
            )}
            {step===5&&(
              <>
                <div style={stepTitle}>Backstory</div>
                <p style={{ fontSize:11, color:'rgba(248,250,252,0.3)', marginTop:4, marginBottom:12 }}>Write a rough idea, then hit the wand ✨</p>
                <div style={{ position:'relative' }}>
                  <textarea style={{ ...inputCss, minHeight:120, resize:'none', lineHeight:1.6 }} value={tempChar.memory_hook} onChange={e=>setTempChar({...tempChar,memory_hook:e.target.value})} placeholder="e.g. We survived high school together…"/>
                  <button onClick={refineBackstory} disabled={isRefining||!tempChar.memory_hook}
                    style={{ position:'absolute', bottom:12, right:12, width:36, height:36, borderRadius:8, background:avatarColor, border:'none', color:'#fff', fontSize:16, cursor:'pointer', opacity:(!isRefining&&tempChar.memory_hook)?1:0.4, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {isRefining?'⟳':'✨'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={{ padding: isDesktop ? '12px 16px' : '10px 12px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.7)', backdropFilter:'blur(16px)', flexShrink:0 }}>
        {step<5
          ? <button onClick={()=>setStep(step+1)} style={{ ...btnPrimary, background:`linear-gradient(90deg,${avatarColor},#34d399)` }}>Next Step →</button>
          : <button data-testid="launch-character-btn" onClick={saveAndExit} disabled={saving} style={{ ...btnPrimary, background:`linear-gradient(90deg,${avatarColor},#34d399)`, opacity:saving?0.7:1 }}>{saving?'Saving…':'Launch Character ✨'}</button>
        }
      </div>
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
  const bubbleMaxWidth = isDesktop ? '82%' : '95%';

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{type:'spring',stiffness:280,damping:28}}
      style={{ display:'flex', flexDirection:'column', maxWidth:bubbleMaxWidth, alignSelf:'flex-start' }}>
      {msg.role==='ai'&&meta&&(
        <div style={{ fontSize:10, letterSpacing:1.2, textTransform:'uppercase', marginBottom:5, paddingLeft:2 }}>
          <span style={{ color:'rgba(248,250,252,0.4)' }}>RE · </span>
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
const GossipBubble = ({ msg, isDesktop }) => (
  <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{type:'spring',stiffness:280,damping:28}}
    style={{ display:'flex', flexDirection:'column', maxWidth:isDesktop ? '82%' : '95%', alignSelf:'flex-start' }}>
    {msg.role==='ai'&&(
      <div style={{ fontSize:10, letterSpacing:1.2, textTransform:'uppercase', marginBottom:5 }}>
        <span style={{ color:'rgba(251,191,36,0.5)' }}>RE · </span>
        <span style={{ color:'#fbbf24', fontWeight:600 }}>GOSSIP</span>
      </div>
    )}
    {msg.role==='user'&&<div style={{ fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(248,250,252,0.25)', marginBottom:4, textAlign:'left' }}>You</div>}
    <div style={{ padding:isDesktop ? '12px 16px' : '10px 12px', fontSize:isDesktop ? 14 : 13, lineHeight:1.7, backdropFilter:'blur(16px)',
      ...(msg.role==='user'?{background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.22)',borderRadius:14}:{background:'rgba(251,191,36,0.04)',border:'1px solid rgba(251,191,36,0.12)',borderRadius:'2px 14px 14px 14px'})
    }}>{msg.content}</div>
  </motion.div>
);

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
        <span style={{ fontSize:9, fontWeight:600, color:activeVibe==='default'?'#a78bfa':'rgba(248,250,252,0.4)', letterSpacing:0.5, whiteSpace:'nowrap' }}>RE</span>
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
const DesktopSidebar = ({ authUser, activeVibe, setActiveVibe, characters, onOpenCreator, onDeleteCharacter, onOpenSettings, onOpenGossip, language, setLanguage, startNewSession, chatSessions, activeSessionId, onSwitchSession, onDeleteSession, onRenameSession }) => {
  const canCreate = characters.length < 3;
  const [renamingId, setRenamingId] = React.useState(null);
  const [renameVal, setRenameVal] = React.useState('');
  const [newChatName, setNewChatName] = React.useState('');
  const [showNewInput, setShowNewInput] = React.useState(false);
  const defaultSessions = activeVibe === 'default' ? (chatSessions||[]) : [];
  const canAddSession = defaultSessions.length < 2;

  const handleRenameStart = (s) => { setRenamingId(s.session_id); setRenameVal(s.title||'New Chat'); };
  const handleRenameSubmit = (sid) => { onRenameSession(sid, renameVal); setRenamingId(null); };
  const handleNewChat = () => {
    if(!canAddSession){ alert('Max 2 sessions. Delete one to create a new chat.'); return; }
    setShowNewInput(true); setNewChatName('');
  };
  const handleNewChatSubmit = () => {
    const t = newChatName.trim() || 'New Chat';
    startNewSession(t); setShowNewInput(false); setNewChatName('');
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', padding:'20px 16px', overflowY:'auto', borderRight:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.6)', backdropFilter:'blur(20px)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:24, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <LogoIcon size="sm"/>
        <div>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:16, background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>ReVent</div>
          <div style={{ fontSize:8, color:'rgba(248,250,252,0.2)', letterSpacing:2, textTransform:'uppercase' }}>Re · In · Venting · Space</div>
        </div>
      </div>
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
      <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(167,139,250,0.5)', textTransform:'uppercase', marginTop:16, marginBottom:10 }}>Companions</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {/* User characters */}
        {characters.map(c=>{
          const color = ROLE_COLORS[c.base_role]||'#a78bfa';
          const icon = BASE_ROLES.find(r=>r.id===c.base_role)?.icon||'✨';
          return (
            <div key={c.character_id} style={{ display:'flex', alignItems:'center', gap:0 }}>
              <motion.button data-testid={`sidebar-vibe-${c.character_id}`} onClick={()=>setActiveVibe(c.character_id)} whileTap={{scale:0.97}}
                style={{ flex:1, display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'12px 0 0 12px', border:`1px solid ${activeVibe===c.character_id?color+'50':'rgba(255,255,255,0.05)'}`, borderRight:'none', background:activeVibe===c.character_id?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', transition:'all 0.2s', textAlign:'left' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:activeVibe===c.character_id?color+'20':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>{icon}</div>
                <span style={{ fontSize:13, fontWeight:600, color:activeVibe===c.character_id?'#fff':'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.label||c.base_role}</span>
                {activeVibe===c.character_id&&<span style={{ marginLeft:'auto', color, fontSize:12 }}>●</span>}
              </motion.button>
              <button data-testid={`delete-char-${c.character_id}`} onClick={()=>onDeleteCharacter(c.character_id)}
                style={{ padding:'10px 10px', borderRadius:'0 12px 12px 0', border:`1px solid ${activeVibe===c.character_id?color+'50':'rgba(255,255,255,0.05)'}`, borderLeft:'none', background:activeVibe===c.character_id?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:12, color:'rgba(248,113,113,0.6)', transition:'all 0.2s', display:'flex', alignItems:'center', height:'100%' }}
                title="Delete character">×</button>
            </div>
          );
        })}
        {/* Current chats UI moved inside Companions */}
        {activeVibe==='default'&&(
          <div style={{ marginTop:4 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {defaultSessions.map(s=>(
                <div key={s.session_id} style={{ display:'flex', alignItems:'center', gap:0, borderRadius:10, border:`1px solid ${s.session_id===activeSessionId?'rgba(167,139,250,0.3)':'rgba(255,255,255,0.05)'}`, background:s.session_id===activeSessionId?'rgba(167,139,250,0.1)':'rgba(255,255,255,0.03)', overflow:'hidden' }}>
                  {renamingId===s.session_id?(
                    <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                      onBlur={()=>handleRenameSubmit(s.session_id)}
                      onKeyDown={e=>{ if(e.key==='Enter')handleRenameSubmit(s.session_id); if(e.key==='Escape')setRenamingId(null); }}
                      style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:12, padding:'9px 10px', fontFamily:"'Outfit',sans-serif" }}/>
                  ):(
                    <button onClick={()=>onSwitchSession(s.session_id)} onDoubleClick={()=>handleRenameStart(s)}
                      title="Click to open · Double-click to rename"
                      style={{ flex:1, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:'9px 10px', color:s.session_id===activeSessionId?'#fff':'rgba(248,250,252,0.5)', fontSize:12, fontWeight:s.session_id===activeSessionId?600:400, fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.title||'New Chat'}
                    </button>
                  )}
                  <button onClick={()=>onDeleteSession(s.session_id)} title="Delete session"
                    style={{ background:'transparent', border:'none', cursor:'pointer', padding:'9px 8px', color:'rgba(248,113,113,0.5)', fontSize:13, flexShrink:0, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
            {showNewInput?(
              <div style={{ marginTop:6, display:'flex', gap:4 }}>
                <input autoFocus value={newChatName} onChange={e=>setNewChatName(e.target.value)} placeholder="Chat name…"
                  onKeyDown={e=>{ if(e.key==='Enter')handleNewChatSubmit(); if(e.key==='Escape'){setShowNewInput(false);} }}
                  style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'7px 10px', color:'#fff', fontSize:12, outline:'none', fontFamily:"'Outfit',sans-serif" }}/>
                <button onClick={handleNewChatSubmit} style={{ background:'rgba(52,211,153,0.15)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:8, color:'#34d399', fontSize:12, padding:'0 10px', cursor:'pointer' }}>+</button>
              </div>
            ):canAddSession?(
              <motion.button data-testid="sidebar-new-chat-btn" onClick={handleNewChat} whileTap={{scale:0.97}}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, border:'1px dashed rgba(52,211,153,0.25)', background:'transparent', cursor:'pointer', marginTop:6, width:'100%' }}>
                <span style={{ fontSize:14, color:'rgba(52,211,153,0.6)' }}>+</span>
                <span style={{ fontSize:12, fontWeight:500, color:'rgba(52,211,153,0.6)', fontFamily:"'Outfit',sans-serif" }}>New Chat</span>
              </motion.button>
            ):(
              <div style={{ marginTop:6, padding:'7px 10px', borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', fontSize:11, color:'rgba(248,250,252,0.25)', textAlign:'center' }}>Max 2 chats · delete one to add</div>
            )}
          </div>
        )}
        {canCreate&&(
          <motion.button data-testid="sidebar-create-btn" onClick={onOpenCreator} whileTap={{scale:0.97}}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, border:'1px dashed rgba(255,255,255,0.1)', background:'transparent', cursor:'pointer', textAlign:'left' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>+</div>
            <span style={{ fontSize:13, fontWeight:600, color:'rgba(248,250,252,0.3)', fontFamily:"'Outfit',sans-serif" }}>Create Persona</span>
          </motion.button>
        )}
      </div>
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
      <motion.button data-testid="sidebar-settings-btn" onClick={onOpenSettings} whileTap={{scale:0.97}}
        style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, border:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.03)', cursor:'pointer', marginTop:16, width:'100%' }}>
        <span style={{ fontSize:16 }}>⚙️</span>
        <span style={{ fontSize:13, color:'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>Settings</span>
      </motion.button>
    </div>
  );
};

// ─── Mobile Drawer ───────────────────────────────────────────────────────────
const MobileDrawer = ({ isOpen, onClose, authUser, activeVibe, setActiveVibe, characters, onOpenCreator, onDeleteCharacter, onOpenSettings, onOpenGossip, language, setLanguage, startNewSession, chatSessions, activeSessionId, onSwitchSession, onDeleteSession, onRenameSession }) => {
  const [renamingId, setRenamingId] = React.useState(null);
  const [renameVal, setRenameVal] = React.useState('');
  const defaultSessions = activeVibe === 'default' ? (chatSessions||[]) : [];
  const canAddSession = defaultSessions.length < 2;
  const canCreate = characters.length < 3;

  const handleRenameStart = (s) => { setRenamingId(s.session_id); setRenameVal(s.title||'New Chat'); };
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
          {/* Companions */}
          <div style={{ fontSize:9, letterSpacing:2.5, color:'rgba(167,139,250,0.5)', textTransform:'uppercase', marginTop:14, marginBottom:8 }}>Companions</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {characters.map(c=>{
              const color = ROLE_COLORS[c.base_role]||'#a78bfa';
              const icon = BASE_ROLES.find(r=>r.id===c.base_role)?.icon||'✨';
              return (
                <div key={c.character_id} style={{ display:'flex', alignItems:'center', gap:0 }}>
                  <motion.button onClick={()=>{setActiveVibe(c.character_id);onClose();}} whileTap={{scale:0.97}}
                    style={{ flex:1, display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'12px 0 0 12px', border:`1px solid ${activeVibe===c.character_id?color+'50':'rgba(255,255,255,0.05)'}`, borderRight:'none', background:activeVibe===c.character_id?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:activeVibe===c.character_id?color+'20':'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{icon}</div>
                    <span style={{ fontSize:13, fontWeight:600, color:activeVibe===c.character_id?'#fff':'rgba(248,250,252,0.5)', fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.label||c.base_role}</span>
                  </motion.button>
                  <button onClick={()=>{onDeleteCharacter(c.character_id);onClose();}}
                    style={{ padding:'10px 10px', borderRadius:'0 12px 12px 0', border:`1px solid ${activeVibe===c.character_id?color+'50':'rgba(255,255,255,0.05)'}`, borderLeft:'none', background:activeVibe===c.character_id?color+'15':'rgba(255,255,255,0.03)', cursor:'pointer', fontSize:12, color:'rgba(248,113,113,0.6)' }}
                    title="Delete character">×</button>
                </div>
              );
            })}
            {/* Current chats UI moved inside Companions */}
            {activeVibe==='default'&&(
              <div style={{ marginTop:2 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {defaultSessions.map(s=>(
                    <div key={s.session_id} style={{ display:'flex', alignItems:'center', gap:0, borderRadius:10, border:`1px solid ${s.session_id===activeSessionId?'rgba(167,139,250,0.3)':'rgba(255,255,255,0.05)'}`, background:s.session_id===activeSessionId?'rgba(167,139,250,0.1)':'rgba(255,255,255,0.03)', overflow:'hidden' }}>
                      {renamingId===s.session_id?(
                        <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onBlur={()=>handleRenameSubmit(s.session_id)}
                          onKeyDown={e=>{ if(e.key==='Enter')handleRenameSubmit(s.session_id); if(e.key==='Escape')setRenamingId(null); }}
                          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:12, padding:'9px 10px', fontFamily:"'Outfit',sans-serif" }}/>
                      ):(
                        <button onClick={()=>{onSwitchSession(s.session_id);onClose();}} onDoubleClick={()=>handleRenameStart(s)}
                          title="Click to open · Double-click to rename"
                          style={{ flex:1, background:'transparent', border:'none', cursor:'pointer', textAlign:'left', padding:'9px 10px', color:s.session_id===activeSessionId?'#fff':'rgba(248,250,252,0.5)', fontSize:12, fontWeight:s.session_id===activeSessionId?600:400, fontFamily:"'Outfit',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {s.title||'New Chat'}
                        </button>
                      )}
                      <button onClick={()=>onDeleteSession(s.session_id)} title="Delete session"
                        style={{ background:'transparent', border:'none', cursor:'pointer', padding:'9px 8px', color:'rgba(248,113,113,0.5)', fontSize:13, flexShrink:0 }}>×</button>
                    </div>
                  ))}
                </div>
                {canAddSession&&(
                  <motion.button onClick={()=>{startNewSession();onClose();}} whileTap={{scale:0.97}}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10, border:'1px dashed rgba(52,211,153,0.25)', background:'transparent', cursor:'pointer', marginTop:6, width:'100%' }}>
                    <span style={{ fontSize:14, color:'rgba(52,211,153,0.6)' }}>+</span>
                    <span style={{ fontSize:12, fontWeight:500, color:'rgba(52,211,153,0.6)', fontFamily:"'Outfit',sans-serif" }}>New Chat</span>
                  </motion.button>
                )}
              </div>
            )}
            {canCreate&&(
              <motion.button onClick={()=>{onOpenCreator();onClose();}} whileTap={{scale:0.97}}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:12, border:'1px dashed rgba(255,255,255,0.1)', background:'transparent', cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>+</div>
                <span style={{ fontSize:13, fontWeight:600, color:'rgba(248,250,252,0.3)', fontFamily:"'Outfit',sans-serif" }}>Create Persona</span>
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
const ChatInterface = ({ activeVibe, setActiveVibe, setView, characters, onOpenCreator, onDeleteCharacter, intensity, baseline, manualMode, setManualMode, authUser, messages, input, setInput, sendMessage, loading, scrollRef, language, setLanguage, isDesktop, onOpenGossip, startNewSession, chatSessions, sessionId, onSwitchSession, onDeleteSession, onRenameSession, onOpenSettings }) => {
  const activeChar = characters.find(c=>c.character_id===activeVibe);
  const accentColor = activeChar ? (ROLE_COLORS[activeChar.base_role]||'#a78bfa') : '#a78bfa';
  const lastAiMsg = [...messages].reverse().find(m=>m.role==='ai');
  const isCrisis = lastAiMsg?.mode === 'CRISIS';
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', position:'relative' }}>
      {/* Mobile Drawer */}
      {!isDesktop&&(
        <AnimatePresence>
          {drawerOpen&&(
            <MobileDrawer isOpen={drawerOpen} onClose={()=>setDrawerOpen(false)}
              authUser={authUser} activeVibe={activeVibe} setActiveVibe={setActiveVibe}
              characters={characters} onOpenCreator={onOpenCreator} onDeleteCharacter={onDeleteCharacter}
              onOpenSettings={onOpenSettings||(() => setView('settings'))} onOpenGossip={onOpenGossip||(() => setView('gossip_chat'))}
              language={language} setLanguage={setLanguage}
              startNewSession={startNewSession} chatSessions={chatSessions} activeSessionId={sessionId}
              onSwitchSession={onSwitchSession} onDeleteSession={onDeleteSession} onRenameSession={onRenameSession}/>
          )}
        </AnimatePresence>
      )}

      {/* Topbar */}
      <div style={topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {!isDesktop&&(
            <button onClick={()=>setDrawerOpen(true)} style={{ ...iconBtn, width:34, height:34, fontSize:18, background:'rgba(255,255,255,0.06)' }}>☰</button>
          )}
          <LogoIcon size="sm"/>
          <div>
            <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:14, background:'linear-gradient(90deg,#a78bfa,#34d399)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>RE</div>
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

      {/* Mode chips — compact on mobile */}
      <div data-testid="mode-chips" style={{ display:'flex', gap: isDesktop ? 6 : 4, padding: isDesktop ? '8px 14px' : '6px 10px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.5)', overflowX:'auto', flexShrink:0, pointerEvents:isCrisis?'none':'auto', opacity:isCrisis?0.3:1, transition:'opacity 0.3s', scrollbarWidth:'none' }}>
        {[{id:'AUTO',label:'⚡ AUTO'},{id:'HEAR_ME',label:'💙 HEAR ME'},{id:'BACK_ME',label:'🔥 BACK ME'},{id:'BE_REAL',label:'🧠 BE REAL'}].map(m=>(
          <button key={m.id} data-testid={`mode-chip-${m.id}`} onClick={()=>setManualMode(m.id)}
            style={{ display:'inline-flex', alignItems:'center', gap: isDesktop ? 6 : 4, padding: isDesktop ? '6px 14px' : '5px 10px', borderRadius:99, border:`1px solid ${manualMode===m.id?accentColor+'55':'rgba(255,255,255,0.06)'}`, background:manualMode===m.id?accentColor+'18':'rgba(255,255,255,0.04)', fontSize: isDesktop ? 12 : 11, fontWeight:500, color:manualMode===m.id?accentColor:'rgba(248,250,252,0.5)', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.2s', flexShrink:0 }}>
            {m.label}
          </button>
        ))}
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
      <div data-testid="chat-messages" style={{ flex:1, overflowY:'auto', padding: isDesktop ? '16px 16px 8px' : '12px 10px 8px', display:'flex', flexDirection:'column', gap: isDesktop ? 12 : 8 }}>
        {messages.map((msg,i)=><ChatBubble key={i} msg={msg} isDesktop={isDesktop}/>)}
        {loading&&(
          <div style={{ alignSelf:'flex-start' }}>
            <div style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'2px 14px 14px 14px' }}>
              <TypingDots color={accentColor}/>
            </div>
          </div>
        )}
        <div ref={scrollRef}/>
      </div>

      {/* Emotion bar — compact on mobile */}
      <div style={{ pointerEvents:isCrisis?'none':'auto', opacity:isCrisis?0.3:1, transition:'opacity 0.3s' }}>
        <EmotionBar onEmotion={setManualMode} manualMode={manualMode} isDesktop={isDesktop}/>
      </div>

      {/* Input */}
      <div style={{ padding: isDesktop ? '10px 14px' : '8px 10px', borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,5,22,0.8)', backdropFilter:'blur(16px)', flexShrink:0, position:'relative' }}>
        {isDesktop&&<GossipFloatingBtn onClick={()=>setView('gossip_chat')} isDesktop={isDesktop}/>}
        <div style={{ display:'flex', gap:8, paddingRight: isDesktop ? 80 : 0 }}>
          <textarea data-testid="chat-input" style={{ ...textareaCss, flex:1, fontSize: isDesktop ? 14 : 15, padding: isDesktop ? '13px 16px' : '11px 14px' }} value={input} onChange={e=>setInput(e.target.value)} placeholder="Just say it…" rows={1}
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
  const [loading,setLoading]=useState(false);
  const [gossipLoading,setGossipLoading]=useState(false);
  const [coinToast,setCoinToast]=useState(null);
  const [chatSessions,setChatSessions]=useState([]);

  const scrollRef=useRef(null);
  const gossipScrollRef=useRef(null);
  const coinToastRef=useRef(null);
  const windowWidth=useWindowWidth();
  const isDesktop=windowWidth>=768;

  // Load chat history for current session from DB
  const loadChatHistory=async(sid)=>{
    if(!sid)return false;
    try{
      const res=await api.get(`/api/chat/history/${sid}`);
      const msgs=(res.data||[]).map(m=>({role:m.role==='ai'?'ai':'user',content:m.content,mode:m.mode}));
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
          try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
        }

        if(savedView && ['chat','settings','creator','gossip_chat'].includes(savedView)){
          setView(savedView);
        } else {
          setView('chat');
        }
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
      if(user.onboarding_complete){ setView('chat'); }
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
    setAskAliasAfterOnboarding(false);
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
            try{ await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:'default',title:'My Chats'}); await loadSessions('default'); }catch{}
          }
          try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
        }
        setView('chat');
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
      try{ await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:vibeId,title:'My Chats'}); await loadSessions(vibeId); }catch{}
      if(vibeId==='default'){
        try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
      } else {
        setMessages([{role:'ai',content:'Hey! Ready to talk? 😊',mode:'AUTO'}]);
      }
    }
  };

  const getPersonaConfig=()=>{
    const char = characters.find(c=>c.character_id===activeVibe);
    if(char) return { base_role:char.base_role, traits:char.traits, energy:char.energy, quirks:char.quirks, memory_hook:char.memory_hook };
    return {};
  };

  const showCoinNotif=(deducted,remaining)=>{
    if(coinToastRef.current)clearTimeout(coinToastRef.current);
    setCoinToast({deducted,remaining});
    coinToastRef.current=setTimeout(()=>setCoinToast(null),3000);
  };

  const sendMessage=async()=>{
    if(!input.trim()||loading)return;
    const userMsg={role:'user',content:input};
    setMessages(prev=>[...prev,userMsg]);
    setInput('');setLoading(true);
    try{
      const res=await api.post('/api/chat',{message:userMsg.content,session_id:sessionId,language,manual_mode:manualMode,persona_config:getPersonaConfig(),force_vault:false});
      setMessages(prev=>[...prev,{role:'ai',content:res.data.response,mode:res.data.mode}]);
      setIntensity(res.data.intensity_score||0);
      setBaseline(res.data.emotional_baseline||5);
      if(res.data.coins_remaining!==undefined)setAuthUser(prev=>prev?{...prev,coins:res.data.coins_remaining}:prev);
      if(res.data.coins_deducted>0)showCoinNotif(res.data.coins_deducted,res.data.coins_remaining);
    }catch{
      setMessages(prev=>[...prev,{role:'system',content:'⚠️ Connection failed. Try again.'}]);
    }finally{setLoading(false);}
  };

  const sendGossipMessage=async()=>{
    if(!gossipInput.trim()||gossipLoading)return;
    const userMsg={role:'user',content:gossipInput};
    setGossipMessages(prev=>[...prev,userMsg]);
    setGossipInput('');setGossipLoading(true);
    try{
      const res=await api.post('/api/chat',{message:userMsg.content,session_id:gossipSessionId,language,manual_mode:'GOSSIP',persona_config:{},force_vault:true});
      setGossipMessages(prev=>[...prev,{role:'ai',content:res.data.response,mode:'GOSSIP'}]);
    }catch{
      setGossipMessages(prev=>[...prev,{role:'system',content:'⚠️ Connection failed.'}]);
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
    try{ await api.post('/api/chat/sessions',{session_id:newSid,vibe_id:'default',title:'My Chats'}); await loadSessions('default'); }catch{}
    // Load personalized welcome
    try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
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
  const openCreator=()=>{ if(characters.length>=3)return; setView('creator'); };
  const handleCharacterSaved=(newChar)=>{
    setCharacters(prev=>[...prev,newChar]);
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
          try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
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
      try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
    } else {
      setMessages([{role:'ai',content:'Hey! Ready to talk? 😊',mode:'AUTO'}]);
    }
  };

  const switchSession=async(sid)=>{
    if(sid===sessionId)return;
    setSessionId(sid);
    setMessages([]);
    await loadChatHistory(sid);
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
            try{ const wRes=await api.get('/api/chat/welcome'); setMessages(wRes.data.messages||[]); }catch{ setMessages([WELCOME_MESSAGE]); }
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
    characters,onOpenCreator:openCreator,onDeleteCharacter:handleDeleteCharacter,
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
            <OnboardingScreen onDone={()=>setView(askAliasAfterOnboarding?'name':'chat')}/>
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
          {isDesktop?(
            <div style={{ display:'flex', height:'100%' }}>
              <div style={{ width:240, flexShrink:0, height:'100%' }}>
                <DesktopSidebar authUser={authUser} activeVibe={activeVibe} setActiveVibe={switchVibe} characters={characters} onOpenCreator={openCreator} onDeleteCharacter={handleDeleteCharacter} onOpenSettings={()=>setView('settings')} onOpenGossip={openGossip} language={language} setLanguage={setLanguage} startNewSession={startNewSession} chatSessions={chatSessions} activeSessionId={sessionId} onSwitchSession={switchSession} onDeleteSession={deleteSession} onRenameSession={renameSession}/>
              </div>
              <div style={{ flex:1, overflow:'hidden', position:'relative', height:'100%' }}>
                <ChatInterface {...chatViewProps}/>
              </div>
            </div>
          ):(
            <ChatInterface {...chatViewProps}/>
          )}
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
                <DesktopSidebar authUser={authUser} activeVibe={activeVibe} setActiveVibe={switchVibe} characters={characters} onOpenCreator={openCreator} onDeleteCharacter={handleDeleteCharacter} onOpenSettings={()=>setView('settings')} onOpenGossip={openGossip} language={language} setLanguage={setLanguage} startNewSession={startNewSession} chatSessions={chatSessions} activeSessionId={sessionId} onSwitchSession={switchSession} onDeleteSession={deleteSession} onRenameSession={renameSession}/>
              </div>
              <div style={{ flex:1, overflow:'hidden', position:'relative', height:'100%' }}>
                <CharacterCreator onBack={()=>setView('chat')} onSave={handleCharacterSaved} language={language} isDesktop={isDesktop}/>
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
