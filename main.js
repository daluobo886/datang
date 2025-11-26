// main.js
// 需要同目录下有 three.module.js

import * as THREE from './three.module.js';

let scene, camera, renderer, controls;
let clock;

// ---------- 简易 OrbitControls（本地版，无外部依赖） ----------
class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement || document;

    this.target = new THREE.Vector3(0, 0, 0);

    this.minDistance = 20;
    this.maxDistance = 260;
    this.minPolarAngle = THREE.MathUtils.degToRad(10);
    this.maxPolarAngle = THREE.MathUtils.degToRad(80);
    this.rotateSpeed = 0.004;
    this.zoomSpeed = 1.0;
    this.panSpeed = 0.6;

    this._radius = 120;
    this._theta = THREE.MathUtils.degToRad(45); // 水平角
    this._phi = THREE.MathUtils.degToRad(40);   // 竖直角

    this._state = 'none'; // 'rotate' | 'pan' | 'none'
    this._pointerStart = new THREE.Vector2();
    this._pointerEnd = new THREE.Vector2();

    this._updateCameraPosition();

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);

    domElement.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('contextmenu', e => e.preventDefault());
  }

  dispose() {
    const d = this.domElement;
    d.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    d.removeEventListener('wheel', this._onWheel);
  }

  _updateCameraPosition() {
    const sinPhi = Math.sin(this._phi);
    const x = this._radius * sinPhi * Math.sin(this._theta);
    const y = this._radius * Math.cos(this._phi);
    const z = this._radius * sinPhi * Math.cos(this._theta);

    this.camera.position.set(
      this.target.x + x,
      this.target.y + y,
      this.target.z + z
    );
    this.camera.lookAt(this.target);
  }

  _handlePointerDown(event) {
    if (event.button === 2 || event.ctrlKey) {
      this._state = 'pan';
    } else if (event.button === 0) {
      this._state = 'rotate';
    } else {
      this._state = 'none';
      return;
    }
    this._pointerStart.set(event.clientX, event.clientY);
  }

  _handlePointerMove(event) {
    if (this._state === 'none') return;

    this._pointerEnd.set(event.clientX, event.clientY);
    const dx = this._pointerEnd.x - this._pointerStart.x;
    const dy = this._pointerEnd.y - this._pointerStart.y;

    if (this._state === 'rotate') {
      this._theta -= dx * this.rotateSpeed;
      this._phi -= dy * this.rotateSpeed;
      this._phi = THREE.MathUtils.clamp(this._phi, this.minPolarAngle, this.maxPolarAngle);
    } else if (this._state === 'pan') {
      const panX = -dx * this.panSpeed * (this._radius / 2000);
      const panZ = dy * this.panSpeed * (this._radius / 2000);
      const pan = new THREE.Vector3(panX, 0, panZ);
      this.target.add(pan);
    }

    this._pointerStart.copy(this._pointerEnd);
    this._updateCameraPosition();
  }

  _handlePointerUp() {
    this._state = 'none';
  }

  _handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY;
    const zoomFactor = Math.exp(delta * 0.001 * this.zoomSpeed);
    this._radius = THREE.MathUtils.clamp(
      this._radius * zoomFactor,
      this.minDistance,
      this.maxDistance
    );
    this._updateCameraPosition();
  }

  update() {
    // 此版本无阻尼，update 只保持接口一致
    this._updateCameraPosition();
  }
}

// ---------- 初始化 three.js 场景 ----------
init();
animate();

function init() {
  const container = document.getElementById('three-container');
  const width = window.innerWidth;
  const height = window.innerHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);
  scene.fog = new THREE.FogExp2(0x020617, 0.0032);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000);
  camera.position.set(80, 70, 120);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  controls = new SimpleOrbitControls(camera, renderer.domElement);
  controls.target.set(0, 6, 0);
  controls._updateCameraPosition();

  setupLights();
  createSite();
  setupFloorCanvas();

  window.addEventListener('resize', onWindowResize);
}

// ---------- 灯光 ----------
function setupLights() {
  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(80, 120, 60);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 10;
  dir.shadow.camera.far = 400;
  dir.shadow.camera.left = -120;
  dir.shadow.camera.right = 120;
  dir.shadow.camera.top = 120;
  dir.shadow.camera.bottom = -120;
  scene.add(dir);
}

