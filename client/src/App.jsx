import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? "http://localhost:3001" 
    : "https://tartapies.onrender.com");
const socket = io.connect(BACKEND_URL);

function App() {
  const [view, setView] = useState('lobby');
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [gameState, setGameState] = useState(null);
  const [selectingTarget, setSelectingTarget] = useState(null);
  const [activatingPotion, setActivatingPotion] = useState(null);
  
  useEffect(() => {
    socket.on('update_state', (data) => {
      setGameState(data);
      if (data.gameStarted) setView('game');
      setSelectingTarget(null);
    });
    
    return () => {
      socket.off('update_state');
    };
  }, []);

  const joinGame = () => {
    if (!username || !room) return alert("Enter name and room!");
    socket.emit('join_room', { room, username });
  };

  const playCard = (cardId, needsTarget = false) => {
    if (needsTarget) {
      setSelectingTarget(cardId);
      return;
    }
    socket.emit('play_card', { room, cardUniqueId: cardId });
  };

  const playCardWithTarget = (cardId, targetId) => {
    socket.emit('play_card', { room, cardUniqueId: cardId, targetId });
    setSelectingTarget(null);
  };

  const respondToStack = (cardId) => {
    socket.emit('respond_to_stack', { room, cardUniqueId: cardId });
  };

  const resolveStack = () => {
    socket.emit('resolve_stack', { room });
  };

  const activatePotion = (cardId, method) => {
    socket.emit('activate_potion', { room, cardUniqueId: cardId, method });
    setActivatingPotion(null);
  };

  const useHeroAbility = (abilityType, targetId = null) => {
    socket.emit('use_hero_ability', { room, abilityType, targetId });
  };

  const endTurn = () => {
    socket.emit('end_turn', { room });
  };

  const passAction = () => {
    socket.emit('pass_action', { room });
  };

  if (view === 'lobby') {
    return (
      <div className="lobby">
        <h1>🥧 Tartapies Online</h1>
        <div className="card">
          <input placeholder="Your Name" value={username} onChange={e => setUsername(e.target.value)} />
          <input placeholder="Room Code (e.g. LOVE)" value={room} onChange={e => setRoom(e.target.value)} />
          <button onClick={joinGame}>Enter Kingdom</button>
        </div>
        <p>Connecting to: {BACKEND_URL}</p>
      </div>
    );
  }

  if (!gameState) return <div>Loading...</div>;

  const me = gameState.players.find(p => p.id === socket.id);
  const opponent = gameState.players.find(p => p.id !== socket.id);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  const activePlayer = gameState.players[gameState.turnIndex];

  // Check if card needs target
  const needsTarget = (card) => {
    return ['atk_zar', 'atk_pet', 'atk_lev', 'rel_vol'].includes(card.id);
  };

  // Check if can play card
  const canPlayCard = (card) => {
    if (!isMyTurn && card.type !== 'Defense') return false;
    if (card.type === 'Faction' && (me.playedFaction || me.board.filter(c => c.type === 'Tartapie').length === 0)) return false;
    if (card.type === 'Attack' && me.playedAttack) return false;
    if (card.type === 'Relic' && me.playedRelic) return false;
    if (card.type === 'Tartapie' && me.cannotPlayTartapies) return false;
    if (card.type === 'Defense' && !gameState.waitingForResponse) return false;
    return true;
  };

  return (
    <div className="game-container">
      {/* GAME STATUS BAR */}
      <div className="status-bar">
        <div className="phase-indicator">
          Phase: <strong>{gameState.phase}</strong> | 
          Turn: <strong>{activePlayer?.name}</strong> | 
          Deck: {gameState.deck.length} | 
          {gameState.gameEnded && <span className="game-ended">GAME ENDED</span>}
        </div>
        {gameState.stack && gameState.stack.length > 0 && (
          <div className="stack-indicator">
            Stack: {gameState.stack.length} item(s) | 
            {gameState.waitingForResponse && <span>Waiting for responses...</span>}
          </div>
        )}
      </div>

      {/* OPPONENT ZONE */}
      <div className="zone opponent-zone">
        <div className="player-info">
          <h3>👤 {opponent?.name || "Waiting..."}</h3>
          <span className="badge">Score: {opponent?.score || 0}</span>
          <span className="badge">Hero: {opponent?.hero?.name}</span>
          <span className={`badge ${opponent?.heroRotated ? 'rotated' : 'ready'}`}>
            {opponent?.heroRotated ? 'Rotated' : 'Ready'}
          </span>
        </div>
        <div className="board">
          {opponent?.board.map((c) => (
            <div 
              key={c.uniqueId}
              onClick={() => selectingTarget && playCardWithTarget(selectingTarget, c.uniqueId)}
              className={selectingTarget ? 'targetable' : ''}
            >
              <CardView card={c} isMine={false} />
            </div>
          ))}
        </div>
      </div>

      {/* MID ZONE */}
      <div className="mid-zone">
        <div className="deck-pile">
          <div>🎴 Deck: {gameState.deck.length}</div>
          <div>🗑️ Discard: {gameState.discard.length}</div>
        </div>
        
        {/* STACK DISPLAY */}
        {gameState.stack && gameState.stack.length > 0 && (
          <div className="stack-display">
            <strong>Stack (LIFO):</strong>
            {gameState.stack.map((item, i) => (
              <div key={i} className="stack-item">
                {item.card.name} by {gameState.players.find(p => p.id === item.player)?.name}
              </div>
            ))}
            {isMyTurn && !gameState.waitingForResponse && (
              <button onClick={resolveStack}>Resolve Stack</button>
            )}
          </div>
        )}

        <div className="logs">
          {gameState.logs.slice(-6).map((l, i) => <div key={i}>{l}</div>)}
        </div>

        <div className="controls">
          {isMyTurn && gameState.phase === 'action' && !selectingTarget && (
            <>
              <button onClick={passAction} className="btn-pass">Pass Action</button>
              <button onClick={endTurn} className="btn-end">End Turn</button>
            </>
          )}
          {!isMyTurn && gameState.waitingForResponse && (
            <div className="response-prompt">You can respond with a Defense card!</div>
          )}
          {selectingTarget && (
            <div className="target-prompt">Select a target card...</div>
          )}
        </div>
      </div>

      {/* MY ZONE */}
      <div className="zone my-zone">
        <div className="board">
          {me?.board.map((c) => (
            <div key={c.uniqueId}>
              <CardView card={c} isMine={true} />
              {c.isFaceDown && (
                <div className="activation-buttons">
                  <button onClick={() => activatePotion(c.uniqueId, 'discard')}>Discard to Activate</button>
                  <button onClick={() => activatePotion(c.uniqueId, 'roll')}>Roll to Activate</button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="player-info">
          <h3>👤 {me?.name} (You)</h3>
          <span className="badge gold">Score: {me?.score || 0}</span>
          <span className="badge">Hero: {me?.hero?.name}</span>
          <span className={`badge ${me?.heroRotated ? 'rotated' : 'ready'}`}>
            {me?.heroRotated ? 'Rotated' : 'Ready'}
          </span>
          
          {/* HERO ABILITIES */}
          {isMyTurn && !me.heroRotated && (
            <div className="hero-abilities">
              <button 
                onClick={() => useHeroAbility('talent')}
                disabled={me.usedTalent}
                className="btn-talent"
              >
                Talent
              </button>
              <button 
                onClick={() => useHeroAbility('mastery')}
                disabled={me.usedMastery || me.score < 3}
                className="btn-mastery"
                title={me.score < 3 ? "Need 3+ Tartapies" : "Discard 1 card"}
              >
                Mastery {me.score < 3 && `(Need 3+)`}
              </button>
            </div>
          )}
        </div>
        
        {/* HAND */}
        <div className="hand">
          {me?.hand.map((c) => (
            <div 
              key={c.uniqueId} 
              className={`card-in-hand ${canPlayCard(c) ? 'playable' : 'unplayable'}`}
              onClick={() => {
                if (canPlayCard(c)) {
                  if (c.type === 'Defense' && gameState.waitingForResponse) {
                    respondToStack(c.uniqueId);
                  } else if (needsTarget(c)) {
                    playCard(c.uniqueId, true);
                  } else {
                    playCard(c.uniqueId);
                  }
                }
              }}
            >
              <CardView card={c} isMine={true} inHand={true} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardView({ card, isMine, inHand }) {
  const getColors = (type) => {
    switch(type) {
      case 'Tartapie': return { bg: '#fff0e6', border: '#e67e22' };
      case 'Attack': return { bg: '#ffe6e6', border: '#c0392b' };
      case 'Defense': return { bg: '#e6f2ff', border: '#2980b9' };
      case 'Faction': return { bg: '#f9f9f9', border: '#2c3e50' };
      case 'Relic': return { bg: '#fffbe6', border: '#f1c40f' };
      case 'Potion': return { bg: '#e8f5e9', border: '#4caf50' };
      case 'SuperItem': return { bg: '#f3e6ff', border: '#8e44ad' };
      default: return { bg: '#fff', border: '#ccc' };
    }
  };

  const style = getColors(card.type);
  const opacity = card.isFaceDown ? 0.5 : 1;

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
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      opacity: opacity,
      position: 'relative'
    }}>
      {card.isFaceDown && <div style={{fontSize: '8px', color: '#666'}}>Face Down</div>}
      {card.isRotated && <div style={{fontSize: '8px', color: '#666'}}>Rotated</div>}
      <strong>{card.name}</strong>
      <div style={{fontSize: '9px', fontStyle: 'italic'}}>{card.type}</div>
      <div style={{fontSize: '9px'}}>{card.desc}</div>
      {card.value !== undefined && <div style={{fontWeight: 'bold', fontSize: '14px'}}>⭐ {card.value}</div>}
    </div>
  );
}

export default App;
