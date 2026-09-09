# tax-man-finder

Find and book accounting services. Django/DRF backend, React frontend.

Product and architecture documentation: [`docs/product/README.md`](docs/product/README.md).

## Backend

Needs Python 3.12. Use a single venv at `backend/.venv`.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

For local work, keep `ENV=development` in `.env` so Django uses SQLite. Set `ENV=production` only when you have real Postgres settings.

Start the API (Daphne so chat WebSockets work):

```bash
source .venv/bin/activate
python manage.py migrate
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

- API: http://127.0.0.1:8000  
- Admin: http://127.0.0.1:8000/admin/

Chat uses Redis by default (`CHANNEL_LAYER=redis`). Start Redis (`brew services start redis` on macOS), or set `CHANNEL_LAYER=memory` in `.env` if you skip Redis.

Verification emails go to the terminal when using the console email backend (default in `.env.example`).

Full env list: `backend/.env.example`. Do not commit `backend/.env`.

### Stripe Checkout (paid consultations)

1. Add keys to `backend/.env`:
   - `STRIPE_SECRET_KEY` — Stripe Dashboard → Developers → API keys (test mode for local)
   - `STRIPE_WEBHOOK_SECRET` — from Stripe CLI or Dashboard webhook endpoint
2. Forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:8000/bookings/stripe/webhook/
   ```
3. Client flow: accept paid booking → **Pay consultation fee** → Stripe Checkout → webhook confirms booking.
4. Without Stripe keys, **Complete Demo Payment** remains available in local dev (`ALLOW_DEMO_PAYMENT`).

## Frontend

```bash
cd frontend/taxmanfinder
npm install
npm start
```

App: http://localhost:3000 (talks to the API at http://127.0.0.1:8000)
