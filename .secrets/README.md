# Credenciales locales (no commitear)

Esta carpeta está en `.gitignore`. Nunca subas el archivo `.token` a GitHub.

| Archivo | Uso |
|---------|-----|
| `github-nodocore.token` | PAT de la cuenta nodocore para `git push` |

## Push forzando el token (evita caché de juanmendia)

```bash
cd ~/Documentos/@Desarrollo/nodo-core
TOKEN=$(tr -d '\n\r' < .secrets/github-nodocore.token)
git -c credential.helper= push "https://x-access-token:${TOKEN}@github.com/nodocoreIT/nodo-core.git" main
```

## gh CLI (requiere scope `read:org` en el token)

Al crear/regenerar el token en GitHub, marcar:
- `repo`
- `read:org`

```bash
gh auth login --hostname github.com --git-protocol https --with-token < .secrets/github-nodocore.token
gh auth setup-git
```

## Borrar credenciales viejas

```bash
printf "protocol=https\nhost=github.com\n" | git credential reject
```

También: **Contraseñas y claves** (Seahorse) → borrar entradas de `github.com` / `juanmendia`.
