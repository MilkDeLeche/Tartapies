// server/index.js - Complete Tartapies Game Engine
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- CARD DATABASE ---
const CARD_DB = [
    // TARTAPIES
    { id: 'tar_std', name: 'Tartapie', type: 'Tartapie', value: 1, count: 20, desc: "Delicioso." },
    { id: 'tar_dbl', name: 'Doble Tartapie', type: 'Tartapie', value: 2, count: 1, desc: "Vale por 2 Tartapies." },
    { id: 'tar_man', name: 'Tartapie y Manzana Real', type: 'Tartapie', value: 1, count: 1, desc: "Busca otro Tartapie al jugar." },
    
    // HEROES
    { id: 'hero_olaf', name: 'Olaf, El Conquistador', type: 'Hero', desc: "Talento: Saqueo / Maestría: Frenesí" },
    { id: 'hero_panz', name: 'Panzalegre el Bufón', type: 'Hero', desc: "Talento: Dolor de Cabeza / Maestría: Resaca" },
    { id: 'hero_zaniah', name: 'Zaniah Selestia', type: 'Hero', desc: "Talento: Escudo Mágico / Maestría: Quiromancia" },
    { id: 'hero_lord', name: 'Lord Asgaroth', type: 'Hero', desc: "Talento: Heraldo del Vacío / Maestría: Vacío Absoluto" },
    
    // ATTACK ITEMS
    { id: 'atk_zar', name: 'Zarpatrampa', type: 'Attack', count: 2, desc: "Roba un Tartapie de otro jugador." },
    { id: 'atk_pet', name: 'Petardobomba', type: 'Attack', count: 2, desc: "Mezcla Tartapie enemigo en el mazo." },
    { id: 'atk_lev', name: 'Levitasuero', type: 'Attack', count: 2, desc: "Devuelve Tartapie a la mano." },
    { id: 'atk_hie', name: 'Hierbafrenesí', type: 'Attack', count: 2, desc: "Roba 2. Si sale Tartapie, juégalo." },
    
    // DEFENSE ITEMS
    { id: 'def_tra', name: 'Tratado de Granalianza', type: 'Defense', count: 2, desc: "Niega un Item de Ataque/Defensa." },
    { id: 'def_nie', name: 'Nieblabomba Vaporosa', type: 'Defense', count: 2, desc: "Si otro juega Tartapie, róbalo." },
    { id: 'def_sue', name: 'Suero de la Paz', type: 'Defense', count: 2, desc: "Niega una Habilidad de Héroe." },
    
    // RELICS
    { id: 'rel_vol', name: 'Voluntad de Aldia', type: 'Relic', count: 1, desc: "Roba 1. Gira/Endereza un Héroe." },
    { id: 'rel_cao', name: 'Caosrubí', type: 'Relic', count: 1, desc: "Talento sin dado o Maestría gratis." },
    { id: 'rel_ord', name: 'Orden Absoluto', type: 'Relic', count: 1, desc: "Niega Reliquia o Destruye Facción." },
    
    // FACTIONS
    { id: 'fac_ald', name: 'Aldia Guardiadestino', type: 'Faction', value: 1, count: 1, desc: "+1 Tartapie. (Pasiva: +1 extra si hay otra facción)." },
    { id: 'fac_gre', name: 'El Gremio', type: 'Faction', value: 1, count: 1, desc: "+1 Tartapie. Mira mano oponente." },
    { id: 'fac_num', name: 'Nume el Vacío', type: 'Faction', value: 0, count: 1, desc: "+0 Tartapies. Intercambia esta carta por otra facción." },
    
    // POTIONS
    { id: 'pot_cel', name: 'Poción de Celeridad', type: 'Potion', count: 1, desc: "Roba 2 cartas." },
    { id: 'pot_nig', name: 'Poción de Nigromancia', type: 'Potion', count: 1, desc: "Al jugar Tartapie: Recupéralo del descarte." },
    
    // SUPER ITEMS
    { id: 'sup_sab', name: 'Sabotajeador', type: 'SuperItem', count: 1, desc: "Recupera Item del descarte." },
    { id: 'sup_esc', name: 'Escudo de Granalianza', type: 'SuperItem', count: 1, desc: "Niega pérdida de Tartapie." }
];

