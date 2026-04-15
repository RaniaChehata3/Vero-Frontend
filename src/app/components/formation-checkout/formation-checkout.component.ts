import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { loadStripe, Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { FormationService } from '../../services/formation.service';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Formation } from '../../services/formation.models';

@Component({
  selector: 'app-formation-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formation-checkout.component.html',
  styleUrl: './formation-checkout.component.css'
})
export class FormationCheckoutComponent implements OnInit, AfterViewInit, OnDestroy {
  formationId = 0;
  formation: Formation | null = null;
  currentUser: any = null;
  loading = true;
  processing = false;
  error: string | null = null;
  success = false;

  stripe: Stripe | null = null;
  elements: StripeElements | null = null;
  cardElement: StripeCardElement | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formationService: FormationService,
    private paymentService: PaymentService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.formationId = +this.route.snapshot.params['id'];
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.loadFormation();
      },
      error: () => this.router.navigate(['/login'])
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.cardElement?.destroy();
  }

  loadFormation(): void {
    this.formationService.getById(this.formationId).subscribe({
      next: (f) => {
        this.formation = f;
        this.loading = false;
        if (this.isPaid()) {
          setTimeout(() => this.initStripe(), 100);
        }
      },
      error: () => {
        this.error = 'Formation introuvable';
        this.loading = false;
      }
    });
  }

  isPaid(): boolean {
    return !!(this.formation?.price && this.formation.price > 0);
  }

  isAlreadyRegistered(): boolean {
    if (!this.formation || !this.currentUser) return false;
    return this.formation.participantIds?.includes(this.currentUser.id) || false;
  }

  private async initStripe(): Promise<void> {
    this.paymentService.getConfig().subscribe({
      next: async (config) => {
        this.stripe = await loadStripe(config.publishableKey);
        if (!this.stripe) return;
        this.elements = this.stripe.elements();
        this.cardElement = this.elements.create('card', {
          style: {
            base: { fontSize: '16px', color: '#2c2c28', '::placeholder': { color: '#9ca3af' } },
            invalid: { color: '#ef4444' }
          },
          hidePostalCode: true
        });
        const container = document.getElementById('card-element');
        if (container) {
          this.cardElement.mount('#card-element');
          this.cardElement.on('change', (e) => { this.error = e.error?.message || null; });
        }
      },
      error: () => { this.error = 'Impossible de charger le système de paiement.'; }
    });
  }

  async registerFree(): Promise<void> {
    this.processing = true;
    this.formationService.register(this.formationId, this.currentUser.id).subscribe({
      next: () => {
        this.success = true;
        this.notificationService.show('Inscription réussie !', 'success');
        setTimeout(() => this.router.navigate(['/formations', this.formationId]), 2000);
      },
      error: (err) => {
        this.error = err.error?.message || "Erreur lors de l'inscription";
        this.processing = false;
      }
    });
  }

  async payAndRegister(): Promise<void> {
    if (!this.stripe || !this.cardElement) {
      this.error = 'Système de paiement non prêt';
      return;
    }
    this.processing = true;
    this.error = null;

    // Create payment intent for formation
    this.paymentService.createFormationPaymentIntent(this.formationId, this.currentUser.id).subscribe({
      next: async (response) => {
        const { error: stripeError, paymentIntent } = await this.stripe!.confirmCardPayment(
          response.clientSecret,
          { payment_method: { card: this.cardElement! } }
        );
        if (stripeError) {
          this.error = stripeError.message || 'Paiement échoué';
          this.processing = false;
        } else if (paymentIntent?.status === 'succeeded') {
          // Register after payment
          this.formationService.register(this.formationId, this.currentUser.id).subscribe({
            next: () => {
              this.success = true;
              this.notificationService.show('Paiement et inscription réussis !', 'success');
              setTimeout(() => this.router.navigate(['/formations', this.formationId]), 2000);
            },
            error: () => {
              this.error = 'Paiement réussi mais inscription échouée. Contactez le support.';
              this.processing = false;
            }
          });
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors du paiement';
        this.processing = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/formations', this.formationId]);
  }
}
