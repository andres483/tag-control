# Apple Review Checklist

Correr esto ANTES de cada build de producción. Sin excepción.

## 1. Credenciales del revisor

- [ ] `revisor` / `2026` funciona sin internet (modo avión activado)
- [ ] Login tarda menos de 3 segundos en modo avión
- [ ] Al hacer login con `revisor/2026` se ven 5 viajes en historial
- [ ] Botón "Explorar sin cuenta" funciona sin internet

## 2. iPad

- [ ] `supportsTablet: true` en app.json
- [ ] AuthScreen se ve centrado en pantalla ancha (no full-width)
- [ ] Todas las tabs cargan sin crash en iPad Air (usar simulador)
- [ ] Historial, Home, Settings se ven bien en iPad en portrait

## 3. Inicio de app

- [ ] Cold start sin cuenta: muestra login (no pantalla blanca)
- [ ] Cold start con cuenta guardada: va directo al home
- [ ] Sin internet: login y demo funcionan

## 4. Flujo completo del revisor (simular exactamente esto)

```
1. Desinstalar app completamente
2. Instalar fresh
3. Activar modo avión
4. Abrir app
5. Escribir "revisor" + PIN "2026"
6. Presionar Entrar
7. Verificar: llega al home con "Modo demostración"
8. Tab Historial: ver 5 viajes
9. Tab Configuración: ver pantalla de demo
10. Desactivar modo avión — nada debe crashear
```

## 5. App.json

- [ ] `supportsTablet: true`
- [ ] `version` actualizada si es nuevo build
- [ ] `bundleIdentifier: co.blooming.tagcontrol`
- [ ] Location usage strings en español y descriptivos

## 6. Respuesta al Resolution Center

Si hay rechazo, responder SIEMPRE en inglés y con:
- Root cause específico (no genérico)
- Qué se cambió exactamente
- Cómo reproducir que está arreglado

---

**Historial de rechazos:**

| Build | Razón | Root cause real |
|---|---|---|
| 1-5 | Varios | Icon placeholder, privacy URL, login error |
| 11 | Login "Sin conexión" | Supabase timeout 12s |
| 13 | Login "Sin conexión" | Red de Apple bloquea Supabase (no era timeout) |
| 14 | (pendiente) | supportsTablet false + misma causa del login |
