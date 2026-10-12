# Sécurisation — Trimble Dashboard (trimble-dashboard)

> **Pour l'agent IA** : lire ce document et appliquer toutes les modifications. Ne pas toucher à la logique métier.

---

## Identité extension

| Champ | Valeur |
|-------|--------|
| Repo GitHub | `SimonTrim/trimble-dashboard` |
| Titre TC | Trimble Dashboard |
| Type Trimble Connect | **Projet** |
| `extensionType` manifest | `project` |
| Projet Vercel dev | `trimble-dashboard-dev` |
| **URL manifest TC** | `https://trimble-dashboard-dev.vercel.app/manifest.json` |
| Email autorisé | `simon_martin@trimble.com` |

---

## Manifest cible (`public/manifest.json`)

```json
{
  "title": "Trimble Dashboard",
  "url": "https://trimble-dashboard-dev.vercel.app/",
  "icon": "https://trimble-dashboard-dev.vercel.app/icon-48.png",
  "extensionType": "project",
  "description": "Visualisation métriques projet Trimble Connect",
  "enabled": true
}
```

---

## Fichiers à modifier / créer

Copier gate licence depuis **`../trb-recherche-elements-3D/`**.

`.env.example` : `VITE_LICENSE_API_URL=https://trimble-dashboard-dev.vercel.app/api`

---

## `api/verify-license.ts` — multi-région (obligatoire)

Copier depuis **`../trb-recherche-elements-3D/api/verify-license.ts`** (version multi-région).
Le handler doit interroger les 4 hosts TC (US, EU, AP, AU) jusqu'à obtenir `/users/me` valide.

---

## Déploiement COMPLET (obligatoire)

L'extension dev doit être **identique à la prod** + gate licence.

### Avant commit
1. `git status` — aucun fichier `src/` ou `api/` non commité
2. `npm run check && npm run build`

### Après push
3. `vercel.cmd --prod --yes`
4. Test TC : licence OK + UI complète

---

## Vercel dev : `trimble-dashboard-dev` · Auth OFF

## TC : Add Custom → **Projet** → URL manifest ci-dessus

## Checklist agent

- [ ] Manifest `-dev` + `project`
- [ ] Gate licence installée
- [ ] `verify-license.ts` multi-région (US, EU, AP, AU)
- [ ] `git status` : tout `src/` commité
- [ ] Build OK → commit → push
- [ ] `vercel.cmd --prod --yes`
- [ ] Test TC : licence + UI complète