const rooms = {};

// --- UTILITY FUNCTIONS ---
function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
}

function isPar(roll) {
    return roll % 2 === 0;
}

function buildDeck() {
    let deck = [];
    CARD_DB.forEach(card => {
        if (card.type === 'Hero') return;
        const qty = card.count || 1;
        for (let i = 0; i < qty; i++) {
            deck.push({ 
                ...card, 
                uniqueId: Math.random().toString(36).substr(2, 9),
                isFaceDown: card.type === 'Potion' || card.type === 'SuperItem',
                isRotated: false
            });
        }
    });
    return deck.sort(() => Math.random() - 0.5);
}

function recalculateScore(player) {
    let score = 0;
    player.board.forEach(card => {
        if (card.type === 'Tartapie') {
            score += card.value || 1;
        } else if (card.type === 'Faction') {
            if (card.id === 'fac_num') {
                score += 0;
            } else if (card.id === 'fac_ald') {
                const otherFactions = player.board.filter(c => c.type === 'Faction' && c.id !== 'fac_ald');
                score += otherFactions.length > 0 ? 2 : 1;
            } else {
                score += card.value || 1;
            }
        }
    });
    player.score = score;
}

function getActivePlayer(game) {
    return game.players[game.turnIndex];
}

function getOpponent(game, playerId) {
    return game.players.find(p => p.id !== playerId);
}

function findCardById(game, cardUniqueId) {
    for (let player of game.players) {
        const inHand = player.hand.find(c => c.uniqueId === cardUniqueId);
        if (inHand) return { card: inHand, location: 'hand', player };
        
        const onBoard = player.board.find(c => c.uniqueId === cardUniqueId);
        if (onBoard) return { card: onBoard, location: 'board', player };
    }
    const inDiscard = game.discard.find(c => c.uniqueId === cardUniqueId);
    if (inDiscard) return { card: inDiscard, location: 'discard', player: null };
    return null;
}

// --- GAME PHASES ---
function startTurn(game) {
    const player = getActivePlayer(game);
    player.heroRotated = false;
    player.usedTalent = false;
    player.usedMastery = false;
    player.playedFaction = false;
    player.playedAttack = false;
    player.playedRelic = false;
    
    game.phase = 'draw';
    game.logs.push(`--- ${player.name}'s Turn (Draw Phase) ---`);
    
    // Draw Phase
    if (game.deck.length > 0) {
        player.hand.push(game.deck.pop());
        game.logs.push(`${player.name} drew a card.`);
    }
    
    // Check win condition
    if (game.deck.length === 0) {
        endGame(game);
        return;
    }
    
    game.phase = 'action';
    game.stack = [];
    game.waitingForTarget = null;
    game.waitingForResponse = false;
    
    io.to(game.room).emit('update_state', game);
}

function endTurn(game) {
    const player = getActivePlayer(game);
    
    // End Phase: Discard down to 6
    while (player.hand.length > 6) {
        if (player.hand.length > 0) {
            const discarded = player.hand.pop();
            game.discard.push(discarded);
            game.logs.push(`${player.name} discarded ${discarded.name} (hand limit)`);
        }
    }
    
    // Exile Relics
    const relicsToExile = player.board.filter(c => c.type === 'Relic');
    relicsToExile.forEach(relic => {
        const index = player.board.indexOf(relic);
        player.board.splice(index, 1);
        game.logs.push(`${relic.name} was exiled.`);
    });
    
    // Next player
    game.turnIndex = (game.turnIndex + 1) % 2;
    startTurn(game);
}

function endGame(game) {
    game.gameEnded = true;
    game.phase = 'ended';
    
    recalculateScore(game.players[0]);
    recalculateScore(game.players[1]);
    
    const winner = game.players[0].score > game.players[1].score 
        ? game.players[0] 
        : game.players[1].score > game.players[0].score 
            ? game.players[1] 
            : null;
    
    if (winner) {
        game.logs.push(`🎉 ${winner.name} WINS with ${winner.score} points!`);
    } else {
        game.logs.push(`🤝 TIE! Both players have ${game.players[0].score} points.`);
    }
    
    io.to(game.room).emit('update_state', game);
}

