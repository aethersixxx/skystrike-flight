import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const cwd = process.cwd();
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

mkdirSync(outputDir, { recursive: true });

for (const name of ['game', 'screenshots']) {
  const source = join(cwd, name);
  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new Error(`${name}/: no such directory in the repository`);
  }
  const destination = join(outputDir, name);
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true, force: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`SKYSTRIKE dossier written: ${join(outputDir, 'dossier.json')}`);