// ---------- 场景内容（地面 + 道路 + 物业体量 + 树 + 车） ----------
function createSite() {
  const mallGroup = new THREE.Group();
  mallGroup.position.set(0, 0, 0);
  scene.add(mallGroup);

  // 地面
  const groundGeo = new THREE.PlaneGeometry(400, 260);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 1.0,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // 主道路（前方）—— 假设是东西向主干道
  const roadGeo = new THREE.PlaneGeometry(380, 70);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.97,
    metalness: 0.0
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, 80);
  road.receiveShadow = true;
  scene.add(road);

  // 车道线（简单线条）
  const laneMat = new THREE.LineBasicMaterial({ color: 0x9ca3af, linewidth: 1 });
  const laneGeo = new THREE.BufferGeometry();
  const lanePoints = [];
  const laneCount = 5;
  for (let i = 0; i < laneCount; i++) {
    const offset = -30 + i * 15;
    lanePoints.push(new THREE.Vector3(-180, 0.02, 80 + offset));
    lanePoints.push(new THREE.Vector3(180, 0.02, 80 + offset));
  }
  laneGeo.setFromPoints(lanePoints);
  const lanes = new THREE.LineSegments(laneGeo, laneMat);
  scene.add(lanes);

  // 物业主楼（根据照片抽象为长条盒子）
  const floorHeight = 4;            // 每层约 4m
  const baseHeight = floorHeight * 3;
  const width = 90;                 // 总长
  const depth = 22;                 // 进深（含后场）

  const mallGeo = new THREE.BoxGeometry(width, baseHeight, depth);
  const mallMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.8,
    metalness: 0.1
  });
  const mall = new THREE.Mesh(mallGeo, mallMat);
  mall.castShadow = true;
  mall.receiveShadow = true;
  mall.position.set(0, baseHeight / 2 + 0.1, 20);
  mallGroup.add(mall);

  // 立面分层（深色裙房 + 二三层玻璃带）
  const facadeBandGeo = new THREE.BoxGeometry(width, 1.4, depth + 0.2);
  const facadeDarkMat = new THREE.MeshStandardMaterial({
    color: 0x020617,
    roughness: 0.85,
    metalness: 0.1
  });
  const band1 = new THREE.Mesh(facadeBandGeo, facadeDarkMat);
  band1.position.set(0, 2, 20.05);
  band1.castShadow = true;
  band1.receiveShadow = true;
  mallGroup.add(band1);

  const glassBandGeo = new THREE.BoxGeometry(width, 1.6, depth + 0.3);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    roughness: 0.25,
    metalness: 0.8,
    envMapIntensity: 0.6
  });
  const band2 = new THREE.Mesh(glassBandGeo, glassMat);
  band2.position.set(0, 6, 20.1);
  band2.castShadow = true;
  mallGroup.add(band2);

  // 正中大广告位（对应实物的巨大 LED 屏）
  const ledGeo = new THREE.PlaneGeometry(22, 10);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x0b1120,
    roughness: 1.0,
    metalness: 0.0
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 7.5, depth / 2 + 0.26);
  mallGroup.add(led);

  // 左右两块广告牌
  const adGeo = new THREE.PlaneGeometry(10, 7);
  const adMatLeft = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.7,
    metalness: 0.3
  });
  const adMatRight = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.7,
    metalness: 0.3
  });
  const adLeft = new THREE.Mesh(adGeo, adMatLeft);
  adLeft.position.set(-24, 5.5, depth / 2 + 0.25);
  const adRight = new THREE.Mesh(adGeo, adMatRight);
  adRight.position.set(24, 5.5, depth / 2 + 0.25);
  mallGroup.add(adLeft, adRight);

  // 前场广场（停车场 / 人行空间）
  const plazaGeo = new THREE.PlaneGeometry(width + 10, 55);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: 0xe5e7eb,
    roughness: 0.92,
    metalness: 0.0
  });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.02, 45);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // 简单台阶（前立面）
  const stepGeo = new THREE.BoxGeometry(width + 2, 0.6, 4);
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.9
  });
  const steps = new THREE.Mesh(stepGeo, stepMat);
  steps.position.set(0, 0.3, depth / 2 + 2);
  steps.castShadow = true;
  steps.receiveShadow = true;
  mallGroup.add(steps);

  // 一些树
  createTreesAlong(plaza, 10);
  // 一些车
  createCarsOnRoad(road, 10);
}

// 简单树列
function createTreesAlong(plazaMesh, count) {
  const group = new THREE.Group();
  scene.add(group);

  const radius = 1.1;
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.0, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.9
  });

  const crownGeo = new THREE.SphereGeometry(radius, 12, 10);
  const crownMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    roughness: 0.8,
    metalness: 0.05
  });

  const z = 25;
  const startX = -40;
  const stepX = (Math.abs(startX) * 2) / (count - 1);

  for (let i = 0; i < count; i++) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    const x = startX + i * stepX + (Math.random() - 0.5) * 2;
    trunk.position.set(x, 1, z + 15 + Math.random() * 8);
    crown.position.set(x, 2.4 + radius, z + 15 + Math.random() * 8);
    trunk.castShadow = crown.castShadow = true;
    trunk.receiveShadow = crown.receiveShadow = true;
    group.add(trunk, crown);
  }
}