// --- CARD EFFECTS ---
function resolveCardEffect(game, player, card, targetId = null) {
    const opponent = getOpponent(game, player.id);
    
    switch(card.id) {
        // TARTAPIES
        case 'tar_dbl':
            if (game.deck.length > 0) {
                player.hand.push(game.deck.pop());
                game.logs.push(`${player.name} drew a card from Doble Tartapie.`);
            }
            break;
            
        case 'tar_man':
            const tartapieInDeck = game.deck.find(c => c.type === 'Tartapie');
            if (tartapieInDeck) {
                const index = game.deck.indexOf(tartapieInDeck);
                const found = game.deck.splice(index, 1)[0];
                player.hand.push(found);
                game.logs.push(`${player.name} searched for and found a Tartapie.`);
            }
            break;
            
        // ATTACK ITEMS
        case 'atk_zar':
            if (targetId) {
                const target = findCardById(game, targetId);
                if (target && target.location === 'board' && target.card.type === 'Tartapie' && target.player.id === opponent.id) {
                    const index = target.player.board.indexOf(target.card);
                    target.player.board.splice(index, 1);
                    player.board.push(target.card);
                    recalculateScore(player);
                    recalculateScore(target.player);
                    game.logs.push(`${player.name} stole ${target.card.name} from ${opponent.name}!`);
                }
            }
            break;
            
        case 'atk_pet':
            if (targetId) {
                const target = findCardById(game, targetId);
                if (target && target.location === 'board' && target.card.type === 'Tartapie' && target.player.id === opponent.id) {
                    const index = target.player.board.indexOf(target.card);
                    const card = target.player.board.splice(index, 1)[0];
                    game.deck.push(card);
                    game.deck.sort(() => Math.random() - 0.5);
                    recalculateScore(target.player);
                    game.logs.push(`${player.name} shuffled ${card.name} into the deck!`);
                }
            }
            break;
            
        case 'atk_lev':
            if (targetId) {
                const target = findCardById(game, targetId);
                if (target && target.location === 'board' && target.card.type === 'Tartapie' && target.player.id === opponent.id) {
                    const index = target.player.board.indexOf(target.card);
                    const card = target.player.board.splice(index, 1)[0];
                    target.player.hand.push(card);
                    recalculateScore(target.player);
                    game.logs.push(`${player.name} returned ${card.name} to ${opponent.name}'s hand!`);
                }
            }
            break;
            
        case 'atk_hie':
            for (let i = 0; i < 2 && game.deck.length > 0; i++) {
                const drawn = game.deck.pop();
                player.hand.push(drawn);
                if (drawn.type === 'Tartapie') {
                    game.logs.push(`${player.name} drew ${drawn.name} and may play it immediately!`);
                    // Could trigger auto-play option here
                }
            }
            game.logs.push(`${player.name} drew 2 cards from Hierbafrenesí.`);
            break;
            
        // RELICS
        case 'rel_vol':
            if (game.deck.length > 0) {
                player.hand.push(game.deck.pop());
            }
            if (targetId) {
                const target = findCardById(game, targetId);
                if (target && target.card.type === 'Hero') {
                    const heroPlayer = target.player;
                    heroPlayer.heroRotated = !heroPlayer.heroRotated;
                    game.logs.push(`${heroPlayer.name}'s hero is now ${heroPlayer.heroRotated ? 'Rotated' : 'Ready'}.`);
                }
            }
            break;
            
        case 'rel_cao':
            player.caosrubiActive = true;
            game.logs.push(`${player.name} activated Caosrubí - abilities cost 0 this turn!`);
            break;
            
        // POTIONS (when activated)
        case 'pot_cel':
            if (!card.isFaceDown) {
                for (let i = 0; i < 2 && game.deck.length > 0; i++) {
                    player.hand.push(game.deck.pop());
                }
                game.logs.push(`${player.name} drew 2 cards from Poción de Celeridad.`);
            }
            break;
            
        case 'pot_nig':
            // Triggered when Tartapie is played
            break;
            
        // SUPER ITEMS
        case 'sup_sab':
            if (!card.isFaceDown && !card.isRotated) {
                const roll = rollD6();
                game.logs.push(`${player.name} rolled ${roll} for Sabotajeador.`);
                if (isPar(roll)) {
                    // Return item from discard - would need targeting
                    game.logs.push(`Sabotajeador: Even roll - can return item from discard.`);
                }
                card.isRotated = true;
            }
            break;
            
        case 'sup_esc':
            // Triggered when losing Tartapie
            break;
    }
}

