# Tartapies Online

A multiplayer card game built with React (Vite) and Node.js (Express + Socket.io).

## Project Structure

```
tartapies-online/
├── client/          # Frontend (React + Vite)
└── server/          # Backend (Node.js + Express + Socket.io)
```

## Setup

### Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The server will run on `http://localhost:3000` by default.

### Client Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The client will run on `http://localhost:5173` by default.

## Environment Variables

### Client (.env)
- `VITE_API_URL` - API server URL 
  - Local: `http://localhost:3001`
  - Production: `https://tartapies.onrender.com`

### Server
- `PORT` - Server port (default: 3001, or set by Render automatically)
- `NODE_ENV` - Set to `production` on Render

## Deployment

### Backend (Render)
- **Live URL**: https://tartapies.onrender.com
- Deployed on Render.com as a Web Service
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

### Frontend (Netlify)
- Configure environment variable:
  - `VITE_API_URL` = `https://tartapies.onrender.com`
- Base Directory: `client`
- Build Command: `npm run build`
- Publish Directory: `client/dist`

## Development

The project uses:
- **Frontend**: React 18, Vite, Socket.io-client
- **Backend**: Node.js, Express, Socket.io, CORS

Game logic and UI components will be added to:
- `server/index.js` - Game engine and server logic
- `client/src/App.jsx` - Main game UI and client logic
- `client/src/index.css` - Game styles

