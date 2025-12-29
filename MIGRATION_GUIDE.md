# Guide de Migration PostgreSQL → MongoDB Atlas

Ce guide explique comment migrer votre base de données de PostgreSQL vers MongoDB Atlas.

## Prérequis

1. **MongoDB Atlas** : Vous devez avoir un cluster MongoDB Atlas configuré
2. **Connexion String** : `mongodb+srv://deep:12345@cluster0.y7nju.mongodb.net/?appName=Cluster0`
3. **Nom de la base de données** : `coffee`

## Étapes de Migration

### 1. Installer les dépendances

```bash
cd backend
npm install mongodb
```

### 2. Configurer les variables d'environnement

Ajoutez dans votre fichier `.env` (ou variables d'environnement Railway) :

```env
MONGODB_URI=mongodb+srv://deep:12345@cluster0.y7nju.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=coffee
```

**Important** : Gardez `DATABASE_URL` (PostgreSQL) pour la migration, puis vous pourrez le supprimer après.

### 3. Exécuter la migration

```bash
cd backend
node migrate-to-mongodb.js
```

Le script va :
- ✅ Se connecter à PostgreSQL (source)
- ✅ Se connecter à MongoDB Atlas (destination)
- ✅ Migrer toutes les tables dans l'ordre correct
- ✅ Convertir les types de données (UUID → string, DECIMAL → number, JSONB → array, etc.)
- ✅ Créer les index pour optimiser les performances
- ✅ Afficher un rapport de migration

### 4. Tables migrées

Les tables suivantes seront migrées :

- `users` - Utilisateurs
- `products` - Produits
- `product_variants` - Variantes de produits
- `product_collections` - Collections de produits
- `product_categories` - Catégories de produits
- `orders` - Commandes
- `order_items` - Articles de commande
- `workshops` - Ateliers
- `workshop_sessions` - Sessions d'ateliers
- `reservations` - Réservations
- `blog_posts` - Articles de blog
- `contact_messages` - Messages de contact
- `site_settings` - Paramètres du site
- `clients` - Clients
- `gift_cards` - Cartes cadeaux
- `gift_card_transactions` - Transactions de cartes cadeaux
- `stock_movements` - Mouvements de stock

### 5. Conversions automatiques

Le script convertit automatiquement :

- **UUID** → String (conservé tel quel pour compatibilité)
- **TIMESTAMP** → Date MongoDB
- **DECIMAL** → Number JavaScript
- **JSONB** → Array JavaScript
- **BOOLEAN** → Boolean MongoDB
- **Images JSONB** → Array d'images

### 6. Vérifier la migration

Après la migration, vérifiez dans MongoDB Atlas :

1. Connectez-vous à MongoDB Atlas
2. Allez dans "Browse Collections"
3. Vérifiez que toutes les collections existent
4. Vérifiez que les données sont présentes

### 7. Mettre à jour les routes

Après la migration, vous devrez mettre à jour toutes les routes pour utiliser MongoDB au lieu de PostgreSQL.

**Exemple de conversion :**

**Avant (PostgreSQL) :**
```javascript
const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
const product = result.rows[0];
```

**Après (MongoDB) :**
```javascript
const collection = await getCollection('products');
const product = await collection.findOne({ _id: id });
```

## Notes importantes

⚠️ **Sauvegarde** : Assurez-vous d'avoir une sauvegarde de votre base PostgreSQL avant de migrer.

⚠️ **Double migration** : Le script supprime les données existantes dans MongoDB avant d'insérer. Si vous voulez conserver les données existantes, modifiez le script.

⚠️ **Test** : Testez la migration sur un environnement de développement avant de la faire en production.

## Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs de migration
2. Vérifiez la connexion MongoDB Atlas
3. Vérifiez que toutes les variables d'environnement sont correctes
4. Vérifiez que PostgreSQL est toujours accessible pour la migration

