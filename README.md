# tax-man-finder

Marketplace platform for finding and offering accounting services.

## Local development (backend)

Use **one** virtual environment: `backend/.venv` (Python 3.12).  
Do not create a second folder named `venv` — that caused confusion earlier.

```bash
cd backend

# First-time only: create the venv and install deps
python3.12 -m venv .venv          # or: python3 -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# First-time setup: create your local env file
cp .env.example .env
# Edit .env if needed. Keep ENV=development for SQLite.

# Every time you work on the backend:
source .venv/bin/activate

# Redis must be running for WebSocket chat
# macOS (Homebrew): brew services start redis

python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
# HTTP-only alternative (WebSockets may not work):
# python manage.py runserver
```

Confirm you’re in the right env: your shell prompt should show `(.venv)`, and `which python` should end with `backend/.venv/bin/python`.

API: http://127.0.0.1:8000  
Admin: http://127.0.0.1:8000/admin/

**Important:** If `ENV=production`, Django expects Postgres via `DB_*` vars. For local work, keep `ENV=development` (or anything other than `production`) so it uses `db.sqlite3`.

Signup verification emails print to the terminal when using the console email backend (the `.env.example` default).

## Local development (frontend)

```bash
cd frontend/taxmanfinder
npm install
npm start
```

Frontend: http://localhost:3000 (expects the API at http://127.0.0.1:8000)

## Environment variables

See `backend/.env.example` for the full list. Never commit `backend/.env`.
