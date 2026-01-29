# 📝 Notes Techniques - Extension Trimble Dashboard

## 🎯 État actuel du projet

### ✅ Ce qui fonctionne

Le projet est **entièrement fonctionnel** avec des données de démonstration (mock). Vous pouvez:

1. ✅ Compiler le projet (`npm run build`)
2. ✅ Voir le dashboard avec données fictives
3. ✅ Tester tous les composants UI
4. ✅ Vérifier que tout fonctionne avant d'intégrer la vraie API

### ⚠️ Ce qui doit être adapté

#### 1. API Trimble Connect (CRITIQUE)

**Fichier concerné**: `src/api/trimbleClient.ts` (ligne 26)

```typescript
// ACTUELLEMENT (Mock):
const { TrimbleConnectWorkspace } = await import('./trimble-api-mock');

// À REMPLACER PAR (Production):
const { TrimbleConnectWorkspace } = await import('@trimble/connect-workspace-api');
```

**Pourquoi?** Le package `@trimble/connect-workspace-api` n'est pas disponible sur npm public. C'est un package privé Trimble.

**Solutions:**

1. **Registre npm privé Trimble** (si vous avez accès):
   ```bash
   npm config set @trimble:registry https://registry.trimble.com/
   npm login --registry=https://registry.trimble.com/
   npm install @trimble/connect-workspace-api
   ```

2. **Package fourni par Trimble** (.tgz):
   ```bash
   npm install /path/to/connect-workspace-api-2.0.0.tgz
   ```

3. **CDN ou script externe** (si Trimble le fournit):
   ```html
   <script src="https://cdn.trimble.com/connect-workspace-api/2.0.0/index.js"></script>
   ```

#### 2. Vérifier la compatibilité de l'API

Le fichier `src/api/trimble-api-mock.ts` contient une **simulation** de l'API basée sur la documentation. Quand vous aurez accès à la vraie API, vérifiez que:

**Méthodes utilisées:**
- ✅ `TrimbleConnectWorkspace.connect()`
- ✅ `api.project.get()`
- ✅ `api.notes.getAll()`
- ✅ `api.bcf.getTopics()`
- ✅ `api.files.getAll()`
- ✅ `api.files.getRecent({ limit, since })`
- ✅ `api.views.getAll()`

**Si une méthode n'existe pas**, vous devrez adapter le code dans les services correspondants.

#### 3. Structure des données

Les types TypeScript dans `src/models/types.ts` sont basés sur la documentation BIM/BCF standard. Vérifiez que les propriétés correspondent:

**Exemple - BCFTopic:**
```typescript
export interface BCFTopic {
  id: string;
  title: string;
  status: BCFStatus;  // Vérifier les valeurs possibles
  priority: 'Low' | 'Medium' | 'High';  // Vérifier
  // ...
}
```

Si Trimble utilise des noms différents (ex: `severity` au lieu de `priority`), adaptez le code.

## 🔧 Modifications avancées

### Ajouter un nouveau service

Exemple: Service pour les Annotations

1. Créer `src/api/annotationsService.ts`:

```typescript
import { trimbleClient } from './trimbleClient';
import { logger } from '../utils/logger';

class AnnotationsService {
  async getAll(): Promise<any[]> {
    return await trimbleClient.executeWithRetry(async (api) => {
      const annotations = await api.annotations.getAll();
      logger.info(`Found ${annotations.length} annotations`);
      return annotations;
    }, 'getAllAnnotations');
  }
}

export const annotationsService = new AnnotationsService();
```

2. Importer dans le dashboard et afficher les données

### Ajouter un nouveau graphique

Exemple: Graphique en camembert (Pie Chart)

Dans `src/ui/charts.ts`:

```typescript
createPieChart(canvasId: string, data: any): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  
  const config: ChartConfiguration = {
    type: 'pie',
    data: {
      labels: ['Label 1', 'Label 2'],
      datasets: [{
        data: [30, 70],
        backgroundColor: [
          TRIMBLE_COLORS.primary,
          TRIMBLE_COLORS.secondary,
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  };
  
  new Chart(ctx!, config);
}
```

### Modifier l'intervalle de rafraîchissement dynamiquement

```typescript
// Ajouter dans dashboard.ts
setRefreshInterval(intervalMs: number): void {
  this.config.refreshInterval = intervalMs;
  this.stopAutoRefresh();
  this.startAutoRefresh();
  logger.info(`Refresh interval updated to ${intervalMs}ms`);
}
```

## 🐛 Debugging avancé

### Activer les logs détaillés

Dans `src/utils/logger.ts`, le mode debug est automatique en développement. Pour l'activer manuellement:

```typescript
// Dans votre code
logger.debug('Message de debug détaillé', { data: someData });
```

### Intercepter les appels API

Pour déboguer les appels API, ajoutez dans `src/api/trimbleClient.ts`:

```typescript
async executeWithRetry<T>(
  operation: (api: TrimbleAPI) => Promise<T>,
  context: string
): Promise<T> {
  logger.debug(`API Call: ${context}`);  // Ajoutez ceci
  const startTime = Date.now();
  
  try {
    const result = await errorHandler.retry(async () => {
      const api = this.getApi();
      return await operation(api);
    }, 3, 1000);
    
    logger.debug(`API Success: ${context} (${Date.now() - startTime}ms)`);
    return result;
  } catch (error) {
    logger.error(`API Error: ${context}`, { error, duration: Date.now() - startTime });
    throw errorHandler.handleApiError(error, context);
  }
}
```

### Performance monitoring

Ajoutez dans `src/ui/dashboard.ts`:

```typescript
private async loadData(): Promise<void> {
  const startTime = performance.now();
  this.showLoader();
  
  try {
    // ... code existant ...
    
    const duration = performance.now() - startTime;
    logger.info(`Dashboard loaded in ${duration.toFixed(2)}ms`);
  } catch (error) {
    // ... gestion erreur ...
  }
}
```

## 📊 Optimisations possibles

### 1. Code Splitting

Charger Chart.js uniquement quand nécessaire:

```typescript
// Dans charts.ts
const loadChartJs = async () => {
  const Chart = await import('chart.js');
  return Chart;
};
```

### 2. Cache des données

Éviter de recharger les données si elles n'ont pas changé:

```typescript
private dataCache: Map<string, { data: any, timestamp: number }> = new Map();
private CACHE_DURATION = 60000; // 1 minute

private async getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = this.dataCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
    logger.debug(`Using cached data for: ${key}`);
    return cached.data;
  }
  
  const data = await fetcher();
  this.dataCache.set(key, { data, timestamp: now });
  return data;
}
```

### 3. Lazy Loading des graphiques

Ne créer les graphiques que quand l'utilisateur scroll jusqu'à eux:

```typescript
// Utiliser Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      this.loadCharts();
      observer.unobserve(entry.target);
    }
  });
});

observer.observe(document.getElementById('charts-section')!);
```

## 🔒 Sécurité

### Variables d'environnement

Pour les clés API sensibles, utilisez des variables d'environnement:

1. Installer `dotenv`:
   ```bash
   npm install dotenv
   ```

2. Créer `.env`:
   ```
   TRIMBLE_API_KEY=your_api_key_here
   TRIMBLE_PROJECT_ID=your_project_id
   ```

3. Utiliser dans le code:
   ```typescript
   const apiKey = process.env.TRIMBLE_API_KEY;
   ```

### Validation des données

Ajouter une validation avant d'afficher les données:

```typescript
function validateBCFTopic(topic: any): topic is BCFTopic {
  return (
    typeof topic.id === 'string' &&
    typeof topic.title === 'string' &&
    ['Open', 'In Progress', 'Resolved', 'Closed'].includes(topic.status)
  );
}

// Utiliser
const topics = await bcfService.getAllTopics();
const validTopics = topics.filter(validateBCFTopic);
```

## 📦 Packaging pour distribution

### Créer un package installable

```bash
# Générer le package
npm pack

# Crée: trimble-dashboard-extension-1.0.0.tgz
```

### Minifier davantage

Dans `webpack.config.js`, ajouter:

```javascript
optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true,  // Supprimer console.log en prod
        },
      },
    }),
  ],
},
```

## 🎓 Pour aller plus loin

### Tests automatisés

Ajouter Jest pour les tests:

```bash
npm install --save-dev jest @types/jest ts-jest
```

Créer `src/__tests__/notesService.test.ts`:

```typescript
import { notesService } from '../api/notesService';

describe('NotesService', () => {
  it('should count active notes', async () => {
    const count = await notesService.countActiveNotes();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
```

### Documentation API

Générer la documentation avec TypeDoc:

```bash
npm install --save-dev typedoc
npx typedoc --out docs src/
```

## 📞 Checklist avant production

- [ ] Remplacer `trimble-api-mock.ts` par la vraie API
- [ ] Tester avec de vraies données Trimble
- [ ] Vérifier les permissions dans `manifest.json`
- [ ] Optimiser les images (si vous ajoutez des assets)
- [ ] Tester sur différents navigateurs (Chrome, Firefox, Edge)
- [ ] Vérifier les performances (temps de chargement < 2s)
- [ ] Activer la minification (mode production)
- [ ] Supprimer les `console.log` de debug
- [ ] Tester la gestion des erreurs (déconnecter le réseau)
- [ ] Vérifier la responsivité mobile
- [ ] Documentation utilisateur finale
- [ ] Tests utilisateurs réels

---

**💡 Astuce**: Gardez toujours `trimble-api-mock.ts` dans le projet (commenté) pour les tests et la démo sans connexion réelle.
