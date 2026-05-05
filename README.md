# PalmID — Real-Time Biometric Attendance System

A production-ready **palm-based biometric attendance system** for colleges and institutions.  
Students authenticate by showing their palm at the lab door — no cards, no PINs, no manual marking.

---

## 🏗️ System Architecture

```
  LAB DOOR KIOSK (no login)          STUDENT PORTAL (login required)
  ─────────────────────────           ──────────────────────────────
  http://[server]:5173/kiosk          http://[server]:5173/student

  📷 Always-on camera                 ✋ Register Palm (one-time)
  Auto-scans every 2.5s               📊 My Attendance
  Shows name + confidence                ├─ Daily  (heatmap)
  Marks attendance in DB                 ├─ Monthly (bar chart)
                                         └─ Yearly (grade)

  ADMIN PANEL                         TEACHER PANEL
  ──────────────                      ─────────────
  /admin                              /teacher
  - Manage users                      - View class attendance
  - Train ML model                    - Mark manual attendance
  - View audit logs
  - Configure settings
```

---

## ✨ Key Features

### Biometric Authentication
- **MediaPipe** hand landmark detection (21 points)
- **99-feature vector** — raw xyz + inter-landmark distances + joint angles
- **Ensemble ML model** — SVC + RandomForest + GradientBoosting (soft voting)
- **50× synthetic augmentation** — high accuracy with as few as 5 real samples
- **100% training accuracy** achieved consistently

### Kiosk Door Screen (`/kiosk`)
- Fully public — no login required
- Auto-detects and authenticates palms every 2.5 seconds
- Live landmark overlay (MediaPipe)
- Green/red result card with student name and confidence %
- Rolling log of today's authenticated students
- Live clock + server health indicator

### Student Portal (`/student`)
- One-time palm registration (5+ samples)
- Today's attendance status banner
- **Daily view** — GitHub-style calendar heatmap + log
- **Monthly view** — bar chart of attendance per month
- **Yearly view** — grade (Excellent/Good/Average/Poor) + at-risk warning

### Admin Panel (`/admin`)
- User management (create, activate, deactivate)
- One-click model training with live stats
- Audit logs for all system actions
- Confidence threshold configuration

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Flask 3.0, Flask-JWT-Extended, SQLAlchemy |
| Database | SQLite |
| ML | scikit-learn (SVC + RF + GB ensemble), MediaPipe, OpenCV |
| Frontend | React + Vite, Tailwind CSS, Recharts, Lucide |
| Auth | JWT (Bearer token) |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Webcam

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

Backend runs at: `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## 📋 College Deployment Guide

### Step 1 — Initial Setup
1. Install and start backend + frontend on the college server
2. Login as **admin** (`admin@palm.sys` / `admin123`)
3. Run migration if upgrading: `POST /api/palm/migrate`

### Step 2 — Student Registration
1. Students visit `http://[server]:5173/register` to create accounts
2. Login → Student Portal → **Register Palm**
3. Capture **5–10 palm samples** (takes ~30 seconds)

### Step 3 — Train the Model (Admin)
1. Admin panel → **Train Model**
2. Wait ~20–30 seconds
3. Expect: `Accuracy: 100%, model_type: VotingEnsemble(SVC+RF+GB)`

### Step 4 — Kiosk Setup (Lab Door)
1. On the door laptop/PC, open: `http://[server]:5173/kiosk`
2. Press **F11** for fullscreen
3. Leave it running — students just show their palm as they enter

### Step 5 — Students Check Attendance
- Login to student portal → **My Attendance**
- View daily/monthly/yearly records

---

## 🔐 Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@palm.sys` | `admin123` |
| Teacher | `teacher@palm.sys` | `teacher123` |

> ⚠️ Change these passwords before production deployment!

---

## 📡 API Reference

### Public Endpoints (no auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/kiosk/authenticate` | Door palm scan → mark attendance |
| GET | `/api/kiosk/recent` | Today's last 10 authenticated students |

### Auth Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Create account |
| POST | `/api/login` | Login → get JWT |
| GET | `/api/me` | Current user profile |

