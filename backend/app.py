"""
Crossed App Backend - Safety-First Social Discovery
Flask + SQLite + WebSocket for real-time chat
"""

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from functools import wraps
import sqlite3
import hashlib
import secrets
import time
import threading
from datetime import datetime, timedelta
import json
import re

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(32)
CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:3000'])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

DATABASE = 'crossed.db'

# ============ DATABASE ============
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db: db.close()

def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE,
        phone_hash TEXT,
        device_id TEXT,
        gender TEXT,
        intent TEXT DEFAULT 'friends',
        profile_img TEXT,
        id_img TEXT,
        first_name TEXT,
        bio TEXT,
        verified INTEGER DEFAULT 0,
        discoverable INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP,
        daily_visibility_count INTEGER DEFAULT 0,
        is_bot INTEGER DEFAULT 0
    )''')
    
    # Locations (micro-zones)
    c.execute('''CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT,
        lat REAL,
        lng REAL,
        radius INTEGER DEFAULT 100
    )''')
    
    # User presence (who is where)
    c.execute('''CREATE TABLE IF NOT EXISTS presence (
        user_id TEXT,
        location_id TEXT,
        entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        PRIMARY KEY (user_id, location_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (location_id) REFERENCES locations(id)
    )''')
    
    # Interactions (recognize, wave)
    c.execute('''CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT,
        to_user TEXT,
        type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user) REFERENCES users(id),
        FOREIGN KEY (to_user) REFERENCES users(id)
    )''')
    
    # Matches (mutual consent)
    c.execute('''CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        user1 TEXT,
        user2 TEXT,
        matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unlock_level INTEGER DEFAULT 0,
        saved INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        FOREIGN KEY (user1) REFERENCES users(id),
        FOREIGN KEY (user2) REFERENCES users(id)
    )''')
    
    # Messages
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id TEXT,
        sender_id TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read INTEGER DEFAULT 0,
        FOREIGN KEY (match_id) REFERENCES matches(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
    )''')
    
    # Reports
    c.execute('''CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reporter_id TEXT,
        reported_id TEXT,
        reason TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending'
    )''')
    
    # Screenshot attempts (for ban tracking)
    c.execute('''CREATE TABLE IF NOT EXISTS screenshot_attempts (
        user_id TEXT,
        count INTEGER DEFAULT 0,
        last_attempt TIMESTAMP,
        PRIMARY KEY (user_id)
    )''')
    
    conn.commit()
    
    # Insert demo locations
    demo_locations = [
        ('loc_cafe1', 'Fresh Bake Café', 12.9716, 77.5946),
        ('loc_tech1', 'TechPark Building 5', 12.9352, 77.6245),
        ('loc_metro1', 'Metro Station - Central', 12.9784, 77.5726),
        ('loc_college1', 'Engineering College Canteen', 13.0274, 77.5659),
        ('loc_mall1', 'Phoenix Mall Food Court', 12.9698, 77.6480),
    ]
    for loc in demo_locations:
        c.execute('INSERT OR IGNORE INTO locations (id, name, lat, lng) VALUES (?, ?, ?, ?)', loc)
    
    # Insert bot users for demo
    bot_users = [
        ('bot_priya', 'Priya', 'female', 'friends', 
         'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
         'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=600&fit=crop'),
        ('bot_arjun', 'Arjun', 'male', 'network',
         'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
         'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=600&fit=crop'),
        ('bot_ananya', 'Ananya', 'female', 'chat',
         'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&crop=face',
         'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=600&fit=crop'),
        ('bot_rahul', 'Rahul', 'male', 'friends',
         'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
         'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop'),
        ('bot_sneha', 'Sneha', 'female', 'network',
         'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
         'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop'),
    ]
    for bot in bot_users:
        c.execute('''INSERT OR IGNORE INTO users 
            (id, first_name, gender, intent, profile_img, id_img, verified, is_bot, discoverable) 
            VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1)''', bot)
    
    conn.commit()
    conn.close()

# ============ SAFETY FILTERS ============
BLOCKED_WORDS = [
    'sex', 'nude', 'naked', 'xxx', 'porn', 'fuck', 'dick', 'pussy', 
    'boob', 'ass', 'slut', 'whore', 'rape', 'kill', 'murder', 'die',
    'phone number', 'address', 'send pics', 'send photo', 'video call'
]

