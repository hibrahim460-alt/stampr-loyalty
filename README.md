# Stampr — Digital Loyalty Platform

A production-ready digital loyalty program (inspired by "Stamp Me"), built with a
Node.js/Express + MongoDB backend, a mobile-first customer web app, and a desktop
merchant dashboard. The backend serves the static frontend, so the whole thing runs
as a single web service — ideal for Render's free/starter tier.

## Features

**Customers (mobile view)**
- Sign up / log in and join programs by join code (`/join/:code` redirect) or search.
- Earn stamps by entering the merchant's static **Stamp Code**, or a single-use **OneStamp** (Pro) code that can never be reused.
- A live stamp card that fills up; when full, a reward voucher is generated.
- **In-person redemption** with a 3-minute countdown timer the member shows to staff (auto-expires server- and client-side).
- **Remote redemption**: an online discount code is issued and a notification email is simulated when a reward is earned.

**Merchants (desktop dashboard)**
- Real-time analytics: total members, stamps given, rewards redeemed, recent activity feed.
- Manually add members and manually allocate stamps.
- Edit offer text, stamps required, logo, location.
- Generate and track OneStamp codes.
- Simulate push/SMS/email broadcasts to all members.
- Birthday Club toggle + a birthday run that issues vouchers to members celebrating today.

## Tech stack
- **Backend:** Node.js, Express, Mongoose (MongoDB), JWT auth, bcrypt password hashing.
- **Frontend:** Vanilla HTML/CSS/JS, Tailwind CSS via CDN (no build step).
- **Deploy:** Render Blueprint (`render.yaml`).

## Project structure
```
loyalty-platform/
├── backend/
│   ├── config/db.js              # Mongoose connection (with retry)
│   ├── models/                   # User, Merchant, StampCard, OneStamp, Transaction
│   ├── routes/                   # auth, member, merchant, stamp
│   ├── middleware/authMiddleware.js  # JWT verify + role guard
│   ├── utils.js                  # token signing, reward codes, notification stub
│   ├── server.js                 # Express app, serves frontend
│   └── package.json
├── frontend/
│   ├── public/                   # index.html + app.js (served by backend)
│   └── package.json
├── render.yaml
├── .gitignore
└── README.md
```

## Run locally

**Prerequisites:** Node.js 18+ and a MongoDB connection string (a free
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster works well).

```bash
git clone https://github.com/YOUR_USERNAME/loyalty-platform.git
cd loyalty-platform/backend

# 1. Set up environment variables
cp .env.example .env
#    then edit .env and set MONGODB_URI and JWT_SECRET

# 2. Install dependencies and run
npm install
npm run dev        # or: npm start
```

Open **http://localhost:5000**. The backend serves the frontend, so that single URL
gives you both the customer app and (after registering as a business) the merchant
dashboard.

### Try it
1. Register a **business** account → you land on the merchant dashboard. Note your
   **Join code** and **Counter stamp code** on the Overview tab.
2. In another browser/incognito, register a **customer** account.
3. As the customer, go to **Discover** and join with the join code, then go to
   **Scan** and enter the counter stamp code to collect stamps.
4. Fill the card to earn a reward, then **Redeem in store** to see the 3-minute timer.

## Deploy to Render (Blueprint)

1. Push this repo to GitHub (see below).
2. In the [Render dashboard](https://dashboard.render.com), click **New → Blueprint**
   and select your repo. Render reads `render.yaml` automatically.
3. When prompted, set the **`MONGODB_URI`** environment variable (your Atlas URI).
   `JWT_SECRET` is generated automatically and `NODE_ENV` is preset to `production`.
4. Click **Apply**. Render installs dependencies (`npm install`) and starts the API
   (`npm start`). The health check at `/api/health` confirms it's live.

> The backend service serves the frontend, so the API URL **is** your app URL.
> A standalone static frontend service is also defined in `render.yaml` if you ever
> want to host the UI separately.

### Push to GitHub
```bash
cd loyalty-platform
git init
git add .
git commit -m "Initial commit: Stampr loyalty platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/loyalty-platform.git
git push -u origin main
```
With `autoDeploy: true`, every push to `main` triggers an automatic rebuild on Render.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register member or merchant |
| POST | `/api/auth/login` | Log in, returns JWT |
| GET | `/api/auth/me` | Current user |
| GET | `/api/member/merchants` | Browse/search merchants |
| POST | `/api/member/join` | Join via join code |
| GET | `/api/member/cards` | Member's stamp cards |
| GET | `/api/member/rewards` | Available rewards |
| POST | `/api/member/rewards/:cardId/:rewardId/redeem` | Start 3-min window |
| POST | `/api/member/rewards/:cardId/:rewardId/confirm` | Staff confirm redemption |
| POST | `/api/stamp/code` | Earn a stamp via counter code |
| POST | `/api/stamp/one` | Earn a stamp via single-use OneStamp |
| GET | `/api/merchant/analytics` | Dashboard figures |
| GET/POST | `/api/merchant/members` | List / add members |
| POST | `/api/merchant/stamp` | Manually allocate a stamp |
| PUT | `/api/merchant/profile` | Edit offer details |
| GET/POST | `/api/merchant/onestamps` | List / generate OneStamps |
| POST | `/api/merchant/broadcast` | Simulate push/SMS/email |
| POST | `/api/merchant/birthday-run` | Issue birthday vouchers |

## Notes on the notification stub
`utils.sendNotification` logs to the server console instead of calling a real
provider, so the app runs with zero external credentials. To go live, swap its body
for a SendGrid (email) or Twilio (SMS) call — the call sites stay the same.

## License
MIT — use freely.
