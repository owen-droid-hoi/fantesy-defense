import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===================================================
// META-GAME: LocalStorage helpers
// ===================================================
const TOWER_INFO = {
    magic:     { name: 'Magic Tower', baseCost: 10, emoji: '🔮' },
    crossbow:  { name: 'Crossbow',    baseCost: 20, emoji: '🏹' },
    frost:     { name: 'Frost Tower', baseCost: 30, emoji: '❄️' },
    cannon:    { name: 'Cannon',      baseCost: 50, emoji: '💥' },
    storm:     { name: 'Storm Tower', baseCost: 75, emoji: '⚡' },
    lightning: { name: 'Lightning',   baseCost: 40, emoji: '🌩️' },
    poison:    { name: 'Poison Vat',  baseCost: 35, emoji: '🧪' },
    flamer:    { name: 'Flamethrower',baseCost: 60, emoji: '🔥' },
    time:      { name: 'Time Clock',  baseCost: 80, emoji: '⏳' },
    buff:      { name: 'Buff Banner', baseCost: 45, emoji: '💎' },
    shield:    { name: 'Shield Dome', baseCost: 90, emoji: '🛡️' },
    tornado:   { name: 'Tornado Spire',baseCost:65, emoji: '🌪️' },
    gravity:   { name: 'Gravity Well',baseCost:100, emoji: '🧲' },
    laser:     { name: 'Prism Laser', baseCost: 95, emoji: '🔮' },
    sniper:    { name: 'Sniper Nest', baseCost: 120, emoji: '🎯' },
    goldmine:  { name: 'Gold Mine',   baseCost: 150, emoji: '💰' },
    quake:     { name: 'Earthquake',  baseCost: 85, emoji: '🌋' }
};

const RARITY_INFO = {
    common:    { name: 'Common',    dmgMult: 1.0, speedMult: 1.0, costMult: 1.0,  emoji: '⚪' },
    uncommon:  { name: 'Uncommon',  dmgMult: 1.3, speedMult: 1.1, costMult: 1.25, emoji: '🟢' },
    rare:      { name: 'Rare',      dmgMult: 1.8, speedMult: 1.2, costMult: 1.5,  emoji: '🔵' },
    epic:      { name: 'Epic',      dmgMult: 2.5, speedMult: 1.4, costMult: 2.0,  emoji: '🟣' },
    legendary: { name: 'Legendary', dmgMult: 4.0, speedMult: 1.6, costMult: 2.5,  emoji: '🟠' },
    mythic:    { name: 'Mythic',    dmgMult: 7.0, speedMult: 1.8, costMult: 3.2,  emoji: '🔴' },
    divine:    { name: 'Divine',    dmgMult: 15.0,speedMult: 2.5, costMult: 4.5,  emoji: '🌈' }
};

function parseCardId(id) {
    if(!id.includes('_')) return { type: id, rarity: 'common' };
    const [t,r] = id.split('_');
    return { type: t, rarity: r };
}

function getCardCost(cardId) {
    const {type, rarity} = parseCardId(cardId);
    return Math.floor(TOWER_INFO[type].baseCost * RARITY_INFO[rarity].dmgMult);
}

function getCardLimit(cardId) {
    const {type} = parseCardId(cardId);
    if(type === 'goldmine') return 5;
    if(TOWER_INFO[type].baseCost >= 75) return 2;
    if(TOWER_INFO[type].baseCost >= 40) return 3;
    return 4;
}

const CHEST_COSTS = { wooden: 50, magic: 150, epic: 400 };
const CHEST_RARITY = {
    wooden: [ {r:'common',w:70}, {r:'uncommon',w:25}, {r:'rare',w:5} ],
    magic:  [ {r:'uncommon',w:40}, {r:'rare',w:30}, {r:'epic',w:29}, {r:'legendary',w:1} ],
    epic:   [ {r:'uncommon',w:20}, {r:'rare',w:40}, {r:'epic',w:30}, {r:'legendary',w:6}, {r:'mythic',w:3}, {r:'divine',w:1} ]
};

function migrateArray(arr) { return arr.map(id => id.includes('_') ? id : id+'_common'); }

function getGems()       { return parseInt(localStorage.getItem('fd_gems') || '100'); }
function saveGems(n)     { localStorage.setItem('fd_gems', Math.max(0,n)); }
function getCollection() { 
    try { 
        let arr = migrateArray(JSON.parse(localStorage.getItem('fd_collection') || '["magic_common", "cannon_common"]')); 
        if(!arr.includes('magic_common')) arr.push('magic_common');
        if(!arr.includes('cannon_common')) arr.push('cannon_common');
        return arr;
    } catch { return ['magic_common', 'cannon_common']; } 
}
function saveCollection(c){ localStorage.setItem('fd_collection', JSON.stringify(c)); }
function getLoadout()    { 
    try { return migrateArray(JSON.parse(localStorage.getItem('fd_loadout') || '["magic_common", "cannon_common"]')); } 
    catch { return ['magic_common', 'cannon_common']; } 
}
function saveLoadout(l)  { localStorage.setItem('fd_loadout', JSON.stringify(l)); }

// ===================================================
// GAME CONFIG
// ===================================================
const GRID_SIZE = 10;
const TILE_SIZE = 1;
const PATH = [
    {x:-4,z:-4},{x:-3,z:-4},{x:-2,z:-4},{x:-1,z:-4},{x:0,z:-4},
    {x:0,z:-3},{x:0,z:-2},{x:1,z:-2},{x:2,z:-2},{x:3,z:-2},
    {x:3,z:-1},{x:3,z:0},{x:3,z:1},{x:3,z:2},{x:3,z:3},
    {x:4,z:3},{x:5,z:3}
];

const START_GOLD = 30;

let wave = 1;
let waveEnemiesToSpawn = 8;
let waveEnemiesSpawned = 0;
let isWaveActive = false;
const ENEMIES_PER_WAVE = (w) => 5 + w * 5;

const COLORS = {
    grass:'#7cfc00', stone:'#888888', crystal:'#00ffff', ice:'#00ccff',
    goblin:'#32cd32', wood:'#8b4513', dirt:'#5d4037', cannon:'#333333'
};

// ===================================================
// BIOMES & SOUNDS
// ===================================================
const BIOMES = {
    forest: { name: 'Forest',  grass: 0x2e7d32, sand: 0x5d4037, enemies: 1.0,  assets: ['tree', 'rock', 'flower'] },
    desert: { name: 'Desert',  grass: 0xedc9af, sand: 0xc2b280, enemies: 1.15, assets: ['cactus', 'rock'] },
    snow:   { name: 'Snow',    grass: 0xffffff, sand: 0xdddddd, enemies: 1.3,  assets: ['snowytree', 'icerock'] }
};
let currentBiome = 'forest';

