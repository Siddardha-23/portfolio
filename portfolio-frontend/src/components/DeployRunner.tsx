/**
 * DeployRunner - DevOps-themed Easter Egg Game
 * 
 * A Chrome Dino-style infinite runner where you play as a Docker container
 * navigating through a CI/CD pipeline, jumping over bugs and collecting
 * cloud resources.
 * 
 * Activated by the Konami code: ↑↑↓↓←→←→BA
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, RotateCcw, Gamepad2 } from 'lucide-react';

// ── Game constants ──
const GAME_WIDTH = 800;
const GAME_HEIGHT = 300;
const GROUND_Y = 240;
const PLAYER_SIZE = 36;
const GRAVITY = 0.7;
const JUMP_FORCE = -13;
const OBSTACLE_WIDTH = 30;
const OBSTACLE_GAP_MIN = 250;
const OBSTACLE_GAP_MAX = 400;
const COLLECTIBLE_SIZE = 22;
const INITIAL_SPEED = 4;
const MAX_SPEED = 10;
const SPEED_INCREMENT = 0.002;

// Pipeline stages that cycle in the background
const PIPELINE_STAGES = [
    { name: 'CODE', color: '#3b82f6', emoji: '📝' },
    { name: 'BUILD', color: '#f59e0b', emoji: '🔨' },
    { name: 'TEST', color: '#8b5cf6', emoji: '🧪' },
    { name: 'DEPLOY', color: '#10b981', emoji: '🚀' },
    { name: 'MONITOR', color: '#ec4899', emoji: '📊' },
];

// Obstacle types (things to jump over)
const OBSTACLE_TYPES = [
    { emoji: '🐛', label: 'Bug', height: 36 },
    { emoji: '❌', label: 'Failed Test', height: 32 },
    { emoji: '🔥', label: 'Outage', height: 40 },
    { emoji: '💀', label: 'Memory Leak', height: 34 },
    { emoji: '🚫', label: '403 Forbidden', height: 30 },
];

// Collectible types
const COLLECTIBLE_TYPES = [
    { emoji: '☁️', label: 'Cloud', points: 10 },
    { emoji: '⚡', label: 'Lambda', points: 15 },
    { emoji: '🛡️', label: 'Security', points: 20 },
    { emoji: '📦', label: 'Container', points: 10 },
    { emoji: '✅', label: 'Green Build', points: 25 },
];

interface Obstacle {
    x: number;
    type: typeof OBSTACLE_TYPES[number];
}

interface Collectible {
    x: number;
    y: number;
    type: typeof COLLECTIBLE_TYPES[number];
    collected: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
}

// ── Konami Code Hook ──
const KONAMI_SEQUENCE = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a'
];

export function useKonamiCode(callback: () => void) {
    const sequenceIndex = useRef(0);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const expected = KONAMI_SEQUENCE[sequenceIndex.current];
            if (e.key === expected || e.key.toLowerCase() === expected) {
                sequenceIndex.current++;
                if (sequenceIndex.current === KONAMI_SEQUENCE.length) {
                    sequenceIndex.current = 0;
                    callback();
                }
            } else {
                sequenceIndex.current = 0;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [callback]);
}

// ── Main Game Component ──
export default function DeployRunner({ isOpen, onClose }: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameLoopRef = useRef<number>(0);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(() => {
        if (typeof window !== 'undefined') {
            return parseInt(localStorage.getItem('deploy_runner_high_score') || '0', 10);
        }
        return 0;
    });
    const [collectCount, setCollectCount] = useState(0);
    const [currentStage, setCurrentStage] = useState(0);
    const [showHint, setShowHint] = useState(true);

    // Game state refs (for animation loop access without re-renders)
    const playerY = useRef(GROUND_Y - PLAYER_SIZE);
    const playerVelocity = useRef(0);
    const isJumping = useRef(false);
    const isDucking = useRef(false);
    const obstacles = useRef<Obstacle[]>([]);
    const collectibles = useRef<Collectible[]>([]);
    const particles = useRef<Particle[]>([]);
    const gameSpeed = useRef(INITIAL_SPEED);
    const frameCount = useRef(0);
    const scoreRef = useRef(0);
    const collectCountRef = useRef(0);
    const lastObstacleX = useRef(GAME_WIDTH + 200);
    const stageProgress = useRef(0);
    const gameRunning = useRef(false);
    const groundOffset = useRef(0);

    // Responsive canvas sizing
    const [canvasScale, setCanvasScale] = useState(1);

    useEffect(() => {
        const updateScale = () => {
            const maxWidth = Math.min(window.innerWidth - 32, 800);
            setCanvasScale(maxWidth / GAME_WIDTH);
        };
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, []);

    // Jump / Duck input
    const handleInput = useCallback((action: 'jump' | 'duck-start' | 'duck-end') => {
        if (action === 'jump') {
            if (!isJumping.current) {
                playerVelocity.current = JUMP_FORCE;
                isJumping.current = true;
            }
        } else if (action === 'duck-start') {
            isDucking.current = true;
        } else {
            isDucking.current = false;
        }
    }, []);

    // Spawn particles on collect
    const spawnParticles = useCallback((x: number, y: number, color: string) => {
        for (let i = 0; i < 8; i++) {
            particles.current.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6 - 2,
                life: 1,
                color,
                size: 2 + Math.random() * 3,
            });
        }
    }, []);

    // Main game loop
    const gameLoop = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameRunning.current) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        frameCount.current++;

        // ── Update ──

        // Player physics
        playerVelocity.current += GRAVITY;
        playerY.current += playerVelocity.current;
        if (playerY.current >= GROUND_Y - PLAYER_SIZE) {
            playerY.current = GROUND_Y - PLAYER_SIZE;
            playerVelocity.current = 0;
            isJumping.current = false;
        }

        // Speed up
        gameSpeed.current = Math.min(MAX_SPEED, gameSpeed.current + SPEED_INCREMENT);

        // Score
        scoreRef.current += 1;
        if (frameCount.current % 5 === 0) {
            setScore(Math.floor(scoreRef.current / 5));
        }

        // Pipeline stage
        stageProgress.current += gameSpeed.current;
        if (stageProgress.current > 2000) {
            stageProgress.current = 0;
            setCurrentStage(prev => (prev + 1) % PIPELINE_STAGES.length);
        }

        // Ground scroll
        groundOffset.current = (groundOffset.current + gameSpeed.current) % 20;

        // Spawn obstacles
        if (obstacles.current.length === 0 ||
            (GAME_WIDTH - lastObstacleX.current) > OBSTACLE_GAP_MIN + Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN)) {
            const shouldSpawn = obstacles.current.length === 0 ||
                obstacles.current[obstacles.current.length - 1].x < GAME_WIDTH - OBSTACLE_GAP_MIN;

            if (shouldSpawn) {
                const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
                obstacles.current.push({ x: GAME_WIDTH + 50, type });
                lastObstacleX.current = GAME_WIDTH + 50;

                // Sometimes spawn a collectible above
                if (Math.random() > 0.4) {
                    const cType = COLLECTIBLE_TYPES[Math.floor(Math.random() * COLLECTIBLE_TYPES.length)];
                    collectibles.current.push({
                        x: GAME_WIDTH + 50 + Math.random() * 100,
                        y: GROUND_Y - 80 - Math.random() * 60,
                        type: cType,
                        collected: false,
                    });
                }
            }
        }

        // Move obstacles
        obstacles.current = obstacles.current.filter(ob => {
            ob.x -= gameSpeed.current;
            return ob.x > -OBSTACLE_WIDTH;
        });

        // Move & check collectibles
        collectibles.current = collectibles.current.filter(c => {
            c.x -= gameSpeed.current;
            if (c.x < -COLLECTIBLE_SIZE) return false;

            if (!c.collected) {
                const px = 40;
                const py = playerY.current;
                const pw = isDucking.current ? PLAYER_SIZE : PLAYER_SIZE * 0.7;
                const ph = isDucking.current ? PLAYER_SIZE * 0.5 : PLAYER_SIZE;

                if (
                    px < c.x + COLLECTIBLE_SIZE &&
                    px + pw > c.x &&
                    py < c.y + COLLECTIBLE_SIZE &&
                    py + ph > c.y
                ) {
                    c.collected = true;
                    scoreRef.current += c.type.points * 5;
                    collectCountRef.current++;
                    setCollectCount(collectCountRef.current);
                    spawnParticles(c.x, c.y, '#10b981');
                }
            }
            return !c.collected || c.x > -COLLECTIBLE_SIZE;
        });

        // Collision detection
        const px = 40;
        const py = playerY.current;
        const pw = PLAYER_SIZE * 0.6;
        const ph = isDucking.current ? PLAYER_SIZE * 0.5 : PLAYER_SIZE * 0.8;
        const pxOffset = isDucking.current ? 5 : 8;

        for (const ob of obstacles.current) {
            const ox = ob.x;
            const oy = GROUND_Y - ob.type.height;
            const ow = OBSTACLE_WIDTH;
            const oh = ob.type.height;

            if (
                px + pxOffset < ox + ow &&
                px + pxOffset + pw > ox &&
                py + (PLAYER_SIZE - ph) < oy + oh &&
                py + PLAYER_SIZE > oy
            ) {
                // Game over!
                gameRunning.current = false;
                const finalScore = Math.floor(scoreRef.current / 5);
                setScore(finalScore);
                setGameState('gameover');

                if (finalScore > highScore) {
                    setHighScore(finalScore);
                    localStorage.setItem('deploy_runner_high_score', String(finalScore));
                }

                // Death particles
                for (let i = 0; i < 15; i++) {
                    particles.current.push({
                        x: px + PLAYER_SIZE / 2,
                        y: py + PLAYER_SIZE / 2,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10 - 3,
                        life: 1,
                        color: '#f43f5e',
                        size: 3 + Math.random() * 4,
                    });
                }
                return;
            }
        }

        // Update particles
        particles.current = particles.current.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life -= 0.025;
            return p.life > 0;
        });

        // ── Draw ──
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        skyGrad.addColorStop(0, '#0f0a1a');
        skyGrad.addColorStop(1, '#1a0e2e');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 30; i++) {
            const sx = (i * 97 + frameCount.current * 0.1) % GAME_WIDTH;
            const sy = (i * 43) % (GROUND_Y - 40);
            ctx.beginPath();
            ctx.arc(sx, sy, 0.5 + (i % 3) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pipeline stage indicator (top bar)
        const stage = PIPELINE_STAGES[currentStage % PIPELINE_STAGES.length];
        const stageBarWidth = (stageProgress.current / 2000) * GAME_WIDTH;
        ctx.fillStyle = stage.color + '20';
        ctx.fillRect(0, 0, GAME_WIDTH, 28);
        ctx.fillStyle = stage.color + '40';
        ctx.fillRect(0, 0, stageBarWidth, 28);
        ctx.fillStyle = stage.color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${stage.emoji} ${stage.name} STAGE`, 10, 18);

        // Ground
        ctx.fillStyle = '#1e1035';
        ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);

        // Ground line with dashes
        ctx.strokeStyle = '#6d28d9';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -groundOffset.current;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(GAME_WIDTH, GROUND_Y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ground binary text (scrolling)
        ctx.fillStyle = '#6d28d920';
        ctx.font = '9px monospace';
        const binaryStr = '01001000 01000001 01010010 01010011 01001000 01001001 01010100 01001000 ';
        for (let i = 0; i < 4; i++) {
            const bx = -(groundOffset.current * 3) % 200 + i * 200;
            ctx.fillText(binaryStr, bx, GROUND_Y + 18);
            ctx.fillText(binaryStr, bx + 50, GROUND_Y + 32);
        }

        // Player (Docker whale / container)
        const playerDrawY = playerY.current;
        const duck = isDucking.current;
        ctx.save();

        // Player shadow
        ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.beginPath();
        ctx.ellipse(px + PLAYER_SIZE / 2, GROUND_Y + 2, PLAYER_SIZE * 0.4, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Player body
        ctx.font = duck ? '24px serif' : '30px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Slight bob when running
        const bob = isJumping.current ? 0 : Math.sin(frameCount.current * 0.3) * 2;
        ctx.fillText('🐳', px + PLAYER_SIZE / 2, playerDrawY + (duck ? PLAYER_SIZE * 0.75 : PLAYER_SIZE / 2) + bob);

        // Trail when jumping
        if (isJumping.current) {
            ctx.globalAlpha = 0.3;
            ctx.font = '20px serif';
            ctx.fillText('🐳', px + PLAYER_SIZE / 2 - 15, playerDrawY + PLAYER_SIZE / 2 + 10);
            ctx.globalAlpha = 0.15;
            ctx.font = '14px serif';
            ctx.fillText('🐳', px + PLAYER_SIZE / 2 - 28, playerDrawY + PLAYER_SIZE / 2 + 18);
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Obstacles
        obstacles.current.forEach(ob => {
            ctx.font = `${ob.type.height - 4}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(ob.type.emoji, ob.x + OBSTACLE_WIDTH / 2, GROUND_Y);

            // Danger glow
            ctx.fillStyle = '#f43f5e15';
            ctx.beginPath();
            ctx.arc(ob.x + OBSTACLE_WIDTH / 2, GROUND_Y - ob.type.height / 2, ob.type.height * 0.6, 0, Math.PI * 2);
            ctx.fill();
        });

        // Collectibles
        collectibles.current.forEach(c => {
            if (!c.collected) {
                ctx.font = `${COLLECTIBLE_SIZE}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Float animation
                const floatY = Math.sin(frameCount.current * 0.06 + c.x * 0.01) * 4;
                ctx.fillText(c.type.emoji, c.x + COLLECTIBLE_SIZE / 2, c.y + COLLECTIBLE_SIZE / 2 + floatY);

                // Glow
                ctx.fillStyle = '#10b98115';
                ctx.beginPath();
                ctx.arc(c.x + COLLECTIBLE_SIZE / 2, c.y + COLLECTIBLE_SIZE / 2 + floatY, COLLECTIBLE_SIZE * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Particles
        particles.current.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Score display
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`SCORE: ${Math.floor(scoreRef.current / 5).toString().padStart(5, '0')}`, GAME_WIDTH - 15, 18);

        // Speed indicator
        const speedPct = ((gameSpeed.current - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED)) * 100;
        ctx.fillStyle = '#6d28d940';
        ctx.fillRect(GAME_WIDTH - 120, 24, 105, 6);
        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(GAME_WIDTH - 120, 24, speedPct * 1.05, 6);

        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [highScore, spawnParticles]);

    // Start game
    const startGame = useCallback(() => {
        playerY.current = GROUND_Y - PLAYER_SIZE;
        playerVelocity.current = 0;
        isJumping.current = false;
        isDucking.current = false;
        obstacles.current = [];
        collectibles.current = [];
        particles.current = [];
        gameSpeed.current = INITIAL_SPEED;
        frameCount.current = 0;
        scoreRef.current = 0;
        collectCountRef.current = 0;
        lastObstacleX.current = GAME_WIDTH + 200;
        stageProgress.current = 0;
        groundOffset.current = 0;
        gameRunning.current = true;

        setScore(0);
        setCollectCount(0);
        setCurrentStage(0);
        setGameState('playing');
        setShowHint(false);

        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [gameLoop]);

    // Key handlers
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'idle' && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                startGame();
                return;
            }
            if (gameState === 'gameover' && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                startGame();
                return;
            }
            if (gameState === 'playing') {
                if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                    e.preventDefault();
                    handleInput('jump');
                }
                if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    handleInput('duck-start');
                }
            }
            if (e.key === 'Escape') {
                onClose();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                handleInput('duck-end');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isOpen, gameState, startGame, handleInput, onClose]);

    // Cleanup on unmount/close
    useEffect(() => {
        if (!isOpen) {
            gameRunning.current = false;
            cancelAnimationFrame(gameLoopRef.current);
            setGameState('idle');
        }
    }, [isOpen]);

    // Draw idle/gameover screens
    useEffect(() => {
        if (gameState !== 'playing' && canvasRef.current && isOpen) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Background
            const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
            skyGrad.addColorStop(0, '#0f0a1a');
            skyGrad.addColorStop(1, '#1a0e2e');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

            // Stars
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            for (let i = 0; i < 40; i++) {
                const sx = (i * 97) % GAME_WIDTH;
                const sy = (i * 43) % (GROUND_Y - 40);
                ctx.beginPath();
                ctx.arc(sx, sy, 0.5 + (i % 3) * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Ground
            ctx.fillStyle = '#1e1035';
            ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
            ctx.strokeStyle = '#6d28d9';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, GROUND_Y);
            ctx.lineTo(GAME_WIDTH, GROUND_Y);
            ctx.stroke();

            // Player idle
            ctx.font = '30px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('🐳', 60, GROUND_Y);

            if (gameState === 'idle') {
                // Title
                ctx.fillStyle = '#e2e8f0';
                ctx.font = 'bold 28px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('DEPLOY RUNNER', GAME_WIDTH / 2, 100);

                ctx.fillStyle = '#94a3b8';
                ctx.font = '14px monospace';
                ctx.fillText('Navigate your container through the CI/CD pipeline', GAME_WIDTH / 2, 130);

                ctx.fillStyle = '#8b5cf6';
                ctx.font = 'bold 16px monospace';
                ctx.fillText('Press SPACE to start', GAME_WIDTH / 2, 180);

                ctx.fillStyle = '#64748b';
                ctx.font = '12px monospace';
                ctx.fillText('SPACE/↑ = Jump  |  ↓ = Duck  |  ESC = Close', GAME_WIDTH / 2, 210);
            }
        }
    }, [gameState, isOpen]);

    const stage = PIPELINE_STAGES[currentStage % PIPELINE_STAGES.length];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Game Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ duration: 0.4, type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 z-[71] flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative w-full max-w-[850px]">
                            {/* Glow */}
                            <div className="absolute -inset-2 bg-gradient-to-br from-violet-600/20 via-primary/10 to-violet-600/20 rounded-3xl blur-xl opacity-80" />

                            <div className="relative bg-[#0f0a1a] rounded-3xl border border-violet-500/20 shadow-2xl overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-3 bg-[#1a0e2e]/80 border-b border-violet-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Gamepad2 className="h-4 w-4 text-violet-400" />
                                            <span className="text-sm font-mono text-violet-300">deploy-runner</span>
                                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-full">
                                                Easter Egg
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-xs font-mono text-violet-400">
                                            <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                                            <span>HI: {highScore.toString().padStart(5, '0')}</span>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-1.5 rounded-lg hover:bg-violet-500/20 transition-colors text-violet-400 hover:text-violet-200"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Canvas */}
                                <div
                                    className="relative flex justify-center bg-[#0f0a1a] cursor-pointer"
                                    onClick={() => {
                                        if (gameState === 'idle' || gameState === 'gameover') startGame();
                                        else if (gameState === 'playing') handleInput('jump');
                                    }}
                                    onTouchStart={(e) => {
                                        e.preventDefault();
                                        if (gameState === 'idle' || gameState === 'gameover') startGame();
                                        else if (gameState === 'playing') handleInput('jump');
                                    }}
                                >
                                    <canvas
                                        ref={canvasRef}
                                        width={GAME_WIDTH}
                                        height={GAME_HEIGHT}
                                        style={{
                                            width: GAME_WIDTH * canvasScale,
                                            height: GAME_HEIGHT * canvasScale,
                                            imageRendering: 'pixelated',
                                        }}
                                    />

                                    {/* Game Over Overlay */}
                                    {gameState === 'gameover' && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                                        >
                                            <motion.div
                                                initial={{ y: -20 }}
                                                animate={{ y: 0 }}
                                                className="text-center"
                                            >
                                                <div className="text-4xl mb-2">💥</div>
                                                <h3 className="text-2xl font-bold font-mono text-red-400 mb-1">
                                                    DEPLOYMENT FAILED
                                                </h3>
                                                <p className="text-violet-300 font-mono text-sm mb-1">
                                                    Score: <span className="text-white font-bold">{score.toString().padStart(5, '0')}</span>
                                                </p>
                                                <p className="text-violet-400 font-mono text-xs mb-4">
                                                    Collected: {collectCount} resources
                                                </p>
                                                {score >= highScore && score > 0 && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ delay: 0.3, type: 'spring' }}
                                                        className="mb-3"
                                                    >
                                                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs font-bold font-mono border border-yellow-500/30">
                                                            🏆 NEW HIGH SCORE!
                                                        </span>
                                                    </motion.div>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startGame(); }}
                                                    className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-mono text-sm transition-colors"
                                                >
                                                    <RotateCcw className="h-4 w-4" />
                                                    Redeploy
                                                </button>
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between px-5 py-2.5 bg-[#1a0e2e]/80 border-t border-violet-500/20">
                                    <div className="flex items-center gap-4">
                                        {gameState === 'playing' && (
                                            <>
                                                <span className="text-xs font-mono text-violet-400">
                                                    {stage.emoji} <span style={{ color: stage.color }}>{stage.name}</span>
                                                </span>
                                                <span className="text-xs font-mono text-violet-500">
                                                    📦 {collectCount}
                                                </span>
                                            </>
                                        )}
                                        {gameState === 'idle' && showHint && (
                                            <span className="text-[10px] font-mono text-violet-500 animate-pulse">
                                                🎮 Konami Code: ↑↑↓↓←→←→BA
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono text-violet-600">
                                        SPACE = Jump • ↓ = Duck • Click/Tap to play
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
