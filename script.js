const modal = document.getElementById('game-modal');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const titleEl = document.getElementById('modal-title');
const statusEl = document.getElementById('game-status');
const closeBtn = document.getElementById('close-game');
const pauseBtn = document.getElementById('pause-game');
const menu = document.getElementById('game-menu');
const menuStart = document.getElementById('menu-start');
const menuPause = document.getElementById('menu-pause');
const menuReset = document.getElementById('menu-reset');
const scoreTableBody = document.getElementById('score-table-body');
const liveScoreEl = document.getElementById('live-score');
const levelLabelEl = document.getElementById('level-label');
const bestScoreEl = document.getElementById('best-score');
const livesLabelEl = document.getElementById('lives-label');

const keys = {};
let currentGame = null;
let animationFrameId = null;
let audioContext = null;
let menuState = { paused: false, started: false };

const STORAGE_KEY = 'retro_arcade_scores_v1';

const gameTitles = {
    pacman: 'Pac-Man',
    tetris: 'Tetris',
    mario: 'Super Mario',
    space: 'Space Invaders'
};

const setStatus = (message) => {
    statusEl.textContent = message;
};

const ensureAudio = () => {
    if (!audioContext) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (AudioCtor) {
            audioContext = new AudioCtor();
        }
    }

    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
};

const playTone = (frequency, duration = 0.08, type = 'square', volume = 0.06) => {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
};