def check_message_safety(content):
    """Check if message contains inappropriate content"""
    content_lower = content.lower()
    for word in BLOCKED_WORDS:
        if word in content_lower:
            return False, f"Message blocked: inappropriate content detected"
    # Check for phone numbers
    if re.search(r'\b\d{10}\b', content):
        return False, "Sharing phone numbers is not allowed in early conversations"
    return True, None

# ============ AUTH HELPERS ============
def generate_token(user_id):
    return hashlib.sha256(f"{user_id}{secrets.token_hex(16)}{time.time()}".encode()).hexdigest()

def hash_phone(phone):
    return hashlib.sha256(phone.encode()).hexdigest()

def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE id = ?', (token,)).fetchone()
        if not user:
            return jsonify({'error': 'Invalid token'}), 401
        
        g.user = dict(user)
        return f(*args, **kwargs)
    return decorated

# ============ API ROUTES ============

# --- AUTH ---
@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    """Send OTP to phone (demo: always succeeds)"""
    data = request.json
    phone = data.get('phone', '').strip()
    
    if not phone or len(phone) != 10:
        return jsonify({'error': 'Invalid phone number'}), 400
    
    # In production, send actual OTP via SMS
    # For demo, OTP is always 123456
    return jsonify({'success': True, 'message': 'OTP sent'})

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP and create/login user"""
    data = request.json
    phone = data.get('phone', '').strip()
    otp = data.get('otp', '').strip()
    device_id = data.get('device_id', '')
    
    # Demo: accept any 6-digit OTP
    if len(otp) != 6:
        return jsonify({'error': 'Invalid OTP'}), 400
    
    db = get_db()
    phone_hash = hash_phone(phone)
    
    # Check if user exists
    user = db.execute('SELECT * FROM users WHERE phone_hash = ?', (phone_hash,)).fetchone()
    
    if user:
        # Existing user - update device
        db.execute('UPDATE users SET device_id = ?, last_active = ? WHERE id = ?',
                   (device_id, datetime.now(), user['id']))
        db.commit()
        return jsonify({
            'success': True,
            'user_id': user['id'],
            'is_new': False,
            'verified': bool(user['verified'])
        })
    else:
        # New user
        user_id = f"user_{secrets.token_hex(8)}"
        db.execute('''INSERT INTO users (id, phone, phone_hash, device_id, last_active) 
                      VALUES (?, ?, ?, ?, ?)''',
                   (user_id, phone[-4:], phone_hash, device_id, datetime.now()))
        db.commit()
        return jsonify({
            'success': True,
            'user_id': user_id,
            'is_new': True,
            'verified': False
        })

@app.route('/api/auth/complete-profile', methods=['POST'])
@auth_required
def complete_profile():
    """Complete user profile after verification"""
    data = request.json
    user_id = g.user['id']
    
    gender = data.get('gender')
    intent = data.get('intent', 'friends')
    profile_img = data.get('profile_img')
    id_img = data.get('id_img')
    first_name = data.get('first_name', '')
    
    db = get_db()
    
    # Set default discoverable based on gender (safety feature)
    discoverable = 0 if gender == 'female' else 1
    
    db.execute('''UPDATE users SET 
        gender = ?, intent = ?, profile_img = ?, id_img = ?, 
        first_name = ?, verified = 1, discoverable = ?
        WHERE id = ?''',
        (gender, intent, profile_img, id_img, first_name, discoverable, user_id))
    db.commit()
    
    return jsonify({'success': True})

# --- DISCOVERY ---
@app.route('/api/discover/enter-location', methods=['POST'])
@auth_required
def enter_location():
    """User enters a location zone"""
    data = request.json
    user_id = g.user['id']
    location_id = data.get('location_id')
    
    db = get_db()
    
    # Check if location exists
    location = db.execute('SELECT * FROM locations WHERE id = ?', (location_id,)).fetchone()
    if not location:
        return jsonify({'error': 'Location not found'}), 404
    
    # Set presence with 30-minute expiry
    expires_at = datetime.now() + timedelta(minutes=30)
    db.execute('''INSERT OR REPLACE INTO presence (user_id, location_id, entered_at, expires_at)
                  VALUES (?, ?, ?, ?)''',
               (user_id, location_id, datetime.now(), expires_at))
    db.commit()
    
    return jsonify({
        'success': True,
        'location': dict(location),
        'expires_at': expires_at.isoformat()
    })

@app.route('/api/discover/nearby', methods=['GET'])
@auth_required
def get_nearby():
    """Get people at the same location"""
    user_id = g.user['id']
    db = get_db()
    
    # Get user's current location
    presence = db.execute('''
        SELECT p.*, l.name as location_name 
        FROM presence p
        JOIN locations l ON p.location_id = l.id
        WHERE p.user_id = ? AND p.expires_at > ?
    ''', (user_id, datetime.now())).fetchone()
    
    if not presence:
        return jsonify({'people': [], 'location': None})
    
    # Get others at same location (excluding self)
    nearby = db.execute('''
        SELECT u.id, u.profile_img, u.id_img, u.intent, u.gender,
               p.entered_at, l.name as location
        FROM users u
        JOIN presence p ON u.id = p.user_id
        JOIN locations l ON p.location_id = l.id
        WHERE p.location_id = ? 
          AND u.id != ?
          AND u.discoverable = 1
          AND u.verified = 1
          AND p.expires_at > ?
        ORDER BY p.entered_at DESC
    ''', (presence['location_id'], user_id, datetime.now())).fetchall()
    
    # Get existing interactions
    interactions = db.execute('''
        SELECT to_user, type FROM interactions 
        WHERE from_user = ?
    ''', (user_id,)).fetchall()
    
    interaction_map = {}
    for i in interactions:
        if i['to_user'] not in interaction_map:
            interaction_map[i['to_user']] = []
        interaction_map[i['to_user']].append(i['type'])
    
    # Check for mutual interactions
    people = []
    for person in nearby:
        person_data = dict(person)
        person_data['time_ago'] = get_time_ago(person['entered_at'])
        
        # Check interactions
        my_interactions = interaction_map.get(person['id'], [])
        their_interactions = db.execute('''
            SELECT type FROM interactions WHERE from_user = ? AND to_user = ?
        ''', (person['id'], user_id)).fetchall()
        their_types = [i['type'] for i in their_interactions]
        
        person_data['i_recognized'] = 'recognize' in my_interactions
        person_data['i_waved'] = 'wave' in my_interactions
        person_data['they_recognized'] = 'recognize' in their_types
        person_data['they_waved'] = 'wave' in their_types
        person_data['mutual'] = person_data['i_waved'] and person_data['they_waved']
        
        # Check if already matched
        match = db.execute('''
            SELECT id FROM matches 
            WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)
        ''', (user_id, person['id'], person['id'], user_id)).fetchone()
        person_data['matched'] = match is not None
        person_data['match_id'] = match['id'] if match else None
        
        people.append(person_data)
    
    return jsonify({
        'people': people,
        'location': {
            'id': presence['location_id'],
            'name': presence['location_name'],
            'expires_at': presence['expires_at']
        }
    })

@app.route('/api/discover/interact', methods=['POST'])
@auth_required
def interact():
    """Record an interaction (recognize or wave)"""
    data = request.json
    user_id = g.user['id']
    target_id = data.get('target_id')
    interaction_type = data.get('type')  # 'recognize' or 'wave'
    
    if interaction_type not in ['recognize', 'wave']:
        return jsonify({'error': 'Invalid interaction type'}), 400
    
    db = get_db()
    
    # Check if target exists and is nearby
    target = db.execute('SELECT * FROM users WHERE id = ?', (target_id,)).fetchone()
    if not target:
        return jsonify({'error': 'User not found'}), 404
    
    # Record interaction
    db.execute('''INSERT INTO interactions (from_user, to_user, type) VALUES (?, ?, ?)''',
               (user_id, target_id, interaction_type))
    db.commit()
    
    # Check for mutual wave
    mutual = False
    match_id = None
    
    if interaction_type == 'wave':
        their_wave = db.execute('''
            SELECT * FROM interactions 
            WHERE from_user = ? AND to_user = ? AND type = 'wave'
        ''', (target_id, user_id)).fetchone()
        
        if their_wave:
            # Create match!
            mutual = True
            match_id = f"match_{secrets.token_hex(8)}"
            expires_at = datetime.now() + timedelta(hours=24)
            
            db.execute('''INSERT INTO matches (id, user1, user2, expires_at) VALUES (?, ?, ?, ?)''',
                       (match_id, user_id, target_id, expires_at))
            db.commit()
            
            # Notify via socket
            socketio.emit('new_match', {
                'match_id': match_id,
                'with_user': target_id
            }, room=user_id)
            
            socketio.emit('new_match', {
                'match_id': match_id,
                'with_user': user_id
            }, room=target_id)
    
    # If target is a bot, simulate their response
    if target['is_bot']:
        threading.Thread(target=simulate_bot_response, 
                        args=(target_id, user_id, interaction_type)).start()
    
    return jsonify({
        'success': True,
        'mutual': mutual,
        'match_id': match_id
    })

@app.route('/api/discover/profile/<target_id>', methods=['GET'])
@auth_required
def get_profile(target_id):
    """Get profile (only if mutual recognition or match)"""
    user_id = g.user['id']
    db = get_db()
    
    # Check for mutual recognition or match
    match = db.execute('''
        SELECT * FROM matches 
        WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)
    ''', (user_id, target_id, target_id, user_id)).fetchone()
    
    my_recognize = db.execute('''
        SELECT * FROM interactions 
        WHERE from_user = ? AND to_user = ? AND type = 'recognize'
    ''', (user_id, target_id)).fetchone()
    
    their_recognize = db.execute('''
        SELECT * FROM interactions 
        WHERE from_user = ? AND to_user = ? AND type = 'recognize'
    ''', (target_id, user_id)).fetchone()
    
    if not (match or (my_recognize and their_recognize)):
        return jsonify({'error': 'Mutual recognition required'}), 403
    
    target = db.execute('SELECT * FROM users WHERE id = ?', (target_id,)).fetchone()
    if not target:
        return jsonify({'error': 'User not found'}), 404
    
    # Determine what to reveal based on unlock level
    unlock_level = match['unlock_level'] if match else 0
    
    profile = {
        'id': target['id'],
        'profile_img': target['profile_img'],
        'id_img': target['id_img'],
        'intent': target['intent'],
        'matched': match is not None,
        'match_id': match['id'] if match else None,
    }
    
    # Progressive reveal
    if unlock_level >= 1 or (my_recognize and their_recognize):
        profile['first_name'] = target['first_name']
    
    if unlock_level >= 2:
        profile['bio'] = target['bio']
    
    return jsonify(profile)

# --- CHAT ---
@app.route('/api/chat/matches', methods=['GET'])
@auth_required
def get_matches():
    """Get all matches/chats"""
    user_id = g.user['id']
    db = get_db()
    
    matches = db.execute('''
        SELECT m.*, 
               CASE WHEN m.user1 = ? THEN u2.id ELSE u1.id END as other_id,
               CASE WHEN m.user1 = ? THEN u2.profile_img ELSE u1.profile_img END as other_img,
               CASE WHEN m.user1 = ? THEN u2.first_name ELSE u1.first_name END as other_name,
               CASE WHEN m.user1 = ? THEN u2.intent ELSE u1.intent END as other_intent,
               (SELECT content FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
               (SELECT COUNT(*) FROM messages WHERE match_id = m.id) as message_count
        FROM matches m
        JOIN users u1 ON m.user1 = u1.id
        JOIN users u2 ON m.user2 = u2.id
        WHERE (m.user1 = ? OR m.user2 = ?)
          AND (m.expires_at > ? OR m.saved = 1)
        ORDER BY last_message_time DESC
    ''', (user_id, user_id, user_id, user_id, user_id, user_id, datetime.now())).fetchall()
    
    result = []
    for m in matches:
        match_data = dict(m)
        match_data['time_ago'] = get_time_ago(m['matched_at'])
        match_data['expires_in'] = get_time_until(m['expires_at']) if m['expires_at'] and not m['saved'] else None
        
        # Calculate unlock level based on message count
        if m['message_count'] >= 10:
            match_data['unlock_level'] = 2
        elif m['message_count'] >= 5:
            match_data['unlock_level'] = 1
        else:
            match_data['unlock_level'] = 0
        
        result.append(match_data)
    
    return jsonify({'matches': result})

@app.route('/api/chat/<match_id>/messages', methods=['GET'])
@auth_required
def get_messages(match_id):
    """Get messages for a match"""
    user_id = g.user['id']
    db = get_db()
    
    # Verify user is part of match
    match = db.execute('''
        SELECT * FROM matches WHERE id = ? AND (user1 = ? OR user2 = ?)
    ''', (match_id, user_id, user_id)).fetchone()
    
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    messages = db.execute('''
        SELECT m.*, u.first_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.match_id = ?
        ORDER BY m.created_at ASC
    ''', (match_id,)).fetchall()
    
    # Mark as read
    db.execute('UPDATE messages SET read = 1 WHERE match_id = ? AND sender_id != ?',
               (match_id, user_id))
    db.commit()
    
    return jsonify({
        'messages': [dict(m) for m in messages],
        'match': dict(match)
    })

@app.route('/api/chat/<match_id>/send', methods=['POST'])
@auth_required
def send_message(match_id):
    """Send a message"""
    user_id = g.user['id']
    data = request.json
    content = data.get('content', '').strip()
    
    if not content:
        return jsonify({'error': 'Message cannot be empty'}), 400
    
    # Safety check
    is_safe, error = check_message_safety(content)
    if not is_safe:
        return jsonify({'error': error, 'blocked': True}), 400
    
    db = get_db()
    
    # Verify user is part of match
    match = db.execute('''
        SELECT * FROM matches WHERE id = ? AND (user1 = ? OR user2 = ?)
    ''', (match_id, user_id, user_id)).fetchone()
    
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    # Check if match expired
    if match['expires_at'] and datetime.fromisoformat(match['expires_at']) < datetime.now() and not match['saved']:
        return jsonify({'error': 'Chat has expired'}), 400
    
    # Insert message
    db.execute('''INSERT INTO messages (match_id, sender_id, content) VALUES (?, ?, ?)''',
               (match_id, user_id, content))
    
    # Update unlock level based on message count
    msg_count = db.execute('SELECT COUNT(*) as c FROM messages WHERE match_id = ?', (match_id,)).fetchone()['c']
    new_unlock = 2 if msg_count >= 10 else (1 if msg_count >= 5 else 0)
    
    if new_unlock > match['unlock_level']:
        db.execute('UPDATE matches SET unlock_level = ? WHERE id = ?', (new_unlock, match_id))
    
    db.commit()
    
    # Get the other user
    other_id = match['user2'] if match['user1'] == user_id else match['user1']
    
    # Emit via socket
    message_data = {
        'match_id': match_id,
        'sender_id': user_id,
        'content': content,
        'created_at': datetime.now().isoformat(),
        'unlock_level': new_unlock
    }
    
    socketio.emit('new_message', message_data, room=match_id)
    
    # If other user is bot, simulate response
    other = db.execute('SELECT * FROM users WHERE id = ?', (other_id,)).fetchone()
    if other and other['is_bot']:
        threading.Thread(target=simulate_bot_chat, 
                        args=(match_id, other_id, content, msg_count)).start()
    
    return jsonify({'success': True, 'unlock_level': new_unlock})

@app.route('/api/chat/<match_id>/save', methods=['POST'])
@auth_required
def save_chat(match_id):
    """Save chat (prevent expiry)"""
    user_id = g.user['id']
    db = get_db()
    
    match = db.execute('''
        SELECT * FROM matches WHERE id = ? AND (user1 = ? OR user2 = ?)
    ''', (match_id, user_id, user_id)).fetchone()
    
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    db.execute('UPDATE matches SET saved = 1 WHERE id = ?', (match_id,))
    db.commit()
    
    return jsonify({'success': True})

@app.route('/api/chat/<match_id>/unlock', methods=['POST'])
@auth_required
def request_unlock(match_id):
    """Request profile unlock"""
    user_id = g.user['id']
    db = get_db()
    
    match = db.execute('''
        SELECT * FROM matches WHERE id = ? AND (user1 = ? OR user2 = ?)
    ''', (match_id, user_id, user_id)).fetchone()
    
    if not match:
        return jsonify({'error': 'Match not found'}), 404
    
    # For demo, auto-approve unlock
    db.execute('UPDATE matches SET unlock_level = 2 WHERE id = ?', (match_id,))
    db.commit()
    
    other_id = match['user2'] if match['user1'] == user_id else match['user1']
    socketio.emit('profile_unlocked', {'match_id': match_id}, room=match_id)
    
    return jsonify({'success': True, 'unlock_level': 2})

# --- SAFETY ---
@app.route('/api/safety/report', methods=['POST'])
@auth_required
def report_user():
    """Report a user"""
    user_id = g.user['id']
    data = request.json
    
    db = get_db()
    db.execute('''INSERT INTO reports (reporter_id, reported_id, reason, details) 
                  VALUES (?, ?, ?, ?)''',
               (user_id, data.get('user_id'), data.get('reason'), data.get('details')))
    db.commit()
    
    return jsonify({'success': True, 'message': 'Report submitted. We take safety seriously.'})

@app.route('/api/safety/screenshot', methods=['POST'])
@auth_required
def record_screenshot():
    """Record screenshot attempt"""
    user_id = g.user['id']
    db = get_db()
    
    attempt = db.execute('SELECT * FROM screenshot_attempts WHERE user_id = ?', (user_id,)).fetchone()
    
    if attempt:
        new_count = attempt['count'] + 1
        db.execute('UPDATE screenshot_attempts SET count = ?, last_attempt = ? WHERE user_id = ?',
                   (new_count, datetime.now(), user_id))
    else:
        new_count = 1
        db.execute('INSERT INTO screenshot_attempts (user_id, count, last_attempt) VALUES (?, 1, ?)',
                   (user_id, datetime.now()))
    
    db.commit()
    
    if new_count >= 3:
        return jsonify({'banned': True, 'message': 'Account suspended for screenshot violations'})
    elif new_count == 2:
        return jsonify({'warning': True, 'message': 'Final warning: One more screenshot attempt will result in ban'})
    else:
        return jsonify({'warning': True, 'message': 'Screenshots are not allowed for privacy protection'})

# --- SETTINGS ---
@app.route('/api/settings', methods=['GET'])
@auth_required
def get_settings():
    """Get user settings"""
    return jsonify({
        'discoverable': bool(g.user['discoverable']),
        'intent': g.user['intent'],
        'gender': g.user['gender']
    })

@app.route('/api/settings', methods=['PUT'])
@auth_required
def update_settings():
    """Update user settings"""
    user_id = g.user['id']
    data = request.json
    db = get_db()
    
    updates = []
    params = []
    
    if 'discoverable' in data:
        updates.append('discoverable = ?')
        params.append(1 if data['discoverable'] else 0)
    
    if 'intent' in data and data['intent'] in ['friends', 'chat', 'network']:
        updates.append('intent = ?')
        params.append(data['intent'])
    
    if updates:
        params.append(user_id)
        db.execute(f'UPDATE users SET {", ".join(updates)} WHERE id = ?', params)
        db.commit()
    
    return jsonify({'success': True})

# ============ WEBSOCKET EVENTS ============
@socketio.on('connect')
def handle_connect():
    """Handle socket connection"""
    pass

@socketio.on('join')
def handle_join(data):
    """Join user's room and match rooms"""
    user_id = data.get('user_id')
    if user_id:
        join_room(user_id)
        
        # Join all match rooms
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        matches = conn.execute('''
            SELECT id FROM matches WHERE user1 = ? OR user2 = ?
        ''', (user_id, user_id)).fetchall()
        conn.close()
        
        for m in matches:
            join_room(m['id'])

