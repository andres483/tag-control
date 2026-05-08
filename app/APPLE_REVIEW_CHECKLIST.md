# Apple Review Checklist

Correr esto ANTES de cada build de producción. Sin excepción.
Simular el rol de Apple reviewer en iPad + iPhone, con y sin internet.

---

## PASO 0: Verificar metadatos ASC antes de buildear

- [ ] Support URL en ASC apunta a `https://tag-control.vercel.app/support` (no a la raíz)
- [ ] Review notes mencionan exactamente los campos que existen hoy en AuthScreen
- [ ] Screenshots coinciden con la UI actual (contar campos, botones, tabs)
- [ ] Privacy URL funciona: `https://tag-control.vercel.app/privacy`
- [ ] Support URL funciona: `https://tag-control.vercel.app/support`

---

## PASO 1: Flujo demo (primer path que Apple prueba)

- [ ] Tap "Ver cómo funciona →" → carga demo sin error
- [ ] Home muestra banner demo + 5 viajes simulados visibles en historial
- [ ] Tab Historial: 5 viajes con costos y timestamps (no "undefined")
- [ ] Tab Configuración: muestra nombre real del usuario, "Cuenta de demostración"
- [ ] "Crear cuenta real" en Home → NO expulsa al revisor inmediatamente (navega a historial)
- [ ] "Salir del modo demo" en Settings → vuelve al login (esperado, no un bug)

---

## PASO 2: Login con credenciales revisor (offline)

- [ ] Modo avión ACTIVADO
- [ ] Escribir `revisor` (con minúscula) + PIN `2026` → Entrar → login exitoso
- [ ] Escribir `Revisor` (con mayúscula) + PIN `2026` → Entrar → login exitoso (case-insensitive)
- [ ] Historial: 5 viajes demo
- [ ] Home: funciona sin internet
- [ ] Settings: muestra "revisor" como nombre

---

## PASO 3: Flujo de registro nuevo usuario (el que causó el rechazo Build 14)

- [ ] Escribir cualquier nombre nuevo (ej: `testuser`) + cualquier PIN de 4 dígitos
- [ ] Tap "Entrar" → app pide email (campo de email aparece)
- [ ] **CRÍTICO**: el campo de email recibe foco automáticamente y acepta texto
- [ ] Escribir email válido (ej: `test@apple.com`) → tap "Entrar"
- [ ] Si hay internet: usuario creado, app abre normalmente
- [ ] Si no hay internet (Supabase bloqueado): error dice "Toca 'Ver cómo funciona →'" — el botón existe y funciona

---

## PASO 4: iPad específico (iPad Air 11" o similar)

- [ ] AuthScreen centrado con maxWidth 480 (no full-width)
- [ ] Campo de email en estado needsEmail es interactivo en iPad (teclado aparece)
- [ ] Demo button visible sin scroll en iPad
- [ ] Todas las tabs se ven correctas en portrait
- [ ] Teclado no tapa el campo de email al aparecer (KeyboardAvoidingView funciona)

---

## PASO 5: Edge cases del AuthScreen

- [ ] PIN incorrecto para usuario existente → "PIN incorrecto" (no crash, no timeout)
- [ ] Dejar nombre vacío → botón "Entrar" deshabilitado
- [ ] PIN menos de 4 dígitos → botón deshabilitado
- [ ] Botón "Entrar" disabled hasta que email incluye "@" en modo needsEmail

---

## PASO 6: Rutas de error y recuperación

- [ ] Sin internet + nombre nuevo → timeout 25s → error "Sin conexión" → demo button funciona
- [ ] Sin internet + nombre existente → timeout 25s → error → demo button visible
- [ ] Error message no menciona "Explorar sin cuenta" — dice exactamente el label del botón demo

---

## PASO 7: App.json y config

- [ ] `supportsTablet: true`
- [ ] `orientation: "default"` (permite landscape en iPad)
- [ ] `bundleIdentifier: co.blooming.tagcontrol`
- [ ] Location permission strings en español y descriptivos
- [ ] Sin imágenes placeholder (iconos "TC", "APP", iniciales genéricas)

---

## PASO 8: URLs que Apple verifica

- [ ] Privacy Policy: `https://tag-control.vercel.app/privacy` — carga y tiene contenido real
- [ ] Support URL: `https://tag-control.vercel.app/support` — carga y tiene FAQ + email de contacto
- [ ] Ambas en ASC apuntan a las URLs correctas

---

## Historial de rechazos

| Build | Guideline | Razón específica | Root cause | Evitable? |
|---|---|---|---|---|
| 1-5 | Varios | Icon placeholder, login error | No testeado | Sí |
| 11 | 2.1 | Login "Sin conexión" | Supabase timeout 12s sin bypass | Sí |
| 13 | 2.1 | Login "Sin conexión" | Red Apple bloquea Supabase — bypass no existía | Sí |
| 14 (1ra) | 2.1 | "3 campos" pero app tiene 2 | Review notes no actualizadas después del cambio de UI | Sí |
| 14 (2da) | 2.1 + 1.5 | Email field no responde + Support URL incorrecta | autoFocus falla en iOS 26 + URL apuntaba a PWA raíz | Sí |

**Patrón**: cada rechazo fue evitable. El fix de uno no incluía walkthrough completo de los demás flujos.
