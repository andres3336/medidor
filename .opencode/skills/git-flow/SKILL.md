---
name: Flujo de git
description: Convenciones de ramas, commits, PR y deploy a GitHub Pages del Medidor AYA. Cargar antes de commitear, pushear o abrir un PR.
---

# Flujo de git

## Antes de commitear

```sh
bun run check
bun run test
```

Si cualquiera falla, no se commitea. El build (`bun run build`) se corre antes de un PR o cuando se toca PWA, Vite, rutas o assets.

## Ramas

- `feat/<tema>` para funcionalidad.
- `fix/<tema>` para bugs.
- `chore/<tema>` para scaffold, dependencias, CI.
- `docs/<tema>` para documentación.
- `main` siempre desplegable: Pages publica desde ahí.

## Commits

Conventional Commits, asunto en español, imperativo, ≤ 72 caracteres:

```text
feat(domain): facturación ARESEP con IVA sobre el acueducto
fix(pwa): no perder el formulario al actualizar
docs: instrucciones de cierre de ciclo
chore(ci): desplegar a Pages con Bun
```

Un commit por unidad lógica. No mezclar refactor, feature y formato.

## PR

```sh
gh pr create --fill
```

El cuerpo debe incluir:

- qué cambió y por qué;
- comandos ejecutados (`bun run check`, `bun run test`, `bun run build`);
- riesgos o deuda pendiente;
- capturas si cambió UI.

No mergear sin checks verdes. Merge con squash y borrar rama.

## Prohibido

- `git push --force` (ni con lease) salvo pedido explícito del usuario.
- Commitear `node_modules/`, `dist/`, `dev-dist/`, `.env`, tokens o `*.local`.
- Reescribir historia de `main`.
- Commitear el PAT del gist. Vive solo en `localStorage`.
- Bajar la versión de Node/Bun sin actualizar CI y `.bun-version`.

## Deploy

`.github/workflows/deploy.yml` corre en cada push a `main`:

1. `oven-sh/setup-bun` con `.bun-version`.
2. `bun install --frozen-lockfile`.
3. `bun run check`, `bun run test`, `bun run build`.
4. `actions/upload-pages-artifact` + `actions/deploy-pages`.

GitHub Pages debe estar configurado con `build_type: workflow`. El sitio vive en `https://andres3336.github.io/medidor/`; `base: './'` y hash routing hacen que funcione en ese subpath.

## Si algo se rompe

- No borres `bun.lock` para “arreglar” dependencias.
- Revisá `dist/sw.js` y el manifest si falla la instalación PWA.
- Si Pages falla, verificá que el repo siga público o que Pages tenga permiso.
