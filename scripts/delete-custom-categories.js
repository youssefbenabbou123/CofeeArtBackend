import { getCollection, closeConnection } from '../db-mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

// Categories to delete
const categoriesToDelete = ['Cups', 'cups', 'CUP', 'bomboclat', 'Bomboclat', 'BOMBOCLAT'];

async function deleteCategories() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    
    const categoriesCollection = await getCollection('product_categories');
    
    // First, find all categories that match the names
    const allCategories = await categoriesCollection.find({}).toArray();
    console.log(`\n📋 Toutes les catégories trouvées:`);
    allCategories.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat._id})`);
    });
    
    // Find categories to delete (case-insensitive matching)
    const categoriesToDeleteList = [];
    for (const categoryName of categoriesToDelete) {
      const found = await categoriesCollection.findOne({ 
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
      });
      if (found) {
        categoriesToDeleteList.push(found);
      }
    }
    
    if (categoriesToDeleteList.length === 0) {
      console.log('\n⚠️  Aucune catégorie à supprimer trouvée.');
      console.log('   Catégories recherchées:', categoriesToDelete.join(', '));
      return;
    }
    
    console.log(`\n🗑️  Catégories à supprimer (${categoriesToDeleteList.length}):`);
    categoriesToDeleteList.forEach(cat => {
      console.log(`   - ${cat.name} (ID: ${cat._id})`);
    });
    
    // Delete each category
    for (const category of categoriesToDeleteList) {
      const result = await categoriesCollection.deleteOne({ _id: category._id });
      if (result.deletedCount > 0) {
        console.log(`✅ Supprimé: ${category.name}`);
      } else {
        console.log(`❌ Erreur lors de la suppression de: ${category.name}`);
      }
    }
    
    console.log('\n✅ Opération terminée !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await closeConnection();
    process.exit(0);
  }
}

deleteCategories();