### Palm Endpoints (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/palm/capture` | Save palm sample |
| POST | `/api/palm/train` | Train ensemble model (admin/teacher) |
| GET | `/api/palm/status` | Current user's registration status |
| POST | `/api/palm/migrate` | Wipe legacy data after upgrade (admin) |
| DELETE | `/api/palm/reset/<id>` | Reset a user's palm data (admin) |

### Attendance Endpoints (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/mark` | Mark attendance |
| GET | `/api/attendance/student/<id>` | Student history |
| GET | `/api/attendance/class` | Class view (admin/teacher) |
| GET | `/api/attendance/today` | Today's records |
| PUT | `/api/attendance/manual` | Manual mark (admin/teacher) |

---

## 🧠 ML Pipeline

```
Real palm image (base64)
        ↓
MediaPipe Hand Detection
        ↓
99-Feature Vector:
  [0:63]  — 21 landmarks × xyz (wrist-normalised)
  [63:84] — 21 inter-landmark distances
  [84:99] — 15 joint angles
        ↓
Synthetic Augmentation (50× per sample)
        ↓
VotingEnsemble (soft voting, weights 3:2:2)
  ├── SVC (rbf, C=50)
  ├── RandomForest (100+ trees)
  └── GradientBoosting (80 estimators)
        ↓
StandardScaler + LabelEncoder
        ↓
Confidence score (0–1) + User ID
```

### Running the offline test suite
```bash
cd backend
python ml_model/test_pipeline.py
```

Expected output:
```
TEST 1: Augmentor ........... [PASS]
TEST 2: augment_dataset ..... [PASS]
TEST 3: Train + predict ..... [PASS] accuracy=1.0000, confidence>0.99
ALL TESTS PASSED
```

---

## 📁 Project Structure

```
palm-attendance-system/
├── backend/
│   ├── app.py                    # Flask application entry point
│   ├── config.py                 # Configuration (DB, JWT, ML paths)
│   ├── requirements.txt
│   ├── migrate_palm_data.py      # One-time DB migration script
│   ├── ml_model/
│   │   ├── trainer.py            # Ensemble model training
│   │   ├── augmentor.py          # Synthetic data augmentation
│   │   └── test_pipeline.py      # Offline test suite
│   ├── models/
│   │   └── database.py           # SQLAlchemy ORM models
│   ├── routes/
│   │   ├── auth.py               # Login / Register
│   │   ├── palm.py               # Palm capture / train / predict
│   │   ├── attendance.py         # Attendance CRUD
│   │   ├── kiosk.py              # Public door authentication
│   │   ├── admin.py              # Admin management
│   │   └── esp32.py              # Hardware relay control
│   └── services/
│       ├── palm_service.py       # Feature extraction + prediction
│       └── auth_service.py       # JWT helpers + RBAC
└── frontend/
    └── src/
        ├── App.jsx               # Routes (includes public /kiosk)
        ├── pages/
        │   ├── KioskPage.jsx     # Door authentication screen
        │   ├── Login.jsx
        │   └── Register.jsx
        ├── dashboard/
        │   ├── StudentDashboard.jsx   # Registration + attendance view
        │   ├── AdminDashboard.jsx
        │   └── TeacherDashboard.jsx
        └── components/
            ├── PalmCamera.jsx    # Camera + MediaPipe overlay
            ├── Sidebar.jsx
            └── AttendanceTable.jsx
```

---

## 🔧 Configuration

Edit `backend/config.py`:

```python
CONFIDENCE_THRESHOLD   = 0.80   # Minimum confidence to grant access
FEATURE_VECTOR_SIZE    = 99     # DO NOT change after registrations
AUGMENT_MULTIPLIER     = 50     # Synthetic samples per real sample
MIN_PALM_SAMPLES_FOR_TRAIN = 3  # Minimum samples before training
MAX_PALM_SAMPLES_PER_USER  = 20 # Maximum samples per user
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## 📜 License

MIT License — free for educational and institutional use.

---

*Built with ❤️ for real-world college attendance automation.*
