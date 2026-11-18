// Catalog of robot parts. Pure data: stats, attacks and skills each part grants.

export const HEADS = {
  visor: { id: 'visor', name: 'Scout Visor', desc: '+1 range for beam weapons', beamRange: 1 },
  helm: { id: 'helm', name: 'Battle Helm', desc: '+2 armor', armor: 2 },
  radar: {
    id: 'radar', name: 'Radar Dome', desc: 'Lock-On: next attack +60%',
    skill: { id: 'lockon', name: 'Lock-On', icon: '🎯', type: 'buff', cooldown: 2 },
  },
  dragon: {
    id: 'dragon', name: 'Dragon Head', desc: 'Fire Breath: burns nearby enemies',
    skill: { id: 'fire', name: 'Fire Breath', icon: '🔥', type: 'melee', dmg: 18, range: 2, pierce: 0.5, splash: true, cooldown: 2 },
  },
  brain: {
    id: 'brain', name: 'Brain Core', desc: 'Nano Repair: heal self or a friend',
    skill: { id: 'nanorepair', name: 'Nano Repair', icon: '🔧', type: 'heal', heal: 25, range: 1, cooldown: 3 },
  },
};

export const BODIES = {
  racer: { id: 'racer', name: 'Racer Chassis', core: 'Car', hp: 60, armor: 2, move: 1, desc: 'Fast car robot' },
  jet: { id: 'jet', name: 'Jet Frame', core: 'Jet', hp: 50, armor: 1, jump: 1, desc: 'Light flying robot' },
  titan: { id: 'titan', name: 'Titan Torso', core: 'Titan', hp: 90, armor: 4, move: -1, desc: 'Huge and strong' },
  beast: { id: 'beast', name: 'Beast Body', core: 'Beast', hp: 70, armor: 3, melee: 0.25, desc: 'Wild animal robot, +25% melee' },
  tank: { id: 'tank', name: 'Tank Hull', core: 'Tank', hp: 100, armor: 6, move: -1, desc: 'Heavy armor' },
};

export const ARMS = {
  blaster: {
    id: 'blaster', name: 'Blaster', desc: 'Laser shots, needs clear line',
    attack: { id: 'blaster', name: 'Blaster', icon: '🔫', type: 'beam', dmg: 14, range: 6, pierce: 0, cooldown: 0 },
  },
  lance: {
    id: 'lance', name: 'Laser Lance', desc: 'Pierces armor',
    attack: { id: 'lance', name: 'Laser Lance', icon: '⚡', type: 'beam', dmg: 18, range: 5, pierce: 0.6, cooldown: 0 },
  },
  cannon: {
    id: 'cannon', name: 'Cannon', desc: 'Lobs shells over walls, splash',
    attack: { id: 'cannon', name: 'Cannon', icon: '💣', type: 'arc', dmg: 24, range: 6, minRange: 2, pierce: 0.2, splash: true, cooldown: 1 },
  },
  missile: {
    id: 'missile', name: 'Missile Pod', desc: 'Long range homing missile',
    attack: { id: 'missile', name: 'Missiles', icon: '🚀', type: 'missile', dmg: 30, range: 9, pierce: 0.3, cooldown: 2 },
  },
  fist: {
    id: 'fist', name: 'Power Fist', desc: 'Huge punch, knocks back',
    attack: { id: 'fist', name: 'Power Punch', icon: '👊', type: 'melee', dmg: 26, range: 1, pierce: 0.2, knockback: 1, cooldown: 0 },
  },
  saw: {
    id: 'saw', name: 'Saw Blade', desc: 'Cuts through armor',
    attack: { id: 'saw', name: 'Saw Blade', icon: '🪚', type: 'melee', dmg: 20, range: 1, pierce: 0.7, cooldown: 0 },
  },
  hammer: {
    id: 'hammer', name: 'Hammer', desc: 'Ground Slam hits everything around',
    attack: { id: 'hammer', name: 'Ground Slam', icon: '🔨', type: 'melee', dmg: 22, range: 1, pierce: 0.3, splash: true, cooldown: 1 },
  },
  shield: { id: 'shield', name: 'Shield', desc: '+3 armor, better Guard', armor: 3, guard: true },
  repair: {
    id: 'repair', name: 'Repair Arm', desc: 'Fix yourself or a friend',
    attack: { id: 'repair', name: 'Repair', icon: '🛠️', type: 'heal', heal: 30, range: 1, cooldown: 2 },
  },
};

export const LEGS = {
  walker: { id: 'walker', name: 'Walker Legs', desc: 'Good at everything', move: 4, climb: 2, jump: 2, fall: 3 },
  wheels: { id: 'wheels', name: 'Wheels', desc: 'Very fast, bad at climbing', move: 6, climb: 1, jump: 1, fall: 2 },
  tracks: { id: 'tracks', name: 'Tracks', desc: 'Sturdy, +2 armor', move: 4, climb: 1, jump: 1, fall: 4, armor: 2 },
  jets: { id: 'jets', name: 'Jet Boosters', desc: 'Flies over everything', move: 5, climb: 4, jump: 4, fall: 99 },
  spider: { id: 'spider', name: 'Spider Legs', desc: 'Climbs tall walls', move: 4, climb: 3, jump: 1, fall: 3 },
};

export const COLORS = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#eceff1'];

export const SLOTS = [
  { key: 'head', label: 'Head', table: HEADS },
  { key: 'body', label: 'Body', table: BODIES },
  { key: 'left', label: 'Left Arm', table: ARMS },
  { key: 'right', label: 'Right Arm', table: ARMS },
  { key: 'legs', label: 'Legs', table: LEGS },
];

export const GUARD = { id: 'guard', name: 'Guard', icon: '🛡️', type: 'guard', cooldown: 0 };

// Every robot can always kick, so it is never stuck when weapons are cooling down.
export const KICK = { id: 'kick', name: 'Kick', icon: '🦶', type: 'melee', dmg: 9, range: 1, pierce: 0, cooldown: 0 };