@socketio.on('typing')
def handle_typing(data):
    """Broadcast typing indicator"""
    match_id = data.get('match_id')
    user_id = data.get('user_id')
    emit('user_typing', {'user_id': user_id}, room=match_id, include_self=False)

# ============ BOT SIMULATION ============
BOT_RESPONSES = {
    'greet': [
        "Hey! Were you at the café earlier? ☕",
        "Hi there! I think I noticed you 👋",
        "Hello! Nice to match with you!",
    ],
    'recognize': [
        "Oh, I think I remember seeing you too!",
        "Yes! Were you near the window?",
        "I noticed you as well! Small world 😊",
    ],
    'chat': [
        "What brings you here today?",
        "Are you from around here?",
        "This place has great coffee, right?",
        "So what do you do?",
        "First time using this app?",
    ],
    'positive': [
        "That's cool! 😊",
        "Nice! Tell me more",
        "Interesting! I'd love to know more",
        "Awesome! Same here actually",
    ],
    'question': [
        "What about you?",
        "How about yourself?",
        "And you?",
    ]
}

def simulate_bot_response(bot_id, user_id, interaction_type):
    """Simulate bot responding to interactions"""
    time.sleep(2 + secrets.randbelow(3))  # Random delay 2-5 seconds
    
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    
    if interaction_type == 'recognize':
        # Bot recognizes back
        conn.execute('INSERT INTO interactions (from_user, to_user, type) VALUES (?, ?, ?)',
                    (bot_id, user_id, 'recognize'))
        conn.commit()
        socketio.emit('interaction', {'from': bot_id, 'type': 'recognize'}, room=user_id)
    
    elif interaction_type == 'wave':
        # Bot waves back - creating a match
        time.sleep(1)
        conn.execute('INSERT INTO interactions (from_user, to_user, type) VALUES (?, ?, ?)',
                    (bot_id, user_id, 'wave'))
        
        # Create match
        match_id = f"match_{secrets.token_hex(8)}"
        expires_at = datetime.now() + timedelta(hours=24)
        conn.execute('INSERT INTO matches (id, user1, user2, expires_at) VALUES (?, ?, ?, ?)',
                    (match_id, user_id, bot_id, expires_at))
        conn.commit()
        
        socketio.emit('new_match', {
            'match_id': match_id,
            'with_user': bot_id
        }, room=user_id)
        
        # Bot sends first message after a delay
        time.sleep(3)
        import random
        greeting = random.choice(BOT_RESPONSES['greet'])
        conn.execute('INSERT INTO messages (match_id, sender_id, content) VALUES (?, ?, ?)',
                    (match_id, bot_id, greeting))
        conn.commit()
        
        socketio.emit('new_message', {
            'match_id': match_id,
            'sender_id': bot_id,
            'content': greeting,
            'created_at': datetime.now().isoformat()
        }, room=match_id)
    
    conn.close()