// --- HERO ABILITIES ---
function resolveHeroAbility(game, player, abilityType, targetId = null) {
    const opponent = getOpponent(game, player.id);
    const roll = rollD6();
    const par = isPar(roll);
    
    switch(player.hero.id) {
        case 'hero_olaf':
            if (abilityType === 'talent') {
                // Reaction ability - handled separately
            } else if (abilityType === 'mastery') {
                // Play Tartapie from hand for free
                if (targetId) {
                    const target = findCardById(game, targetId);
                    if (target && target.location === 'hand' && target.card.type === 'Tartapie' && target.player.id === player.id) {
                        const index = player.hand.indexOf(target.card);
                        player.hand.splice(index, 1);
                        player.board.push(target.card);
                        recalculateScore(player);
                        game.logs.push(`${player.name} used Mastery to play ${target.card.name} for free!`);
                    }
                }
            }
            break;
            
        case 'hero_panz':
            if (abilityType === 'talent') {
                // Reaction - modify opponent's roll
            } else if (abilityType === 'mastery') {
                if (par) {
                    const tartapie = opponent.board.find(c => c.type === 'Tartapie');
                    if (tartapie) {
                        const index = opponent.board.indexOf(tartapie);
                        const card = opponent.board.splice(index, 1)[0];
                        player.board.push(card);
                        recalculateScore(player);
                        recalculateScore(opponent);
                        game.logs.push(`${player.name} stole a Tartapie with Mastery!`);
                    }
                }
            }
            break;
            
        case 'hero_zaniah':
            if (abilityType === 'talent') {
                // Reaction - negate item
            } else if (abilityType === 'mastery') {
                // Look at opponent hand, play Tartapie from it
                if (targetId) {
                    const target = findCardById(game, targetId);
                    if (target && target.location === 'hand' && target.card.type === 'Tartapie' && target.player.id === opponent.id) {
                        const index = opponent.hand.indexOf(target.card);
                        opponent.hand.splice(index, 1);
                        player.board.push(target.card);
                        recalculateScore(player);
                        game.logs.push(`${player.name} played ${target.card.name} from ${opponent.name}'s hand!`);
                    }
                }
            }
            break;
            
        case 'hero_lord':
            if (abilityType === 'talent') {
                // Reaction - shuffle Tartapie on odd roll
            } else if (abilityType === 'mastery') {
                opponent.cannotPlayTartapies = true;
                game.logs.push(`${opponent.name} cannot play Tartapies next turn!`);
            }
            break;
    }
}

