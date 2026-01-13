// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const PORT = process.env.PORT || 3001; // Dynamic port for Render

const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from Netlify
        methods: ["GET", "POST"]
    }
});

// --- 1. THE FULL CARD DATABASE ---
// Based on all the images you sent
const CARD_DB = [
    // --- TARTAPIES (The Points) ---
    { id: 'tar_std', name: 'Tartapie', type: 'Tartapie', value: 1, count: 20, desc: "Delicioso." },
    { id: 'tar_dbl', name: 'Doble Tartapie', type: 'Tartapie', value: 2, count: 1, desc: "Vale por 2 Tartapies." },
    { id: 'tar_man', name: 'Tartapie y Manzana Real', type: 'Tartapie', value: 1, count: 1, desc: "Busca otro Tartapie al jugar." },

    // --- HEROES (Avatars) ---
    // Note: In this MVP, Heroes are assigned randomly or chosen.
    { id: 'hero_olaf', name: 'Olaf, El Conquistador', type: 'Hero', hp: 0, desc: "Talento: Saqueo / Maestría: Frenesí" },
    { id: 'hero_panz', name: 'Panzalegre el Bufón', type: 'Hero', hp: 0, desc: "Talento: Dolor de Cabeza / Maestría: Resaca" },
    { id: 'hero_zaniah', name: 'Zaniah Selestia', type: 'Hero', hp: 0, desc: "Talento: Escudo Mágico / Maestría: Quiromancia" },
    { id: 'hero_lord', name: 'Lord Asgaroth', type: 'Hero', hp: 0, desc: "Talento: Heraldo del Vacío / Maestría: Vacío Absoluto" },

    // --- ATTACK ITEMS (Swords) ---
    { id: 'atk_zar', name: 'Zarpatrampa', type: 'Attack', count: 2, desc: "Roba un Tartapie de otro jugador." },
    { id: 'atk_pet', name: 'Petardobomba', type: 'Attack', count: 2, desc: "Mezcla Tartapie enemigo en el mazo." },
    { id: 'atk_lev', name: 'Levitasuero', type: 'Attack', count: 2, desc: "Devuelve Tartapie a la mano." },
    { id: 'atk_hie', name: 'Hierbafrenesí', type: 'Attack', count: 2, desc: "Roba 2. Si sale Tartapie, juégalo." },

    // --- DEFENSE ITEMS (Shields) ---
    { id: 'def_tra', name: 'Tratado de Granalianza', type: 'Defense', count: 2, desc: "Niega un Item de Ataque/Defensa." },
    { id: 'def_nie', name: 'Nieblabomba Vaporosa', type: 'Defense', count: 2, desc: "Si otro juega Tartapie, róbalo." },
    { id: 'def_sue', name: 'Suero de la Paz', type: 'Defense', count: 2, desc: "Niega una Habilidad de Héroe." },

    // --- RELICS (Lightning) ---
    { id: 'rel_vol', name: 'Voluntad de Aldia', type: 'Relic', count: 1, desc: "Roba 1. Gira/Endereza un Héroe." },
    { id: 'rel_cao', name: 'Caosrubí', type: 'Relic', count: 1, desc: "Talento sin dado o Maestría gratis." },
    { id: 'rel_ord', name: 'Orden Absoluto', type: 'Relic', count: 1, desc: "Niega Reliquia o Destruye Facción." },

    // --- FACTIONS (+1s) ---
    { id: 'fac_ald', name: 'Aldia Guardiadestino', type: 'Faction', value: 1, count: 1, desc: "+1 Tartapie. (Pasiva: +1 extra si hay otra facción)." },
    { id: 'fac_gre', name: 'El Gremio', type: 'Faction', value: 1, count: 1, desc: "+1 Tartapie. Mira mano oponente." },
    { id: 'fac_num', name: 'Nume el Vacío', type: 'Faction', value: 0, count: 1, desc: "+0 Tartapies. Intercambia esta carta por otra facción." },

    // --- POTIONS (Alchemies) ---
    { id: 'pot_cel', name: 'Poción de Celeridad', type: 'Potion', count: 1, desc: "Roba 2 cartas." },
    { id: 'pot_nig', name: 'Poción de Nigromancia', type: 'Potion', count: 1, desc: "Al jugar Tartapie: Recupéralo del descarte." },

    // --- SUPER ITEMS (Stars) ---
    { id: 'sup_sab', name: 'Sabotajeador', type: 'SuperItem', count: 1, desc: "Recupera Item del descarte." },
    { id: 'sup_esc', name: 'Escudo de Granalianza', type: 'SuperItem', count: 1, desc: "Niega pérdida de Tartapie." }
];