const updateScoreTable = () => {
    const records = {
        pacman: [],
        tetris: [],
        mario: [],
        space: []
    };

    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        Object.assign(records, saved);
    } catch (error) {
        console.warn('Skor tablosu okunamadı:', error);
    }

    const allRows = [];
    Object.entries(records).forEach(([game, scores]) => {
        scores.forEach((entry) => {
            allRows.push({
                game: gameTitles[game] || game,
                score: Number(entry.score || 0)
            });
        });
    });

    allRows.sort((a, b) => b.score - a.score);
    const top = allRows.slice(0, 5);

    scoreTableBody.innerHTML = top.length
        ? top.map((row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${row.game}</td>
                <td>${row.score}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="3">Henüz skor yok</td>
            </tr>
        `;
};

const saveHighScore = (game, score) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const gameScores = stored[game] || [];
    gameScores.push({ score, date: new Date().toISOString() });
    gameScores.sort((a, b) => b.score - a.score);
    stored[game] = gameScores.slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setBestScore(getBestScore());
    updateScoreTable();
};

const setLiveScore = (score) => {
    liveScoreEl.textContent = `SKOR: ${score}`;
};

const setLevelLabel = (level) => {
    levelLabelEl.textContent = `SEVİYE ${level}`;
};

const setBestScore = (score) => {
    bestScoreEl.textContent = `EN YÜKSEK: ${score}`;
};

const setLives = (lives) => {
    livesLabelEl.textContent = `CAN: ${lives}`;
};

const getBestScore = () => {
    const scoreboard = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    let best = 0;
    Object.values(scoreboard).forEach((entries) => {
        entries.forEach((entry) => {
            best = Math.max(best, Number(entry.score || 0));
        });
    });
    return best;
};

const togglePauseMenu = (visible) => {
    menu.classList.toggle('hidden', !visible);
};

const openGame = (game) => {
    ensureAudio();
    currentGame = game;
    titleEl.textContent = gameTitles[game] || 'Arcade';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    menuState = { paused: false, started: true };
    togglePauseMenu(false);
    updateScoreTable();
    setLiveScore(0);
    setLevelLabel(1);
    setBestScore(getBestScore());
    setLives(3);
    setStatus('Kontrol tuşlarını kullanarak oynayın.');
    startGame(game);
};

const closeGame = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    currentGame = null;
    menuState = { paused: false, started: false };
    togglePauseMenu(false);
};

const handleButtonClick = (event) => {
    const game = event.currentTarget.dataset.game;
    openGame(game);
};

const bindButtons = () => {
    document.querySelectorAll('.btn-oyna').forEach((button) => {
        button.addEventListener('click', handleButtonClick);
    });
};

closeBtn.addEventListener('click', closeGame);
pauseBtn.addEventListener('click', () => {
    if (!currentGame) return;
    const active = menuState.paused;
    menuState.paused = !active;
    togglePauseMenu(menuState.paused);
    setStatus(menuState.paused ? 'Oyun duraklatıldı. Devam etmek için menüden başlatın.' : 'Oyun devam ediyor.');
});
menuStart.addEventListener('click', () => {
    if (!currentGame) return;
    menuState.paused = false;
    togglePauseMenu(false);
    setStatus('Oyun başladı.');
});
menuPause.addEventListener('click', () => {
    if (!currentGame) return;
    menuState.paused = !menuState.paused;
    togglePauseMenu(menuState.paused);
    setStatus(menuState.paused ? 'Oyun duraklatıldı.' : 'Oyun devam ediyor.');
});
menuReset.addEventListener('click', () => {
    if (!currentGame) return;
    menuState.paused = false;
    togglePauseMenu(false);
    startGame(currentGame);
});

modal.addEventListener('click', (event) => {
    if (event.target === modal) closeGame();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (currentGame) {
            menuState.paused = true;
            togglePauseMenu(true);
            setStatus('Oyun duraklatıldı.');
        }
        return;
    }

    keys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});

const drawBackground = (colorA, colorB) => {
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < canvas.width; i += 24) {
        ctx.fillStyle = colorB;
        ctx.fillRect(i, 0, 2, canvas.height);
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function startGame(game) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    switch (game) {
        case 'pacman':
            startPacman();
            break;
        case 'tetris':
            startTetris();
            break;
        case 'mario':
            startMario();
            break;
        case 'space':
            startSpaceInvaders();
            break;
        default:
            break;
    }
}

function startPacman() {
    const cols = 12;
    const rows = 9;
    const tile = 28;
    const mazeBlueprint = [
        '###########',
        '#o....#...#',
        '#.##.#.#..#',
        '#....#.#..#',
        '###.#.#.###',
        '#...#...#.#',
        '#.###.#.#.#',
        '#.....#..o#',
        '###########'
    ];

    let level = 1;
    let score = 0;
    let roundOver = false;
    let paused = false;
    let lives = 3;
    let lastGhostMove = 0;

    const buildLevel = (levelNumber) => {
        const maze = mazeBlueprint.map((row) => row.split(''));
        const pellets = [];

        for (let y = 0; y < maze.length; y += 1) {
            for (let x = 0; x < maze[y].length; x += 1) {
                const cell = maze[y][x];
                if (cell === '.') {
                    pellets.push({ x, y, isPower: false });
                }
                if (cell === 'o') {
                    pellets.push({ x, y, isPower: true });
                }
            }
        }

        const player = { x: 1, y: 1, dirX: 0, dirY: 0, speed: 1 + levelNumber * 0.08 };
        const ghosts = [
            { x: 9, y: 1, dirX: -1, dirY: 0, color: '#ff4d6d', frightened: false, speed: 0.8 + levelNumber * 0.12 },
            { x: 9, y: 7, dirX: 0, dirY: -1, color: '#00f0ff', frightened: false, speed: 0.9 + levelNumber * 0.12 },
            { x: 4, y: 4, dirX: 1, dirY: 0, color: '#ffd54a', frightened: false, speed: 1 + levelNumber * 0.15 }
        ];

        return { maze, pellets, player, ghosts };
    };

    const state = buildLevel(level);
    const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
    ];

    setLevelLabel(level);
    setLiveScore(score);
    setLives(lives);

    const triggerSound = (type) => {
        ensureAudio();
        if (!audioContext) return;

        const frequencyMap = {
            pellet: 660,
            power: 840,
            ghost: 220,
            hit: 120,
            level: 980,
            lose: 180
        };

        playTone(frequencyMap[type] || 440, type === 'ghost' ? 0.14 : 0.08, type === 'hit' ? 'sawtooth' : 'square', type === 'hit' || type === 'lose' ? 0.1 : 0.06);
    };

    const nextLevel = () => {
        level += 1;
        setLevelLabel(level);
        Object.assign(state, buildLevel(level));
        setStatus(`Seviye ${level}! Canavarlar daha hızlı.`);
        triggerSound('level');
    };

    const finishRound = () => {
        roundOver = true;
        saveHighScore(currentGame, score);
        setStatus(`Seviye tamamlandı! Toplam skor: ${score}`);
        triggerSound('level');
        setTimeout(() => {
            if (currentGame === 'pacman') {
                nextLevel();
                roundOver = false;
            }
        }, 1000);
    };

    const loseLife = () => {
        lives -= 1;
        setLives(lives);
        triggerSound('lose');

        if (lives <= 0) {
            saveHighScore(currentGame, score);
            setStatus(`Canlar bitti! Skor: ${score}`);
            roundOver = true;
            return;
        }

        state.player.x = 1;
        state.player.y = 1;
        state.player.dirX = 0;
        state.player.dirY = 0;
        state.ghosts.forEach((ghost, index) => {
            ghost.x = index === 0 ? 9 : index === 1 ? 9 : 4;
            ghost.y = index === 0 ? 1 : index === 1 ? 7 : 4;
            ghost.frightened = false;
        });
        setStatus(`Can kaybı! Kalan can: ${lives}`);
    };

    const renderMaze = () => {
        const maze = state.maze;
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < maze.length; y += 1) {
            for (let x = 0; x < maze[y].length; x += 1) {
                const cell = maze[y][x];
                const px = x * tile;
                const py = y * tile;

                if (cell === '#') {
                    ctx.fillStyle = '#00d9ff';
                    ctx.fillRect(px, py, tile, tile);
                }
            }
        }
    };

    const draw = () => {
        renderMaze();

        state.pellets.forEach((pellet) => {
            ctx.fillStyle = pellet.isPower ? '#ffeb3b' : '#ffd54a';
            ctx.beginPath();
            ctx.arc(pellet.x * tile + tile / 2, pellet.y * tile + tile / 2, pellet.isPower ? 6 : 4, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = '#ffe15a';
        ctx.beginPath();
        ctx.arc(state.player.x * tile + tile / 2, state.player.y * tile + tile / 2, tile / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        state.ghosts.forEach((ghost) => {
            ctx.fillStyle = ghost.frightened ? '#8f9cff' : ghost.color;
            ctx.fillRect(ghost.x * tile + 4, ghost.y * tile + 4, tile - 8, tile - 8);
        });

        ctx.fillStyle = '#00f0ff';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText(`SKOR: ${score}`, 20, 26);

        if (roundOver) {
            ctx.fillStyle = '#00f0ff';
            ctx.fillText('LEVEL CLEAR!', 150, 200);
        }
    };

    const movePlayer = () => {
        const player = state.player;
        if (keys.ArrowUp || keys.w || keys.W) {
            player.dirX = 0; player.dirY = -1;
        } else if (keys.ArrowDown || keys.s || keys.S) {
            player.dirX = 0; player.dirY = 1;
        } else if (keys.ArrowLeft || keys.a || keys.A) {
            player.dirX = -1; player.dirY = 0;
        } else if (keys.ArrowRight || keys.d || keys.D) {
            player.dirX = 1; player.dirY = 0;
        }

        const nextX = player.x + player.dirX;
        const nextY = player.y + player.dirY;
        const tileValue = state.maze[nextY]?.[nextX];

        if (tileValue && tileValue !== '#') {
            player.x = nextX;
            player.y = nextY;
        }
    };

    const collectPellets = () => {
        for (let i = state.pellets.length - 1; i >= 0; i -= 1) {
            const pellet = state.pellets[i];
            if (pellet.x === state.player.x && pellet.y === state.player.y) {
                state.pellets.splice(i, 1);
                score += pellet.isPower ? 50 : 10;
                setLiveScore(score);
                triggerSound(pellet.isPower ? 'power' : 'pellet');

                if (pellet.isPower) {
                    state.ghosts.forEach((ghost) => {
                        ghost.frightened = true;
                    });
                    setTimeout(() => {
                        state.ghosts.forEach((ghost) => {
                            ghost.frightened = false;
                        });
                    }, 1500);
                }
            }
        }

        if (state.pellets.length === 0) {
            finishRound();
        }
    };

    const chooseGhostDirection = (ghost) => {
        const options = directions
            .map((dir) => ({ dir, nextX: ghost.x + dir.x, nextY: ghost.y + dir.y }))
            .filter(({ nextX, nextY }) => {
                const tileValue = state.maze[nextY]?.[nextX];
                return tileValue && tileValue !== '#';
            });

        if (options.length === 0) return null;

        if (ghost.frightened) {
            return options[Math.floor(Math.random() * options.length)];
        }

        const target = { x: state.player.x, y: state.player.y };
        return options.sort((a, b) => {
            const distA = Math.abs((a.nextX - target.x)) + Math.abs((a.nextY - target.y));
            const distB = Math.abs((b.nextX - target.x)) + Math.abs((b.nextY - target.y));
            return distA - distB;
        })[0];
    };

    const moveGhost = (ghost) => {
        if (performance.now() - lastGhostMove < 320) return;

        const selected = chooseGhostDirection(ghost);
        if (!selected) return;

        ghost.x = selected.nextX;
        ghost.y = selected.nextY;
        lastGhostMove = performance.now();
    };

    const checkGhostCollision = () => {
        for (const ghost of state.ghosts) {
            if (ghost.x === state.player.x && ghost.y === state.player.y) {
                if (ghost.frightened) {
                    ghost.x = 9;
                    ghost.y = 1;
                    ghost.frightened = false;
                    score += 200;
                    setLiveScore(score);
                    triggerSound('ghost');
                    setStatus('Canavar yakalandı!');
                } else {
                    loseLife();
                    return;
                }
            }
        }
    };

    const update = () => {
        if (paused || roundOver || menuState.paused) return;
        movePlayer();
        collectPellets();
        state.ghosts.forEach((ghost) => moveGhost(ghost));
        checkGhostCollision();
    };

    const loop = () => {
        if (!menuState.paused) {
            update();
        }

        draw();
        animationFrameId = requestAnimationFrame(loop);
    };

    setStatus('Yön tuşlarıyla gezin, canavarları kaçır ve toplayıcıları topla.');
    setBestScore(getBestScore());
    draw();
    animationFrameId = requestAnimationFrame(loop);
}

function startTetris() {
    const cols = 10;
    const rows = 18;
    const block = 24;
    const board = Array.from({ length: rows }, () => Array(cols).fill(0));
    const shapes = [
        [[1, 1, 1, 1]],
        [[1, 1], [1, 1]],
        [[1, 1, 0], [0, 1, 1]],
        [[0, 1, 1], [1, 1, 0]],
        [[1, 0, 0], [1, 1, 1]],
        [[0, 0, 1], [1, 1, 1]],
        [[1, 1, 1], [0, 1, 0]]
    ];
    const colors = ['#00f0ff', '#f20089', '#ffd54a', '#7ef29a', '#a393eb', '#ff8a5b', '#b9fbc0'];
    let current = null;
    let score = 0;
    let intervalMs = 500;
    let lastDrop = 0;
    let gameOver = false;

    const randomShape = () => {
        const template = shapes[Math.floor(Math.random() * shapes.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        return {
            matrix: template.map((row) => [...row]),
            x: Math.floor(cols / 2) - 1,
            y: 0,
            color
        };
    };

    const collides = (matrix, x, y) => matrix.some((row, rowIndex) =>
        row.some((value, colIndex) => {
            if (!value) return false;
            const newX = x + colIndex;
            const newY = y + rowIndex;
            return newX < 0 || newX >= cols || newY >= rows || (newY >= 0 && board[newY][newX]);
        })
    );

    const clearCompletedRows = () => {
        let cleared = 0;

        for (let row = rows - 1; row >= 0; row -= 1) {
            if (board[row].every(Boolean)) {
                board.splice(row, 1);
                board.unshift(Array(cols).fill(0));
                cleared += 1;
                row += 1;
            }
        }

        if (cleared > 0) {
            score += cleared * 100;
            setStatus('Satır temizlendi! +' + (cleared * 100) + ' puan');
        }
    };

    const merge = () => {
        current.matrix.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
                if (!value) return;
                const px = current.x + colIndex;
                const py = current.y + rowIndex;
                if (py >= 0 && py < rows && px >= 0 && px < cols) {
                    board[py][px] = current.color;
                }
            });
        });

        clearCompletedRows();

        current = randomShape();
        if (collides(current.matrix, current.x, current.y)) {
            gameOver = true;
            setStatus('Oyun bitti! Skor: ' + score + '');
        }
    };

    const rotate = (matrix) => {
        return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
    };

    const update = () => {
        if (gameOver) return;
        if (!current) current = randomShape();

        if (keys.ArrowLeft || keys.a || keys.A) {
            if (!collides(current.matrix, current.x - 1, current.y)) current.x -= 1;
            keys.ArrowLeft = false;
            keys.a = false;
            keys.A = false;
        }

        if (keys.ArrowRight || keys.d || keys.D) {
            if (!collides(current.matrix, current.x + 1, current.y)) current.x += 1;
            keys.ArrowRight = false;
            keys.d = false;
            keys.D = false;
        }

        if (keys.ArrowDown || keys.s || keys.S) {
            if (!collides(current.matrix, current.x, current.y + 1)) {
                current.y += 1;
            } else {
                merge();
            }
            keys.ArrowDown = false;
            keys.s = false;
            keys.S = false;
        }

        if (keys.ArrowUp || keys.x || keys.X) {
            const rotated = rotate(current.matrix);
            if (!collides(rotated, current.x, current.y)) current.matrix = rotated;
            keys.ArrowUp = false;
            keys.x = false;
            keys.X = false;
        }

        if (performance.now() - lastDrop >= intervalMs) {
            if (!collides(current.matrix, current.x, current.y + 1)) {
                current.y += 1;
            } else {
                merge();
            }
            lastDrop = performance.now();
        }
    };

    const draw = () => {
        ctx.fillStyle = '#05070d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        for (let x = 0; x <= cols; x += 1) {
            ctx.beginPath();
            ctx.moveTo(x * block + 80, 30);
            ctx.lineTo(x * block + 80, 30 + rows * block);
            ctx.stroke();
        }

        for (let y = 0; y <= rows; y += 1) {
            ctx.beginPath();
            ctx.moveTo(80, y * block + 30);
            ctx.lineTo(80 + cols * block, y * block + 30);
            ctx.stroke();
        }

        for (let y = 0; y < board.length; y += 1) {
            for (let x = 0; x < board[y].length; x += 1) {
                if (board[y][x]) {
                    ctx.fillStyle = board[y][x];
                    ctx.fillRect(80 + x * block, 30 + y * block, block - 2, block - 2);
                }
            }
        }

        if (current) {
            current.matrix.forEach((row, rowIndex) => {
                row.forEach((value, colIndex) => {
                    if (!value) return;
                    ctx.fillStyle = current.color;
                    ctx.fillRect(80 + (current.x + colIndex) * block, 30 + (current.y + rowIndex) * block, block - 2, block - 2);
                });
            });
        }

        ctx.fillStyle = '#00f0ff';
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillText('SKOR: ' + score, 20, 60);

        if (gameOver) {
            ctx.fillStyle = '#ff4d6d';
            ctx.fillText('GAME OVER', 160, 190);
        }
    };

    const loop = (time) => {
        if (!menuState.paused && !gameOver) {
            update();
        }
        draw();
        animationFrameId = requestAnimationFrame(loop);
    };

    setStatus('Yön tuşları ile hareket edin. ↑ döndürür, ↓ hızlı düşürür.');
    current = randomShape();
    animationFrameId = requestAnimationFrame(loop);
}

function startMario() {
    const player = { x: 80, y: 250, width: 30, height: 34, velocityY: 0, grounded: true };
    const obstacles = [];
    const coins = [];
    const enemies = [];
    let score = 0;
    let gameOver = false;
    let lastSpawn = 0;
    let lastCoinSpawn = 0;
    let lastEnemySpawn = 0;
    let gravity = 0.7;

    const canSpawnObstacle = () => obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 180;

    const drawGround = () => {
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(0, 350, canvas.width, 70);
        ctx.fillStyle = '#5b8c4a';
        for (let x = 0; x < canvas.width; x += 18) {
            ctx.fillRect(x, 350, 10, 10);
        }
    };

    const spawnObstacle = () => {
        const height = 30 + Math.random() * 30;
        obstacles.push({
            x: canvas.width + 20,
            y: 350 - height,
            width: 28,
            height
        });
    };

    const spawnCoin = () => {
        coins.push({
            x: canvas.width + 30,
            y: 150 + Math.random() * 130,
            radius: 8,
            collected: false
        });
    };

    const spawnEnemy = () => {
        enemies.push({
            x: canvas.width + 30,
            y: 350 - 22,
            width: 22,
            height: 22,
            speed: 1.4 + Math.random() * 1.2,
            alive: true
        });
    };

    const updatePlayer = () => {
        if (gameOver) return;

        const jumpPressed = keys.ArrowUp || keys.w || keys.W || keys[' '] || keys.Space || keys.Spacebar;
        if (jumpPressed) {
            if (player.grounded) {
                player.velocityY = -12;
                player.grounded = false;
            }
            keys[' '] = false;
            keys.Space = false;
            keys.Spacebar = false;
        }

        player.velocityY += gravity;
        player.y += player.velocityY;

        if (player.y + player.height >= 350) {
            player.y = 350 - player.height;
            player.velocityY = 0;
            player.grounded = true;
        }

        for (let i = coins.length - 1; i >= 0; i -= 1) {
            const coin = coins[i];
            if (coin.collected) continue;

            const hit =
                player.x < coin.x + coin.radius * 2 &&
                player.x + player.width > coin.x &&
                player.y < coin.y + coin.radius * 2 &&
                player.y + player.height > coin.y;

            if (hit) {
                coin.collected = true;
                score += 25;
            }
        }

        for (const enemy of enemies) {
            if (!enemy.alive) continue;

            const overlaps =
                player.x < enemy.x + enemy.width &&
                player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height &&
                player.y + player.height > enemy.y;

            if (!overlaps) continue;

            const playerBottom = player.y + player.height;
            const enemyTop = enemy.y;

            if (player.velocityY > 0 && playerBottom - enemyTop < 18 && player.y < enemy.y) {
                enemy.alive = false;
                player.velocityY = -8;
                score += 150;
                setStatus('Yeşil canavarı ezdin! +150 puan');
            } else {
                gameOver = true;
                setStatus('Minik canavar seni yakaladı! Oyun bitti.');
                break;
            }
        }

        for (const obstacle of obstacles) {
            const overlaps =
                player.x < obstacle.x + obstacle.width &&
                player.x + player.width > obstacle.x &&
                player.y < obstacle.y + obstacle.height &&
                player.y + player.height > obstacle.y;

            if (overlaps) {
                gameOver = true;
                setStatus('Çarpıştın! Oyun bitti.');
                break;
            }
        }

        score += 0.4;
    };

    const updateObstacles = () => {
        if (gameOver) return;

        for (let i = obstacles.length - 1; i >= 0; i -= 1) {
            obstacles[i].x -= 3.5;
            if (obstacles[i].x + obstacles[i].width < 0) {
                obstacles.splice(i, 1);
            }
        }

        for (let i = coins.length - 1; i >= 0; i -= 1) {
            coins[i].x -= 3.2;
            if (coins[i].x + coins[i].radius * 2 < 0) {
                coins.splice(i, 1);
            }
        }

        for (let i = enemies.length - 1; i >= 0; i -= 1) {
            if (!enemies[i].alive) {
                enemies.splice(i, 1);
                continue;
            }
            enemies[i].x -= enemies[i].speed;
            if (enemies[i].x + enemies[i].width < 0) {
                enemies.splice(i, 1);
            }
        }

        if (performance.now() - lastSpawn > 1700 && canSpawnObstacle()) {
            spawnObstacle();
            lastSpawn = performance.now();
        }

        if (performance.now() - lastCoinSpawn > 1800) {
            spawnCoin();
            lastCoinSpawn = performance.now();
        }

        if (performance.now() - lastEnemySpawn > 2700) {
            spawnEnemy();
            lastEnemySpawn = performance.now();
        }
    };

    const drawPlayer = () => {
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(player.x, player.y, player.width, player.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(player.x + 6, player.y + 8, 6, 6);
        ctx.fillStyle = '#1d2f92';
        ctx.fillRect(player.x + 2, player.y + 15, player.width - 4, 12);
    };

    const drawObstacles = () => {
        obstacles.forEach((obstacle) => {
            ctx.fillStyle = '#8d5c2c';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        });
    };

    const drawCoins = () => {
        coins.forEach((coin) => {
            if (coin.collected) return;
            ctx.fillStyle = '#f9d84d';
            ctx.beginPath();
            ctx.arc(coin.x + coin.radius, coin.y + coin.radius, coin.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c89200';
            ctx.fillRect(coin.x + coin.radius - 2, coin.y + 2, 4, 12);
        });
    };

    const drawEnemies = () => {
        enemies.forEach((enemy) => {
            if (!enemy.alive) return;
            ctx.fillStyle = '#5d7c2d';
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(enemy.x + 4, enemy.y + 5, 4, 4);
            ctx.fillRect(enemy.x + 12, enemy.y + 5, 4, 4);
            ctx.fillStyle = '#111';
            ctx.fillRect(enemy.x + 6, enemy.y + 12, 10, 3);
        });
    };

    const drawText = () => {
        ctx.fillStyle = '#00f0ff';
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillText('SKOR: ' + Math.floor(score), 20, 40);
        if (gameOver) {
            ctx.fillStyle = '#ff4d6d';
            ctx.fillText('GAME OVER', 180, 200);
        }
    };

    const loop = () => {
        if (!menuState.paused && !gameOver) {
            updatePlayer();
            updateObstacles();
        }
        drawBackground('#080b1c', '#0e1530');
        drawGround();
        drawCoins();
        drawObstacles();
        drawEnemies();
        drawPlayer();
        drawText();
        animationFrameId = requestAnimationFrame(loop);
    };

    setStatus('SPACE veya ↑ tuşu ile zıplayın, altın toplayın ve minik canavarları ezin!');
    animationFrameId = requestAnimationFrame(loop);
}

function startSpaceInvaders() {
    const player = { x: 270, y: 360, width: 40, height: 18, speed: 5 };
    const bullets = [];
    const alienBullets = [];
    const aliens = [];
    let score = 0;
    let gameOver = false;
    let lastShot = 0;
    let lastAlienShot = 0;

    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            aliens.push({
                x: 80 + col * 45,
                y: 40 + row * 26,
                width: 22,
                height: 20,
                alive: true
            });
        }
    }

    const spawnAlienShot = () => {
        const aliveAliens = aliens.filter((alien) => alien.alive);
        if (aliveAliens.length === 0) {
            gameOver = true;
            setStatus('Kazandın!');
            return;
        }
        const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
        alienBullets.push({ x: shooter.x + 10, y: shooter.y + shooter.height, width: 4, height: 12, speed: 4 });
    };

    const updatePlayer = () => {
        if (keys.ArrowLeft || keys.a || keys.A) player.x -= player.speed;
        if (keys.ArrowRight || keys.d || keys.D) player.x += player.speed;
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

        if ((keys[' '] || keys.Space || keys.Spacebar) && performance.now() - lastShot > 250) {
            bullets.push({ x: player.x + player.width / 2 - 2, y: player.y - 10, width: 4, height: 12, speed: 6 });
            lastShot = performance.now();
            keys[' '] = false;
            keys.Space = false;
            keys.Spacebar = false;
        }
    };

    const updateBullets = () => {
        for (let i = bullets.length - 1; i >= 0; i -= 1) {
            bullets[i].y -= bullets[i].speed;
            if (bullets[i].y < 0) bullets.splice(i, 1);
        }

        for (let i = alienBullets.length - 1; i >= 0; i -= 1) {
            alienBullets[i].y += alienBullets[i].speed;
            if (alienBullets[i].y > canvas.height) alienBullets.splice(i, 1);
        }
    };

    const checkCollisions = () => {
        for (let i = bullets.length - 1; i >= 0; i -= 1) {
            const bullet = bullets[i];
            for (let j = aliens.length - 1; j >= 0; j -= 1) {
                const alien = aliens[j];
                if (!alien.alive) continue;
                const hit = bullet.x < alien.x + alien.width && bullet.x + bullet.width > alien.x && bullet.y < alien.y + alien.height && bullet.y + bullet.height > alien.y;
                if (hit) {
                    alien.alive = false;
                    bullets.splice(i, 1);
                    score += 10;
                    break;
                }
            }
        }

        for (let i = alienBullets.length - 1; i >= 0; i -= 1) {
            const shot = alienBullets[i];
            const hitPlayer = shot.x > player.x && shot.x < player.x + player.width && shot.y + shot.height > player.y && shot.y < player.y + player.height;
            if (hitPlayer) {
                gameOver = true;
                setStatus('Vurdun ama savaş bitti.');
                alienBullets.splice(i, 1);
            }
        }
    };

    const draw = () => {
        drawBackground('#03040d', '#0b1227');

        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(player.x, player.y, player.width, player.height);

        bullets.forEach((bullet) => {
            ctx.fillStyle = '#f20089';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        alienBullets.forEach((bullet) => {
            ctx.fillStyle = '#ffd54a';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });

        aliens.forEach((alien) => {
            if (!alien.alive) return;
            ctx.fillStyle = '#7ef29a';
            ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
        });

        ctx.fillStyle = '#00f0ff';
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.fillText('SKOR: ' + score, 20, 36);

        if (gameOver) {
            ctx.fillStyle = '#ff4d6d';
            ctx.fillText('GAME OVER', 170, 200);
        }
    };

    const loop = () => {
        if (!menuState.paused && !gameOver) {
            updatePlayer();
            updateBullets();
            checkCollisions();
            if (performance.now() - lastAlienShot > 900) {
                spawnAlienShot();
                lastAlienShot = performance.now();
            }
        }

        draw();
        animationFrameId = requestAnimationFrame(loop);
    };

    setStatus('Yön tuşlarıyla kaydırın, boşluk ile ateş edin.');
    animationFrameId = requestAnimationFrame(loop);
}

bindButtons();
