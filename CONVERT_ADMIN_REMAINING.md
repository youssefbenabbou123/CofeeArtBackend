# Conversion MongoDB - Routes Admin Restantes

Le fichier `admin.js` contient encore ~48 requêtes `pool.query` à convertir.

## Pattern de conversion

**PostgreSQL:**
```javascript
const result = await pool.query('SELECT ... FROM table WHERE ...', [params]);
const data = result.rows;
```

**MongoDB:**
```javascript
const collection = await getCollection('table');
const data = await collection.find({ ... }).toArray();
```

**PostgreSQL UPDATE:**
```javascript
const result = await pool.query('UPDATE table SET ... WHERE id = $1 RETURNING *', [id]);
```

**MongoDB UPDATE:**
```javascript
const collection = await getCollection('table');
await collection.updateOne({ _id: id }, { $set: { ... } });
const updated = await collection.findOne({ _id: id });
```

## Routes à convertir

1. GET /products - ✅ Partiellement fait (ligne 177)
2. POST /products - À convertir
3. PUT /products/:id - À convertir
4. DELETE /products/:id - À convertir
5. Toutes les autres routes (contact, orders, workshops, blogs, etc.)

## Note

Vu le volume, il serait plus efficace de convertir les routes une par une en suivant le pattern ci-dessus.


