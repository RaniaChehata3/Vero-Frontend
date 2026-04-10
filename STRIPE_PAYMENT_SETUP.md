# Stripe Payment Integration

## Setup Complete ✅

### Backend (Spring Boot)
- ✅ Stripe dependency added to `pom.xml`
- ✅ Stripe secret key configured in `application.properties`
- ✅ Payment controller created (`PaymentController.java`)
- ✅ Payment DTOs created (`PaymentRequest.java`, `PaymentResponse.java`)
- ✅ Integration with existing Order/Commande system

### Frontend (Angular)
- ✅ Stripe.js library added to `package.json`
- ✅ Payment service created (`payment.service.ts`)
- ✅ Checkout component with Stripe Elements
- ✅ Orders history page
- ✅ Cart integration with payment flow

## Installation

### 1. Install Frontend Dependencies
```bash
cd Vero-Frontend-main/Vero-Frontend-main
npm install
```

### 2. Rebuild Backend
```bash
cd Vero-main/Vero-main
./mvnw clean install
```

## Usage Flow

### 1. Shopping
- User browses products on `/shop`
- Clicks `+` button to add products to cart
- Cart icon animates and shows count

### 2. Checkout
- User clicks cart icon in navbar
- Reviews cart items
- Clicks "Checkout" button
- Redirected to `/checkout` page

### 3. Payment
- User enters delivery address
- User enters card details (Stripe Elements)
- Clicks "Pay" button
- Payment processed through Stripe
- Order created in database with PENDING status
- On success, order status updated to CONFIRMED

### 4. Order History
- User redirected to `/orders` page
- Shows success message
- Displays all user orders with:
  - Order number and date
  - Status badge (Pending, Confirmed, Shipped, Delivered, Cancelled)
  - Product list
  - Delivery address
  - Total amount

## Stripe Test Cards

Use these test cards for testing:

### Successful Payment
- Card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/34)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

### Payment Declined
- Card: `4000 0000 0000 0002`

### Requires Authentication
- Card: `4000 0025 0000 3155`

## API Endpoints

### Payment
- `POST /api/payment/create-payment-intent` - Create Stripe payment intent
- `POST /api/payment/confirm-payment/{orderId}` - Confirm payment success
- `GET /api/payment/config` - Get Stripe publishable key

### Orders
- `GET /api/commandes/user/{userId}` - Get user orders
- `GET /api/commandes/{id}` - Get order by ID
- `PATCH /api/commandes/{id}/status` - Update order status

## Environment Variables

### Backend (`application.properties`)
```properties
stripe.secret.key=YOUR_STRIPE_SECRET_KEY_HERE
```

### Frontend (Hardcoded in PaymentController)
```
Publishable Key: pk_test_51RI7ra4QTZ0WjLCh7G8enjKX35lc6LmHPFvia3Z0xN8g2JsOU9ZM3iH5qDk9AmYkJdEj5fQIOVmJXIcQramkvoml00ZUrYa9Uv
```

## Security Notes

⚠️ **Important**: The Stripe keys provided are TEST keys. For production:
1. Replace with production keys from Stripe Dashboard
2. Move publishable key to environment variables
3. Never commit secret keys to version control
4. Use environment-specific configuration

## Features

### Cart Management
- Add/remove products
- Update quantities
- Persistent storage (localStorage)
- Real-time total calculation

### Payment Processing
- Secure Stripe integration
- Card validation
- Error handling
- Loading states

### Order Management
- Order creation
- Status tracking
- Order history
- User-specific orders

## Troubleshooting

### Payment fails
- Check Stripe dashboard for errors
- Verify secret key is correct
- Check browser console for errors

### Orders not showing
- Verify user ID is correct
- Check backend logs
- Ensure database connection is working

### Cart not persisting
- Check browser localStorage
- Verify cart service is injected properly
