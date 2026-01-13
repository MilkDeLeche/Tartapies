import { useState, useEffect } from 'react';
import io from 'socket.io-client';

// AUTO-DETECT ENVIRONMENT
// If localhost, use localhost. If deployed, use the Render URL.
const BACKEND_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "http://localhost:3001" 
    : "https://tartapies.onrender.com");
const socket = io.connect(BACKEND_URL);

function App() {
  const [view, setView] = useState('lobby'); // lobby, game
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [gameState, setGameState] = useState(null);
  
  useEffect(() => {
    socket.on('update_state', (data) => {
      setGameState(data);
      if (data.gameStarted) setView('game');
    });
  }, []);

  const joinGame = () => {
    if (!username || !room) return alert("Enter name and room!");
    socket.emit('join_room', { room, username });
  };

  const playCard = (cardId) => {
    socket.emit('play_card', { room, cardUniqueId: cardId });
  };

  const drawCard = () => {
    socket.emit('draw_card', { room });
  };

  const endTurn = () => {
    socket.emit('end_turn', { room });
  };

  // --- RENDER LOBBY ---
  if (view === 'lobby') {
    return (
      <div className="lobby">
        <h1>🥧 Tartapies Online</h1>
        <div className="card">
          <input placeholder="Your Name" onChange={e => setUsername(e.target.value)} />
          <input placeholder="Room Code (e.g. LOVE)" onChange={e => setRoom(e.target.value)} />
          <button onClick={joinGame}>Enter Kingdom</button>
        </div>
        <p>Connecting to: {BACKEND_URL}</p>
      </div>
    );
  }

  // --- RENDER GAME ---
  const me = gameState.players.find(p => p.id === socket.id);
  const opponent = gameState.players.find(p => p.id !== socket.id);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;

  return (
    <div className="game-container">
      {/* OPPONENT ZONE */}
      <div className="zone opponent-zone">
        <div className="player-info">
          <h3>👤 {opponent?.name || "Waiting..."}</h3>
          <span className="badge">Score: {opponent?.score || 0}</span>
          <span className="badge">Hero: {opponent?.hero?.name}</span>
        </div>
        <div className="board">
          {opponent?.board.map((c) => <CardView key={c.uniqueId} card={c} isMine={false} />)}
        </div>
      </div>

      {/* MID ZONE (Deck & Logs) */}
      <div className="mid-zone">
        <div className="deck-pile">
          <div>🎴 Deck: {gameState.deck.length}</div>
          <div>🗑️ Discard: {gameState.discard.length}</div>
        </div>
        <div className="logs">
          {gameState.logs.slice(-4).map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="controls">
          {isMyTurn && <button onClick={drawCard} className="btn-draw">Draw Card</button>}
          {isMyTurn && <button onClick={endTurn} className="btn-end">End Turn</button>}
          {!isMyTurn && <span className="waiting">Opponent's Turn...</span>}
        </div>
      </div>

      {/* MY ZONE */}
      <div className="zone my-zone">
        <div className="board">
          {me?.board.map((c) => <CardView key={c.uniqueId} card={c} isMine={true} />)}
        </div>
        <div className="player-info">
          <h3>👤 {me?.name} (You)</h3>
          <span className="badge gold">Score: {me?.score || 0}</span>
          <span className="badge">Hero: {me?.hero?.name}</span>
        </div>
        
        {/* HAND */}
        <div className="hand">
          {me?.hand.map((c) => (
            <div 
              key={c.uniqueId} 
              className="card-in-hand" 
              onClick={() => isMyTurn && playCard(c.uniqueId)}
            >
              <CardView card={c} isMine={true} inHand={true} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- SUB COMPONENT: CARD ---
function CardView({ card, isMine, inHand }) {
  const getColors = (type) => {
    switch(type) {
      case 'Tartapie': return { bg: '#fff0e6', border: '#e67e22' }; // Orange
      case 'Attack': return { bg: '#ffe6e6', border: '#c0392b' }; // Red
      case 'Defense': return { bg: '#e6f2ff', border: '#2980b9' }; // Blue
      case 'Faction': return { bg: '#f9f9f9', border: '#2c3e50' }; // Black
      case 'Relic': return { bg: '#fffbe6', border: '#f1c40f' }; // Yellow
      case 'SuperItem': return { bg: '#f3e6ff', border: '#8e44ad' }; // Purple
      default: return { bg: '#fff', border: '#ccc' };
    }
  };

  const style = getColors(card.type);

  return (
    <div style={{
      backgroundColor: style.bg,
      borderColor: style.border,
      borderWidth: '2px',
      borderStyle: 'solid',
      borderRadius: '8px',
      padding: '5px',
      width: inHand ? '100px' : '80px',
      height: inHand ? '140px' : '110px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      fontSize: '11px',
      textAlign: 'center',
      cursor: inHand ? 'pointer' : 'default',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      <strong>{card.name}</strong>
      <div style={{fontSize: '9px', fontStyle: 'italic'}}>{card.type}</div>
      <div style={{fontSize: '9px'}}>{card.desc}</div>
      {card.value ? <div style={{fontWeight: 'bold', fontSize: '14px'}}>⭐ {card.value}</div> : null}
    </div>
  );
}

export default App;
