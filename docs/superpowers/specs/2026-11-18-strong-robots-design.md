# Strong Robots — Design

A 2D browser game for kids who love Transformers/Tobots. It is tuned for iPad (landscape, touch) and also works on desktop.

## Goals

- Build robots from parts (head, body, two arms, legs, color).
- Measure how strong a robot is by breaking walls (Power Test).
- Fight turn-based tactical battles on a side-view grid. Robots walk, climb, jump, and fall over obstacles.
- Start a battle with 1–3 robots. Compatible robots can **combine** during a fight into a super robot.
- Easy, Normal, and Hard levels are generated randomly each time.

## Decisions

- Uses plain ES modules, Canvas 2D, and HTML overlay UI. There is no build step or runtime dependency.
- Deployed as static files to GitHub Pages through GitHub Actions.
- Game logic modules are pure and do not touch the DOM. They are tested with `node --test`.
- Rendering and UI modules consume logic state and an **event list** (move, attack, damage, destroy, merge, fall). This lets the view animate events in order while input is locked.
- The garage is saved in `localStorage`.
- All parts are available from the start. Hits never miss, though damage varies a little. Both choices keep the game kid-friendly.

## Parts

| Slot | Options |
|------|---------|
| Head | Scout Visor (+1 beam range), Battle Helm (+2 armor), Radar Dome (Lock-On skill), Dragon Head (Fire Breath skill), Brain Core (Nano Repair skill) |
| Body (core) | Racer Chassis (Car), Jet Frame (Jet), Titan Torso (Titan), Beast Body (Beast), Tank Hull (Tank) |
| Arms (×2) | Blaster, Laser Lance, Cannon, Missile Pod, Power Fist, Saw Blade, Hammer, Shield, Repair Arm |
| Legs | Walker Legs, Wheels, Tracks, Jet Boosters, Spider Legs |

Legs decide movement: move points, climb height, jump gap, and safe fall height. Arms and the head provide attacks and skills. Every robot can also **Kick** (a weak melee attack that is always available) and **Guard**, which halves damage until its next turn.

Attack types:
- `beam`: needs line of sight.
- `arc`: lobbed over obstacles, minimum range 2, splash damage.
- `missile`: long range, no line of sight needed, has a cooldown.
- `melee`: adjacent cells only.

Damage is calculated as `max(1, dmg − armor × (1 − pierce))`, multiplied by a random factor between 0.9 and 1.1.

## Combining (super robots)

Combining uses the body core types. Recipes:

- Car + Jet → Sky Racer
- Beast + Titan → Mega Beast
- Tank + Titan → Iron Fortress
- Car + Tank → Road Crusher
- Beast + Jet → Dragon Knight
- Car + Jet + Titan → Omega Prime
- Beast + Tank + Titan → Giga Rex
- Beast + Car + Jet → Thunder Dragon

Any other combination cannot combine.

To combine, two friendly robots must be adjacent and the initiator must still have its action. The result:
- Appears in the initiator's cell.
- Gets HP equal to the sum of both robots plus 20.
- Gets armor equal to the higher armor plus 2.
- Uses the best legs.
- Keeps all attacks from both robots and gains the recipe's ultimate attack.
- Is drawn larger with a golden aura.

A combined robot can combine again if the three cores match a triple recipe. On Hard, enemies can combine too.

## Battle

- The grid is 18×10 cells, side view. Cell types: empty, ground (solid), crate (solid, destructible), and spikes (hazard).
- A robot stands in an empty cell that has a solid cell below it.
- Movement uses Dijkstra pathfinding:
  - Walking costs 1 per step.
  - Climbing costs 1 extra per block, up to the robot's climb height.
  - Falling is free, up to the robot's safe fall height.
  - Jumping over gaps costs the gap width plus 1, up to the robot's jump distance.
- Robots can walk through friends but cannot stop on them. Enemies block the way.
- Each robot gets one move and one action per turn (attack, skill, guard, or combine).
- When a crate is destroyed, robots above it fall. A fall higher than the safe height causes damage.
- The enemy AI scores every reachable cell × attack × target combination by damage, with a bonus for kills. If it cannot attack, it moves toward the nearest player robot.

### Level generation

Levels use a seeded RNG and a ground heightmap where neighboring columns differ by at most 1. The generator adds:
- Spike pits. Pits 1 cell wide are deep, so robots jump over them. Pits 2 cells wide are shallow, so robots walk through and take spike damage. Pit edges are always the same height.
- Floating platforms.
- Crates. They are never stacked and only form 1-high steps.

Difficulty controls the enemy count (2, 3, or 4), the parts pool, an HP multiplier (0.8, 1, 1.25), and an enemy damage multiplier (0.65, 0.85, 1).

The generator guarantees that a robot on Wheels can travel between the two spawns in both directions. If that keeps failing, it falls back to narrow pits.

## Power Test

- Choose a robot and a target: Brick Wall (100 HP, 2 armor), Steel Wall (260 HP, 5 armor), or Titanium Vault (600 HP, 10 armor).
- You get 6 turns and choose one attack or skill per turn. Cooldowns apply.
- Stars: 3 stars for breaking the wall in 3 turns or fewer, 2 stars for 5 or fewer, 1 star for 6.
- The wall shows cracks as it takes damage and shatters when it breaks.

## Testing

- Unit tests cover the RNG, robot stats, combine recipes, movement, combat, level generation, AI, and Power Test.
- A Playwright smoke test runs on desktop and as an iPad (touch). It builds a robot, plays a Power Test, and plays battle turns.
