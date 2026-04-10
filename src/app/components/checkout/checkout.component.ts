import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { CartService, CartItem } from '../../services/cart.service';
import { PaymentService, PaymentRequest } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent implements OnInit {
  cartItems: CartItem[] = [];
  deliveryAddress = '';
  notes = '';
  loading = false;
  error: string | null = null;
  
  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  cardElement: StripeCardElement | null = null;

  constructor(
    private cartService: CartService,
    private paymentService: PaymentService,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.cartItems = this.cartService.getCartItems();
    
    if (this.cartItems.length === 0) {
      this.router.navigate(['/shop']);
      return;
    }

    // Initialize Stripe
    try {
      this.paymentService.getConfig().subscribe({
        next: async (config) => {
          try {
            this.stripe = await loadStripe(config.publishableKey);
            if (this.stripe) {
              this.elements = this.stripe.elements();
              this.cardElement = this.elements.create('card', {
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#2c2c28',
                    fontFamily: '"DM Sans", sans-serif',
                    '::placeholder': {
                      color: '#9ca3af'
                    }
                  }
                }
              });
              
              setTimeout(() => {
                const cardElementContainer = document.getElementById('card-element');
                if (cardElementContainer && this.cardElement) {
                  this.cardElement.mount('#card-element');
                }
              }, 100);
            } else {
              this.error = 'Failed to initialize Stripe';
            }
          } catch (stripeError) {
            console.error('Error initializing Stripe:', stripeError);
            this.error = 'Failed to load payment system. Please try again.';
          }
        },
        error: (err) => {
          console.error('Error fetching Stripe config:', err);
          this.error = 'Failed to connect to payment service. Please check your connection.';
        }
      });
    } catch (err) {
      console.error('Error loading Stripe:', err);
      this.error = 'Failed to load payment system';
    }
  }

  getTotal(): number {
    return this.cartService.getTotal();
  }

  async handlePayment() {
    if (!this.deliveryAddress.trim()) {
      this.error = 'Please enter a delivery address';
      return;
    }

    if (!this.stripe || !this.cardElement) {
      this.error = 'Payment system not ready';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      // Get user ID - TODO: Get actual user ID from auth service
      const userId = 1;

      // Create payment request
      const paymentRequest: PaymentRequest = {
        userId,
        items: this.cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity
        })),
        deliveryAddress: this.deliveryAddress,
        notes: this.notes
      };

      // Create payment intent
      this.paymentService.createPaymentIntent(paymentRequest).subscribe({
        next: async (response) => {
          // Confirm payment with Stripe
          const { error: stripeError, paymentIntent } = await this.stripe!.confirmCardPayment(
            response.clientSecret,
            {
              payment_method: {
                card: this.cardElement!
              }
            }
          );

          if (stripeError) {
            this.error = stripeError.message || 'Payment failed';
            this.loading = false;
          } else if (paymentIntent?.status === 'succeeded') {
            // Confirm payment on backend
            this.paymentService.confirmPayment(response.orderId).subscribe({
              next: () => {
                // Clear cart
                this.cartService.clearCart();
                // Navigate to success page
                this.router.navigate(['/orders'], { 
                  queryParams: { success: true, orderId: response.orderId } 
                });
              },
              error: (err) => {
                console.error('Error confirming payment:', err);
                this.loading = false;
              }
            });
          }
        },
        error: (err) => {
          console.error('Error creating payment intent:', err);
          this.error = 'Failed to process payment';
          this.loading = false;
        }
      });
    } catch (err) {
      console.error('Payment error:', err);
      this.error = 'An unexpected error occurred';
      this.loading = false;
    }
  }
}
