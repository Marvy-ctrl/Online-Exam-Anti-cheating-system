# ExamLoc: High-Integrity Online Examination System

ExamLoc is a professional-grade, high-integrity examination platform designed to prevent cheating through real-time biometric monitoring and strict browser-level enforcement.

## 🚀 Key Features

### 🛡️ Anti-Cheating & Proctoring

- **Biometric Identity Verification**: Match live webcam feeds against enrolled face embeddings using 128-bit vector comparisons.
- **Continuous Monitoring**: Detects "No Face", "Multiple Faces", and "Face Mismatch" in real-time.
- **Browser Enforcement**: Tracks tab switching, window focus loss, and blocks unauthorized actions (right-click, copy/paste).
- **Automated Enforcement**: Configurable violation thresholds for automatic exam flagging or termination.

### 📊 Examiner Control

- **Live Monitoring Dashboard**: Real-time WebSocket feed of student status and violations.
- **Exam Randomization**: Deterministic shuffling of both questions and options.
- **Forensic Audit Logs**: Detailed timeline of events and snapshots for post-exam review.

### 🏗️ Technical Architecture

- **Backend**: FastAPI (Python) for high-performance async processing and biometrics.
- **Frontend**: Next.js (React) for a secure, responsive exam shell.
- **Database**: PostgreSQL with SQLModel for type-safe data integrity.
- **Real-time**: WebSockets for instantaneous violation broadcasting.

----

## 🛠️ Setup Instructions

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL**

### 1. Backend Setup

```bash
# Navigate to the project root
cd Online-Exam-Anti-cheating-system

# Create and activate virtual environment
python -m venv env
source env/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables (.env)
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost/dbname
# SECRET_KEY=your_secret_key

# Run the development server
fastapi dev backend/src --host 0.0.0.0
```

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Set up environment variables (.env.local)
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Run the development server
npm run dev
```

---

## 📂 Project Structure

```text
├── backend/
│   ├── src/
│   │   ├── auth/           # Authentication & JWT logic
│   │   ├── db/             # Models & DB configuration
│   │   ├── exam_session/   # Proctoring & Session logic
│   │   ├── exams/          # Exam management
│   │   └── websocket.py    # Real-time communication
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages (App Router)
│   │   ├── components/     # Reusable UI components
│   │   └── lib/            # API utilities
└── Online Exam Anti-Cheating System Build Plan.md
```

---
.
## ⚖️ Engineering Mindset

Every component in this system is built with a **Zero Trust** model. We never trust client-side data. All timing, violation counts, and identity checks are authoritatively validated on the backend.

---

## 📝 License

Proprietary / Research Project...
