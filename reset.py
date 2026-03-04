import subprocess
import os
import shutil

base = '/Users/anuragsingh/Desktop/AI-creative-challenge'

def run(cmd, check=True):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=base)
    print(f'$ {cmd}')
    if result.stdout.strip(): print(result.stdout.strip())
    if result.stderr.strip(): print('STDERR:', result.stderr.strip())
    return result

# 1. Delete all git history - remove the .git folder entirely and reinit
run('rm -rf .git')
run('git init')

# 2. Remove all files except the 27 folder structure (keep only empty chatgpt/claude/gemini dirs)
projects = [
    '01_hexagon_growth', '02_game_of_life', '03_boids', '04_mandelbrot',
    '05_nbody_gravity', '06_sorting_visualizer', '07_maze_solver',
    '08_wave_interference', '09_reaction_diffusion', '10_langtons_ant',
    '11_lsystem_trees', '12_voronoi', '13_dijkstra_pathfinding',
    '14_fourier_epicycles', '15_perlin_terrain', '16_lorenz_attractor',
    '17_double_pendulum', '18_fire_particles', '19_fluid_simulation',
    '20_cave_generation', '21_raycast_engine', '22_prime_spiral',
    '23_tsp_solver', '24_neural_network_playground', '25_gravity_well',
    '26_kaleidoscope', '27_solar_system'
]

ais = ['chatgpt', 'claude', 'gemini']

# Walk the 27 project folders and remove everything except the 3 subdirs (keeping them empty)
for p in projects:
    project_dir = os.path.join(base, p)
    if not os.path.isdir(project_dir):
        continue
    # Remove all items in the project dir that are not chatgpt/claude/gemini
    for item in os.listdir(project_dir):
        if item in ais:
            # Empty out this ai subfolder
            ai_dir = os.path.join(project_dir, item)
            for f in os.listdir(ai_dir):
                fp = os.path.join(ai_dir, f)
                if os.path.isfile(fp):
                    os.remove(fp)
                    print(f'Removed: {p}/{item}/{f}')
                elif os.path.isdir(fp):
                    shutil.rmtree(fp)
                    print(f'Removed dir: {p}/{item}/{f}')
        else:
            # Remove non-AI items (like .DS_Store)
            fp = os.path.join(project_dir, item)
            if os.path.isfile(fp):
                os.remove(fp)
            elif os.path.isdir(fp):
                shutil.rmtree(fp)
            print(f'Removed extra: {p}/{item}')

# Remove loose files at root (README, helper scripts, etc.) - keep nothing except project folders
for item in os.listdir(base):
    if item.startswith('.') and item != '.git':
        # remove .DS_Store etc
        fp = os.path.join(base, item)
        if os.path.isfile(fp):
            os.remove(fp)
            print(f'Removed root file: {item}')
    elif item not in projects and item != '.git' and item != 'reset.py':
        fp = os.path.join(base, item)
        if os.path.isfile(fp):
            os.remove(fp)
            print(f'Removed root file: {item}')

# 3. Add .gitkeep to every empty AI subfolder so git tracks them
for p in projects:
    for ai in ais:
        d = os.path.join(base, p, ai)
        os.makedirs(d, exist_ok=True)
        gk = os.path.join(d, '.gitkeep')
        with open(gk, 'w') as f:
            pass
        print(f'Added .gitkeep: {p}/{ai}/')

# 4. Create a clean README
readme = """# AI Creative Challenge

A head-to-head creative coding challenge comparing the outputs of **ChatGPT**, **Claude**, and **Gemini** across 27 classic algorithmic and simulation projects.

## Project Structure

```
<project_folder>/
├── chatgpt/
├── claude/
└── gemini/
```

## Challenge List

| # | Project |
|---|---------|
| 01 | hexagon_growth |
| 02 | game_of_life |
| 03 | boids |
| 04 | mandelbrot |
| 05 | nbody_gravity |
| 06 | sorting_visualizer |
| 07 | maze_solver |
| 08 | wave_interference |
| 09 | reaction_diffusion |
| 10 | langtons_ant |
| 11 | lsystem_trees |
| 12 | voronoi |
| 13 | dijkstra_pathfinding |
| 14 | fourier_epicycles |
| 15 | perlin_terrain |
| 16 | lorenz_attractor |
| 17 | double_pendulum |
| 18 | fire_particles |
| 19 | fluid_simulation |
| 20 | cave_generation |
| 21 | raycast_engine |
| 22 | prime_spiral |
| 23 | tsp_solver |
| 24 | neural_network_playground |
| 25 | gravity_well |
| 26 | kaleidoscope |
| 27 | solar_system |
"""

with open(os.path.join(base, 'README.md'), 'w') as f:
    f.write(readme)
print('Created clean README.md')

# 5. Commit everything on main
run('git checkout -b main')
run('git add -A')
run('git commit -m "init: project folder structure with 27 challenges"')
run('git branch -v')
print('\nDone. On main branch with clean folder structure only.')
