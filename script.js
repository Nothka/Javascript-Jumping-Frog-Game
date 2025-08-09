(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  requestAnimationFrame(fitCanvas);
  window.addEventListener('resize', fitCanvas);

  const WORLD = {
    width: 800,
    height: 260,
    groundY: 210,
    gravity: 1600,
    jumpVel: -580,
    maxJumps: 1,
    baseSpeed: 300,
    speedRamp: 1.01,
    spawnMin: 0.9,
    spawnMax: 1.2,
  };

  const state = {
    started: false,
    gameOver: false,
    t: 0,
    lastSpawn: 0,
    nextSpawnIn: rand(WORLD.spawnMin, WORLD.spawnMax),
    speed: WORLD.baseSpeed,
    score: 0,
    best: Number(localStorage.getItem('jump_best') || 0),
    obstacles: []
  };

  const player = { x: 80, y: WORLD.groundY, w: 28, h: 36, vy: 0, jumps: 0 };

  function spawnObstacle() {
    const w = randInt(16, 26);
    const h = randInt(28, 50);
    state.obstacles.push({
      x: WORLD.width + 10,
      y: WORLD.groundY + (player.h - h),
      w, h,
      passed: false
    });
  }

  function rand(min, max){ return Math.random() * (max - min) + min; }
  function randInt(min, max){ return Math.floor(rand(min, max + 1)); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function tryJump() {
    if (!state.started) startGame();
    if (state.gameOver) return;
    if (player.jumps < WORLD.maxJumps) {
      player.vy = WORLD.jumpVel;
      player.jumps++;
    }
  }

  function restart() {
    state.started = false;
    state.gameOver = false;
    state.t = 0;
    state.lastSpawn = 0;
    state.nextSpawnIn = rand(WORLD.spawnMin, WORLD.spawnMax);
    state.speed = WORLD.baseSpeed;
    state.score = 0;
    state.obstacles.length = 0;
    player.y = WORLD.groundY;
    player.vy = 0;
    player.jumps = 0;
    document.getElementById('scoreEl').textContent = '0';
    toggleOverlay('startOverlay', true);
    toggleOverlay('gameOverOverlay', false);
  }

  function startGame(){
    state.started = true;
    toggleOverlay('startOverlay', false);
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'w' || e.code === 'ArrowUp') {
      e.preventDefault();
      tryJump();
    } else if (key === 'r') {
      restart();
    }
  });
  canvas.addEventListener('pointerdown', tryJump);
  document.getElementById('restartBtn').addEventListener('click', restart);
  document.getElementById('playAgain').addEventListener('click', restart);

  let last = performance.now();
  let acc = 0;
  const FIXED_DT = 1/120;

  function loop(now){
    const dt = (now - last) / 1000;
    last = now;
    acc += dt;
    acc = Math.min(acc, 0.25);
    while (acc >= FIXED_DT) {
      update(FIXED_DT);
      acc -= FIXED_DT;
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function update(dt){
    if (!state.started || state.gameOver) return;

    state.t += dt;
    state.speed += WORLD.speedRamp * dt * 60;

    player.vy += WORLD.gravity * dt;
    player.y += player.vy * dt;

    if (player.y >= WORLD.groundY) {
      player.y = WORLD.groundY;
      player.vy = 0;
      player.jumps = 0;
    }

    state.lastSpawn += dt;
    if (state.lastSpawn >= state.nextSpawnIn) {
      spawnObstacle();
      state.lastSpawn = 0;
      state.nextSpawnIn = rand(WORLD.spawnMin, WORLD.spawnMax);
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.x -= state.speed * dt;
      if (!o.passed && o.x + o.w < player.x) {
        o.passed = true;
        state.score++;
        document.getElementById('scoreEl').textContent = state.score;
      }
      if (o.x + o.w < -20) {
        state.obstacles.splice(i, 1);
      }
    }

    for (const o of state.obstacles) {
      if (rectsOverlap(player, o)) {
        endGame();
        break;
      }
    }
  }

  function rectsOverlap(a, b){
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function endGame(){
    state.gameOver = true;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem('jump_best', String(state.best));
    document.getElementById('bestEl').textContent = state.best;
    document.getElementById('finalScore').textContent = state.score;
    toggleOverlay('gameOverOverlay', true);
  }

  function toggleOverlay(id, show){
    document.getElementById(id).style.display = show ? '' : 'none';
  }

  function render(){
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGround(ctx, rect.width);
    drawPlayer(ctx, player);
    for (const o of state.obstacles) drawCactus(ctx, o);
    document.getElementById('bestEl').textContent = state.best;
  }

  function drawGround(ctx, w){
    ctx.save();
    ctx.strokeStyle = '#2a2f66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.groundY + player.h + 4);
    ctx.lineTo(w, WORLD.groundY + player.h + 4);
    ctx.stroke();
    const y = WORLD.groundY + player.h + 6;
    const step = 22;
    for (let x = 0; x < w; x += step) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#222864';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  function drawPlayer(ctx, p){
    ctx.save();
    const shadowY = WORLD.groundY + p.h + 2;
    const air = clamp((shadowY - p.y) / 120, 0, 1);
    ctx.globalAlpha = 0.25 * (1 - air * 0.8);
    ctx.beginPath();
    ctx.ellipse(p.x + p.w/2, shadowY + 6, 18 - air*8, 6 - air*3, 0, 0, Math.PI*2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalAlpha = 1;
    roundedRect(ctx, p.x, p.y - p.h + 6, p.w, p.h - 6, 6);
    ctx.fillStyle = '#6ee7b7';
    ctx.fill();
    roundedRect(ctx, p.x + p.w - 6, p.y - p.h - 8, 22, 18, 6);
    ctx.fillStyle = '#7bf0c3';
    ctx.fill();
    ctx.fillStyle = '#0b0f2a';
    ctx.fillRect(p.x + p.w + 8, p.y - p.h - 2, 3, 3);
    ctx.restore();
  }

  function drawCactus(ctx, o){
    ctx.save();
    roundedRect(ctx, o.x, o.y - o.h + o.h*0.1, o.w, o.h, Math.min(8, o.w/2));
    ctx.fillStyle = '#9aa3ff';
    ctx.fill();
    ctx.fillRect(o.x - o.w * 0.5, o.y - o.h * 0.35, o.w * 0.5, 6);
    ctx.fillRect(o.x + o.w,       o.y - o.h * 0.55, o.w * 0.5, 6);
    ctx.restore();
  }

  function roundedRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  toggleOverlay('startOverlay', true);
  document.getElementById('bestEl').textContent = state.best;
})();