// 简单车辆
function createCarsOnRoad(roadMesh, count) {
  const group = new THREE.Group();
  scene.add(group);

  const carGeo = new THREE.BoxGeometry(3.6, 1.4, 1.8);
  const colors = [0xf97316, 0x3b82f6, 0x22c55e, 0xfbbf24, 0x64748b];

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.6
    });
    const car = new THREE.Mesh(carGeo, mat);
    const laneOffset = -30 + (i % 4) * 15 + (Math.random() - 0.5) * 4;
    const x = -160 + Math.random() * 320;
    car.position.set(x, 0.8, 80 + laneOffset);
    car.castShadow = true;
    car.receiveShadow = true;
    group.add(car);
  }
}

// ---------- 楼层平面图（右侧 2D Canvas） ----------
function setupFloorCanvas() {
  const canvas = document.getElementById('floor-canvas');
  const ctx = canvas.getContext('2d');
  const metaEl = document.getElementById('floor-meta');
  const buttons = Array.from(document.querySelectorAll('.floor-btn'));

  function setActiveButton(floor) {
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.floor === String(floor));
    });
  }

  function drawFloor(floor) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 背景
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, w, h);

    // 抽象轮廓：略带弧度的长条形（参考实景照片）
    ctx.save();
    ctx.translate(w * 0.5, h * 0.55);

    const scaleBase = 1.0;
    const scale = floor === 3 ? 0.7 : scaleBase;
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.moveTo(-110, -40);
    ctx.quadraticCurveTo(-20, -70, 90, -45);
    ctx.lineTo(120, 0);
    ctx.quadraticCurveTo(110, 40, 60, 60);
    ctx.lineTo(-80, 60);
    ctx.quadraticCurveTo(-130, 30, -130, 0);
    ctx.closePath();

    // 楼层底色
    if (floor === 1) ctx.fillStyle = '#e0f2fe';
    else if (floor === 2) ctx.fillStyle = '#e5e7eb';
    else ctx.fillStyle = '#fee2e2';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#9ca3af';
    ctx.stroke();

    // 核心中庭 / 交通核
    ctx.beginPath();
    ctx.roundRect(-20, -10, 40, 30, 8);
    ctx.fillStyle = '#0ea5e9';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    // 主要流线（走道）
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-105, 10);
    ctx.quadraticCurveTo(-40, 20, 0, 10);
    ctx.quadraticCurveTo(60, 0, 110, 10);
    ctx.stroke();

    // 若干铺位块（示意）
    const blocks = [
      { x: -95, y: -10, w: 22, h: 20 },
      { x: -65, y: -20, w: 24, h: 18 },
      { x: -35, y: 10, w: 24, h: 18 },
      { x: 15, y: -25, w: 30, h: 18 },
      { x: 55, y: 15, w: 26, h: 18 },
      { x: 85, y: -15, w: 22, h: 16 }
    ];
    ctx.lineWidth = 1;
    blocks.forEach((b, i) => {
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      if (floor === 1) ctx.fillStyle = i % 2 ? '#bfdbfe' : '#dbeafe';
      else if (floor === 2) ctx.fillStyle = i % 2 ? '#e5e7eb' : '#d1d5db';
      else ctx.fillStyle = i % 2 ? '#fecaca' : '#fee2e2';
      ctx.fill();
      ctx.strokeStyle = '#9ca3af';
      ctx.stroke();
    });

    // 入口箭头（沿街一侧）
    ctx.strokeStyle = '#f97316';
    ctx.fillStyle = '#f97316';
    ctx.lineWidth = 1.5;
    for (let i = -70; i <= 70; i += 35) {
      ctx.beginPath();
      ctx.moveTo(i - 6, 64);
      ctx.lineTo(i + 6, 64);
      ctx.lineTo(i, 72);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // 文本标签
    ctx.fillStyle = '#4b5563';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('大塘主街方向', canvas.width / 2 - 36, canvas.height - 10);

    // 更新 meta
    if (floor === 1) {
      metaEl.textContent = '当前：F1，一层约 11000 ㎡，主要为沿街首层商铺，可做旺铺、银行、餐饮等。';
    } else if (floor === 2) {
      metaEl.textContent = '当前：F2，二层约 11000 ㎡，小商品 / 市场铺位为主，可规划分区、动线与消防疏散。';
    } else {
      metaEl.textContent = '当前：F3，三层约 5500 ㎡（半层），适合仓储、办公、培训或配套空间。';
    }
  }

  // 初始 F1
  setActiveButton(1);
  drawFloor(1);

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const floor = parseInt(btn.dataset.floor, 10);
      setActiveButton(floor);
      drawFloor(floor);
    });
  });
}

// ---------- 动画循环 ----------
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  controls.update(dt);
  renderer.render(scene, camera);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
