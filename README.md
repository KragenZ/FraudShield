# 🛡️ FraudShield AI — Financial Fraud Detection Platform

A real-time financial fraud detection and risk telemetry platform inspired by the design aesthetics of Stripe, Linear, and modern cybersecurity command centers.

FraudShield AI ingests high-velocity financial transactions, executes risk heuristics, computes probabilistic risk indices (0–100), and broadcasts security alerts over WebSockets directly to an interactive fintech operations console.

---

## 📸 Key Capabilities

- **Real-Time Telemetry Dashboard**: Live stream of transactions, risk scores, and security alerts via WebSockets.
- **Transaction Audit Trail**: Full search, filtering by channel (Wire, Crypto, P2P, ATM, Card), risk score ranges, and paginated transaction inspection.
- **Incident Queue & Triage**: Triage suspicious transactions, assign severity levels (Critical, High, Medium, Low), record resolution notes, and resolve incidents.
- **Fintech Risk Analytics**: Historical fraud volume trends, temporal attack surfaces, channel breakdown, and detection ratios.
- **Model Performance Benchmark Harness**: Pre-configured evaluation metrics (Precision, Recall, F1, PR-AUC, ROC-AUC) and an interactive Confusion Matrix, prepared for Phase 2 ML training.
- **Test Transaction Injector**: In-app modal to inject test transactions (legitimate or fraudulent attack scenarios) and observe live risk scoring and WebSocket event propagation.

---

## 🏗️ Technology Architecture

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (Dark Navy Fintech palette `#070A13`, `#0E1524`), Glassmorphism panels
- **Visualizations**: Recharts (Area charts, Bar charts, Donut charts)
- **Icons**: Lucide Icons
- **Real-Time**: Native WebSocket client with auto-reconnection

### Backend
- **Framework**: Python 3.11 + FastAPI + Uvicorn
- **ORM & Database**: SQLAlchemy 2.0 with PostgreSQL integration & SQLite sandbox fallback
- **Validation**: Pydantic v2
- **Networking**: High-concurrency WebSockets for live transaction/alert broadcasting
- **Data Engine**: Seeded with 50+ realistic multi-channel transactions and baseline benchmark evaluation records (explicitly labeled `DEMO DATA`)

---

## 📁 Project Structure

```
Fraud Detector/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health.py          # /api/health endpoint
│   │   │   ├── transactions.py    # List, detail, and inject transactions
│   │   │   ├── alerts.py          # Incident queue & status resolution
│   │   │   ├── analytics.py       # KPI metrics & trend aggregations
│   │   │   └── model_metrics.py   # Model evaluation & confusion matrix
│   │   ├── config.py              # Environment variable configuration
│   │   ├── database.py            # SQLAlchemy engine & session factory
│   │   ├── models.py              # Transaction, FraudAlert, ModelPerformance models
│   │   ├── schemas.py             # Pydantic v2 request/response schemas
│   │   ├── seed.py                # Realistic multi-channel demo data generator
│   │   ├── ws_manager.py          # WebSocket connection & broadcast manager
│   │   └── main.py                # FastAPI app & background live simulator
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py                     # Convenience launcher
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # MetricCard, RiskBadge, StatusBadge, LiveIndicator, DemoBadge
│   │   │   ├── layout/            # Sidebar, Header
│   │   │   └── modals/            # TransactionDetailModal, AlertReviewModal, NewTransactionModal
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx
│   │   │   ├── TransactionsPage.tsx
│   │   │   ├── AlertsPage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── ModelPerformancePage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── services/
│   │   │   ├── api.ts             # Fetch client
│   │   │   └── websocket.ts       # Reconnecting WebSocket client
│   │   ├── types/                 # TypeScript interfaces & types
│   │   ├── App.tsx                # Main console state & routing
│   │   ├── index.css              # Dark navy fintech theme
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── .env.example
└── README.md
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **Python**: 3.10+ (tested on Python 3.11)

---

### Step 1: Start the Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows PowerShell:
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux/macOS:
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. *(Optional)* Configure database in `backend/.env`:
   - Default is SQLite (`sqlite:///./fraudshield.db`) for immediate zero-config execution.
   - For PostgreSQL:
     ```env
     DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/fraudshield
     ```

5. Launch the backend server:
   ```bash
   python run.py
   ```
   The backend API will be available at `http://127.0.0.1:8000`.  
   Interactive API docs (Swagger): `http://127.0.0.1:8000/docs`

---

### Step 2: Start the Frontend

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://127.0.0.1:5173`.

---

## 🧪 Testing Live Features

1. **Watch Live Stream**: The backend background generator broadcasts simulated transactions and security alerts directly to the dashboard over WebSockets every few seconds.
2. **Inject Test Transaction**: Click the **"Inject Test Tx"** button in the top header. You can pick presets:
   - **High Risk / Fraud**: Triggers an alert (e.g. $34,500.00 Crypto Exchange via Tor proxy) and pushes to the Incident Queue.
   - **Legitimate**: A routine $42.50 Amazon Cloud charge approved with low risk score.
3. **Audit & Search**: Go to the **Transactions** tab to search, filter by transaction channel (Wire, ATM, Crypto, etc.), or filter by status.
4. **Triage Incidents**: Go to the **Fraud Alerts** tab, click **Review** on any alert to inspect the anomaly rationale, change disposition (e.g., Mark Resolved or False Positive), and enter resolution notes.
5. **View Model Validation Harness**: Go to **Model Performance** to inspect the baseline evaluation metrics (Precision, Recall, F1, PR-AUC, Confusion Matrix).

---

## 🔒 Security & Data Integrity Compliance

- **No Hardcoded Secrets**: Configuration is read dynamically from environment variables.
- **Transparency on ML Status**: All Phase 1 baseline values are strictly documented as pre-training evaluation benchmarks. Real-world model training pipelines (Scikit-learn, XGBoost, and SHAP) are reserved for Phase 2.
- **Demo Data Transparency**: All mock transactions and alerts are tagged `is_demo_data: true` and displayed with prominent DEMO badges in the interface.