// --- SOCKET HANDLERS ---
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join_room', ({ room, username }) => {
        socket.join(room);
        
        if (!rooms[room]) {
            rooms[room] = {
                room,
                players: [],
                deck: [],
                discard: [],
                turnIndex: 0,
                gameStarted: false,
                gameEnded: false,
                phase: 'lobby',
                stack: [],
                logs: [],
                waitingForTarget: null,
                waitingForResponse: false
            };
        }

        const game = rooms[room];
        const existingPlayer = game.players.find(p => p.name === username);
        
        if (!existingPlayer && game.players.length < 2) {
            const heroes = CARD_DB.filter(c => c.type === 'Hero');
            const randomHero = heroes[Math.floor(Math.random() * heroes.length)];
            
            game.players.push({
                id: socket.id,
                name: username,
                hero: randomHero,
                hand: [],
                board: [],
                score: 0,
                heroRotated: false,
                usedTalent: false,
                usedMastery: false,
                playedFaction: false,
                playedAttack: false,
                playedRelic: false,
                cannotPlayTartapies: false,
                caosrubiActive: false
            });
            
            game.logs.push(`${username} joined as ${randomHero.name}`);
        }

        if (game.players.length === 2 && !game.gameStarted) {
            startGame(room);
        } else {
            io.to(room).emit('update_state', game);
        }
    });

    socket.on('play_card', ({ room, cardUniqueId, targetId = null }) => {
        const game = rooms[room];
        if (!game || game.gameEnded) return;

        const player = game.players.find(p => p.id === socket.id);
        if (!player) return;
        
        const cardIndex = player.hand.findIndex(c => c.uniqueId === cardUniqueId);
        if (cardIndex === -1) return;
        
        const card = player.hand[cardIndex];
        const activePlayer = getActivePlayer(game);
        
        // Check if it's player's turn (unless it's a defense/reaction)
        if (card.type !== 'Defense' && player.id !== activePlayer.id) {
            return;
        }
        
        // Validation checks
        if (card.type === 'Faction' && (player.playedFaction || player.board.filter(c => c.type === 'Tartapie').length === 0)) {
            return;
        }
        if (card.type === 'Attack' && player.playedAttack) return;
        if (card.type === 'Relic' && player.playedRelic) return;
        if (card.type === 'Tartapie' && player.cannotPlayTartapies) return;
        
        // Remove from hand
        player.hand.splice(cardIndex, 1);
        
        // Handle Potions (face down)
        if (card.type === 'Potion' || card.type === 'SuperItem') {
            if (card.isFaceDown) {
                // Activation required
                game.waitingForActivation = { playerId: player.id, cardId: cardUniqueId };
                io.to(room).emit('update_state', game);
                return;
            }
        }
        
        // Add to stack or resolve
        if (card.type === 'Attack' || card.type === 'Defense') {
            game.stack.push({
                type: 'card',
                card: card,
                player: player.id,
                targetId: targetId
            });
            game.waitingForResponse = true;
            game.logs.push(`${player.name} played ${card.name} (waiting for responses)...`);
        } else {
            // Immediate resolution
            if (card.type === 'Tartapie' || card.type === 'Faction') {
                player.board.push(card);
                recalculateScore(player);
            } else if (card.type === 'Potion' || card.type === 'SuperItem') {
                player.board.push(card);
            } else if (card.type === 'Relic') {
                player.board.push(card);
                player.playedRelic = true;
            }
            
            resolveCardEffect(game, player, card, targetId);
        }
        
        // Update flags
        if (card.type === 'Faction') player.playedFaction = true;
        if (card.type === 'Attack') player.playedAttack = true;
        
        // Check for potion triggers
        if (card.type === 'Tartapie') {
            const nigromancia = player.board.find(c => c.id === 'pot_nig' && !c.isFaceDown);
            if (nigromancia && game.discard.length > 0) {
                const tartapieInDiscard = game.discard.find(c => c.type === 'Tartapie');
                if (tartapieInDiscard) {
                    const index = game.discard.indexOf(tartapieInDiscard);
                    const recovered = game.discard.splice(index, 1)[0];
                    player.board.push(recovered);
                    recalculateScore(player);
                    game.logs.push(`${player.name} recovered ${recovered.name} from discard!`);
                }
            }
        }
        
        io.to(room).emit('update_state', game);
    });

    socket.on('respond_to_stack', ({ room, cardUniqueId, targetId = null }) => {
        const game = rooms[room];
        if (!game || !game.waitingForResponse) return;
        
        const player = game.players.find(p => p.id === socket.id);
        const cardIndex = player.hand.findIndex(c => c.uniqueId === cardUniqueId);
        if (cardIndex === -1 || player.hand[cardIndex].type !== 'Defense') return;
        
        const card = player.hand[cardIndex];
        player.hand.splice(cardIndex, 1);
        
        game.stack.push({
            type: 'defense',
            card: card,
            player: player.id,
            targetId: targetId
        });
        
        game.logs.push(`${player.name} responded with ${card.name}`);
        io.to(room).emit('update_state', game);
    });

    socket.on('resolve_stack', ({ room }) => {
        const game = rooms[room];
        if (!game || game.stack.length === 0) return;
        
        // Resolve LIFO
        while (game.stack.length > 0) {
            const item = game.stack.pop();
            const player = game.players.find(p => p.id === item.player);
            
            if (item.type === 'defense' && item.card.id === 'def_tra') {
                // Negate the previous attack
                const attack = game.stack[game.stack.length - 1];
                if (attack) {
                    game.stack.pop();
                    game.discard.push(attack.card);
                    game.discard.push(item.card);
                    game.logs.push(`${item.card.name} negated ${attack.card.name}!`);
                    continue;
                }
            }
            
            // Resolve the effect
            if (item.card.type === 'Attack' || item.card.type === 'Defense') {
                resolveCardEffect(game, player, item.card, item.targetId);
                game.discard.push(item.card);
            }
        }
        
        game.waitingForResponse = false;
        io.to(room).emit('update_state', game);
    });

    socket.on('activate_potion', ({ room, cardUniqueId, method }) => {
        const game = rooms[room];
        const player = game.players.find(p => p.id === socket.id);
        const card = player.board.find(c => c.uniqueId === cardUniqueId);
        
        if (!card || !card.isFaceDown) return;
        
        if (method === 'discard') {
            if (player.hand.length > 0) {
                const discarded = player.hand.pop();
                game.discard.push(discarded);
                card.isFaceDown = false;
                game.logs.push(`${player.name} activated ${card.name} by discarding ${discarded.name}.`);
            }
        } else if (method === 'roll') {
            const roll = rollD6();
            game.logs.push(`${player.name} rolled ${roll} to activate ${card.name}.`);
            if (isPar(roll)) {
                card.isFaceDown = false;
                game.logs.push(`Success! ${card.name} is now active.`);
            } else {
                game.logs.push(`Failed! ${card.name} remains inactive.`);
            }
        }
        
        io.to(room).emit('update_state', game);
    });

    socket.on('use_hero_ability', ({ room, abilityType, targetId = null }) => {
        const game = rooms[room];
        const player = game.players.find(p => p.id === socket.id);
        const activePlayer = getActivePlayer(game);
        
        if (player.id !== activePlayer.id) return;
        if (player.heroRotated) return;
        if (abilityType === 'mastery' && (player.usedMastery || player.score < 3)) return;
        if (abilityType === 'talent' && player.usedTalent) return;
        
        const cost = player.caosrubiActive ? 0 : (abilityType === 'mastery' ? 1 : 0);
        if (abilityType === 'mastery' && !player.caosrubiActive) {
            if (player.hand.length === 0) return;
            const discarded = player.hand.pop();
            game.discard.push(discarded);
        }
        
        resolveHeroAbility(game, player, abilityType, targetId);
        player.heroRotated = true;
        if (abilityType === 'talent') player.usedTalent = true;
        if (abilityType === 'mastery') player.usedMastery = true;
        
        io.to(room).emit('update_state', game);
    });

    socket.on('end_turn', ({ room }) => {
        const game = rooms[room];
        const player = game.players.find(p => p.id === socket.id);
        const activePlayer = getActivePlayer(game);
        
        if (player.id !== activePlayer.id || game.phase !== 'action') return;
        if (game.stack.length > 0 || game.waitingForResponse) return;
        
        endTurn(game);
    });

    socket.on('pass_action', ({ room }) => {
        const game = rooms[room];
        const player = game.players.find(p => p.id === socket.id);
        const activePlayer = getActivePlayer(game);
        
        if (player.id !== activePlayer.id) return;
        if (game.waitingForResponse) {
            // Resolve stack if no more responses
            game.waitingForResponse = false;
            socket.emit('resolve_stack', { room });
        }
        
        io.to(room).emit('update_state', game);
    });
});

function startGame(room) {
    const game = rooms[room];
    game.gameStarted = true;
    game.deck = buildDeck();
    game.phase = 'lobby';
    game.logs.push("GAME STARTED! Good luck adventurers.");

    game.players.forEach(p => {
        p.hand = [];
        p.board = [];
        for (let i = 0; i < 5; i++) {
            if (game.deck.length > 0) p.hand.push(game.deck.pop());
        }
    });

    // Start first turn
    setTimeout(() => {
        startTurn(game);
    }, 1000);
}

server.listen(PORT, () => {
    console.log(`TARTAPIES SERVER RUNNING ON PORT ${PORT}`);
});