// --- 2. GAME LOGIC ---

const rooms = {};

// Helper: Create a full deck based on "count"
const buildDeck = () => {
    let deck = [];
    CARD_DB.forEach(card => {
        if (card.type === 'Hero') return; // Heroes are handled separately
        const qty = card.count || 1;
        for (let i = 0; i < qty; i++) {
            deck.push({ ...card, uniqueId: Math.random().toString(36).substr(2, 9) });
        }
    });
    return deck.sort(() => Math.random() - 0.5); // Shuffle
};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Join Room
    socket.on('join_room', ({ room, username }) => {
        socket.join(room);
        
        if (!rooms[room]) {
            rooms[room] = {
                players: [],
                deck: [],
                discard: [],
                turnIndex: 0,
                gameStarted: false,
                logs: []
            };
        }

        const game = rooms[room];

        // Check if player already exists (reconnection)
        const existingPlayer = game.players.find(p => p.name === username);
        if (!existingPlayer && game.players.length < 2) {
            // Pick a random hero
            const heroes = CARD_DB.filter(c => c.type === 'Hero');
            const randomHero = heroes[Math.floor(Math.random() * heroes.length)];
            
            game.players.push({
                id: socket.id,
                name: username,
                hero: randomHero,
                hand: [],
                board: [],
                score: 0
            });
            
            game.logs.push(`${username} joined as ${randomHero.name}`);
        }

        // Start Game Condition
        if (game.players.length === 2 && !game.gameStarted) {
            startGame(room);
        } else {
            io.to(room).emit('update_state', game);
        }
    });

    // Play Card Action
    socket.on('play_card', ({ room, cardUniqueId }) => {
        const game = rooms[room];
        if (!game) return;

        const player = game.players.find(p => p.id === socket.id);
        const cardIndex = player.hand.findIndex(c => c.uniqueId === cardUniqueId);
        
        if (cardIndex === -1) return;

        const card = player.hand[cardIndex];
        
        // LOGIC: Move card based on type
        player.hand.splice(cardIndex, 1); // Remove from hand

        game.logs.push(`${player.name} played ${card.name}`);

        if (card.type === 'Tartapie' || card.type === 'Faction') {
            // These stay on board and give points
            player.board.push(card);
            recalculateScore(player);
        } else if (card.type === 'Potion' || card.type === 'SuperItem') {
            // Stay on board but don't usually give points immediately
            player.board.push(card);
        } else {
            // Items/Relics go to discard after use
            game.discard.push(card);
        }

        // Auto-Draw if hand is empty (House Rule for speed)
        if (player.hand.length === 0 && game.deck.length > 0) {
            player.hand.push(game.deck.pop());
        }

        io.to(room).emit('update_state', game);
    });

    // Draw Card Action
    socket.on('draw_card', ({ room }) => {
        const game = rooms[room];
        const player = game.players.find(p => p.id === socket.id);
        
        if (game.deck.length > 0) {
            const card = game.deck.pop();
            player.hand.push(card);
            game.logs.push(`${player.name} drew a card.`);
            io.to(room).emit('update_state', game);
        }
    });

    // End Turn Action (Simple Pass)
    socket.on('end_turn', ({ room }) => {
        const game = rooms[room];
        game.turnIndex = (game.turnIndex + 1) % 2;
        game.logs.push(`--- Turn Change ---`);
        io.to(room).emit('update_state', game);
    });
});

function startGame(room) {
    const game = rooms[room];
    game.gameStarted = true;
    game.deck = buildDeck();
    game.logs.push("GAME STARTED! Good luck adventurers.");

    // Deal 5 cards
    game.players.forEach(p => {
        p.hand = [];
        p.board = [];
        for (let i=0; i<5; i++) {
            if (game.deck.length > 0) p.hand.push(game.deck.pop());
        }
    });

    io.to(room).emit('update_state', game);
}

function recalculateScore(player) {
    player.score = player.board.reduce((total, card) => {
        return total + (card.value || 0);
    }, 0);
}

server.listen(PORT, () => {
    console.log(`TARTAPIES SERVER RUNNING ON PORT ${PORT}`);
});
