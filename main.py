"""Convenient frontend launcher: python3 main.py. The backend is optional."""
from pathlib import Path
import os
import shutil
import subprocess


def main():
    root = Path(__file__).resolve().parent
    npm = shutil.which('npm')
    env = os.environ.copy()
    if not npm:
        local = sorted((root / '.tools').glob('node-*/bin/npm'))
        if local:
            npm = str(local[-1])
            env['PATH'] = str(local[-1].parent) + os.pathsep + env.get('PATH', '')
    if not npm:
        raise SystemExit('Install Node.js 22+ first, then run python3 main.py again. See README.md.')
    frontend = root / 'aircanvas' / 'frontend'
    if not (frontend / 'node_modules').exists():
        subprocess.run([npm, 'install'], cwd=frontend, env=env, check=True)
    try:
        subprocess.run([npm, 'run', 'dev'], cwd=frontend, env=env, check=True)
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