class SoundManager {
    constructor() {
        this.ctx = null; this.muted = false;
        this.bgmLoopId = null; this.beatIdx = 0;
        this.luteNotes = [146.83, 196.00, 220.00, 293.66, 329.63]; // D3, G3, A3, D4, E4
        this.fluteNotes = [440.00, 493.88, 523.25, 587.33, 659.25, 783.99]; // A4, B4, C5, D5, E5, G5
    }
    init() { 
        if(!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const mBtn = document.getElementById('mute-btn');
            if(mBtn) mBtn.onclick = () => this.toggleMute();
        }
        if(this.ctx.state === 'suspended') this.ctx.resume();
    }
    toggleMute() { 
        this.init();
        this.muted = !this.muted; 
        document.getElementById('mute-btn').innerText = this.muted ? '🔇' : '🔊'; 
        if(this.muted) { if(this.bgmLoopId) clearTimeout(this.bgmLoopId); }
        else { this.startBGM(); }
    }
    play(freq, type='sine', dur=0.1, vol=0.15, ramp=true, vibrato=0) {
        if(this.muted || !this.ctx) return;
        if(this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        if(vibrato > 0) {
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.value = 5; lfoGain.gain.value = vibrato;
            lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
            lfo.start();
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        if(ramp) gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    }
    lute(freq, vol=0.08)  { this.play(freq, 'triangle', 0.8, vol, true); }
    flute(freq, vol=0.04) { this.play(freq, 'sine', 0.6, vol, true, 4); }
    startBGM() {
        if(this.muted) return;
        this.init();
        const nextBeat = () => {
            if(this.muted) return;
            const cadence = [0, 4, 2, 4];
            const beatDur = 500;
            // Lute Pattern (Rhythmic)
            if(this.beatIdx % 2 === 0) {
                this.lute(this.luteNotes[cadence[Math.floor(this.beatIdx/2)%4]], 0.05);
            } else {
                this.lute(this.luteNotes[0] * 1.5, 0.02); // Strum
            }
            // Flute Melody (Sparser)
            if(Math.random() < 0.3) {
                setTimeout(() => {
                    const f = this.fluteNotes[Math.floor(Math.random()*this.fluteNotes.length)];
                    this.flute(f, 0.03);
                }, 150);
            }
            this.beatIdx++;
            this.bgmLoopId = setTimeout(nextBeat, beatDur);
        };
        if(this.bgmLoopId) clearTimeout(this.bgmLoopId);
        nextBeat();
    }
    updateWeatherSounds(type) {
        if(this.muted || !this.ctx) return;
        this.init();
        const now = this.ctx.currentTime;
        if(!this.lastAmbience || now - this.lastAmbience > 0.4) {
            this.lastAmbience = now;
            if(type === 'rain' || type === 'storm') {
                // Continuous rain "sheen"
                this.play(1000 + Math.random()*2000, 'sine', 0.3, 0.005, true); 
                if(Math.random() < 0.4) this.play(2000 + Math.random()*4000, 'sine', 0.05, 0.008); // Individual drips
            }
            if(type === 'storm') {
                if(Math.random() < 0.08) {
                     this.play(40 + Math.random()*30, 'sawtooth', 1.2, 0.06); // Distant thunder
                }
            }
        }
    }
    shoot() { this.play(400 + Math.random()*200, 'triangle', 0.1, 0.06); }
    pop()   { this.play(800 + Math.random()*400, 'sine', 0.05, 0.05); }
    thud()  { this.play(120, 'sine', 0.3, 0.1); }
    reveal(rarity) {
        this.init();
        const now = this.ctx.currentTime;
        const playSeq = (notes, type='sine', baseVol=0.1) => {
            notes.forEach((n, i) => {
                setTimeout(() => this.play(n, type, 0.5, baseVol/(i+1), true), i * 150);
            });
        };
        switch(rarity) {
            case 'common':   playSeq([261, 329], 'sine', 0.1); break;
            case 'uncommon': playSeq([329, 392, 523], 'sine', 0.12); break;
            case 'rare':     playSeq([523, 659, 783, 1046], 'triangle', 0.15); break;
            case 'epic':     playSeq([440, 554, 659, 880, 1108], 'sawtooth', 0.15); break;
            case 'legendary':playSeq([293, 370, 440, 587, 740, 880], 'square', 0.18); break;
            case 'mythic':   playSeq([220, 110, 440, 220, 880, 440], 'sawtooth', 0.2); break;
            case 'divine':   
                const chords = [440, 554, 659, 880, 1108, 1318, 1760];
                chords.forEach((f, i) => setTimeout(() => this.play(f, 'sine', 2.0, 0.15), i * 100));
                setTimeout(() => this.play(220, 'triangle', 2.0, 0.2), 0); // Bass foundation
                break;
        }
    }
}
const sounds = new SoundManager();

// ===================================================
// WEATHER & QUESTS
// ===================================================
let weatherType = 'sunny';
let weatherTimer = 0;
let quests = [
    { id: 'kills', label: 'Slay 50 Enemies', target: 50, current: 0, reward: 200, completed: false },
    { id: 'gold', label: 'Spend 1000 Gold', target: 1000, current: 0, reward: 200, completed: false },
    { id: 'waves', label: 'Reach Wave 10', target: 10, current: 0, reward: 200, completed: false }
];

function updateQuestsUI() {
    const container = document.getElementById('quests-container');
    if(!container) return;
    container.innerHTML = '';
    quests.forEach(q => {
        const item = document.createElement('div');
        item.className = 'quest-item';
        const perc = Math.min(100, (q.current / q.target) * 100);
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                <span>${q.completed ? '✅' : '⚔️'} ${q.label}</span>
                <span>${q.current}/${q.target}</span>
            </div>
            <div class="quest-bar"><div class="quest-progress" style="width:${perc}%; background:${q.completed?'#4caf50':'#00e5ff'}"></div></div>
        `;
        container.appendChild(item);
    });
}

function progressQuest(id, amount=1) {
    const q = quests.find(x => x.id === id);
    if(q && !q.completed) {
        q.current += amount;
        if(q.current >= q.target) {
            q.completed = true;
            saveGems(getGems() + q.reward);
            updateGemsDisplay();
        }
        updateQuestsUI();
    }
}

function updateWeather(dt) {
    weatherTimer -= dt;
    if(weatherTimer <= 0) {
        const types = ['sunny', 'rain', 'storm'];
        weatherType = types[Math.floor(Math.random()*types.length)];
        weatherTimer = 45000 + Math.random()*30000;
        
        const el = document.getElementById('weather-indicator');
        if(!el) return;
        if(weatherType === 'sunny') {
            el.innerHTML = '☀️ Sunny'; el.className = '';
            // scene might not be ready on first call from animate if not started
            if(scene) scene.background = new THREE.Color(0x87ceeb);
        } else if(weatherType === 'rain') {
            el.innerHTML = '🌧️ Rain'; el.className = 'weather-rain';
            if(scene) scene.background = new THREE.Color(0x4a5a6a);
        } else {
            el.innerHTML = '⚡ Storm'; el.className = 'weather-storm';
            if(scene) scene.background = new THREE.Color(0x1a1a2e);
        }
    }
    
    // Visual Rain - Optimized: spawn fewer particles, use limited pool if possible 
    // Spawning 10 per frame at 60fps = 600 meshes/sec. Let's reduce to 3 per frame.
    if(weatherType === 'rain' || weatherType === 'storm') {
        const count = weatherType === 'storm' ? 5 : 2;
        for(let i=0; i<count; i++) {
            const r = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.02), new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.3}));
            r.position.set((Math.random()-0.5)*40, 15, (Math.random()-0.5)*40);
            world.add(r);
            r.userData = { life: 800, isVisualOnly: true, drift: new THREE.Vector3(0, -0.8, 0) };
            projectiles.push(r);
        }
    }
    // Storm Flash
    if(weatherType === 'storm' && Math.random() < 0.005) {
        const flash = new THREE.DirectionalLight(0xffffff, 5);
        world.add(flash);
        setTimeout(() => world.remove(flash), 100);
    }
}

function createDeathParticles(pos, color) {
    for(let i=0; i<8; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({color:color}));
        p.position.copy(pos);
        const vel = new THREE.Vector3((Math.random()-0.5)*0.15, 0.1 + Math.random()*0.2, (Math.random()-0.5)*0.15);
        p.userData = { life: 1200, isVisualOnly: true, drift: vel, physics: true };
        world.add(p);
        projectiles.push(p);
    }
}

// ===================================================
// TEXTURES
// ===================================================
function createNoiseTexture(baseColor, size=128, noiseIntensity=0.3, type='noise') {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor; ctx.fillRect(0,0,size,size);
    const imgData = ctx.getImageData(0,0,size,size);
    const data = imgData.data;
    for(let i=0;i<data.length;i+=4){ const f=1+(Math.random()-0.5)*noiseIntensity; data[i]*=f;data[i+1]*=f;data[i+2]*=f; }
    ctx.putImageData(imgData,0,0);
    if(type === 'spots') {
        for(let i=0; i<12; i++) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.arc(Math.random()*size, Math.random()*size, Math.random()*(size/5), 0, Math.PI*2);
            ctx.fill();
        }
    } else if(type === 'cracks') {
         ctx.strokeStyle = 'rgba(0,0,0,0.2)';
         ctx.lineWidth = 2;
         for(let i=0; i<10; i++) {
             ctx.beginPath();
             ctx.moveTo(Math.random()*size, Math.random()*size);
             ctx.lineTo(Math.random()*size, Math.random()*size);
             ctx.stroke();
         }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}
const TEXTURES = {
    grass: createNoiseTexture(COLORS.grass,128,0.4),
    stone: createNoiseTexture(COLORS.stone,128,0.2),
    wood:  createNoiseTexture(COLORS.wood,128,0.5),
    dirt:  createNoiseTexture(COLORS.dirt,64,0.3)
};

// ===================================================
// GAME STATE
// ===================================================
let gold = START_GOLD;
let health = 100;
let isGodMode = false;
let selectedTower = null;
let selectedBuildType = 'magic';
let isPaused = false;
let gameStarted = false;
let manualTarget = null;
let baseHealthBar = null;

// ===================================================
// SCENE SETUP
// ===================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0d8ef);
scene.fog = new THREE.Fog(0xa0d8ef,10,30);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(10,12,10);
camera.lookAt(0,0,0);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
renderer.domElement.style.zIndex = '0'; // keep canvas below the start screen UI

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = false;
controls.enablePan = false;
controls.enableZoom = true;
camera.position.set(12, 14, 12);
camera.lookAt(0,0,0);
controls.update();
controls.maxPolarAngle = Math.PI/2.1;

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// UI refs
const towerPanel   = document.getElementById('tower-panel');
const towerLvlEl   = document.getElementById('tower-lvl');
const towerRangeEl = document.getElementById('tower-range');
const towerSpeedEl = document.getElementById('tower-speed');
const upgradeBtn   = document.getElementById('upgrade-button');
const closeBtn     = document.getElementById('close-panel');
const sellBtn      = document.getElementById('sell-button');
const sellValueEl  = document.getElementById('sell-value');
const towerCostHint= document.getElementById('tower-cost-hint');

const rangeIndicator = new THREE.Mesh(
    new THREE.RingGeometry(0.1,1,64),
    new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.3,side:THREE.DoubleSide})
);
rangeIndicator.rotation.x = -Math.PI/2;
rangeIndicator.position.y = 0.16;
rangeIndicator.visible = false;
scene.add(rangeIndicator);

const focusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.4,0.04,8,24),
    new THREE.MeshBasicMaterial({color:0xff0000,transparent:true,opacity:0.6})
);
focusRing.rotation.x = Math.PI/2;
focusRing.visible = false;
scene.add(focusRing);

const ghostGroup = new THREE.Group();
ghostGroup.visible = false;
scene.add(ghostGroup);

const ghostRing = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 1, 64),
    new THREE.MeshBasicMaterial({color:0x00ff88, transparent:true, opacity:0.22, side:THREE.DoubleSide, depthWrite:false})
);
ghostRing.rotation.x = -Math.PI/2;
ghostRing.position.y = 0.17;
ghostRing.visible = false;
scene.add(ghostRing);

function getTowerRangeForType(type) {
    if(type==='magic')    return 3.4;
    if(type==='crossbow') return 5.6;
    if(type==='frost')    return 4.3;
    if(type==='cannon')   return 3.7;
    if(type==='storm')    return 4.9;
    if(type==='lightning')return 4.4;
    if(type==='poison')   return 3.8;
    if(type==='flamer')   return 2.7;
    if(type==='time')     return 4.0;
    if(type==='buff')     return 3.5;
    if(type==='shield')   return 4.4;
    if(type==='tornado')  return 5.5;
    if(type==='gravity')  return 4.4;
    if(type==='laser')    return 6.0;
    if(type==='sniper')   return 15.0; // effectively infinite map range
    if(type==='goldmine') return 0; // doesn't interact with enemies
    if(type==='quake')    return 2.5; // short range AoE
    return 3.4;
}
function setGhostColor(valid) {
    const col = valid ? 0x00ff88 : 0xff3333;
    ghostGroup.traverse(m => {
        if(m.isMesh) {
            m.material.color.setHex(col);
            m.material.transparent = true;
            m.material.opacity = 0.38;
            m.material.depthWrite = false;
        }
    });
    ghostRing.material.color.setHex(col);
}

// Lights
scene.add(new THREE.AmbientLight(0xffffff,0.5));
scene.add(new THREE.HemisphereLight(0xffffff,0x444444,0.6));
const dirLight = new THREE.DirectionalLight(0xffffff,1.2);
dirLight.position.set(10,20,10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048,2048);
scene.add(dirLight);

// 3D base health bar
function createBaseHealthBar() {
    const group = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.2),new THREE.MeshBasicMaterial({color:0x440000}));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.2),new THREE.MeshBasicMaterial({color:0x00ff00}));
    fg.position.z = 0.01; fg.name = 'fg';
    group.add(bg,fg);
    const end = PATH[PATH.length-1];
    group.position.set(end.x,1.8,end.z);
    return group;
}
baseHealthBar = createBaseHealthBar();
scene.add(baseHealthBar);

const world = new THREE.Group(); scene.add(world);
const enemies = [], towers = [], projectiles = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ===================================================
// TOWER MODELS
// ===================================================
function createTree(x, z) {
    const group = new THREE.Group();
    const h = 0.5 + Math.random();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, h/2), new THREE.MeshStandardMaterial({color:0x5d4037}));
    trunk.position.set(x, h/4, z); group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.25, h, 4), new THREE.MeshStandardMaterial({color:0x2e7d32}));
    leaves.position.set(x, h/2 + h/4, z); group.add(leaves);
    return group;
}
function createRock(x, z) {
    const r = 0.1 + Math.random()*0.2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({color:0x777777}));
    rock.position.set(x, r/2, z); rock.rotation.set(Math.random(), Math.random(), Math.random());
    return rock;
}
function createFlower(x, z) {
    const col = ['#ff4081', '#ffeb3b', '#00e5ff'][Math.floor(Math.random()*3)];
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15), new THREE.MeshStandardMaterial({color:0x2e7d32}));
    stem.position.set(x, 0.075, z);
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), new THREE.MeshStandardMaterial({color:col}));
    petal.position.set(x, 0.15, z);
    const g = new THREE.Group(); g.add(stem, petal); return g;
}

function createCactus(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), new THREE.MeshStandardMaterial({color:0x2e7d32}));
    body.position.set(x, 0.15, z); g.add(body);
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshStandardMaterial({color:0x2e7d32}));
    arm.position.set(x+0.05, 0.25, z); g.add(arm);
    return g;
}

function createSnowyTree(x, z) {
    const tree = createTree(x, z);
    tree.traverse(n => { if(n.isMesh && n.geometry.type==='ConeGeometry') n.material.color.set(0xeeeeee); });
    return tree;
}

function createIceRock(x, z) {
    const rock = createRock(x, z);
    rock.material.color.set(0x00ffff); rock.material.transparent = true; rock.material.opacity = 0.6;
    return rock;
}

function spawnBiomeAssets(group, x, z) {
    const b = BIOMES[currentBiome];
    const count = Math.floor(Math.random()*2) + 1;
    for(let i=0; i<count; i++){
        const ox = (Math.random()-0.5)*0.8, oz = (Math.random()-0.5)*0.8;
        const asset = b.assets[Math.floor(Math.random()*b.assets.length)];
        if(asset === 'tree') group.add(createTree(x+ox, z+oz));
        else if(asset === 'rock') group.add(createRock(x+ox, z+oz));
        else if(asset === 'flower') group.add(createFlower(x+ox, z+oz));
        else if(asset === 'cactus') group.add(createCactus(x+ox, z+oz));
        else if(asset === 'snowytree') group.add(createSnowyTree(x+ox, z+oz));
        else if(asset === 'icerock') group.add(createIceRock(x+ox, z+oz));
    }
}

function createGrassTile(x,z) {
    const group = new THREE.Group();
    const col = BIOMES[currentBiome].grass;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE,0.2,TILE_SIZE),new THREE.MeshStandardMaterial({color:col,roughness:0.8}));
    mesh.position.set(x,0,z); mesh.receiveShadow = true;
    mesh.userData = {type:'grass',occupied:false,tileX:x,tileZ:z};
    group.add(mesh);
    spawnBiomeAssets(group, x, z);
    return group;
}
function createStoneTile(x,z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE,0.25,TILE_SIZE),new THREE.MeshStandardMaterial({map:TEXTURES.stone}));
    mesh.position.set(x,0,z); mesh.receiveShadow = true;
    mesh.userData = {type:'stone'};
    return mesh;
}

function createMagicalTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,0.8,8),new THREE.MeshStandardMaterial({map:TEXTURES.stone}));
    base.position.y = 0.4; group.add(base);
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.15),new THREE.MeshStandardMaterial({color:0x00ffff,emissive:0x00ffff,emissiveIntensity:1}));
    crystal.position.y = 1.2; crystal.name='crystal'; cg.add(crystal);
    const light = new THREE.PointLight(0x00ffff,1.5,4); light.position.y=1.2; light.name='light'; cg.add(light);
    group.add(cg);
    group.castShadow = true;
    group.userData = {type:'magic',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    updateTowerStats(group); return group;
}

// --- CROSSBOW TOWER (Clash Royale style) ---
function createCrossbowTower(level=1) {
    const group = new THREE.Group();
    const metalDark = new THREE.MeshStandardMaterial({color:0x2a2a3a,metalness:0.9,roughness:0.2});
    const metalGray = new THREE.MeshStandardMaterial({color:0x8899aa,metalness:0.7,roughness:0.3});
    const woodMat   = new THREE.MeshStandardMaterial({map:TEXTURES.wood});
    const ropeMat   = new THREE.MeshStandardMaterial({color:0x8b5e3c,roughness:1});

    // Base — dark octagonal platform
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.44,0.28,8),metalDark);
    base.position.y = 0.14; group.add(base);

    // Body — silver/gray mount
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.46,0.32),metalGray);
    body.position.y = 0.51; group.add(body);

    // Pivot cylinder
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.14,0.12,8),metalDark);
    pivot.position.y = 0.77; group.add(pivot);

    // Head — whole crossbow rotates
    const head = new THREE.Group(); head.name='head'; head.position.y = 0.85;

    // Stock (main wooden body along z-axis)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.1,0.85),woodMat);
    stock.position.z = 0.08; head.add(stock);

    // Central metal yoke (where limbs attach)
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.2,0.18),metalGray);
    yoke.position.set(0,0,0.38); head.add(yoke);

    // LEFT limb: 3-part swept-back-then-forward arm
    // Part 1: outer horizontal
    const lArm1 = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.09,0.11),woodMat);
    lArm1.position.set(-0.21,0,0.38); lArm1.rotation.y = 0.35; head.add(lArm1);
    // Part 2: diagonal bend
    const lArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.08,0.1),woodMat);
    lArm2.position.set(-0.4,0,0.24); lArm2.rotation.y = -0.75; head.add(lArm2);
    // Part 3: forward tip
    const lArm3 = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.08,0.24),woodMat);
    lArm3.position.set(-0.46,0,0.1); head.add(lArm3);
    // rope wrap on L arm
    const lRope = new THREE.Mesh(new THREE.TorusGeometry(0.045,0.018,4,8),ropeMat);
    lRope.position.set(-0.21,0,0.38); lRope.rotation.y = Math.PI/2; head.add(lRope);

    // RIGHT limb (mirror)
    const rArm1 = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.09,0.11),woodMat);
    rArm1.position.set(0.21,0,0.38); rArm1.rotation.y = -0.35; head.add(rArm1);
    const rArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.08,0.1),woodMat);
    rArm2.position.set(0.4,0,0.24); rArm2.rotation.y = 0.75; head.add(rArm2);
    const rArm3 = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.08,0.24),woodMat);
    rArm3.position.set(0.46,0,0.1); head.add(rArm3);
    const rRope = new THREE.Mesh(new THREE.TorusGeometry(0.045,0.018,4,8),ropeMat);
    rRope.position.set(0.21,0,0.38); rRope.rotation.y = Math.PI/2; head.add(rRope);

    // Bowstring
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.92,0.012,0.012),new THREE.MeshBasicMaterial({color:0x9b7b4a}));
    string.position.set(0,0,0.04); head.add(string);

    // Bolt body
    const boltBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.68,6),new THREE.MeshStandardMaterial({color:0x999999,metalness:0.6}));
    boltBody.rotation.x = Math.PI/2; boltBody.position.set(0,0,0.48); head.add(boltBody);
    // Bolt tip
    const boltTip = new THREE.Mesh(new THREE.ConeGeometry(0.038,0.14,6),new THREE.MeshStandardMaterial({color:0xdddddd,metalness:0.9}));
    boltTip.rotation.x = Math.PI/2; boltTip.position.set(0,0,0.85); head.add(boltTip);

    group.add(head);
    group.userData = {type:'crossbow',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0,recoil:0};
    updateTowerStats(group); return group;
}

function createFrostTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.2,6),new THREE.MeshStandardMaterial({color:0xeeeeee,map:TEXTURES.stone}));
    base.position.y=0.1; group.add(base);
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.25),new THREE.MeshStandardMaterial({color:0x00ccff,transparent:true,opacity:0.8}));
    crystal.position.y=1.0; crystal.name='crystal'; cg.add(crystal);
    const light = new THREE.PointLight(0x00ccff,1.2,5); light.position.y=1.0; light.name='light'; cg.add(light);
    group.add(cg);
    group.userData = {type:'frost',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    updateTowerStats(group); return group;
}

function createCannonTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.4,0.6),new THREE.MeshStandardMaterial({map:TEXTURES.wood}));
    base.position.y=0.2; group.add(base);
    const piv = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2),new THREE.MeshStandardMaterial({color:0x222222}));
    piv.position.y=0.5; group.add(piv);
    const head = new THREE.Group(); head.name='head'; head.position.y=0.6;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,0.7,12),new THREE.MeshStandardMaterial({color:0x222222,metalness:0.9}));
    barrel.rotation.x = Math.PI/2; barrel.position.z=0.3;
    head.add(barrel); group.add(head);
    group.userData = {type:'cannon',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0,recoil:0};
    updateTowerStats(group); return group;
}

// --- STORM TOWER (Legendary) ---
function createStormTower(level=1) {
    const group = new THREE.Group();
    const darkMat  = new THREE.MeshStandardMaterial({color:0x1a0a40,metalness:0.8,roughness:0.2});
    const purpleMat= new THREE.MeshStandardMaterial({color:0x2a1060,metalness:0.7,roughness:0.3});
    const silverMat= new THREE.MeshStandardMaterial({color:0xbbbbee,metalness:0.9,roughness:0.1});

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.46,0.35,6),darkMat);
    base.position.y=0.175; group.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.34,0.75,6),purpleMat);
    body.position.y=0.725; group.add(body);

    // Conducting spires around body
    const spireGeo = new THREE.ConeGeometry(0.04,0.3,4);
    [0,1,2,3].forEach(i => {
        const angle = (i/4)*Math.PI*2;
        const spire = new THREE.Mesh(spireGeo,silverMat);
        spire.position.set(Math.cos(angle)*0.22,0.95,Math.sin(angle)*0.22);
        group.add(spire);
    });

    // Crystal group at top
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18,8,8),new THREE.MeshStandardMaterial({color:0xffff00,emissive:0xffee00,emissiveIntensity:2,transparent:true,opacity:0.9}));
    orb.position.y=1.3; orb.name='crystal'; cg.add(orb);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.28,0.028,6,14),new THREE.MeshBasicMaterial({color:0xffff00,transparent:true,opacity:0.6}));
    ring1.position.y=1.3; ring1.name='ring1'; cg.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.22,0.02,6,14),new THREE.MeshBasicMaterial({color:0x8888ff,transparent:true,opacity:0.5}));
    ring2.position.y=1.3; ring2.rotation.x=Math.PI/2; ring2.name='ring2'; cg.add(ring2);
    const light = new THREE.PointLight(0xffff00,2.5,5); light.position.y=1.3; light.name='light'; cg.add(light);
    group.add(cg);
    group.userData = {type:'storm',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createLightningTower(level=1) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:0x00e5ff, metalness:0.8, roughness:0.2});
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), mat); base.position.y=0.1; group.add(base);
    const zapper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 1.2, 4), mat); zapper.position.y=0.8; group.add(zapper);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8), new THREE.MeshStandardMaterial({color:0xffffff, emissive:0x00ffff, emissiveIntensity:1.5}));
    orb.position.y=1.5; group.add(orb);
    const cg = new THREE.Group(); cg.name='crystalGroup'; cg.add(orb); group.add(cg);
    group.userData = {type:'lightning',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createPoisonTower(level=1) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({map:TEXTURES.wood});
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 12), wood); vat.position.y=0.3; group.add(vat);
    const goo = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.61, 12), new THREE.MeshStandardMaterial({color:0x32cd32}));
    goo.position.y=0.3; group.add(goo);
    const cg = new THREE.Group(); cg.name='crystalGroup'; // for animation
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8), new THREE.MeshStandardMaterial({color:0x88ff88}));
    bubble.position.y=0.7; bubble.name='crystal'; cg.add(bubble); group.add(cg);
    group.userData = {type:'poison',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0,lastSuperShot:0};
    return group;
}

function createLightningStrike(start, end, color=0x00ffff, fadeMs=200) {
    const group = new THREE.Group();
    const segments = 5;
    let prev = start.clone();
    for(let i=1; i<=segments; i++){
        const target = new THREE.Vector3().lerpVectors(start, end, i/segments);
        if(i < segments) target.add(new THREE.Vector3((Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4));
        const dist = prev.distanceTo(target);
        const geo = new THREE.CylinderGeometry(0.02, 0.02, dist, 4);
        geo.translate(0, dist/2, 0);
        const seg = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9}));
        seg.position.copy(prev); seg.lookAt(target); seg.rotation.x = Math.PI/2;
        group.add(seg); prev.copy(target);
    }
    world.add(group);
    group.userData = { life: fadeMs, isVisualOnly: true, type:'bolt' };
    projectiles.push(group);
}

function createNovaEffect(pos, color, count=12) {
    for(let i=0; i<count; i++) {
        const angle = (i/count) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:2}));
        p.position.copy(pos).add(dir.clone().multiplyScalar(0.5));
        p.userData = { target: null, dir, speed: 0.15, life: 2000, isVisualOnly: false, dmg: 40, type:'nova' };
        world.add(p); projectiles.push(p);
    }
}

function createFloatingText(pos, text, color=0xffffff) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 128;
    ctx.font = 'Bold 80px Outfit';
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 80);
    
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.scale.set(1.2, 0.6, 1);
    
    world.add(sprite);
    // Use projectiles list to auto-clean it
    sprite.userData = { life: 1000, isVisualOnly: true, drift: new THREE.Vector3(0, 0.02, 0) };
    projectiles.push(sprite);
}

function triggerSuperAbility(tower) {
    const type = tower.userData.type;
    const rarity = tower.userData.rarity || 'common';
    const lvl = tower.userData.level;
    const towerPos = tower.position.clone(); towerPos.y += 1.0;
    
    tower.userData.lastSuperShot = Date.now();
    
    switch(type) {
        case 'magic': createNovaEffect(towerPos, 0x00ffff); break;
        case 'crossbow': 
            for(let i=0;i<10;i++) setTimeout(() => {
                const ts = enemies.filter(e => e.position.distanceTo(tower.position) < tower.userData.range);
                if(ts.length > 0) shoot(tower, ts[Math.floor(Math.random()*ts.length)]);
            }, i * 150);
            break;
        case 'frost': 
            enemies.forEach(ae => { if(ae.position.distanceTo(tower.position) < tower.userData.range) ae.userData.slowTimer = 4000; });
            createNovaEffect(towerPos, 0x00ccff, 24);
            break;
        case 'cannon': 
            const targets = enemies.filter(e => e.position.distanceTo(tower.position) < tower.userData.range);
            if(targets.length > 0) {
                const target = targets[0];
                shoot(tower, target); // Main shot
                setTimeout(() => { // 4 Mini bombs
                    [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,-1)].forEach(off => {
                        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({color:0xff3300}));
                        p.position.copy(target.position).add(off.multiplyScalar(0.5));
                        p.userData = { target: target, speed: 0.2, type: 'cannon', dmgMult: 0.5 };
                        world.add(p); projectiles.push(p);
                    });
                }, 300);
            }
            break;
        case 'storm': 
            for(let i=0; i<30; i++) {
                setTimeout(() => {
                    const tx = (Math.random()-0.5)*12 + tower.position.x;
                    const tz = (Math.random()-0.5)*12 + tower.position.z;
                    createLightningStrike(new THREE.Vector3(tx, 6, tz), new THREE.Vector3(tx, 0, tz), 0xffff00, 400);
                    enemies.forEach(ae => { if(ae.position.distanceTo(new THREE.Vector3(tx,0,tz)) < 1.5) ae.userData.hp -= 80 * (tower.userData.dmgMult || 1); });
                }, i * 150);
            }
            break;
        case 'lightning':
            PATH.forEach((tile, idx) => {
                setTimeout(() => {
                    const pos = new THREE.Vector3(tile.x, 0, tile.z);
                    createLightningStrike(new THREE.Vector3(tile.x, 5, tile.z), pos, 0xffff00, 300);
                    enemies.forEach(ae => { if(ae.position.distanceTo(pos) < 1.2) ae.userData.hp -= 150 * (tower.userData.dmgMult || 1); });
                }, idx * 30);
            });
            break;
        case 'poison': 
            const cloud = new THREE.Group(); cloud.position.copy(tower.position);
            for(let i=0; i<35; i++) {
                const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshStandardMaterial({color:0x32cd32, transparent:true, opacity:0.4}));
                blob.position.set((Math.random()-0.5)*10, 0.5, (Math.random()-0.5)*10);
                cloud.add(blob);
            }
            world.add(cloud); cloud.userData = { life: 10000, isVisualOnly: true }; projectiles.push(cloud);
            enemies.forEach(ae => { if(ae.position.distanceTo(tower.position) < 6) { ae.userData.poisonTimer = 10000; ae.userData.poisonDps = 30 * (tower.userData.dmgMult || 1); } });
            break;
        case 'flamer':
            createNovaEffect(towerPos, 0xff4400, 40);
            enemies.forEach(ae => { if(ae.position.distanceTo(tower.position) < 7) { ae.userData.hp -= 250 * (tower.userData.dmgMult || 1); ae.userData.poisonTimer = 4000; ae.userData.poisonDps = 60; } });
            break;
        case 'time':
            enemies.forEach(ae => { ae.userData.slowTimer = 5000; ae.position.y += 0.8; ae.userData.isLifted = true; }); 
            createNovaEffect(towerPos, 0xffffff, 60);
            setTimeout(() => { enemies.forEach(ae => { ae.userData.isLifted = false; }); }, 5000);
            break;
        case 'buff':
            towers.forEach(at => { if(at.position.distanceTo(tower.position) < 8) { at.userData.buffedAt = Date.now(); at.userData.buffDuration = 10000; } });
            createNovaEffect(towerPos, 0xffeb3b, 20);
            break;
        case 'shield':
            towers.forEach(at => { if(at.position.distanceTo(tower.position) < 8) { at.userData.stunTimer = 0; at.userData.shieldTimer = 12000; } });
            health = Math.min(100, health + 20); updateUI();
            break;
        case 'tornado':
            const txC = tower.position.x, tzC = tower.position.z;
            for(let i=0; i<80; i++) {
                setTimeout(() => {
                    enemies.forEach(ae => {
                        const d = ae.position.distanceTo(tower.position);
                        if(d < 10) {
                            const p = new THREE.Vector3(txC - ae.position.x, 0.2, tzC - ae.position.z).normalize().multiplyScalar(0.2);
                            ae.position.add(p); ae.userData.hp -= 3;
                        }
                    });
                }, i * 100);
            }
            break;
        case 'gravity':
            const gHole = new THREE.Mesh(new THREE.SphereGeometry(1.0), new THREE.MeshStandardMaterial({color:0x000000, emissive:0xff00ff, emissiveIntensity:3}));
            gHole.position.copy(towerPos); world.add(gHole);
            for(let i=0; i<120; i++) {
                setTimeout(() => {
                    enemies.forEach(ae => {
                        const d = ae.position.distanceTo(tower.position);
                        if(d < 12) {
                            const pull = new THREE.Vector3().subVectors(tower.position, ae.position).normalize().multiplyScalar(0.3);
                            ae.position.add(pull); ae.userData.hp -= 6;
                        }
                    });
                    if(i === 119) world.remove(gHole);
                }, i * 50);
            }
            break;
        case 'laser':
            const lBeamGeo = new THREE.CylinderGeometry(0.7, 0.7, 30, 16);
            const lBeamMat = new THREE.MeshBasicMaterial({color:0xff00ff, transparent:true, opacity:0.75});
            const lBeam = new THREE.Mesh(lBeamGeo, lBeamMat); lBeam.position.set(tower.position.x, 15, tower.position.z);
            world.add(lBeam);
            setTimeout(() => {
                enemies.forEach(ae => { if(ae.position.distanceTo(tower.position) < 5) ae.userData.hp -= 1500 * (tower.userData.dmgMult || 1); });
                world.remove(lBeam);
            }, 2000);
            break;
        case 'sniper':
            const sTargets = enemies.sort((a,b) => b.userData.hp - a.userData.hp).slice(0, 8);
            sTargets.forEach((t, i) => {
                setTimeout(() => { if(enemies.includes(t)) { createLightningStrike(towerPos, t.position, 0xffea00, 150); t.userData.hp -= 800 * (tower.userData.dmgMult || 1); } }, i * 150);
            });
            break;
        case 'goldmine':
            gold += 300; createFloatingText(towerPos, "+300g", 0xffd700); updateUI();
            break;
        case 'quake':
            document.body.classList.add('screen-shake');
            setTimeout(() => document.body.classList.remove('screen-shake'), 1500);
            enemies.forEach(ae => { ae.userData.hp -= 150; ae.userData.slowTimer = 4000; ae.userData.stunTimer = 1000; });
            break;
    }
}

function createFlamerTower(level=1) {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({color:0x555555, metalness:0.9});
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.4, 8), metal); base.position.y=0.2; group.add(base);
    const head = new THREE.Group(); head.name='head'; head.position.y=0.6;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.6, 8), new THREE.MeshStandardMaterial({color:0xff3300}));
    nozzle.rotation.x = Math.PI/2; nozzle.position.z=0.3; head.add(nozzle);
    group.add(head);
    group.userData = {type:'flamer',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0,recoil:0};
    return group;
}

function createTimeTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), new THREE.MeshStandardMaterial({color:0xeeeeee}));
    base.position.y=0.1; group.add(base);
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const hour1 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), new THREE.MeshStandardMaterial({color:0xeeeeee, transparent:true, opacity:0.6}));
    hour1.position.y=0.6; hour1.rotation.x=Math.PI; cg.add(hour1);
    const hour2 = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6), new THREE.MeshStandardMaterial({color:0xeeeeee, transparent:true, opacity:0.6}));
    hour2.position.y=1.0; cg.add(hour2);
    const sand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({color:0xffd700, emissive:0xffd700, emissiveIntensity:0.5}));
    sand.position.y=0.8; cg.add(sand);
    group.add(cg);
    group.userData = {type:'time',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createBuffTower(level=1) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:0xffffff});
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.2, 6), mat); base.position.y=0.1; group.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), mat); pole.position.y=0.7; group.add(pole);
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshStandardMaterial({color:0xff4081, emissive:0xff4081, emissiveIntensity:1.5}));
    diamond.position.y=1.5; diamond.name='crystal'; cg.add(diamond);
    group.add(cg);
    group.userData = {type:'buff',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createShieldTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 16), new THREE.MeshStandardMaterial({color:0x333333}));
    base.position.y=0.15; group.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({color:0x00bcd4, transparent:true, opacity:0.6}));
    dome.position.y=0.3; group.add(dome);
    group.userData = {type:'shield',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createTornadoTower(level=1) {
    const group = new THREE.Group();
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const tBody = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({color:0xcccccc, transparent:true, opacity:0.7, side:THREE.DoubleSide}));
    tBody.position.y=0.7; tBody.rotation.x=Math.PI; tBody.name='ring1';
    cg.add(tBody); group.add(cg);
    group.userData = {type:'tornado',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createGravityTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({color:0x111111}));
    base.position.y=0.2; group.add(base);
    const cg = new THREE.Group(); cg.name='crystalGroup';
    const bh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshBasicMaterial({color:0x000000}));
    bh.position.y=1.0; cg.add(bh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 4, 16), new THREE.MeshStandardMaterial({color:0x673ab7, emissive:0x673ab7, emissiveIntensity:1.5}));
    ring.position.y=1.0; ring.rotation.x=Math.PI/2; ring.name='ring1'; cg.add(ring);
    group.add(cg);
    group.userData = {type:'gravity',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createLaserTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.4, 8), new THREE.MeshStandardMaterial({color:0xdddddd, metalness:0.8}));
    base.position.y=0.2; group.add(base);
    const head = new THREE.Group(); head.name='head'; head.position.y=0.6;
    const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshStandardMaterial({color:0xff00ff, transparent:true, opacity:0.8, emissive:0xff00ff, emissiveIntensity:1.0}));
    prism.position.z=0.2; head.add(prism);
    group.add(head);
    group.userData = {type:'laser',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0,recoil:0};
    return group;
}

function createSniperTower(level=1) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({map:TEXTURES.wood});
    const legs1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), mat); legs1.position.y=0.6; legs1.position.x=-0.2; legs1.rotation.z=0.2; group.add(legs1);
    const legs2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2), mat); legs2.position.y=0.6; legs2.position.x=0.2; legs2.rotation.z=-0.2; group.add(legs2);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.6), mat); platform.position.y=1.2; group.add(platform);
    const head = new THREE.Group(); head.name='head'; head.position.y=1.4;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), new THREE.MeshStandardMaterial({color:0x111111}));
    barrel.rotation.x = Math.PI/2; barrel.position.z=0.4; head.add(barrel);
    group.add(head);
    group.userData = {type:'sniper',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0,recoil:0};
    return group;
}

function createGoldmineTower(level=1) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({map:TEXTURES.wood});
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), mat); base.position.y=0.2; group.add(base);
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), new THREE.MeshStandardMaterial({color:0x444444}));
    cart.position.set(0, 0.5, 0.1); group.add(cart);
    const gold = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), new THREE.MeshStandardMaterial({color:0xffd700, emissive:0xffaa00, emissiveIntensity:0.5}));
    gold.position.set(0, 0.6, 0.1); group.add(gold);
    group.userData = {type:'goldmine',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function createQuakeTower(level=1) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.2, 8), new THREE.MeshStandardMaterial({color:0x5d4037, roughness:0.9}));
    base.position.y=0.1; group.add(base);
    const cg = new THREE.Group(); cg.name='crystalGroup'; // used for animation
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), new THREE.MeshStandardMaterial({color:0x222222}));
    hammer.position.y=0.6; cg.add(hammer);
    group.add(cg);
    group.userData = {type:'quake',level,lastShot:0,totalInvested:0,tile:null,stunTimer:0};
    return group;
}

function updateTowerStats(tower) {
    const lvl = tower.userData.level;
    const type = tower.userData.type;
    const rarity = tower.userData.rarity || 'common';
    const rMult = RARITY_INFO[rarity];
    
    let baseRange, baseCD, upgCost;
    if(type==='magic')    { baseRange=3+lvl*0.4;   baseCD=Math.max(400,2000-lvl*160); upgCost=20+lvl*15; }
    else if(type==='crossbow') { baseRange=5+lvl*0.6; baseCD=Math.max(200,1300-lvl*120); upgCost=40+lvl*30; }
    else if(type==='frost')  { baseRange=4+lvl*0.3;   baseCD=Math.max(600,1800-lvl*140); upgCost=50+lvl*25; }
    else if(type==='cannon') { baseRange=3.5+lvl*0.2; baseCD=Math.max(1000,3000-lvl*220); upgCost=70+lvl*40; }
    else if(type==='storm')  { baseRange=4.5+lvl*0.4; baseCD=Math.max(300,1100-lvl*90);  upgCost=80+lvl*50; }
    else if(type==='lightning') { baseRange=4.0+lvl*0.4; baseCD=Math.max(400,1500-lvl*100); upgCost=50+lvl*25; }
    else if(type==='poison')    { baseRange=3.5+lvl*0.3; baseCD=Math.max(500,2000-lvl*150); upgCost=45+lvl*20; }
    else if(type==='flamer')    { baseRange=2.5+lvl*0.2; baseCD=100; upgCost=60+lvl*30; }
    else if(type==='time')      { baseRange=3.5+lvl*0.5; baseCD=Math.max(1000,3000-lvl*200); upgCost=70+lvl*35; }
    else if(type==='buff')      { baseRange=3.0+lvl*0.5; baseCD=2000; upgCost=50+lvl*25; }
    else if(type==='shield')    { baseRange=4.0+lvl*0.4; baseCD=3000; upgCost=80+lvl*40; }
    else if(type==='tornado')   { baseRange=5.0+lvl*0.5; baseCD=Math.max(1500,4000-lvl*250); upgCost=65+lvl*35; }
    else if(type==='gravity')   { baseRange=4.0+lvl*0.4; baseCD=Math.max(2000,6000-lvl*400); upgCost=90+lvl*50; }
    else if(type==='laser')     { baseRange=6.0+lvl*0.5; baseCD=200; upgCost=85+lvl*45; } // fast tick attack
    else if(type==='sniper')    { baseRange=15.0; baseCD=Math.max(2500,6000-lvl*350); upgCost=100+lvl*60; }
    else if(type==='goldmine')  { baseRange=0; baseCD=5000; upgCost=150+lvl*80; } // ticks every 5s to give gold
    else if(type==='quake')     { baseRange=2.5+lvl*0.3; baseCD=Math.max(1500,4000-lvl*150); upgCost=75+lvl*40; }
    else { baseRange=3+lvl*0.4; baseCD=2000; upgCost=20+lvl*15; }

    tower.userData.range = baseRange;
    tower.userData.cooldown = baseCD / rMult.speedMult;
    tower.userData.upgradeCost = Math.floor(upgCost * rMult.costMult);
    tower.userData.dmgMult = rMult.dmgMult;

    if(tower===selectedTower) syncTowerPanel(tower);
}

// ===================================================
// ENEMY MODELS
// ===================================================
function createGoblin() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({map:createNoiseTexture('#32cd32',64,0.4,'spots')});
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.45,0.3),mat); body.position.y=0.22;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.25,0.25),mat); head.position.y=0.55;
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.15,4),mat); earL.position.set(-0.15,0.6,0); earL.rotation.z=0.5;
    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.15,4),mat); earR.position.set(0.15,0.6,0); earR.rotation.z=-0.5;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.25,0.1),mat); armL.position.set(-0.2,0.25,0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.25,0.1),mat); armR.position.set(0.2,0.25,0);
    group.add(body,head,earL,earR,armL,armR); return group;
}
function createScout() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({map:createNoiseTexture('#4cff00',64,0.2)});
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.4,0.2),mat); body.position.y=0.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),mat); head.position.y=0.45;
    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.05,0.4),new THREE.MeshStandardMaterial({color:0xff0000}));
    scarf.position.set(0,0.4,-0.2); scarf.rotation.x=0.2;
    group.add(body,head,scarf); return group;
}
function createOgre() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({map:createNoiseTexture('#5d4037',128,0.5,'cracks')});
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.9,0.7),mat); body.position.y=0.45;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),mat); head.position.set(0,0.85,0.1);
    const hunch = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,8),mat); hunch.position.set(0,0.7,-0.2); hunch.scale.set(1,0.6,1);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.6,0.15),mat); armL.position.set(-0.4,0.45,0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15,0.6,0.15),mat); armR.position.set(0.4,0.45,0);
    group.add(body,head,hunch,armL,armR); group.scale.set(1.2,1.2,1.2); return group;
}
function createBoss() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({map:createNoiseTexture('#222222',128,0.6),metalness:0.8,roughness:0.2});
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.3,0.8),mat); body.position.y=0.65;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.4),mat); head.position.set(0,1.4,0);
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2,1),new THREE.MeshStandardMaterial({color:0xff0000,emissive:0xff0000,emissiveIntensity:2.0}));
    heart.position.set(0,0.8,0.3); heart.name='heart';
    for(let i=0;i<6;i++){
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1,0.4,4),new THREE.MeshStandardMaterial({color:0x444444,emissive:0xff00ff,emissiveIntensity:0.5}));
        spike.position.set((i%2===0?0.4:-0.4), 0.5 + Math.floor(i/2)*0.4, -0.45);
        spike.rotation.x = -Math.PI/4; spike.rotation.z = (i%2===0?0.5:-0.5);
        group.add(spike);
    }
    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.5,16,16),new THREE.MeshBasicMaterial({color:0xff00ff,transparent:true,opacity:0.1,wireframe:true}));
    aura.name='aura'; group.add(body,head,heart,aura); group.scale.set(1.5,1.5,1.5); return group;
}

// ===================================================
// GAME UI
// ===================================================
function updateUI() {
    document.getElementById('gold').innerText = gold;
    document.getElementById('health').innerText = health;
    document.getElementById('wave').innerText = wave;
    document.getElementById('enemies-left').innerText = isWaveActive ? (waveEnemiesToSpawn-waveEnemiesSpawned+enemies.length) : 0;
    if(health<=0) {
        health=0; isPaused=true;
        const gemsEarned = wave * 10;
        saveGems(getGems() + gemsEarned);
        document.getElementById('gems-earned').innerText = gemsEarned;
        document.getElementById('game-over-screen').style.display = 'block';
        document.getElementById('final-wave').innerText = wave;
    }
    if(selectedTower) syncTowerPanel(selectedTower);
    if(baseHealthBar) {
        const fg = baseHealthBar.getObjectByName('fg');
        const hpPerc = isGodMode ? 1.0 : Math.min(1.0, health/100); 
        fg.scale.x=Math.max(0.0001,hpPerc);
        fg.position.x=(hpPerc-1)*0.75;
        if(isGodMode) fg.material.color.setHex(0xffd700);
        else fg.material.color.setHex(hpPerc>0.4?0x00ff00:(hpPerc>0.2?0xffff00:0xff0000));
    }
}
function syncTowerPanel(tower) {
    towerLvlEl.innerText = tower.userData.level;
    towerRangeEl.innerText = tower.userData.range.toFixed(1);
    towerSpeedEl.innerText = (tower.userData.cooldown/1000).toFixed(2)+'s';
    sellValueEl.innerText = Math.floor(tower.userData.totalInvested*0.9);
    upgradeBtn.innerText = tower.userData.level>=10 ? 'MAX' : `Upgrade (${tower.userData.upgradeCost}g)`;
    upgradeBtn.disabled = gold<tower.userData.upgradeCost||tower.userData.level>=10;
    rangeIndicator.position.set(tower.position.x,0.16,tower.position.z);
    rangeIndicator.scale.set(tower.userData.range,tower.userData.range,1);
    rangeIndicator.visible = true;
    
    // Super Ability Button - Enabled for ALL towers
    const supContainer = document.getElementById('super-ability-container');
    supContainer.style.display = 'block';
    updateSuperButton(tower);

    // Add Max Out button if not present
    let debugBtn = document.getElementById('debug-max-btn');
    if(!debugBtn) {
        debugBtn = document.createElement('button');
        debugBtn.id = 'debug-max-btn';
        debugBtn.innerText = '✨ Max out Tower';
        debugBtn.style.marginTop = '10px';
        debugBtn.style.width = '100%';
        debugBtn.style.padding = '8px';
        debugBtn.style.background = 'linear-gradient(45deg, #ffd700, #ff8c00)';
        debugBtn.style.border = 'none';
        debugBtn.style.borderRadius = '5px';
        debugBtn.style.color = 'white';
        debugBtn.style.fontWeight = 'bold';
        debugBtn.style.cursor = 'pointer';
        debugBtn.addEventListener('click', debugMaxTower);
        towerPanel.appendChild(debugBtn);
    }
}

function updateSuperButton(tower) {
    const btn = document.getElementById('super-button');
    const bar = document.getElementById('super-cooldown-bar');
    const now = Date.now();
    const elapsed = now - (tower.userData.lastSuperShot || 0);
    const cd = 18000;
    const perc = Math.min(100, (elapsed / cd) * 100);
    bar.style.width = perc + '%';
    btn.disabled = perc < 100;
    btn.onclick = () => { triggerSuperAbility(tower); syncTowerPanel(tower); };
}

function setBuildType(cardId) {
    selectedBuildType = cardId;
    document.querySelectorAll('.build-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.card===cardId));
    const {type} = parseCardId(cardId);
    
    // Dynamic Ghost Update
    while(ghostGroup.children.length>0) ghostGroup.remove(ghostGroup.children[0]);
    let nt;
    if(type==='magic')          nt=createMagicalTower();
    else if(type==='crossbow')  nt=createCrossbowTower();
    else if(type==='frost')     nt=createFrostTower();
    else if(type==='cannon')    nt=createCannonTower();
    else if(type==='storm')     nt=createStormTower();
    else if(type==='lightning') nt=createLightningTower();
    else if(type==='poison')    nt=createPoisonTower();
    else if(type==='flamer')    nt=createFlamerTower();
    else if(type==='time')      nt=createTimeTower();
    else if(type==='buff')      nt=createBuffTower();
    else if(type==='shield')    nt=createShieldTower();
    else if(type==='tornado')   nt=createTornadoTower();
    else if(type==='gravity')   nt=createGravityTower();
    else if(type==='laser')     nt=createLaserTower();
    else if(type==='sniper')    nt=createSniperTower();
    else if(type==='goldmine')  nt=createGoldmineTower();
    else if(type==='quake')     nt=createQuakeTower();

    if(nt) {
        nt.traverse(node => {
            if(node.isMesh) {
                node.material = node.material.clone();
                node.material.transparent = true;
                node.material.opacity = 0.38;
                node.material.depthWrite = false;
            }
        });
        ghostGroup.add(nt);
    }

    const info = TOWER_INFO[type];
    if(towerCostHint) towerCostHint.innerText = `${info.emoji} ${info.name}: ${getCardCost(cardId)}g`;
    if(ghostRing.visible) {
        const r = getTowerRangeForType(type);
        ghostRing.scale.set(r, r, 1);
    }
}

function buildBuildMenu() {
    const menu = document.getElementById('build-menu');
    menu.innerHTML = '';
    const loadout = getLoadout();
    loadout.forEach((cardId,i) => {
        if(!cardId) return;
        const {type, rarity} = parseCardId(cardId);
        const info = TOWER_INFO[type];
        const btn = document.createElement('button');
        btn.className = 'build-btn'+(i===0?' active':'');
        btn.id = 'build-'+cardId.replace('_','-');
        btn.dataset.card = cardId;
        btn.innerHTML = `<span class="btn-emoji">${info.emoji}</span><span class="btn-name">${info.name}</span><span class="btn-cost">${getCardCost(cardId)}g</span><div style="font-size:0.6rem;color:#888" class="rarity-${rarity}">${RARITY_INFO[rarity].name}</div>`;
        btn.addEventListener('click', ()=>setBuildType(cardId));
        menu.appendChild(btn);
    });
    if(loadout.length>0 && loadout[0]) setBuildType(loadout[0]);
}

upgradeBtn.addEventListener('click', () => {
    if(selectedTower&&gold>=selectedTower.userData.upgradeCost&&selectedTower.userData.level<10){
        const cost = selectedTower.userData.upgradeCost;
        gold-=cost; selectedTower.userData.totalInvested+=cost;
        selectedTower.userData.level++; 
        progressQuest('gold', cost);
        updateTowerStats(selectedTower); updateUI();
    }
});
sellBtn.addEventListener('click', () => {
    if(selectedTower){
        gold+=Math.floor(selectedTower.userData.totalInvested*0.9);
        selectedTower.userData.tile.userData.occupied=false;
        world.remove(selectedTower); towers.splice(towers.indexOf(selectedTower),1);
        selectedTower=null; towerPanel.style.display='none'; rangeIndicator.visible=false; updateUI();
    }
});
closeBtn.addEventListener('click',()=>{selectedTower=null;towerPanel.style.display='none';rangeIndicator.visible=false;});

function restartGame() {
    enemies.forEach(e=>world.remove(e)); enemies.length=0;
    towers.forEach(t=>{t.userData.tile.userData.occupied=false;world.remove(t);}); towers.length=0;
    projectiles.forEach(p=>world.remove(p)); projectiles.length=0;
    health=100; gold=START_GOLD; wave=1; isWaveActive=false; waveEnemiesSpawned=0;
    manualTarget=null; isPaused=false;
    document.getElementById('game-over-screen').style.display='none';
    document.getElementById('pause-screen').style.display='none';
    selectedTower=null; towerPanel.style.display='none'; rangeIndicator.visible=false;
    buildBuildMenu(); updateUI();
}
function goToMenu() {
    restartGame(); gameStarted=false;
    const screen = document.getElementById('start-screen');
    screen.style.display='flex'; screen.classList.remove('fade-out');
    updateGemsDisplay(); renderLoadout();
}

document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('menu-btn').addEventListener('click', goToMenu);

window.addEventListener('keydown',(e)=>{
    const loadout = getLoadout();
    if(e.key==='1'&&loadout[0]) setBuildType(loadout[0]);
    if(e.key==='2'&&loadout[1]) setBuildType(loadout[1]);
    if(e.key==='3'&&loadout[2]) setBuildType(loadout[2]);
    if(e.key==='4'&&loadout[3]) setBuildType(loadout[3]);
    if(e.key.toLowerCase()==='u'){isPaused=!isPaused;document.getElementById('pause-screen').style.display=isPaused?'block':'none';}
});

// --- GHOST HOVER ---
function onMouseMove(event) {
    if(!gameStarted || isPaused) { ghostGroup.visible=false; ghostRing.visible=false; return; }
    if(towerPanel.style.display==='block') { ghostGroup.visible=false; ghostRing.visible=false; return; }
    mouse.x=(event.clientX/window.innerWidth)*2-1;
    mouse.y=-(event.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const intersects=raycaster.intersectObjects(world.children,true);
    let foundTile=false;
    if(intersects.length>0){
        let tile=intersects[0].object; while(tile&&!tile.userData.type)tile=tile.parent;
        if(tile&&tile.userData.type==='grass'){
            foundTile=true;
            const counts=towers.reduce((acc,t)=>{acc[t.userData.type]=(acc[t.userData.type]||0)+1;return acc;},{});
            const {type, rarity} = parseCardId(selectedBuildType);
            const cost = getCardCost(selectedBuildType);
            const limit = getCardLimit(selectedBuildType);
            const isValid=!tile.userData.occupied&&gold>=cost&&(counts[type]||0)<limit;
            ghostGroup.position.set(tile.userData.tileX, 0.1, tile.userData.tileZ);
            ghostGroup.visible=true;
            const r=getTowerRangeForType(type);
            ghostRing.position.set(tile.userData.tileX, 0.17, tile.userData.tileZ);
            ghostRing.scale.set(r,r,1);
            ghostRing.visible=true;
            setGhostColor(isValid);
        }
    }
    if(!foundTile){ghostGroup.visible=false;ghostRing.visible=false;}
}
window.addEventListener('mousemove', onMouseMove);

function onMouseClick(event) {
    sounds.init();
    if(event.target!==renderer.domElement) return;
    mouse.x=(event.clientX/window.innerWidth)*2-1;
    mouse.y=-(event.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const enemyIntersects=raycaster.intersectObjects(enemies,true);
    if(enemyIntersects.length>0){let p=enemyIntersects[0].object;while(p&&!enemies.includes(p))p=p.parent;if(p){manualTarget=p;focusRing.visible=true;return;}}
    const intersects=raycaster.intersectObjects(world.children,true);
    if(intersects.length>0){
        let t=intersects[0].object; while(t&&!towers.includes(t))t=t.parent;
        if(t){selectedTower=t;syncTowerPanel(t);towerPanel.style.display='block';ghostGroup.visible=false;ghostRing.visible=false;return;}
        let tile=intersects[0].object; while(tile&&!tile.userData.type)tile=tile.parent;
        if(tile&&tile.userData.type==='grass'&&!tile.userData.occupied){
            const counts=towers.reduce((acc,t)=>{acc[t.userData.type]=(acc[t.userData.type]||0)+1;return acc;},{});
            const {type, rarity} = parseCardId(selectedBuildType);
            const cost = getCardCost(selectedBuildType);
            const limit = getCardLimit(selectedBuildType);
            if(gold>=cost&&(counts[type]||0)<limit){
                gold-=cost;
                let nt;
                if(type==='magic')          nt=createMagicalTower();
                else if(type==='crossbow')  nt=createCrossbowTower();
                else if(type==='frost')     nt=createFrostTower();
                else if(type==='cannon')    nt=createCannonTower();
                else if(type==='storm')     nt=createStormTower();
                else if(type==='lightning') nt=createLightningTower();
                else if(type==='poison')    nt=createPoisonTower();
                else if(type==='flamer')    nt=createFlamerTower();
                else if(type==='time')      nt=createTimeTower();
                else if(type==='buff')      nt=createBuffTower();
                else if(type==='shield')    nt=createShieldTower();
                else if(type==='tornado')   nt=createTornadoTower();
                else if(type==='gravity')   nt=createGravityTower();
                else if(type==='laser')     nt=createLaserTower();
                else if(type==='sniper')    nt=createSniperTower();
                else if(type==='goldmine')  nt=createGoldmineTower();
                else if(type==='quake')     nt=createQuakeTower();
                
                nt.userData.type = type;
                nt.userData.rarity = rarity;
                nt.userData.totalInvested = cost;
                nt.position.set(tile.userData.tileX,0.1,tile.userData.tileZ);
                nt.userData.tile=tile; 
                updateTowerStats(nt);
                world.add(nt); towers.push(nt); tile.userData.occupied=true;
                ghostGroup.visible=false; ghostRing.visible=false;
                updateUI();
            }
        }
    }
}
window.addEventListener('mousedown',onMouseClick);

// ===================================================
// BUILD WORLD
// ===================================================
for(let x=-GRID_SIZE/2;x<GRID_SIZE/2;x++){
    for(let z=-GRID_SIZE/2;z<GRID_SIZE/2;z++){
        const isP=PATH.some(p=>p.x===x&&p.z===z);
        world.add(isP?createStoneTile(x,z):createGrassTile(x,z));
    }
}

// ===================================================
// ENEMIES
// ===================================================
function spawnEnemy(typeOverride=null) {
    let type=typeOverride;
    if(!type){
        let r=Math.random();
        if(wave<3)type='goblin';
        else if(wave<6)type=r<0.7?'goblin':'scout';
        else type=r<0.5?'goblin':(r<0.8?'scout':'ogre');
    }
    let g;
    if(type==='scout')g=createScout();
    else if(type==='ogre')g=createOgre();
    else if(type==='boss'){g=createBoss();g.userData.isBoss=true;g.userData.lastStun=Date.now();}
    else g=createGoblin();
    let baseHp=type==='scout'?6:(type==='ogre'?40:(type==='boss'?600:10));
    let reward=type==='scout'?2:(type==='ogre'?12:(type==='boss'?50:3));
    let speed=type==='scout'?0.04:(type==='ogre'?0.01:(type==='boss'?0.004:0.018));
    let speedScaling = type==='boss' ? 0.0006 : 0.0012;
    
    // Scaling Logic
    let finalHp;
    if(type === 'boss') {
        // Boss becomes 4x stronger every 10 waves (600 at wave 10, 2400 at wave 20...)
        const bossOrder = Math.max(0, (wave / 10) - 1);
        finalHp = 600 * Math.pow(4, bossOrder);
    } else {
        // Normal enemies scale moderately (e.g. +4 hp per wave)
        finalHp = baseHp + (wave * 4);
    }
    
    g.userData={type,pathIdx:0,speed:speed+wave*speedScaling,hp:finalHp,reward,slowTimer:0,originalColors:[]};
    g.traverse(c=>{if(c.isMesh&&c.material&&c.material.color)g.userData.originalColors.push({m:c.material,c:c.material.color.getHex()});});
    g.position.set(PATH[0].x,0,PATH[0].z);
    world.add(g); enemies.push(g); waveEnemiesSpawned++;
}

function createPoisonCloud(pos, rarity='common') {
    const cloud = new THREE.Group();
    cloud.position.copy(pos);
    const radius = rarity==='mythic'||rarity==='divine' ? 1.5 : 0.8;
    for(let i=0; i<8; i++) {
        const mat = new THREE.MeshStandardMaterial({color:0x32cd32, transparent:true, opacity:0.6});
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.2+Math.random()*0.2), mat);
        blob.position.set((Math.random()-0.5)*radius, 0.2+Math.random()*0.4, (Math.random()-0.5)*radius);
        blob.userData = { drift: new THREE.Vector3((Math.random()-0.5)*0.01, 0.01+Math.random()*0.02, (Math.random()-0.5)*0.01) };
        cloud.add(blob);
    }
    world.add(cloud);
    cloud.userData = { life: 1500, isVisualOnly: true };
    projectiles.push(cloud);
}

// ===================================================
// PROJECTILES
// ===================================================
function shoot(tower,target, offsetTarget=null, isSuper=false) {
    sounds.init(); sounds.shoot();
    const type=tower.userData.type;
    if(type==='buff' || type==='shield' || type==='time' || type==='goldmine' || type==='quake') {
        tower.userData.lastShot=Date.now();
        return;
    }

    let geo;
    if(type==='cannon')      geo=new THREE.SphereGeometry(0.15);
    else if(type==='crossbow')geo=new THREE.BoxGeometry(0.05,0.05,0.4);
    else if(type==='storm')  geo=new THREE.SphereGeometry(0.12);
    else if(type==='tornado')geo=new THREE.ConeGeometry(0.2,0.5,8);
    else if(type==='gravity')geo=new THREE.IcosahedronGeometry(0.25);
    else if(type==='sniper')  geo=new THREE.BoxGeometry(0.02,0.02,0.8);
    else                      geo=new THREE.SphereGeometry(0.08); // fallback

    const matColor = type==='frost'?0x00ccff:(type==='cannon'?0x222222:(type==='storm'?0xffff00:(type==='poison'?0x32cd32:(type==='flamer'?0xff6b35:(type==='tornado'?0xcccccc:(type==='gravity'?0x4a148c:(type==='laser'?0xff00ff:(type==='sniper'?0xffea00:0xffff00))))))));
    
    let p;
    if(type === 'poison') {
        p = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({color:matColor, transparent:true, opacity:0.8});
        for(let i=0; i<4; i++) {
            const bub = new THREE.Mesh(new THREE.SphereGeometry(0.12+Math.random()*0.05, 6, 6), mat);
            bub.position.set((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2);
            p.add(bub);
        }
    } else if(type === 'magic') {
        p = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({color:matColor, emissive:matColor, emissiveIntensity:1.5});
        p.add(new THREE.Mesh(new THREE.SphereGeometry(0.1), mat));
        for(let i=1; i<=4; i++) {
            const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1 - i*0.015), new THREE.MeshStandardMaterial({color:0x00ffff, transparent:true, opacity: 1.0 - i*0.2}));
            tail.position.z = 0.12 * i; // negative z because object looks AT target
            p.add(tail);
        }
    } else if(type === 'laser') {
        // Laser is dealt specially below
    } else if(type === 'flamer' && isSuper) {
        p = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({color:0xff3300, transparent:true, opacity:0.6});
        for(let i=0; i<30; i++) {
            const blob = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random()*0.4), mat);
            blob.position.set((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, i * 0.4);
            p.add(blob);
        }
        enemies.forEach(ae => { if(ae.position.distanceTo(tower.position) < tower.userData.range * 2) ae.userData.hp -= 80 * (tower.userData.dmgMult || 1); });
    } else {
        p=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:matColor,emissive:type==='storm'?0xffee00:0,emissiveIntensity:type==='storm'?1.5:0}));
        if(type==='tornado') p.rotation.x = Math.PI/2;
    }

    const head=tower.getObjectByName('head');
    const startPos=new THREE.Vector3();
    if(head)head.getWorldPosition(startPos);
    else{startPos.copy(tower.position);startPos.y+=1.0;}
    
    if(type === 'lightning') {
        const head=tower.getObjectByName('head');
        const startPos=new THREE.Vector3();
        if(head)head.getWorldPosition(startPos); else startPos.copy(tower.position).y+=1.0;
        
        createLightningStrike(startPos, target.position, 0x00ffff, 200);
        
        const dMult = tower.userData.dmgMult || 1;
        const dmg = 25;
        let chained = [target];
        target.userData.hp -= dmg * dMult;
        let current = target;
        let maxChains = (tower.userData.rarity==='mythic'||tower.userData.rarity==='divine') ? 5 : 2;
        for(let c=0; c<maxChains; c++) {
            let next = enemies.find(e => !chained.includes(e) && e.position.distanceTo(current.position) < 2.5);
            if(next) { next.userData.hp -= (dmg*0.7)*dMult; chained.push(next); current = next; }
            else break;
        }
        
        // Splash
        enemies.forEach(ae => { if(ae !== target && ae.position.distanceTo(target.position) < 1.0) ae.userData.hp -= 10 * dMult; });
        
        tower.userData.lastShot=Date.now();
        return;
    }

    if(type === 'laser') {
        const dist = startPos.distanceTo(target.position);
        const geoY = new THREE.CylinderGeometry(0.04, 0.04, 1, 8);
        geoY.translate(0, 0.5, 0); 
        const lp = new THREE.Mesh(geoY, new THREE.MeshBasicMaterial({color:0xff00ff, transparent:true, opacity:0.8}));
        lp.rotation.x = Math.PI/2;
        lp.position.copy(startPos);
        lp.scale.set(1, dist, 1);
        lp.lookAt(target.position);
        world.add(lp);
        lp.userData={target:target, towerHead:head || tower, life: tower.userData.cooldown, isVisualOnly:true, type:'laser'};
        projectiles.push(lp);
        target.userData.hp -= 12 * (tower.userData.dmgMult || 1);
        tower.userData.lastShot=Date.now();
        return;
    }

    if(type === 'sniper' && tower.userData.piercingMode) {
        const dir = new THREE.Vector3().subVectors(target.position, startPos).normalize();
        createLightningStrike(startPos, startPos.clone().add(dir.multiplyScalar(20)), 0xffea00, 400);
        enemies.forEach(ae => {
            const toEnemy = new THREE.Vector3().subVectors(ae.position, startPos);
            const projection = toEnemy.dot(dir);
            if(projection > 0 && projection < 20) {
                const nearestPoint = dir.clone().multiplyScalar(projection);
                if(toEnemy.distanceTo(nearestPoint) < 0.5) ae.userData.hp -= 150 * (tower.userData.dmgMult || 1);
            }
        });
        tower.userData.lastShot = Date.now();
        return;
    }

    p.position.copy(startPos);
    if(offsetTarget) p.position.add(offsetTarget);
    const projSpeed = type==='cannon'?0.35 : (type==='tornado'?0.15 : (type==='sniper'?1.2 : 0.5));
    p.userData={target,speed:projSpeed,type,dmgMult:tower.userData.dmgMult,rarity:tower.userData.rarity};
    if(type==='crossbow'||type==='cannon'||type==='sniper')p.lookAt(target.position);
    world.add(p); projectiles.push(p);
    tower.userData.lastShot=Date.now();
    if(tower.userData.recoil!==undefined)tower.userData.recoil=0.25;
}

// ===================================================
// START SCREEN LOGIC
// ===================================================
function updateGemsDisplay() {
    document.getElementById('gems-count').textContent = getGems();
}

function rollChest(chestType) {
    const table = CHEST_RARITY[chestType];
    const total = table.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    let chosenRarity = table[0].r;
    for(const entry of table) { 
        r -= entry.w; 
        if(r <= 0) { 
            chosenRarity = entry.r; 
            break; 
        } 
    }
    
    const types = Object.keys(TOWER_INFO);
    const chosenType = types[Math.floor(Math.random() * types.length)];
    return `${chosenType}_${chosenRarity}`;
}

function buyChest(chestType) {
    const cost=CHEST_COSTS[chestType];
    const gems=getGems();
    if(gems<cost){
        const btn=document.querySelector(`[data-chest="${chestType}"]`);
        btn.classList.add('shake');
        setTimeout(()=>btn.classList.remove('shake'),500);
        return;
    }
    saveGems(gems-cost);
    updateGemsDisplay();
    const collection=getCollection();
    let towerCard=rollChest(chestType);

    // Duplicate Protection (Reroll)
    const types = Object.keys(TOWER_INFO);
    const rarities = Object.keys(RARITY_INFO);
    const totalCombos = types.length * rarities.length;
    
    if(collection.length < totalCombos) {
        let attempts = 0;
        while(collection.includes(towerCard) && attempts < 20) {
            towerCard = rollChest(chestType);
            attempts++;
        }
    }

    const isDuplicate=collection.includes(towerCard);
    if(!isDuplicate){collection.push(towerCard);saveCollection(collection);}
    else{saveGems(getGems()+25);updateGemsDisplay();}

    const {type, rarity} = parseCardId(towerCard);
    const info=TOWER_INFO[type];
    const rInfo=RARITY_INFO[rarity];
    const chestEmojis={wooden:'🟫',magic:'📦✨',epic:'🔮'};
    
    const modal=document.getElementById('chest-modal');
    const card=document.getElementById('chest-reveal-card');
    const glow=document.getElementById('chest-reveal-glow');
    const flash=document.getElementById('reveal-flash');
    
    // Initial State: Hidden
    modal.style.display='flex';
    document.getElementById('chest-open-emoji').textContent=chestEmojis[chestType];
    document.getElementById('chest-open-rarity').style.visibility = 'hidden';
    document.getElementById('chest-open-tower').style.visibility = 'hidden';
    document.getElementById('chest-open-sub').style.visibility = 'hidden';
    card.className = 'chest-modal-content';
    glow.className = 'reveal-card-glow';

    // Suspense Delay
    const delay = rarity==='common' ? 200 : (rarity==='uncommon'?500 : (rarity==='rare'?1000 : 2000));
    
    setTimeout(() => {
        // The Reveal!
        flash.classList.add('flash-active');
        setTimeout(() => flash.classList.remove('flash-active'), 800);
        
        sounds.reveal(rarity);
        document.getElementById('chest-open-rarity').style.visibility = 'visible';
        document.getElementById('chest-open-tower').style.visibility = 'visible';
        document.getElementById('chest-open-sub').style.visibility = 'visible';
        
        document.getElementById('chest-open-rarity').innerHTML=`<span class="card-rarity rarity-${rarity}">${rInfo.name.toUpperCase()}</span>`;
        document.getElementById('chest-open-tower').innerHTML=`<span>${info.emoji}</span><span>${info.name}</span>`;
        document.getElementById('chest-open-sub').textContent=isDuplicate?'Already owned! +25 💎 refunded':'Added to your collection!';
        
        card.className = 'chest-modal-content reveal-' + rarity;
        glow.className = 'reveal-card-glow glow-' + rarity;

        if(rarity==='divine' || rarity==='mythic') {
            document.body.classList.add('screen-shake');
            setTimeout(()=>document.body.classList.remove('screen-shake'), rarity==='divine'?1200:600);
        }

        const pCount = rarity==='divine'?100 : (rarity==='mythic'?60 : (rarity==='legendary'?40 : 20));
        spawnChestParticles(pCount, rarity==='divine', {common:0xcccccc, uncommon:0x81c784, rare:0x64b5f6, epic:0xce93d8, legendary:0xffd700, mythic:0xff4444}[rarity]);

    }, delay);

    card.style.animation='none';
    requestAnimationFrame(()=>{card.style.animation='';});
}

function spawnChestParticles(count, rainbow, color=0xffffff) {
    const container = document.getElementById('particles');
    const colors = rainbow ? ['#ff00ff', '#00ffff', '#ffff00', '#ff0000', '#ffffff'] : [color];
    
    for(let i=0; i<count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const c = colors[Math.floor(Math.random()*colors.length)];
        const size = Math.random()*10+4;
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 200;
        
        p.style.cssText = `
            width:${size}px; height:${size}px; 
            left:50%; top:50%; 
            background:${c}; opacity:1;
            box-shadow: 0 0 15px ${c};
            position: absolute;
            transform: translate(-50%, -50%);
            animation: particleBurst 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        `;
        
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        p.style.setProperty('--dx', `${dx}px`);
        p.style.setProperty('--dy', `${dy}px`);
        
        container.appendChild(p);
        setTimeout(() => p.remove(), 1200);
    }
}

function debugMaxTower() {
    if(!selectedTower) return;
    selectedTower.userData.level = 10;
    selectedTower.userData.rarity = 'legendary';
    updateTowerStats(selectedTower);
    syncTowerPanel(selectedTower);
}

function renderLoadout() {
    const collection=[...new Set(getCollection())];
    const loadout=getLoadout();
    const slotsEl=document.getElementById('loadout-slots'); slotsEl.innerHTML='';
    for(let i=0;i<4;i++){
        const towerCard=loadout[i];
        const slot=document.createElement('div');
        slot.className='loadout-slot'+(towerCard?' filled':'');
        if(towerCard){
            const {type, rarity} = parseCardId(towerCard);
            const info=TOWER_INFO[type];
            slot.innerHTML=`<span class="slot-tower-emoji">${info.emoji}</span><span class="slot-tower-name">${info.name}</span><div style="margin-top:2px;" class="card-rarity rarity-${rarity}">${RARITY_INFO[rarity].name}</div>`;
            const rb=document.createElement('button');rb.className='remove-slot-btn';rb.textContent='×';
            rb.addEventListener('click',(e)=>{e.stopPropagation();const l=[...loadout];l.splice(i,1);saveLoadout(l);renderLoadout();});
            slot.appendChild(rb);
            slot.classList.add(`border-${rarity}`);
        } else {
            slot.innerHTML=`<span class="slot-label">Slot ${i+1}</span>`;
        }
        slotsEl.appendChild(slot);
    }
    const grid=document.getElementById('collection-grid'); grid.innerHTML='';
    if(collection.length===0){grid.innerHTML='<p class="empty-collection">No towers yet — buy some chests! 🎁</p>';return;}
    collection.forEach(card=>{
        const {type, rarity} = parseCardId(card);
        const info=TOWER_INFO[type];
        const rInfo=RARITY_INFO[rarity];
        const inLoadout=loadout.includes(card);
        const cardEl=document.createElement('div');
        cardEl.className=`collection-card border-${rarity}${inLoadout?' in-loadout':''}`;
        cardEl.innerHTML=`<span class="card-emoji">${info.emoji}</span><span class="card-name">${info.name}</span><span style="margin:2px 0;" class="card-rarity rarity-${rarity}">${rInfo.name}</span><span class="card-cost">${getCardCost(card)}g</span>${inLoadout?'<span class="in-loadout-badge">✓ Loadout</span>':''}`;
        if(!inLoadout){
            cardEl.addEventListener('click',()=>{
                const current=getLoadout();
                if(current.length<4&&!current.includes(card)){saveLoadout([...current,card]);renderLoadout();}
            });
        }
        grid.appendChild(cardEl);
    });
}

function startGame() {
    sounds.init();
    sounds.startBGM();
    const screen=document.getElementById('start-screen');
    screen.classList.add('fade-out');
    setTimeout(()=>{
        screen.style.display='none';
        gameStarted=true;
        buildBuildMenu();
        updateUI();
    },800);
}

function initStartScreen() {
    // Particles
    const container=document.getElementById('particles');
    const colors=['#00e5ff','#7b2fff','#00ff88','#ff6b35','#ffd700'];
    for(let i=0;i<50;i++){
        const p=document.createElement('div');
        p.className='particle';
        const size=Math.random()*6+2;
        p.style.cssText=`width:${size}px;height:${size}px;left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${Math.random()*8+5}s;animation-delay:${Math.random()*8}s;box-shadow:0 0 ${size*2}px currentColor;`;
        container.appendChild(p);
    }
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
            if(btn.dataset.tab==='loadout')renderLoadout();
        });
    });
    // Buttons
    const startBtn = document.getElementById('start-btn') || document.getElementById('play-btn');
    if(startBtn) startBtn.addEventListener('click', startGame);
    document.querySelectorAll('.buy-chest-btn').forEach(btn=>btn.addEventListener('click',()=>{
        sounds.init();
        buyChest(btn.dataset.chest);
    }));
    document.getElementById('chest-close-btn').addEventListener('click',()=>{
        document.getElementById('chest-modal').style.display='none';
        updateGemsDisplay();
    });
    updateGemsDisplay();

    // Cheat Code Listener
    const cheatInput = document.getElementById('cheat-code-input');
    const cheatBtn = document.getElementById('activate-cheat-btn');
    const cheatStatus = document.getElementById('cheat-status');

    if(cheatBtn && cheatInput) {
        cheatBtn.addEventListener('click', () => {
            const code = cheatInput.value.trim();
            if(code === '1234') {
                activateGodMode();
                cheatStatus.style.color = '#00e5ff';
                cheatStatus.textContent = '✨ GOD MODE ACTIVATED ✨';
                cheatInput.value = '';
                sounds.reveal('divine');
            } else {
                cheatStatus.style.color = '#ff4444';
                cheatStatus.textContent = 'Invalid Code';
                setTimeout(() => { cheatStatus.textContent = ''; }, 2000);
            }
        });
    }

    // Share Game Listener
    const shareBtn = document.getElementById('share-game-btn');
    if(shareBtn) {
        shareBtn.addEventListener('click', shareGame);
    }
}

function shareGame() {
    const status = document.getElementById('share-status');
    const isHosted = window.location.protocol.startsWith('http');
    
    if (isHosted) {
        // Copy current URL if hosted
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            status.style.color = '#00e5ff';
            status.textContent = 'Link copied to clipboard! 📋';
            setTimeout(() => { status.textContent = ''; }, 3000);
        }).catch(() => {
            status.style.color = '#ff4444';
            status.textContent = 'Failed to copy. Try manual copy!';
        });
    } else {
        // Local file - instructions
        status.style.color = '#ffd700';
        status.textContent = 'Zip this folder and send it to your friends! 📦';
        alert("Since you are playing locally, you can share the game by zipping the entire folder and sending it to your friends.\n\nTip: Host it on GitHub Pages for a free link!");
        setTimeout(() => { status.textContent = ''; }, 10000);
    }
}

function activateGodMode() {
    isGodMode = true;
    health = 999999;
    gold = 999999;
    saveGems(getGems() + 1000000);
    updateGemsDisplay();
    updateUI();
    
    // Visual feedback on the HUD
    const healthEl = document.getElementById('health');
    if(healthEl) {
        healthEl.style.color = '#ffd700';
        healthEl.style.fontWeight = '900';
        healthEl.style.textShadow = '0 0 10px rgba(255,215,0,0.5)';
    }
}
initStartScreen();

// ===================================================
// MAIN GAME LOOP
// ===================================================
let lastTime=0, spawnAcc=0;
function animate(time) {
    const dt=time-lastTime; lastTime=time;
    controls.update();
    updateWeather(dt);
    sounds.updateWeatherSounds(weatherType);
    if(baseHealthBar)baseHealthBar.lookAt(camera.position);

    if(!gameStarted){renderer.render(scene,camera);requestAnimationFrame(animate);return;}

    if(!isPaused) {
        if(isWaveActive){
            spawnAcc+=dt;
            if(wave%10===0&&waveEnemiesSpawned===0){spawnEnemy('boss');waveEnemiesToSpawn=5;}
            if(waveEnemiesSpawned<waveEnemiesToSpawn&&spawnAcc>1200){
                for(let i=0;i<3;i++)if(waveEnemiesSpawned<waveEnemiesToSpawn)spawnEnemy();
                spawnAcc=0;
            }
            if(waveEnemiesSpawned>=waveEnemiesToSpawn&&enemies.length===0){
                isWaveActive=false; gold+=20+wave*5; wave++; updateUI();
            }
        } else if(Date.now()%5000<50){
            isWaveActive=true; 
            waveEnemiesToSpawn=ENEMIES_PER_WAVE(wave); 
            waveEnemiesSpawned=0;
            gold += 30;
            updateUI();
        }

        if(manualTarget&&enemies.includes(manualTarget))focusRing.position.set(manualTarget.position.x,0.2,manualTarget.position.z);
        else{manualTarget=null;focusRing.visible=false;}

        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            if(e.userData.isBoss&&Date.now()-e.userData.lastStun>5000){
                e.userData.lastStun=Date.now();
                towers.forEach(t=>{if(t.position.distanceTo(e.position)<2.5)t.userData.stunTimer=2000;});
            }
            if(e.userData.slowTimer>0)e.userData.slowTimer-=dt;
            if(e.userData.poisonTimer>0){
                e.userData.poisonTimer-=dt;
                e.userData.hp -= (e.userData.poisonDps * dt * 0.001);
            }
            
            // Status Visuals
            if(e.userData.slowTimer > 0) {
                e.userData.originalColors.forEach(item=>item.m.color.setHex(0x00ffff)); // Cyan/Blue for Frost
            } else if(e.userData.poisonTimer > 0) {
                e.userData.originalColors.forEach(item=>item.m.color.setHex(0x32cd32)); // Green for Poison
            } else {
                e.userData.originalColors.forEach(item=>item.m.color.setHex(item.c)); // Restore original
            }
            
            if(e.userData.isBoss) {
                if(!e.userData.lastMinion || Date.now() - e.userData.lastMinion > 4000) {
                    e.userData.lastMinion = Date.now();
                    const minion = spawnEnemy('goblin');
                    if(minion) minion.position.copy(e.position);
                }
                // Aura Visual
                let aura = e.getObjectByName('aura');
                if(aura) aura.rotation.y += 0.02;
            }
            
            let dmgReduction = 1.0;
            enemies.forEach(other => {
                if(other !== e && other.userData.isBoss && other.position.distanceTo(e.position) < 2.5) dmgReduction = 0.7;
            });
            e.userData.dmgReduction = dmgReduction;

            // Weather & Biome Speed Modifier
            let spMult = 1.0;
            if(weatherType === 'rain') spMult = 0.85;
            if(weatherType === 'storm') spMult = 1.1;
            if(currentBiome === 'snow') spMult *= 1.2; // Slippery!
            if(currentBiome === 'desert') spMult *= 1.1;

            const sp = (e.userData.slowTimer > 0 ? 0.5 : 1.0) * spMult;
            const tp=PATH[e.userData.pathIdx+1];
            if(tp){
                const dir=new THREE.Vector3(tp.x-e.position.x,0,tp.z-e.position.z);
                if(dir.length()<0.05)e.userData.pathIdx++;
                else{e.position.add(dir.normalize().multiplyScalar(e.userData.speed*sp));e.rotation.y=Math.atan2(dir.x,dir.z);}
            } else {
                world.remove(e);
                enemies.splice(i,1);
                if(!isGodMode) {
                    health -= 5;
                    updateUI();
                }
            }
        }

        // Global Death Check
        for(let i=enemies.length-1; i>=0; i--) {
            if(enemies[i].userData.hp <= 0) {
                gold+=enemies[i].userData.reward;
                createDeathParticles(enemies[i].position, enemies[i].userData.originalColors[0].c);
                sounds.pop();
                world.remove(enemies[i]);
                enemies.splice(i,1);
                progressQuest('kills', 1);
                updateUI();
            }
        }

        towers.forEach(t=>{
            if(selectedTower === t) updateSuperButton(t);
            if(t.userData.type === 'buff') {
                towers.forEach(other => {
                    if(other!==t && other.position.distanceTo(t.position)<=t.userData.range) other.userData.buffedAt=Date.now();
                });
            }
            if(t.userData.type === 'shield') {
                towers.forEach(other => {
                    if(other!==t && other.position.distanceTo(t.position)<=t.userData.range) other.userData.stunTimer=0;
                });
                t.userData.stunTimer=0;
            }
            if(t.userData.type === 'time') {
                enemies.forEach(e => {
                    if(t.position.distanceTo(e.position)<=t.userData.range) e.userData.slowTimer=1000;
                });
            }
            if(t.userData.type === 'goldmine') {
                if(Date.now() - t.userData.lastShot > t.userData.cooldown) {
                    gold += Math.floor(10 * t.userData.dmgMult);
                    t.userData.lastShot = Date.now();
                    updateUI();
                }
            }
            if(t.userData.type === 'quake') {
                if(Date.now() - t.userData.lastShot > t.userData.cooldown) {
                    let hit = false;
                    enemies.forEach(e => {
                        if(t.position.distanceTo(e.position) <= t.userData.range) {
                            e.userData.hp -= 20 * t.userData.dmgMult;
                            e.userData.slowTimer = 500;
                            hit = true;
                        }
                    });
                    if(hit){
                        t.userData.lastShot = Date.now();
                        const hammer = t.getObjectByName('crystalGroup'); 
                        if(hammer) { hammer.position.y -= 0.2; setTimeout(() => {if(hammer)hammer.position.y += 0.2;}, 100); }
                    }
                }
            }

            const cg=t.getObjectByName('crystalGroup');
            if(cg){
                const crys=cg.getObjectByName('crystal');
                const lt=cg.getObjectByName('light');
                const tm=Date.now()*0.002;
                cg.position.y=Math.sin(tm)*0.1;
                if(crys)crys.rotation.y+=0.02;
                if(lt)lt.intensity=1.0+Math.sin(tm*2)*0.5;
                const r1=cg.getObjectByName('ring1');
                const r2=cg.getObjectByName('ring2');
                if(r1)r1.rotation.z+=0.03;
                if(r2)r2.rotation.y+=0.05;
                if(t.userData.type==='storm'&&lt)lt.intensity=2+Math.sin(tm*4)*1.2;
            }
            if(t.userData.stunTimer>0){t.userData.stunTimer-=dt;return;}
            let closest=null,minDist=t.userData.range;
            if(manualTarget&&t.position.distanceTo(manualTarget.position)<minDist)closest=manualTarget;
            else enemies.forEach(e=>{const d=t.position.distanceTo(e.position);if(d<minDist){minDist=d;closest=e;}});
            const head=t.getObjectByName('head');
            if(head&&closest){
                const tPos=closest.position.clone();tPos.y=head.getWorldPosition(new THREE.Vector3()).y;
                head.lookAt(tPos);
            }
            if(t.userData.recoil>0){t.userData.recoil-=dt*0.001;if(t.userData.recoil<0)t.userData.recoil=0;}
            
            let cooldown = t.userData.cooldown;
            if(t.userData.buffedAt && Date.now()-t.userData.buffedAt < 500) cooldown *= 0.6; // Buff Tower effect

            if(closest&&Date.now()-t.userData.lastShot>cooldown) {
                shoot(t,closest);
                if(t.userData.type==='crossbow' && (t.userData.rarity==='mythic'||t.userData.rarity==='divine')) {
                    let targets = enemies.filter(e => e !== closest && t.position.distanceTo(e.position) < t.userData.range);
                    if(targets.length > 0) shoot(t, targets[0], new THREE.Vector3(0.1,0,0));
                    if(targets.length > 1) shoot(t, targets[1], new THREE.Vector3(-0.1,0,0));
                }
            }
        });

        for(let i=projectiles.length-1;i>=0;i--){
            const p=projectiles[i];
            
            if(p.userData.type === 'nova') {
                p.position.add(p.userData.dir.clone().multiplyScalar(p.userData.speed));
                p.userData.life -= dt;
                enemies.forEach(ae => { if(ae.position.distanceTo(p.position) < 0.3) ae.userData.hp -= p.userData.dmg; });
                if(p.userData.life <= 0) { world.remove(p); projectiles.splice(i,1); }
                continue;
            }

            if(p.userData.isVisualOnly) {
                p.userData.life -= dt;
                
                // Laser Tracking
                if(p.userData.type === 'laser' && p.userData.towerHead && p.userData.target) {
                    if(!enemies.includes(p.userData.target)) {
                        p.userData.life = 0; 
                    } else {
                        const start = new THREE.Vector3();
                        p.userData.towerHead.getWorldPosition(start);
                        const end = p.userData.target.position;
                        const dist = start.distanceTo(end);
                        p.position.copy(start);
                        p.lookAt(end);
                        p.scale.set(1, dist, 1);
                    }
                }

                if(p.isGroup) {
                    p.children.forEach(c => {
                        if(c.userData.drift) c.position.add(c.userData.drift);
                        if(c.material && c.material.opacity) c.material.opacity -= dt*0.0006;
                        c.scale.multiplyScalar(1.01);
                    });
                } else if(p.material && p.material.opacity) {
                    // For lasers, keep opacity constant so it stays "1 straal"
                    if(p.userData.type !== 'laser') p.material.opacity -= dt*0.005;
                }
                if(p.userData.life <= 0) { world.remove(p); projectiles.splice(i,1); }
                continue;
            }

            const type = p.userData.type;
            const rarity = p.userData.rarity || 'common';
            const dMult = p.userData.dmgMult || 1;

            if(!enemies.includes(p.userData.target)){world.remove(p);projectiles.splice(i,1);continue;}
            
            const dir=new THREE.Vector3().subVectors(p.userData.target.position,p.position).normalize();
            p.position.add(dir.multiplyScalar(p.userData.speed));
            if(type!=='tornado') p.lookAt(p.userData.target.position);
            else p.rotation.y += 0.2;

            if(p.position.distanceTo(p.userData.target.position)<0.4){
                const target=p.userData.target;
                
                let dmg = 15;
                if(type==='magic') dmg = 15;
                else if(type==='crossbow') dmg = 12;
                else if(type==='frost') { dmg=10; target.userData.slowTimer=2000; }
                else if(type==='cannon') {
                    dmg=25; 
                    const radius = (rarity==='mythic'||rarity==='divine') ? 2.0 : 1.0;
                    enemies.forEach(ae=>{if(ae.position.distanceTo(p.position)<radius)ae.userData.hp-=dmg*dMult;});
                    dmg=0;
                }
                else if(type==='storm') { dmg=20; target.userData.slowTimer=1500; }
                else if(type==='lightning') {
                    dmg=15;
                    let chained = [target];
                    target.userData.hp -= dmg*dMult;
                    let current = target;
                    let maxChains = (rarity==='mythic'||rarity==='divine') ? 5 : 2;
                    for(let c=0; c<maxChains; c++) {
                        let next = enemies.find(e => !chained.includes(e) && e.position.distanceTo(current.position) < 2.0);
                        if(next) { next.userData.hp -= (dmg*0.8)*dMult; chained.push(next); current = next; }
                        else break;
                    }
                    dmg=0;
                }
                else if(type==='poison') {
                    dmg=5; 
                    target.userData.poisonTimer = (target.userData.poisonTimer||0) + 3000 * ((rarity==='mythic'||rarity==='divine')?2:1);
                    target.userData.poisonDps = 8 * dMult;
                    createPoisonCloud(p.position, rarity);
                }
                else if(type==='flamer') {
                    dmg=18;
                    enemies.forEach(ae=>{if(ae.position.distanceTo(p.position)<1.2)ae.userData.hp-=dmg*dMult;});
                    dmg=0;
                }
                else if(type==='tornado') {
                    dmg=8;
                    enemies.forEach(ae=>{
                        if(ae.position.distanceTo(p.position)<1.5) {
                            ae.userData.hp-=dmg*dMult;
                            const pullDir = new THREE.Vector3().subVectors(p.position, ae.position).normalize();
                            ae.position.add(pullDir.multiplyScalar(0.08));
                        }
                    });
                    dmg=0;
                }
                else if(type==='gravity') {
                    dmg=20;
                    enemies.forEach(ae=>{
                        if(ae.position.distanceTo(p.position)<3.0) {
                            ae.userData.hp-=dmg*dMult;
                            const pullDir = new THREE.Vector3().subVectors(p.position, ae.position).normalize();
                            ae.position.add(pullDir.multiplyScalar(0.35));
                            ae.userData.slowTimer = 1000;
                        }
                    });
                    dmg=0;
                }
                else if(type==='laser') dmg=12;
                else if(type==='sniper') dmg=100;

                let finalDmg = dmg * dMult * (target.userData.dmgReduction || 1);
                if(finalDmg > 0) {
                    target.userData.hp -= finalDmg;
                    createFloatingText(target.position.clone().add(new THREE.Vector3(0, 0.5, 0)), `-${Math.round(finalDmg)}`, type==='frost'?0x00ffff:(type==='poison'?0x32cd32:0xffffff));
                }
                world.remove(p);projectiles.splice(i,1);
            }
        }
    }
    renderer.render(scene,camera); requestAnimationFrame(animate);
}
// ===================================================
// WEATHER & QUESTS
// ===================================================


function applyCheatMode(enabled) {
    if(enabled) {
        // Backup original if not already backed up
        if(!localStorage.getItem('fd_collection_backup')) {
            localStorage.setItem('fd_collection_backup', localStorage.getItem('fd_collection') || JSON.stringify(['magic_common', 'cannon_common']));
            localStorage.setItem('fd_gems_backup', localStorage.getItem('fd_gems') || '100');
        }
        
        // Generate all combos
        const allTowers = [];
        const types = Object.keys(TOWER_INFO);
        const rarities = Object.keys(RARITY_INFO);
        types.forEach(t => {
            rarities.forEach(r => {
                allTowers.push(`${t}_${r}`);
            });
        });
        
        saveCollection(allTowers);
        saveGems(999999);
        console.log("Cheat Mode Enabled: All towers granted!");
    } else {
        // Restore from backup
        const backupColl = localStorage.getItem('fd_collection_backup');
        const backupGems = localStorage.getItem('fd_gems_backup');
        if(backupColl) {
            localStorage.setItem('fd_collection', backupColl);
            localStorage.setItem('fd_gems', backupGems || '100');
            localStorage.removeItem('fd_collection_backup');
            localStorage.removeItem('fd_gems_backup');
            console.log("Cheat Mode Disabled: Original status restored.");
        }
    }
}

// ===================================================
// INITIALIZATION
// ===================================================
// Om de torens weg te halen, verander de 'true' hieronder naar 'false'
applyCheatMode(false); 

requestAnimationFrame(animate);
