import fs from 'fs';
import path from 'path';

let fontsInitialized = false;

/**
 * Initializes Fontconfig environment variables to make bundled Devanagari fonts
 * (NotoSansDevanagari-Bold.ttf, NotoSansDevanagari-Regular.ttf) discoverable by
 * Pango, Fontconfig, and librsvg inside Sharp native binaries on cloud containers.
 *
 * MUST be executed before Sharp is loaded or performs text rasterization.
 */
export function initFonts(): string | null {
  if (fontsInitialized && process.env.FONTCONFIG_PATH) {
    return process.env.FONTCONFIG_PATH;
  }

  const candidateDirs = [
    path.resolve(__dirname, '../../assets/fonts'),
    path.resolve(__dirname, '../../../assets/fonts'),
    path.resolve(__dirname, '../assets/fonts'),
    path.resolve(process.cwd(), 'assets/fonts'),
    path.resolve(process.cwd(), 'server/assets/fonts'),
    path.resolve(process.cwd(), 'dist/assets/fonts'),
    path.resolve(process.cwd(), 'server/dist/assets/fonts'),
  ];

  let resolvedFontsDir: string | null = null;
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'NotoSansDevanagari-Bold.ttf'))) {
      resolvedFontsDir = dir;
      break;
    }
  }

  if (!resolvedFontsDir) {
    console.warn('[FontInitializer] Could not locate bundled assets/fonts directory.');
    return null;
  }

  // Ensure fonts.conf exists with the exact absolute path to the resolved fonts directory
  const fontsConfPath = path.join(resolvedFontsDir, 'fonts.conf');
  try {
    const fontsConfXml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${resolvedFontsDir}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <dir>~/.fonts</dir>
  <cachedir>/tmp/fonts-cache</cachedir>
  <config></config>
</fontconfig>
`;
    fs.writeFileSync(fontsConfPath, fontsConfXml, 'utf-8');
  } catch (err: any) {
    console.warn('[FontInitializer] Could not update fonts.conf:', err.message);
  }

  process.env.FONTCONFIG_PATH = resolvedFontsDir;
  process.env.FONTCONFIG_FILE = fontsConfPath;
  fontsInitialized = true;

  console.log(`[DIAG:Fontconfig] Initialized bundled font directory: ${resolvedFontsDir}`);
  return resolvedFontsDir;
}

// Auto-run on import to ensure early initialization before any downstream module loads Sharp
initFonts();
