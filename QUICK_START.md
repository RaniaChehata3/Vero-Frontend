# Guide de démarrage rapide - Shop Integration

## 🚀 Démarrage rapide

### 1. Démarrer le Backend
```bash
cd Vero-main/Vero-main
./mvnw spring-boot:run
```
Le backend démarre sur `http://localhost:8085`

### 2. Démarrer le Frontend
```bash
cd Vero-Frontend-main/Vero-Frontend-main
npm install
npm start
```
Le frontend démarre sur `http://localhost:4200`

### 3. Créer un compte ADMIN

#### Option A: Via l'interface
1. Aller sur `http://localhost:4200/login`
2. S'inscrire avec un email et mot de passe
3. Modifier manuellement le rôle dans la base de données:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'votre@email.com';
```

#### Option B: Via Postman
```
POST http://localhost:8085/api/auth/register
Content-Type: application/json

{
  "fullName": "Admin User",
  "email": "admin@vero.com",
  "password": "admin123"
}
```

Puis modifier le rôle dans la base de données.

### 4. Se connecter et obtenir le token JWT
```
POST http://localhost:8085/api/auth/login
Content-Type: application/json

{
  "email": "admin@vero.com",
  "password": "admin123"
}
```

Réponse:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Copier ce token pour l'utiliser dans les requêtes suivantes.

### 5. Ajouter des produits de test

#### Option A: Via SQL
Exécuter le fichier `Vero-main/Vero-main/src/main/resources/sample-products.sql` dans votre base de données MySQL.

#### Option B: Via Postman
1. Importer la collection `Vero-main/Vero-main/postman-products-collection.json`
2. Définir la variable `token` avec votre JWT token
3. Exécuter les requêtes dans le dossier "Sample Products to Add"

#### Option C: Via curl
```bash
curl -X POST http://localhost:8085/api/produits \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Organic Cotton T-Shirt",
    "description": "100% organic cotton, fair trade certified",
    "price": 29.99,
    "stock": 150,
    "category": "FASHION",
    "origin": "Portugal",
    "isEcological": true,
    "image": "https://via.placeholder.com/300x300?text=T-Shirt"
  }'
```

### 6. Voir les produits dans le Shop
1. Aller sur `http://localhost:4200/shop`
2. Les produits s'affichent automatiquement
3. Filtrer par catégorie (All, Home, Beauty, Food, Fashion, Electronics)
4. Cliquer sur "+" pour ajouter au panier (animation visuelle)

## ✅ Vérification

### Backend fonctionne?
```bash
curl http://localhost:8085/api/auth/login
```
Devrait retourner une erreur 400 (normal sans body), pas une erreur de connexion.

### Frontend fonctionne?
Ouvrir `http://localhost:4200` dans le navigateur.

### Produits visibles?
1. Se connecter sur le frontend
2. Aller sur `/shop`
3. Les produits de la base de données s'affichent

## 🔧 Dépannage

### Erreur CORS
Vérifier que `@CrossOrigin("*")` est présent sur les controllers backend.

### Erreur 401 Unauthorized
- Vérifier que vous êtes bien connecté
- Vérifier que le token JWT est valide
- Vérifier que l'intercepteur HTTP est configuré

### Aucun produit affiché
- Vérifier que des produits existent dans la base de données
- Ouvrir la console du navigateur pour voir les erreurs
- Vérifier que le backend est accessible

### Erreur de connexion à la base de données
Vérifier `application.properties`:
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/vero_db
spring.datasource.username=root
spring.datasource.password=your_password
```

## 📝 Notes importantes

1. **Authentification requise**: Tous les endpoints produits nécessitent un token JWT
2. **Rôle ADMIN**: Seuls les ADMIN peuvent créer/modifier/supprimer des produits
3. **Rôle USER**: Les utilisateurs simples peuvent voir tous les produits
4. **Stock**: Les produits avec stock = 0 affichent "Out of Stock"
5. **Catégories**: HOME, BEAUTY, FOOD, FASHION, ELECTRONICS, OTHER

## 🎯 Fonctionnalités implémentées

✅ Affichage de tous les produits depuis l'API  
✅ Filtrage par catégorie  
✅ Affichage du stock disponible  
✅ Badge "Out of Stock" pour produits épuisés  
✅ Animation "ajout au panier"  
✅ États de chargement et d'erreur  
✅ Authentification JWT  
✅ Intercepteur HTTP automatique  

## 🚧 À implémenter

- [ ] Système de panier complet
- [ ] Page de détail produit
- [ ] Système de commande
- [ ] Upload d'images produits
- [ ] Interface admin pour gérer les produits
- [ ] Pagination
- [ ] Recherche en temps réel
