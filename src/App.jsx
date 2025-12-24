import { lazy, Suspense, useEffect, useState, useRef, useMemo, useCallback, memo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, MapPin, Users, Shield, Clock, Eye, MessageCircle, ChevronRight,
  Phone, Lock, Camera, Check, Fingerprint, Hand, Briefcase, ChevronDown,
  CheckCircle2, X, Unlock, Flag, Bookmark, Send, MoreVertical, Settings,
  Compass, Bell, Trash2, LogOut, Smartphone, UserX, ArrowLeft, AlertTriangle,
  Wifi, WifiOff, RefreshCw, Heart, UserCheck, Image
} from 'lucide-react'

// ============ API CONFIG ============
const API_URL = 'http://localhost:5000/api'
let socket = null

const api = {
  async fetch(endpoint, options = {}) {
    const token = useStore.getState().user?.id
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  },
  get: (endpoint) => api.fetch(endpoint),
  post: (endpoint, body) => api.fetch(endpoint, { method: 'POST', body }),
  put: (endpoint, body) => api.fetch(endpoint, { method: 'PUT', body }),
}

// ============ STORE ============
const useStore = create(
  persist(
    (set, get) => ({
      screen: 'splash',
      prevScreen: null,
      isDiscoverable: true,
      isOnline: true,
      isLoading: false,
      user: { id: null, verified: false, gender: null, intent: 'friends', phone: '' },
      location: null,
      
      // Demo data (used when offline/backend unavailable)
      crossedPaths: [
        { id: 'bot_priya', profile_img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face', location: 'Fresh Bake Café', time_ago: '10m ago', intent: 'friends', i_recognized: false, i_waved: false, they_recognized: false, they_waved: false, mutual: false },
        { id: 'bot_arjun', profile_img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face', location: 'TechPark Building 5', time_ago: '25m ago', intent: 'network', i_recognized: false, i_waved: false, they_recognized: false, they_waved: false, mutual: false },
        { id: 'bot_ananya', profile_img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face', location: 'Metro Station', time_ago: '5m ago', intent: 'chat', i_recognized: true, i_waved: false, they_recognized: true, they_waved: false, mutual: false },
      ],
      
      chats: [],
      activeChat: null,
      activeMessages: [],
      selectedProfile: null,
      
      // Navigation
      go: (screen) => set(s => ({ prevScreen: s.screen, screen })),
      back: () => set(s => ({ screen: s.prevScreen || 'discovery', prevScreen: null })),
      
      // User
      setUser: (data) => set(s => ({ user: { ...s.user, ...data } })),
      setLoading: (isLoading) => set({ isLoading }),
      setOnline: (isOnline) => set({ isOnline }),
      
      // Location
      setLocation: (location) => set({ location }),
      
      // Discovery
      setCrossedPaths: (crossedPaths) => set({ crossedPaths }),
      updatePerson: (id, updates) => set(s => ({
        crossedPaths: s.crossedPaths.map(p => p.id === id ? { ...p, ...updates } : p)
      })),
      
      // Interactions
      recognize: async (targetId) => {
        const s = get()
        set(s => ({ crossedPaths: s.crossedPaths.map(p => p.id === targetId ? { ...p, i_recognized: true } : p) }))
        try {
          await api.post('/discover/interact', { target_id: targetId, type: 'recognize' })
          // Simulate bot response after delay
          setTimeout(() => {
            set(s => ({
              crossedPaths: s.crossedPaths.map(p => p.id === targetId ? { ...p, they_recognized: true } : p)
            }))
          }, 2000 + Math.random() * 2000)
        } catch (e) { console.log('Offline mode') }
      },
      
      wave: async (targetId) => {
        const s = get()
        set(s => ({ crossedPaths: s.crossedPaths.map(p => p.id === targetId ? { ...p, i_waved: true } : p) }))
        try {
          const res = await api.post('/discover/interact', { target_id: targetId, type: 'wave' })
          if (res.mutual) {
            set(s => ({
              crossedPaths: s.crossedPaths.map(p => p.id === targetId ? { ...p, they_waved: true, mutual: true, match_id: res.match_id } : p)
            }))
            return { mutual: true, match_id: res.match_id }
          }
        } catch (e) { console.log('Offline mode') }
        // Simulate bot wave back
        return new Promise(resolve => {
          setTimeout(() => {
            const isMutual = Math.random() > 0.2
            set(s => ({
              crossedPaths: s.crossedPaths.map(p => p.id === targetId ? { ...p, they_waved: isMutual, mutual: isMutual, match_id: isMutual ? `match_${Date.now()}` : null } : p)
            }))
            resolve({ mutual: isMutual })
          }, 2000 + Math.random() * 3000)
        })
      },
      
      // Chat
      setChats: (chats) => set({ chats }),
      openChat: (matchId, otherUser) => set({ activeChat: matchId, selectedProfile: otherUser, screen: 'chat' }),
      setActiveMessages: (activeMessages) => set({ activeMessages }),
      addMessage: (msg) => set(s => ({ activeMessages: [...s.activeMessages, msg] })),
      
      // Profile view
      viewProfile: (person) => set({ selectedProfile: person, screen: 'profile' }),
      
      // Settings
      toggle: (key) => set(s => ({ [key]: !s[key] })),
    }),
    { name: 'crossed-v2', partialize: (s) => ({ user: s.user, isDiscoverable: s.isDiscoverable }) }
  )
)

// ============ ANIMATION VARIANTS ============
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
}
const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

// ============ SHARED COMPONENTS ============
const Btn = memo(({ children, variant = 'primary', className = '', ...props }) => (
  <button
    className={`py-3 px-6 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${
      variant === 'primary' ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white' :
      variant === 'secondary' ? 'bg-dark-800 text-white hover:bg-dark-700' :
      'bg-transparent text-dark-400'
    } ${className}`}
    {...props}
  >{children}</button>
))

const IntentBadge = memo(({ intent }) => {
  const cfg = { friends: ['bg-blue-500', Users], chat: ['bg-pink-500', MessageCircle], network: ['bg-amber-500', Briefcase] }
  const [bg, Icon] = cfg[intent] || cfg.friends
  return <div className={`${bg} px-3 py-1.5 rounded-full flex items-center gap-1.5`}><Icon className="w-4 h-4 text-white" /><span className="text-white text-sm font-medium capitalize">{intent}</span></div>
})

const Glass = memo(({ children, className = '' }) => <div className={`glass rounded-2xl ${className}`}>{children}</div>)

// ============ SPLASH ============
const Splash = memo(() => {
  const go = useStore(s => s.go)
  useEffect(() => { const t = setTimeout(() => go('onboarding'), 2000); return () => clearTimeout(t) }, [go])
  
  return (
    <motion.div {...fadeVariants} className="h-full flex flex-col items-center justify-center">
      <motion.div className="relative" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
        <motion.div className="absolute inset-0 w-28 h-28 rounded-full border-2 border-primary-500/30" animate={{ scale: [1, 2], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity }} />
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-primary-500/30">
          <Eye className="w-14 h-14 text-white" />
        </div>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 text-4xl font-bold gradient-text">Saw You</motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-2 text-dark-400 text-center">Did they see you too?</motion.p>
    </motion.div>
  )
})

// ============ ONBOARDING ============
const slides = [
  { icon: MapPin, title: 'Same Place, Same Time', desc: 'Discover people you saw in real life.', color: 'from-pink-500 to-rose-500' },
  { icon: Eye, title: 'Privacy First', desc: 'See only photo. No names, no stalking possible.', color: 'from-purple-500 to-indigo-500' },
  { icon: Users, title: 'Mutual Consent Only', desc: 'Nothing happens unless both tap.', color: 'from-blue-500 to-cyan-500' },
  { icon: Clock, title: 'Time-Limited', desc: 'Profiles disappear after 30 minutes.', color: 'from-emerald-500 to-teal-500' },
  { icon: Shield, title: 'Built for Safety', desc: 'Screenshot protection, 1-tap reporting.', color: 'from-amber-500 to-orange-500' },
]

const Onboarding = memo(() => {
  const [i, setI] = useState(0)
  const go = useStore(s => s.go)
  const slide = slides[i]
  const Icon = slide.icon
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col p-6">
      <div className="flex justify-end"><button onClick={() => go('verify')} className="text-dark-400 text-sm">Skip</button></div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="text-center">
            <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${slide.color} flex items-center justify-center mb-6`}>
              <Icon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">{slide.title}</h2>
            <p className="text-dark-300">{slide.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-2 mb-6">{slides.map((_, idx) => <button key={idx} onClick={() => setI(idx)} className={`h-2 rounded-full transition-all ${idx === i ? 'w-8 bg-primary-500' : 'w-2 bg-dark-600'}`} />)}</div>
      <Btn onClick={() => i < slides.length - 1 ? setI(i + 1) : go('verify')} className="w-full flex items-center justify-center gap-2">
        {i === slides.length - 1 ? <><Sparkles className="w-5 h-5" />Get Started</> : <>Next<ChevronRight className="w-5 h-5" /></>}
      </Btn>
    </motion.div>
  )
})

// ============ VERIFICATION ============
const Verify = memo(() => {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const { go, setUser } = useStore()
  
  const nextStep = () => {
    if (step === 1 && phone.length === 10) { setUser({ phone }); setStep(2) }
    else if (step === 2 && otp.length === 6) setStep(3)
  }
  
  const selectGender = (g) => { setUser({ gender: g, verified: true }); go('discovery') }
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center"><Shield className="w-5 h-5 text-primary-400" /></div>
        <div><h1 className="text-xl font-bold text-white">Verification</h1><p className="text-dark-400 text-sm">One-time setup for safety</p></div>
      </div>
      <div className="flex gap-2 mb-8">{[1,2,3].map(s => <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-primary-500' : 'bg-dark-700'}`} />)}</div>
      
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="phone" {...pageVariants} className="flex-1 flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-4"><Phone className="w-7 h-7 text-blue-400" /></div>
            <h2 className="text-2xl font-bold text-white mb-2">Phone Number</h2>
            <p className="text-dark-400 mb-6">We'll send a verification code</p>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-400">+91</span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter phone" className="w-full pl-14 pr-4 py-4 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-dark-500 focus:border-primary-500 focus:outline-none" />
            </div>
            <div className="mt-auto"><Btn onClick={nextStep} disabled={phone.length !== 10} className="w-full">Send OTP</Btn></div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="otp" {...pageVariants} className="flex-1 flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mb-4"><Lock className="w-7 h-7 text-green-400" /></div>
            <h1 className="text-4xl font-bold text-white mb-2">Saw You</h1>
            <p className="text-dark-400">Did they see you too?</p>
            <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" maxLength={6} className="w-full text-center text-2xl tracking-[0.5em] py-4 rounded-xl bg-dark-800 border border-dark-700 text-white focus:border-primary-500 focus:outline-none mb-2" />
            <p className="text-dark-500 text-sm text-center mb-6">Demo: Enter any 6 digits</p>
            <div className="mt-auto"><Btn onClick={nextStep} disabled={otp.length !== 6} className="w-full">Verify</Btn></div>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="gender" {...pageVariants} className="flex-1 flex flex-col">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4"><Fingerprint className="w-7 h-7 text-purple-400" /></div>
            <h2 className="text-2xl font-bold text-white mb-2">Select Gender</h2>
            <p className="text-dark-400 mb-6">Personalizes your safety settings</p>
            <div className="space-y-3">
              {[['female', 'Woman', 'Enhanced safety'], ['male', 'Man', 'Standard settings'], ['other', 'Other', 'Choose preferences']].map(([v, l, d]) => (
                <button key={v} onClick={() => selectGender(v)} className="w-full p-4 rounded-xl bg-dark-800 border border-dark-700 hover:border-primary-500 text-left group flex items-center justify-between">
                  <div><p className="font-semibold text-white">{l}</p><p className="text-sm text-dark-500">{d}</p></div>
                  <ChevronRight className="w-5 h-5 text-dark-600 group-hover:text-primary-400" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

// ============ DISCOVERY ============
const Discovery = memo(() => {
  const { crossedPaths, isDiscoverable, toggle, recognize, wave, viewProfile, openChat } = useStore()
  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState({})
  
  const handleRecognize = async (p) => {
    setLoading(l => ({ ...l, [p.id]: 'recognize' }))
    await recognize(p.id)
    setLoading(l => ({ ...l, [p.id]: null }))
  }
  
  const handleWave = async (p) => {
    setLoading(l => ({ ...l, [p.id]: 'wave' }))
    const result = await wave(p.id)
    setLoading(l => ({ ...l, [p.id]: null }))
    if (result?.mutual) {
      setMatch({ ...p, match_id: result.match_id })
    }
  }
  
  const handleProfileClick = (p) => {
    if (p.i_recognized && p.they_recognized) {
      viewProfile(p)
    }
  }
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Eye className="w-6 h-6 text-primary-400" />Saw You</h1>
            <p className="text-dark-400 text-sm">People near you now</p>
          </div>
          <button onClick={() => toggle('isDiscoverable')} className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDiscoverable ? 'bg-primary-500/20 text-primary-400' : 'bg-dark-800 text-dark-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isDiscoverable ? 'bg-primary-400 animate-pulse' : 'bg-dark-500'}`} />
            <span className="text-sm font-medium">{isDiscoverable ? 'Visible' : 'Hidden'}</span>
          </button>
        </div>
        <Glass className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><MapPin className="w-5 h-5 text-emerald-400" /></div>
          <div className="flex-1"><p className="text-white font-medium">Fresh Bake Café</p><p className="text-dark-400 text-sm flex items-center gap-1"><Clock className="w-3 h-3" />Active 15 mins</p></div>
        </Glass>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24">
        <p className="text-dark-500 text-sm mb-4">{crossedPaths.length} people crossed your path</p>
        <div className="space-y-4">
          {crossedPaths.map((p, idx) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass rounded-2xl overflow-hidden">
              {/* Image - clickable for profile if mutual recognize */}
              <div className="relative h-56" onClick={() => handleProfileClick(p)}>
                <img src={p.profile_img} alt="" className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-transparent" />
                <div className="absolute top-3 right-3"><IntentBadge intent={p.intent} /></div>
                
                {/* Status indicators */}
                <div className="absolute top-3 left-3 flex gap-2">
                  {p.they_recognized && <div className="px-2 py-1 rounded-full bg-blue-500/80 text-white text-xs flex items-center gap-1"><Eye className="w-3 h-3" />Saw you</div>}
                  {p.they_waved && !p.mutual && <div className="px-2 py-1 rounded-full bg-pink-500/80 text-white text-xs flex items-center gap-1"><Hand className="w-3 h-3" />Waved</div>}
                </div>
                
                {/* Profile unlock hint */}
                {p.i_recognized && p.they_recognized && !p.mutual && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-dark-900/80 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-primary-400" />
                      Tap to view profile
                    </div>
                  </div>
                )}
                
                <div className="absolute bottom-3 left-3">
                  <div className="flex items-center gap-2 text-white/90"><MapPin className="w-4 h-4" /><span className="text-sm">{p.location}</span></div>
                  <div className="flex items-center gap-2 text-white/60 mt-1"><Clock className="w-3 h-3" /><span className="text-xs">{p.time_ago}</span></div>
                </div>
              </div>
              
              <div className="p-4">
                {p.mutual ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-xl">
                      <Heart className="w-5 h-5 text-primary-400 fill-primary-400" />
                      <span className="text-primary-400 font-medium">It's a match!</span>
                    </div>
                    <Btn onClick={() => openChat(p.match_id, p)} className="w-full flex items-center justify-center gap-2">
                      <MessageCircle className="w-5 h-5" />Start Chat
                    </Btn>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <Btn 
                        variant="secondary" 
                        onClick={() => handleRecognize(p)} 
                        disabled={p.i_recognized || loading[p.id] === 'recognize'} 
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        {loading[p.id] === 'recognize' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                        {p.i_recognized ? (p.they_recognized ? 'Mutual ✓' : 'Recognized') : 'Recognize'}
                      </Btn>
                      <Btn 
                        onClick={() => handleWave(p)} 
                        disabled={p.i_waved || loading[p.id] === 'wave'} 
                        className={`flex-1 flex items-center justify-center gap-2 ${p.i_waved ? 'opacity-70' : ''}`}
                      >
                        {loading[p.id] === 'wave' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Hand className="w-5 h-5" />}
                        {p.i_waved ? (p.they_waved ? 'Mutual!' : 'Waved 👋') : 'Wave'}
                      </Btn>
                    </div>
                    <p className="text-center text-dark-500 text-xs mt-3 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      {p.i_recognized && p.they_recognized ? 'Mutual recognize! View profile or wave to chat' : 'Both must tap to unlock'}
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Match celebration modal */}
      <AnimatePresence>
        {match && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-dark-900/95 backdrop-blur-lg flex items-center justify-center p-6 z-50">
            <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm text-center">
              <button onClick={() => setMatch(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center"><X className="w-5 h-5 text-dark-400" /></button>
              
              {/* Animated hearts */}
              <div className="relative mb-6">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: Infinity }} className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                  <Heart className="w-12 h-12 text-white fill-white" />
                </motion.div>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} className="absolute -top-2 -right-2 w-16 h-16 rounded-full overflow-hidden border-4 border-dark-900">
                  <img src={match.profile_img} alt="" className="w-full h-full object-cover" />
                </motion.div>
              </div>
              
              <h2 className="text-3xl font-bold gradient-text mb-2">It's a Match!</h2>
              <p className="text-dark-400 mb-2">You both waved at each other</p>
              <p className="text-dark-500 text-sm mb-6">at {match.location}</p>
              
              <div className="space-y-3">
                <Btn onClick={() => { setMatch(null); openChat(match.match_id, match) }} className="w-full flex items-center justify-center gap-2">
                  <MessageCircle className="w-5 h-5" />Start Chatting
                </Btn>
                <Btn variant="secondary" onClick={() => setMatch(null)} className="w-full">Keep Browsing</Btn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

// ============ PROFILE (Instagram-like) ============
const Profile = memo(() => {
  const { selectedProfile: p, back, wave, openChat } = useStore()
  const [loading, setLoading] = useState(false)
  
  if (!p) return null
  
  const handleWave = async () => {
    setLoading(true)
    const result = await wave(p.id)
    setLoading(false)
    if (result?.mutual) {
      openChat(result.match_id || p.match_id, p)
    }
  }
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between safe-area-top">
        <button onClick={back} className="w-10 h-10 rounded-full glass flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <button className="w-10 h-10 rounded-full glass flex items-center justify-center">
          <Flag className="w-5 h-5 text-dark-400" />
        </button>
      </div>
      
      {/* Main Photo */}
      <div className="h-[50%] relative">
        <img src={p.profile_img} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-dark-900/50" />
      </div>
      
      {/* Profile Info */}
      <div className="flex-1 -mt-16 relative z-10 px-4">
        {/* Intent & Status */}
        <div className="flex items-center gap-3 mb-4">
          <IntentBadge intent={p.intent} />
          {p.they_recognized && (
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm flex items-center gap-1">
              <UserCheck className="w-4 h-4" />
              Recognized you
            </div>
          )}
        </div>
        
        {/* Location */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-2 text-white">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-lg">{p.location}</span>
          </div>
          <div className="flex items-center gap-2 text-dark-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{p.time_ago}</span>
          </div>
        </div>
        
        {/* ID Photo (if available) */}
        {p.id_img && (
          <div className="mb-6">
            <p className="text-dark-500 text-sm mb-2 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Identification photo
            </p>
            <div className="h-32 rounded-xl overflow-hidden">
              <img src={p.id_img} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        
        {/* Privacy Notice */}
        <Glass className="p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary-400 mt-0.5" />
            <div>
              <p className="text-white font-medium mb-1">Identity Protected</p>
              <p className="text-dark-400 text-sm">Name and bio unlock only after mutual wave and 5+ messages.</p>
            </div>
          </div>
        </Glass>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          {p.mutual ? (
            <Btn onClick={() => openChat(p.match_id, p)} className="w-full flex items-center justify-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Open Chat
            </Btn>
          ) : (
            <Btn onClick={handleWave} disabled={p.i_waved || loading} className="w-full flex items-center justify-center gap-2">
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Hand className="w-5 h-5" />}
              {p.i_waved ? 'Waiting for them to wave back...' : 'Wave to Start Chat'}
            </Btn>
          )}
          
          {!p.mutual && p.i_waved && (
            <p className="text-center text-dark-500 text-sm">
              They'll be notified. Chat opens when they wave back.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
})

// ============ CHAT LIST ============
const ChatList = memo(() => {
  const { chats, crossedPaths, openChat } = useStore()
  
  // Create chats from matched paths for demo
  const allChats = useMemo(() => {
    const matchedPaths = crossedPaths.filter(p => p.mutual && p.match_id)
    return matchedPaths.map(p => ({
      id: p.match_id,
      other_id: p.id,
      other_img: p.profile_img,
      other_name: null, // Anonymous until unlocked
      other_intent: p.intent,
      loc: p.location,
      time_ago: 'Just now',
      message_count: 0,
      unlock_level: 0,
      expires_in: '24h',
      last_message: 'Say hi to start chatting!',
      ...p
    }))
  }, [crossedPaths])
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><MessageCircle className="w-6 h-6 text-primary-400" />Chats</h1>
        <p className="text-dark-400 text-sm mt-1">Mutual matches only</p>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24">
        {allChats.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 rounded-full bg-dark-800 flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-dark-600" />
            </div>
            <p className="text-dark-400 font-medium">No chats yet</p>
            <p className="text-dark-500 text-sm mt-1">Wave at someone to start chatting!</p>
          </div>
        )}
        {allChats.map((c, i) => (
          <motion.button key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} onClick={() => openChat(c.id, c)} className="w-full glass rounded-2xl p-4 mb-3 text-left flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary-500/50"><img src={c.other_img || c.profile_img} alt="" className="w-full h-full object-cover" loading="lazy" /></div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${c.unlock_level > 0 ? 'bg-primary-500' : 'bg-dark-700'}`}>{c.unlock_level > 0 ? <Unlock className="w-3 h-3 text-white" /> : <Lock className="w-3 h-3 text-dark-400" />}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1"><p className="font-semibold text-white">{c.unlock_level > 0 ? c.other_name : 'Anonymous'}</p><span className="text-dark-500 text-xs">{c.time_ago}</span></div>
              <p className="text-dark-400 text-sm truncate">{c.last_message}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-dark-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />Expires in {c.expires_in}</span>
                {c.unlock_level === 0 && <span className="text-primary-400 text-xs flex items-center gap-1"><Sparkles className="w-3 h-3" />{Math.max(0, 5 - c.message_count)} msgs to unlock</span>}
              </div>
            </div>
          </motion.button>
        ))}
        <Glass className="p-4 mt-4">
          <div className="flex items-start gap-3"><Shield className="w-5 h-5 text-primary-400 mt-0.5" /><div><p className="text-white font-medium mb-1">Chat Safety</p><p className="text-dark-400 text-sm">Chats expire in 24h unless saved. Names unlock after 5 messages.</p></div></div>
        </Glass>
      </div>
    </motion.div>
  )
})

// ============ BOT RESPONSES ============
const BOT_RESPONSES = [
  "Hey! Were you at the café earlier? ☕",
  "Oh nice! I think I saw you near the counter",
  "What brings you here today?",
  "That's cool! I'm here studying for exams 📚",
  "Are you from around here?",
  "This place has such a nice vibe right?",
  "Haha yes! I come here often actually",
  "So what do you do?",
  "That sounds interesting! Tell me more",
  "Nice meeting you! We should hang out sometime 😊",
]

// ============ CHAT ============
const Chat = memo(() => {
  const { activeChat, selectedProfile, back, crossedPaths } = useStore()
  const [msg, setMsg] = useState('')
  const [messages, setMessages] = useState([])
  const [menu, setMenu] = useState(false)
  const [unlockLevel, setUnlockLevel] = useState(0)
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)
  
  // Find the chat partner from selectedProfile or crossedPaths
  const partner = selectedProfile || crossedPaths.find(p => p.match_id === activeChat)
  
  useEffect(() => { 
    endRef.current?.scrollIntoView({ behavior: 'smooth' }) 
  }, [messages])
  
  // Simulate bot initial message
  useEffect(() => {
    if (partner && messages.length === 0) {
      setTyping(true)
      const timer = setTimeout(() => {
        setTyping(false)
        setMessages([{
          id: 1,
          me: false,
          text: `Hey! I think we just crossed paths at ${partner.location}! 👋`,
          time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        }])
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [partner])
  
  const handleSend = () => {
    if (!msg.trim()) return
    
    const newMsg = {
      id: Date.now(),
      me: true,
      text: msg.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    
    setMessages(prev => [...prev, newMsg])
    setMsg('')
    
    // Update unlock level
    const newCount = messages.length + 1
    if (newCount >= 5 && unlockLevel === 0) {
      setUnlockLevel(1)
    }
    
    // Bot response
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      const botResponse = {
        id: Date.now() + 1,
        me: false,
        text: BOT_RESPONSES[Math.min(messages.length, BOT_RESPONSES.length - 1)],
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      }
      setMessages(prev => [...prev, botResponse])
    }, 1500 + Math.random() * 2000)
  }
  
  if (!partner) return <div className="h-full flex items-center justify-center text-dark-400">Chat not found</div>
  
  // Name to show based on unlock level
  const displayName = unlockLevel > 0 ? (partner.first_name || 'New Friend') : 'Anonymous'
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col">
      <div className="p-4 glass-dark">
        <div className="flex items-center gap-3">
          <button onClick={back} className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center"><ArrowLeft className="w-5 h-5 text-white" /></button>
          <div className="flex-1 flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-500/50"><img src={partner.profile_img} alt="" className="w-full h-full object-cover" /></div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${unlockLevel > 0 ? 'bg-primary-500' : 'bg-dark-600'}`}>{unlockLevel > 0 ? <Unlock className="w-2.5 h-2.5 text-white" /> : <Lock className="w-2.5 h-2.5 text-dark-300" />}</div>
            </div>
            <div>
              <p className="font-semibold text-white flex items-center gap-2">
                {displayName}
                {typing && <span className="text-primary-400 text-xs animate-pulse">typing...</span>}
              </p>
              <p className="text-dark-400 text-xs">{partner.location}</p>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center"><MoreVertical className="w-5 h-5 text-dark-400" /></button>
            {menu && <div className="absolute top-12 right-0 w-40 glass rounded-xl overflow-hidden z-50">
              <button onClick={() => setMenu(false)} className="w-full px-4 py-3 text-left text-white hover:bg-dark-700 flex items-center gap-2"><Bookmark className="w-4 h-4" />Save Chat</button>
              <button onClick={() => setMenu(false)} className="w-full px-4 py-3 text-left text-red-400 hover:bg-dark-700 flex items-center gap-2"><Flag className="w-4 h-4" />Report</button>
            </div>}
          </div>
        </div>
        
        {/* Unlock progress */}
        {unlockLevel === 0 && (
          <div className="mt-3 flex items-center gap-2 text-primary-400 text-sm">
            <Sparkles className="w-4 h-4" />
            {Math.max(0, 5 - messages.filter(m => m.me).length)} more messages to unlock name
          </div>
        )}
        
        {/* Name unlocked notification */}
        {unlockLevel === 1 && messages.filter(m => m.me).length === 5 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/20 px-3 py-2 rounded-lg"
          >
            <Unlock className="w-4 h-4" />
            Name unlocked! They're {displayName}
          </motion.div>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-800 text-dark-400 text-xs">
            <Shield className="w-3 h-3" />Messages are encrypted & monitored for safety
          </div>
        </div>
        
        {messages.map((m, i) => (
          <motion.div 
            key={m.id} 
            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            className={`mb-3 flex ${m.me ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
              m.me 
                ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-br-md' 
                : 'bg-dark-800 text-white rounded-bl-md'
            }`}>
              <p>{m.text}</p>
              <p className={`text-xs mt-1 ${m.me ? 'text-white/60' : 'text-dark-500'}`}>{m.time}</p>
            </div>
          </motion.div>
        ))}
        
        {/* Typing indicator */}
        {typing && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="mb-3 flex justify-start"
          >
            <div className="bg-dark-800 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1">
              <div className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
        
        <div ref={endRef} />
      </div>
      
      {/* Quick replies for first message */}
      {messages.filter(m => m.me).length === 0 && (
        <div className="px-4 pb-2">
          <p className="text-dark-500 text-xs mb-2">Suggested replies:</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['Hey! Were you there earlier?', 'I think I saw you! 👋', 'Nice to match!', 'What brings you here?'].map((r, i) => (
              <button key={i} onClick={() => setMsg(r)} className="flex-shrink-0 px-4 py-2 rounded-full bg-dark-800 text-dark-300 text-sm hover:bg-dark-700 active:scale-95 transition-transform">{r}</button>
            ))}
          </div>
        </div>
      )}
      
      {/* Input */}
      <div className="p-4 glass-dark safe-area-bottom">
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={msg} 
            onChange={e => setMsg(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && handleSend()} 
            placeholder="Type a message..." 
            className="flex-1 px-4 py-3 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors" 
          />
          <button 
            onClick={handleSend} 
            disabled={!msg.trim()} 
            className="w-12 h-12 rounded-xl bg-gradient-to-r from-primary-500 to-purple-600 flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  )
})

// ============ SETTINGS ============
const SettingsScreen = memo(() => {
  const { user, isDiscoverable, toggle, setUser } = useStore()
  const Toggle = ({ on, onToggle }) => <button onClick={onToggle} className={`w-12 h-7 rounded-full transition-colors ${on ? 'bg-primary-500' : 'bg-dark-700'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} /></button>
  
  return (
    <motion.div {...pageVariants} className="h-full flex flex-col">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-primary-400" />Settings</h1>
        <p className="text-dark-400 text-sm mt-1">Privacy & safety</p>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24">
        <p className="text-dark-400 text-sm font-medium mb-3">DISCOVERY</p>
        <Glass className="divide-y divide-dark-700/50 mb-6">
          <div className="px-4 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-emerald-400"><Eye className="w-5 h-5" /></div><div><p className="text-white font-medium">Discoverable</p><p className="text-dark-500 text-sm">{isDiscoverable ? 'Others can see you' : 'You are hidden'}</p></div></div><Toggle on={isDiscoverable} onToggle={() => toggle('isDiscoverable')} /></div>
          <div className="px-4 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-blue-400"><MapPin className="w-5 h-5" /></div><div><p className="text-white font-medium">Location</p><p className="text-dark-500 text-sm">Micro-zones only, never GPS</p></div></div><span className="text-primary-400 text-sm">Always On</span></div>
        </Glass>
        
        <p className="text-dark-400 text-sm font-medium mb-3">YOUR INTENT</p>
        <div className="space-y-3 mb-6">
          {[['friends', Users, 'Looking for Friends', 'from-blue-500 to-cyan-500'], ['chat', MessageCircle, 'Open to Chat', 'from-pink-500 to-rose-500'], ['network', Briefcase, 'Networking', 'from-amber-500 to-orange-500']].map(([v, Icon, l, c]) => (
            <button key={v} onClick={() => setUser({ intent: v })} className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${user.intent === v ? `bg-gradient-to-r ${c} text-white` : 'bg-dark-800 text-dark-300 hover:bg-dark-700'}`}>
              <Icon className="w-5 h-5" /><span className="font-medium">{l}</span>{user.intent === v && <CheckCircle2 className="w-5 h-5 ml-auto" />}
            </button>
          ))}
        </div>
        
        <p className="text-dark-400 text-sm font-medium mb-3">SAFETY</p>
        <Glass className="divide-y divide-dark-700/50 mb-6">
          <div className="px-4 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-primary-400"><Shield className="w-5 h-5" /></div><div><p className="text-white font-medium">Strict Filters</p><p className="text-dark-500 text-sm">Block inappropriate content</p></div></div><Toggle on={true} onToggle={() => {}} /></div>
          <div className="px-4 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center text-red-400"><Camera className="w-5 h-5" /></div><div><p className="text-white font-medium">Screenshot Protection</p><p className="text-dark-500 text-sm">Blur if screenshot detected</p></div></div><Toggle on={true} onToggle={() => {}} /></div>
        </Glass>
        
        <Glass className="p-5 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary-500/20 flex items-center justify-center mb-3"><Shield className="w-6 h-6 text-primary-400" /></div>
          <h4 className="text-white font-semibold mb-2">Our Safety Promise</h4>
          <p className="text-dark-400 text-sm">See less. Feel safe. Connect only if both want.</p>
        </Glass>
        <p className="text-center text-dark-600 text-xs py-4">Crossed v0.1.0</p>
      </div>
    </motion.div>
  )
})

// ============ BOTTOM NAV ============
const Nav = memo(() => {
  const { screen, go, chats } = useStore()
  const items = [['discovery', Compass, 'Discover'], ['chats', MessageCircle, 'Chats'], ['settings', Settings, 'Settings']]
  
  return (
    <div className="absolute bottom-0 left-0 right-0 safe-area-bottom">
      <div className="mx-4 mb-4 glass rounded-2xl p-2">
        <div className="flex items-center justify-around">
          {items.map(([id, Icon, label]) => {
            const active = screen === id
            return (
              <button key={id} onClick={() => go(id)} className="relative flex flex-col items-center py-2 px-6 rounded-xl">
                {active && <motion.div layoutId="nav" className="absolute inset-0 bg-primary-500/20 rounded-xl" />}
                <div className="relative">
                  <Icon className={`w-6 h-6 ${active ? 'text-primary-400' : 'text-dark-500'}`} />
                  {id === 'chats' && chats.length > 0 && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center"><span className="text-[10px] text-white font-bold">{chats.length}</span></div>}
                </div>
                <span className={`text-xs mt-1 font-medium ${active ? 'text-primary-400' : 'text-dark-500'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// ============ MAIN APP ============
const screens = { splash: Splash, onboarding: Onboarding, verify: Verify, discovery: Discovery, profile: Profile, chats: ChatList, chat: Chat, settings: SettingsScreen }

function App() {
  const screen = useStore(s => s.screen)
  const Screen = screens[screen] || Discovery
  const showNav = ['discovery', 'chats', 'settings'].includes(screen)
  
  return (
    <div className="mobile-container">
      <AnimatePresence mode="wait">
        <Screen key={screen} />
      </AnimatePresence>
      {showNav && <Nav />}
    </div>
  )
}

export default App
