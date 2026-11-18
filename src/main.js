// App entry: screen router and garage persistence.
import { loadGarage, saveGarage } from './save.js';
import { menuScreen, wallSetupScreen, battleSetupScreen } from './ui/menus.js';
import { garageScreen } from './ui/garage.js';
import { battleScreen } from './ui/battle-screen.js';
import { wallScreen } from './ui/wall-screen.js';

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
    const rad = Math.max(0, Math.min(typeof r === 'number' ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}

const SCREENS = {
  menu: menuScreen,
  garage: garageScreen,
  'wall-setup': wallSetupScreen,
  'battle-setup': battleSetupScreen,
  battle: battleScreen,
  wall: wallScreen,
};

const root = document.getElementById('app');
let current = null;

const app = {
  garage: loadGarage(),
  lastBattle: null,
  save() { saveGarage(app.garage); },
  go(name, params = {}) {
    current?.cleanup?.();
    current = SCREENS[name](app, params);
    root.replaceChildren(current);
    globalThis.__game = { ...(globalThis.__game || {}), screen: name, app };
    window.scrollTo(0, 0);
  },
};

// Stop iOS double-tap zoom and pinch zoom inside the game.
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

app.go('menu');
