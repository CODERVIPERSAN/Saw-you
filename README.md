# Crossed

> **"See less. Feel safe. Connect only if both want."**

A privacy-first, consent-based connection app that enables real-world discovery without compromising safety or identity.

---

## 🎯 Core Principle

No identity, no chat, no visibility—without **mutual consent** + **shared place** + **shared time**.

---

## ✨ Features

### 🔍 Discovery Rules
- **Same micro-location** – Connect only within the same venue (bakery, café, block)
- **Same time window** – 10-15 minute overlap required
- **Mutual discoverability** – Both users must enable "Discoverable"
- **No global search** – No followers, no browsing strangers

### 🔒 Location Privacy
- Uses **Place IDs** (micro-zones), not GPS coordinates
- Shows place name only—never distance, direction, or map pins
- Server receives only hashed location ID + expiry timestamp

### 👤 Profile Visibility (Stranger Mode)
| Visible | Hidden |
|---------|--------|
| Profile image (real face) | Name |
| 1 identification image | Age |
| Intent badge (Friends/Chat/Network) | Bio, Social links, Username |

### 🤝 Mutual Consent Flow
- **👀 Recognize** – Indicate you've seen someone
- **👋 Say Hi** – Express interest
- Nothing happens unless **BOTH** tap

### 💬 Chat Safety (Phase-based unlock)
1. **Start** → Anonymous chat
2. **After 5-10 messages** → First name revealed
3. **Mutual unlock** → Bio + socials accessible
4. **Keyword detection** → Auto-warning → Auto-mute → Auto-ban

### ⏱️ Time-Bound Existence
- Profile disappears when leaving the place OR after 30 minutes
- Chat auto-expires in 24 hours unless both users save

### 📸 Screenshot Protection
- Screenshot detected → Image blurs
- Repeat offense → Warning
- Third attempt → Auto-ban

### ✅ Identity Verification
- Phone OTP
- Device fingerprint
- Optional selfie match (blurred, not stored)

### 🛡️ Gender Safety (India-specific)
- **Women**: Default Discover OFF, daily visibility limits, strict message filters
- **Men**: Can't spam likes, no custom first messages without mutual interest

---

## 🛠️ Tech Stack

### Frontend
- **React 18** – UI framework
- **Vite 5** – Build tool & dev server
- **TailwindCSS 3** – Styling
- **Framer Motion** – Animations
- **Lucide React** – Icons
- **Zustand** – State management

### Backend
- **Flask 3** – Python web framework
- **Flask-SocketIO** – Real-time WebSocket communication
- **Flask-CORS** – Cross-origin resource sharing
- **SQLite** – Database

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## 🎯 MVP Launch Strategy

Target initial deployment in controlled environments:
- 🎓 **Colleges**
- 🏢 **Tech parks**
- ☕ **Cafés**
- 🎉 **Events & fests**

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Copyright (c) 2025 Santhosh The Githuber**

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

<p align="center">
  <strong>Built with privacy and safety at its core 💜</strong>
</p>
