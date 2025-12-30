# Statut de Conversion PostgreSQL → MongoDB

## ✅ Routes Converties (Complètes)

1. **products.js** - ✅ Complètement converti
2. **auth.js** - ✅ Complètement converti  
3. **orders.js** - ✅ Complètement converti
4. **contact.js** - ✅ Complètement converti
5. **blogs.js** - ✅ Complètement converti

## 🔄 Routes Partiellement Converties

6. **workshops.js** - Route GET principale convertie, reste à convertir:
   - GET /reservations
   - GET /:id
   - POST /:id/book
   - Autres routes POST/PUT/DELETE

## ⏳ Routes À Convertir

7. **gift-cards.js** - À convertir
8. **square.js** - À convertir
9. **stripe.js** - À convertir
10. **stripe-webhook.js** - À convertir
11. **admin.js** - À convertir (très long, beaucoup de routes)
12. **admin/orders.js** - À convertir
13. **admin/workshops.js** - À convertir
14. **admin/clients.js** - À convertir
15. **admin/gift-cards.js** - À convertir

## 📝 Notes Importantes

- Toutes les routes converties utilisent maintenant `getCollection()` de `db-mongodb.js`
- Les IDs sont convertis de `id` (PostgreSQL UUID) vers `_id` (MongoDB)
- Les requêtes SQL avec JOINs sont converties en requêtes MongoDB séparées avec `Promise.all()`
- Les transactions PostgreSQL sont converties en opérations séquentielles MongoDB

## 🚀 Prochaines Étapes

Pour continuer la conversion, il faut:
1. Convertir les routes restantes dans `workshops.js`
2. Convertir `gift-cards.js`
3. Convertir les routes de paiement (`square.js`, `stripe.js`, `stripe-webhook.js`)
4. Convertir toutes les routes admin (les plus complexes)

## ⚠️ Points d'Attention

- Les requêtes avec JOINs complexes doivent être converties en plusieurs requêtes MongoDB
- Les transactions doivent être gérées différemment (MongoDB supporte les transactions mais nécessite un replica set)
- Certaines requêtes avec agrégations complexes peuvent nécessiter `aggregate()` au lieu de `find()`