def simulate_bot_chat(match_id, bot_id, user_message, msg_count):
    """Simulate bot chat responses"""
    import random
    time.sleep(2 + secrets.randbelow(4))  # Typing delay
    
    # Choose response based on context
    user_lower = user_message.lower()
    
    if msg_count <= 2:
        response = random.choice(BOT_RESPONSES['recognize'])
    elif '?' in user_message:
        response = random.choice(BOT_RESPONSES['positive']) + " " + random.choice(BOT_RESPONSES['question'])
    elif any(word in user_lower for word in ['hi', 'hey', 'hello']):
        response = random.choice(BOT_RESPONSES['greet'])
    else:
        response = random.choice(BOT_RESPONSES['chat'])
    
    conn = sqlite3.connect(DATABASE)
    conn.execute('INSERT INTO messages (match_id, sender_id, content) VALUES (?, ?, ?)',
                (match_id, bot_id, response))
    conn.commit()
    conn.close()
    
    socketio.emit('new_message', {
        'match_id': match_id,
        'sender_id': bot_id,
        'content': response,
        'created_at': datetime.now().isoformat()
    }, room=match_id)

# ============ HELPERS ============
def get_time_ago(timestamp):
    """Convert timestamp to human readable"""
    if isinstance(timestamp, str):
        dt = datetime.fromisoformat(timestamp)
    else:
        dt = timestamp
    
    diff = datetime.now() - dt
    
    if diff.seconds < 60:
        return 'Just now'
    elif diff.seconds < 3600:
        mins = diff.seconds // 60
        return f'{mins}m ago'
    elif diff.seconds < 86400:
        hours = diff.seconds // 3600
        return f'{hours}h ago'
    else:
        days = diff.days
        return f'{days}d ago'

def get_time_until(timestamp):
    """Get time until expiry"""
    if isinstance(timestamp, str):
        dt = datetime.fromisoformat(timestamp)
    else:
        dt = timestamp
    
    diff = dt - datetime.now()
    
    if diff.total_seconds() <= 0:
        return 'Expired'
    elif diff.seconds < 3600:
        mins = diff.seconds // 60
        return f'{mins}m'
    else:
        hours = diff.seconds // 3600
        return f'{hours}h'

# ============ MAIN ============
if __name__ == '__main__':
    init_db()
    print("🚀 Crossed Backend running on http://localhost:5000")
    print("📍 Demo locations and bot users created")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
