# Test de l'API Trimble Connect

Pour identifier le bon format d'endpoint, nous avons besoin de tester directement l'API Trimble.

## Étapes de test

1. **Obtenir votre token d'accès OAuth** :
   - Ouvrez la console Chrome (F12) sur Trimble Connect
   - Allez dans l'onglet "Application" > "Local Storage" ou "Session Storage"
   - Cherchez un token d'accès (souvent nommé `access_token`, `bearer_token`, etc.)
   - **OU** : Ouvrez la console et exécutez ce code pour extraire le token depuis l'extension :
     ```javascript
     // Dans la console de votre extension
     TrimbleConnectWorkspace.extension.requestPermission('accesstoken').then(console.log)
     ```

2. **Tester l'endpoint Files** :
   - Ouvrez PowerShell
   - Remplacez `YOUR_ACCESS_TOKEN` par votre token et `YOUR_PROJECT_ID` par votre projet ID (Cw3RYI17np8)
   - Testez ces différents formats d'URL :

```powershell
# Test 1: Format actuel (v2.0)
$token = "YOUR_ACCESS_TOKEN"
$projectId = "Cw3RYI17np8"

curl -H "Authorization: Bearer $token" -H "Content-Type: application/json" "https://app21.connect.trimble.com/tc/api/2.0/projects/$projectId/files"

# Test 2: Sans version
curl -H "Authorization: Bearer $token" -H "Content-Type: application/json" "https://app21.connect.trimble.com/tc/api/projects/$projectId/files"

# Test 3: Format v2.1
curl -H "Authorization: Bearer $token" -H "Content-Type: application/json" "https://app21.connect.trimble.com/tc/api/2.1/projects/$projectId/files"

# Test 4: Format court
curl -H "Authorization: Bearer $token" -H "Content-Type: application/json" "https://app21.connect.trimble.com/projects/$projectId/files"
```

3. **Analyser la réponse** :
   - Si vous obtenez une liste de fichiers JSON → L'endpoint est correct !
   - Si vous obtenez "INVALID_ENDPOINT" → Essayez le format suivant
   - Si vous obtenez 401/403 → Problème d'authentification

## Information importante

Votre projet est hébergé en **Europe** (région `app21`), donc nous utilisons `app21.connect.trimble.com`.

**Veuillez me communiquer** :
1. Quel format d'URL a fonctionné (si aucun ne fonctionne, indiquez les codes d'erreur)
2. Un exemple de réponse JSON si vous en obtenez une
3. Votre `projectInfo.location` (la valeur exacte retournée par Trimble Connect)

Cela nous permettra d'identifier le bon format d'endpoint et de corriger le backend en conséquence.

## Alternative : Vérifier la documentation

Si vous avez accès à la documentation interne Trimble ou à un portail développeur avec des exemples d'API, merci de partager le format exact des endpoints pour :
- Files: `GET /projects/{projectId}/files`
- Todos: `GET /projects/{projectId}/todos`
- Views: `GET /projects/{projectId}/views`
- BCF Topics: `GET /projects/{projectId}/bcf/topics`
