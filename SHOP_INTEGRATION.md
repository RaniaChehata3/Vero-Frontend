# Shop Integration - Documentation

## Modifications effectuées

### 1. Services créés
- **product.service.ts**: Service pour gérer les appels API des produits
- **product.models.ts**: Modèles TypeScript (Product, ProductCategory, Order, OrderStatus)
- **order.service.ts**: Service pour gérer les commandes

### 2. Composant Shop mis à jour
- **shop.component.ts**: 
  - Intégration avec ProductService
  - Chargement des produits depuis l'API backend
  - Gestion des états (loading, error)
  - Filtrage par catégorie
  - Affichage du stock
  - Gestion des produits en rupture de stock

- **shop.component.html**:
  - Affichage dynamique des produits depuis la base de données
  - États de chargement et d'erreur
  - Badge "Out of Stock" pour les produits épuisés
  - Bouton "Add to cart" désactivé si stock = 0
  - Affichage du stock disponible

- **shop.component.css**:
  - Styles pour les états loading/error
  - Styles pour le badge "Out of Stock"
  - Styles pour l'affichage du stock
  - Bouton désactivé quand produit épuisé

## Configuration

### Backend
- URL: `http://localhost:8085`
- Endpoint produits: `/api/produits`
- Authentification: JWT Bearer token (requis)

### Frontend
- Configuration dans `src/environments/environment.ts`
- Intercepteur HTTP configuré pour ajouter automatiquement le token JWT

## Endpoints API utilisés

### Produits (GET - accessible aux utilisateurs authentifiés)
- `GET /api/produits` - Tous les produits
- `GET /api/produits/{id}` - Produit par ID
- `GET /api/produits/category/{category}` - Filtrer par catégorie
- `GET /api/produits/ecological` - Produits écologiques uniquement
- `GET /api/produits/search?keyword=` - Recherche par mot-clé
- `GET /api/produits/price?min=&max=` - Filtrer par plage de prix
- `GET /api/produits/out-of-stock` - Produits en rupture

### Produits (POST/PUT/DELETE - ADMIN uniquement)
- `POST /api/produits` - Créer un produit
- `PUT /api/produits` - Modifier un produit
- `DELETE /api/produits/{id}` - Supprimer un produit
- `PATCH /api/produits/{id}/stock?quantity=` - Mettre à jour le stock

## Test de l'intégration

### 1. Démarrer le backend
```bash
cd Vero-main/Vero-main
./mvnw spring-boot:run
```

### 2. Démarrer le frontend
```bash
cd Vero-Frontend-main/Vero-Frontend-main
npm install
npm start
```

### 3. Créer un compte utilisateur
- Aller sur `/login`
- S'inscrire avec un email et mot de passe
- Se connecter

### 4. Ajouter des produits (via Postman ou curl)
Vous devez être connecté en tant qu'ADMIN pour ajouter des produits.

Exemple de produit à ajouter:
```json
POST http://localhost:8085/api/produits
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Organic Cotton T-Shirt",
  "description": "100% organic cotton, fair trade certified",
  "price": 29.99,
  "stock": 50,
  "category": "FASHION",
  "origin": "Portugal",
  "isEcological": true,
  "image": "https://example.com/image.jpg"
}
```

### 5. Voir les produits dans le shop
- Aller sur `/shop`
- Les produits de la base de données s'affichent
- Filtrer par catégorie
- Ajouter au panier (fonctionnalité visuelle pour l'instant)

## Catégories disponibles
- HOME (Maison)
- BEAUTY (Beauté)
- FOOD (Alimentation)
- FASHION (Mode)
- ELECTRONICS (Électronique)
- OTHER (Autre)

## Prochaines étapes suggérées
1. Implémenter un vrai système de panier (localStorage ou backend)
2. Créer une page de détail produit
3. Implémenter le système de commande complet
4. Ajouter la gestion des images produits (upload)
5. Créer une interface admin pour gérer les produits
6. Ajouter la pagination pour les listes de produits
7. Implémenter la recherche en temps réel
