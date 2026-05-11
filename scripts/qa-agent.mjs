#!/usr/bin/env node
/**
 * QA Agent — Detecta bugs de usuario antes de cada build.
 *
 * Diferente del code-review-agent (calidad de código) y del cto-review (estrategia).
 * Este agente simula ser un usuario real y pregunta: ¿puedo completar este flow?
 *
 * Uso:
 *   node scripts/qa-agent.mjs              # chequeos estáticos + simulación de flows
 *   node scripts/qa-agent.mjs --static     # solo chequeos estáticos (rápido, sin API)
 *   node scripts/qa-agent.mjs --flows      # solo simulación de flows con Claude
 */

import { readFileSync, existsSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const APP  = `${ROOT}/app`;

const args       = process.argv.slice(2);
const STATIC_ONLY = args.includes('--static');
const FLOWS_ONLY  = args.includes('--flows');

// ── Utilidades ──────────────────────────────────────────────────────────────────

function readFile(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function grep(pattern, dir, extra = '') {
  try {
    return execSync(`grep -rn "${pattern}" "${dir}" --include="*.js" ${extra} 2>/dev/null`).toString().trim();
  } catch { return ''; }
}

function askClaude(prompt) {
  const r = spawnSync('claude', ['-p', prompt], {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
    timeout: 90000,
  });
  if (r.error) throw r.error;
  return r.stdout.trim();
}

let criticalCount = 0;
let highCount     = 0;

function report(level, check, detail) {
  const icons = { CRITICAL: '🔴', HIGH: '🟠', OK: '✅' };
  console.log(`${icons[level]} [${level}] ${check}`);
  if (detail) console.log(`   ${detail}`);
  if (level === 'CRITICAL') criticalCount++;
  if (level === 'HIGH')     highCount++;
}

// ── Chequeos estáticos ──────────────────────────────────────────────────────────

function checkKeyboardTypes() {
  const authScreen = readFile(`${APP}/src/components/AuthScreen.js`);

  // Email field debe tener keyboardType="email-address"
  const emailInputs = [...authScreen.matchAll(/placeholder=["'][^"']*@[^"']*["'][^}]*keyboardType=["']([^"']+)["']/gs)];
  // Buscar el campo con placeholder de email y verificar su keyboardType
  const hasEmailKeyboard = authScreen.includes('keyboardType="email-address"');
  const hasEmailField    = authScreen.includes('tu@email.com') || authScreen.includes('email');

  if (hasEmailField && !hasEmailKeyboard) {
    report('CRITICAL', 'Campo email sin keyboardType="email-address"', 'El usuario verá el teclado por defecto, no el teclado con @');
  } else if (hasEmailField && hasEmailKeyboard) {
    report('OK', 'Campo email tiene keyboardType correcto');
  }

  // Verificar que no haya secureTextEntry en el campo de email
  const emailSection = authScreen.match(/needsEmail[\s\S]*?<\/>/)?.[0] || '';
  if (emailSection.includes('secureTextEntry')) {
    report('CRITICAL', 'Campo email tiene secureTextEntry', 'El usuario no puede ver lo que escribe');
  }

  // PIN debe ser number-pad
  const hasPinNumberPad = authScreen.includes("keyboardType=\"number-pad\"");
  if (!hasPinNumberPad) {
    report('HIGH', 'Campo PIN sin keyboardType="number-pad"', 'El usuario ve teclado completo para un PIN de 4 dígitos');
  } else {
    report('OK', 'Campo PIN tiene keyboardType="number-pad"');
  }
}

function checkKeyboardDismiss() {
  const authScreen = readFile(`${APP}/src/components/AuthScreen.js`);

  // Verificar que haya Keyboard.dismiss() en la transición a needsEmail
  const hasKbDismiss = authScreen.includes('Keyboard.dismiss()');
  const hasKbImport  = authScreen.includes('Keyboard,') || authScreen.includes(', Keyboard');

  if (!hasKbDismiss || !hasKbImport) {
    report('HIGH', 'Sin Keyboard.dismiss() en transición PIN→email', 'El teclado numérico puede quedarse pegado al pasar a la pantalla de email');
  } else {
    report('OK', 'Keyboard.dismiss() presente en transición de teclado');
  }
}

function checkErrorHandling() {
  const authFile   = readFile(`${APP}/src/lib/auth.js`);
  const screenFile = readFile(`${APP}/src/components/AuthScreen.js`);

  // auth.js: Supabase calls deben estar en try/catch
  const supabaseCallsInTry = authFile.match(/try\s*\{[\s\S]*?supabase/);
  if (!supabaseCallsInTry) {
    report('HIGH', 'Llamadas a Supabase sin try/catch en auth.js', 'Un error de red lanza excepción → mensaje genérico "sin conexión" al usuario');
  } else {
    report('OK', 'Supabase SELECT en auth.js tiene try/catch');
  }

  // AuthScreen: catch genérico no debe redirigir a demo (buscar el string específico del mensaje antiguo)
  if (screenFile.includes('Toca "Ver cómo funciona') || screenFile.includes("Toca 'Ver cómo funciona")) {
    report('HIGH', 'Error de red redirige al usuario a demo mode', 'Un usuario que intenta registrarse y tiene error de red termina en demo, confuso');
  } else {
    report('OK', 'Error de red no redirige a demo mode');
  }

  // Verificar que 'connection' error tiene mensaje específico
  if (!screenFile.includes("'connection'") && !screenFile.includes('"connection"')) {
    report('HIGH', 'Error de conexión no diferenciado de PIN incorrecto', 'El usuario no sabe si falló por internet o por PIN');
  } else {
    report('OK', 'Error de conexión tiene mensaje diferenciado');
  }
}

function checkDemoGuards() {
  const files = [
    { path: `${APP}/app/(tabs)/index.js`,    name: 'Home' },
    { path: `${APP}/app/(tabs)/history.js`,  name: 'History' },
    { path: `${APP}/app/(tabs)/settings.js`, name: 'Settings' },
  ];

  for (const { path, name } of files) {
    const content = readFile(path);
    if (!content) continue;
    if (!content.includes('isDemo')) {
      report('HIGH', `Tab ${name} sin guard isDemo`, 'El modo demo podría intentar escribir en Supabase');
    } else {
      report('OK', `Tab ${name} tiene guard isDemo`);
    }
  }
}

function checkReviewerBypass() {
  const authFile = readFile(`${APP}/src/lib/auth.js`);
  if (!authFile.includes("'revisor'") && !authFile.includes('"revisor"')) {
    report('CRITICAL', 'Bypass de revisor Apple no encontrado en auth.js', 'El reviewer de Apple no podrá hacer login → rechazo garantizado');
  } else {
    report('OK', 'Bypass revisor/2026 presente en auth.js');
  }
}

function checkAlertImport() {
  const homeFile = readFile(`${APP}/app/(tabs)/index.js`);
  if (homeFile && !homeFile.match(/import.*Alert.*from.*react-native/)) {
    report('CRITICAL', 'Alert no importado en index.js', 'App crashea si el usuario niega permiso de ubicación (Guideline 5.1.1)');
  } else if (homeFile) {
    report('OK', 'Alert importado en index.js');
  }
}

function checkPrivacyLinks() {
  const files = [
    `${APP}/src/components/AuthScreen.js`,
    `${APP}/app/(tabs)/settings.js`,
  ];
  for (const path of files) {
    const content = readFile(path);
    if (content && !content.includes('vercel.app/privacy')) {
      report('HIGH', `Privacy link ausente en ${path.split('/').pop()}`, 'Guideline 5.1.1 — debe estar en lugares visibles');
    }
  }
}

// ── Simulación de flows con Claude ──────────────────────────────────────────────

function simulateFlows() {
  console.log('\n── Simulación de flows de usuario ─────────────────────────\n');

  const authScreen = readFile(`${APP}/src/components/AuthScreen.js`);
  const authLib    = readFile(`${APP}/src/lib/auth.js`);
  const layout     = readFile(`${APP}/app/_layout.js`);

  const FLOWS = [
    {
      name: 'Registro de cuenta nueva',
      description: 'Usuario nuevo: ingresa nombre + PIN → ve campo email → ingresa email → queda logueado',
      critical: true,
    },
    {
      name: 'Login cuenta existente',
      description: 'Usuario existente: ingresa nombre + PIN → queda logueado directamente',
      critical: true,
    },
    {
      name: 'Demo mode',
      description: 'Usuario toca "Ver cómo funciona" → ve home demo con viajes → puede navegar tabs → puede salir',
      critical: true,
    },
    {
      name: 'Login revisor Apple',
      description: 'Reviewer Apple: ingresa "revisor" + "2026" → queda logueado sin internet (offline)',
      critical: true,
    },
  ];

  const code = `
=== AuthScreen.js ===
${authScreen}

=== auth.js ===
${authLib}

=== _layout.js ===
${layout}
  `.trim();

  for (const flow of FLOWS) {
    const prompt = `Eres un QA engineer de apps React Native. Analiza este código y el flow: "${flow.name}".

Flow esperado: ${flow.description}

CÓDIGO:
${code}

Instrucciones:
- Traza el flow paso a paso con el código real
- Identifica EXACTAMENTE si el usuario puede completar el flow o dónde falla
- Responde en formato:
  RESULTADO: PASS o FAIL
  PROBLEMA: (si FAIL, exactamente qué falla y en qué línea)
  FIX: (si FAIL, el fix mínimo)

Si es PASS, solo escribe "RESULTADO: PASS".
Máximo 5 líneas.`;

    const result = askClaude(prompt);
    const isFail = result.includes('RESULTADO: FAIL');

    console.log(`${isFail ? '🔴' : '✅'} Flow: ${flow.name}`);
    if (isFail) {
      criticalCount++;
      result.split('\n').forEach(l => console.log(`   ${l}`));
    }
    console.log('');
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

console.log(`\n🧪  QA Agent · TAGcontrol · ${new Date().toLocaleString('es-CL')}\n`);

if (!FLOWS_ONLY) {
  console.log('── Chequeos estáticos ──────────────────────────────────────\n');
  checkKeyboardTypes();
  checkKeyboardDismiss();
  checkErrorHandling();
  checkDemoGuards();
  checkReviewerBypass();
  checkAlertImport();
  checkPrivacyLinks();
}

if (!STATIC_ONLY) {
  simulateFlows();
}

console.log('─'.repeat(52));
console.log(`\nResultado: ${criticalCount} críticos · ${highCount} altos\n`);

if (criticalCount > 0) {
  console.log('❌ NO buildear — hay issues críticos que bloquean flujos de usuario.\n');
  process.exit(1);
} else if (highCount > 0) {
  console.log('⚠️  Revisar issues altos antes del build.\n');
  process.exit(0);
} else {
  console.log('✅ Todos los flows de usuario verificados. Listo para build.\n');
  process.exit(0);
}
