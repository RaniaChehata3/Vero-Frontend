import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DonationService, Donation } from '../../services/donation.service';
import { EventApiService, Event } from '../../services/Event api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './donate.component.html',
  styleUrl: './donate.component.css',
  encapsulation: ViewEncapsulation.None
})
export class DonateComponent implements OnInit, OnDestroy {

  // ── Hero animated text ────────────────────────────────────────
  heroTexts = ['Save Our Environment.', 'Take Action.', 'Make a Difference.'];
  heroTextIndex = 0;
  heroTextExit = -1;
  private heroInterval: any;

  // ── Events ────────────────────────────────────────────────────
  events: Event[] = [];
  selectedEventIndex = -1;
  eventsLoading = true;

  // ── Donate form ───────────────────────────────────────────────
  selectedAmount: number | null = 20;
  customAmount: number | null = null;
  donateState: 'idle' | 'processing' | 'confirmed' | 'error' = 'idle';

  message = '';
  isAnonymous = false;
  errorMessage = '';
  successMessage = '';

  donationType: 'MONEY' | 'MATERIAL' | 'TIME' = 'MONEY';
  materialQuantity = '';
  volunteerHours: number | null = null;

  // ── Donations history ─────────────────────────────────────────
  donations: Donation[] = [];
  donationsLoading = false;
  totalDonated = 0;

  // ── Edit modal ────────────────────────────────────────────────
  editingDonation: Donation | null = null;
  editAmount = 0;
  editMessage = '';
  editAnonymous = false;
  editType: 'MONEY' | 'MATERIAL' | 'TIME' = 'MONEY';
  editQuantity = '';
  editState: 'idle' | 'processing' | 'confirmed' = 'idle';

  // ── Auth ──────────────────────────────────────────────────────
  currentRole: string | null = null;
  currentUserEmail: string | null = null;
  private roleSub!: Subscription;

  // ── UI state ──────────────────────────────────────────────────
  deletingId: number | null = null;
  validatingId: number | null = null;
  activeTab: 'browse' | 'donate' | 'history' = 'browse';
  currentStep = 1;
  showConfirmModal = false;
  showSuccessModal = false;
  pendingDonation: Donation | null = null;
  historyFilter: 'all' | 'MONEY' | 'MATERIAL' | 'TIME' = 'all';
  Math = Math;

  donationSteps = [
    { title: 'You donate', desc: 'Choose an event, select an amount or volunteer your time.' },
    { title: 'We record it', desc: 'Your transaction is permanently recorded and traceable.' },
    { title: 'Funds reach the event', desc: 'Funds are released directly to verified event organizers.' },
    { title: 'Track your impact', desc: 'Watch real-time updates as your donation creates change.' }
  ];

  constructor(
    private donationService: DonationService,
    private eventService: EventApiService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.currentUserEmail = this.authService.currentUserEmail;
    this.roleSub = this.authService.roleStream$.subscribe(role => {
      this.currentRole = role;
      this.cdr.markForCheck();
    });
    this.startHeroAnimation();
    this.loadEvents();
  }

  ngOnDestroy(): void {
    clearInterval(this.heroInterval);
    this.roleSub?.unsubscribe();
  }

  // ── Getters ───────────────────────────────────────────────────
  get isAdmin(): boolean { return this.currentRole === 'ADMIN'; }
  get isLoggedIn(): boolean { return this.authService.isLoggedIn; }

  get selectedEvent(): Event | null {
    return this.selectedEventIndex >= 0 ? this.events[this.selectedEventIndex] : null;
  }

  get currentUserInitial(): string {
    return (this.authService.currentUserEmail || '?').charAt(0).toUpperCase();
  }

  get currentUserDisplayName(): string {
    return this.authService.currentUserEmail || 'User';
  }

  // ── Hero animation ────────────────────────────────────────────
  startHeroAnimation(): void {
    this.heroInterval = setInterval(() => {
      this.heroTextExit = this.heroTextIndex;
      setTimeout(() => {
        this.heroTextExit = -1;
        this.heroTextIndex = (this.heroTextIndex + 1) % this.heroTexts.length;
      }, 600);
    }, 4500);
  }

  // ── Events ────────────────────────────────────────────────────
  scrollToForm(): void {
    document.querySelector('.donate-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  loadEvents(): void {
    this.eventsLoading = true;
    this.eventService.getAll().subscribe({
      next: (data) => {
        this.events = data;
        this.eventsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.eventsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectEvent(index: number): void {
    this.selectedEventIndex = index;
    this.currentStep = 2;
    this.goToDonate();
    this.loadDonationsForEvent();
  }

  goToDonate(): void {
    if (this.selectedEventIndex === -1) return;
    this.activeTab = 'donate';
    setTimeout(() => {
      document.querySelector('.donate-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  goToBrowse(): void {
    this.activeTab = 'browse';
    setTimeout(() => {
      document.querySelector('.donate-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  loadDonationsForEvent(): void {
    const ev = this.selectedEvent;
    if (!ev?.id) return;
    this.donationsLoading = true;
    this.donationService.getDonationsByEvent(ev.id).subscribe({
      next: (data) => { this.donations = data; this.donationsLoading = false; },
      error: () => { this.donations = []; this.donationsLoading = false; }
    });
    this.donationService.getTotalByEvent(ev.id).subscribe({
      next: (total) => this.totalDonated = total,
      error: () => this.totalDonated = 0
    });
  }

  // ── Donate form ───────────────────────────────────────────────
  selectAmount(amount: number): void {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  getFinalAmount(): number {
    return this.customAmount || this.selectedAmount || 0;
  }

  handleDonate(): void {
    if (this.donateState !== 'idle') return;

    const ev = this.selectedEvent;
    if (!ev?.id) {
      this.errorMessage = 'Please select an event';
      this.autoClearError();
      return;
    }

    const amount = this.getFinalAmount();

    if (this.donationType === 'MONEY' && amount <= 0) {
      this.errorMessage = 'Please select an amount';
      this.autoClearError();
      return;
    }
    if (this.donationType === 'MATERIAL' && !this.materialQuantity.trim()) {
      this.errorMessage = 'Please describe what you are donating';
      this.autoClearError();
      return;
    }
    if (this.donationType === 'TIME' && (!this.volunteerHours || this.volunteerHours <= 0)) {
      this.errorMessage = 'Please select volunteer hours';
      this.autoClearError();
      return;
    }

    this.errorMessage = '';
    this.pendingDonation = {
      amount: this.donationType === 'TIME' ? (this.volunteerHours || 0) : amount,
      type: this.donationType,
      quantity: this.donationType === 'MATERIAL' ? this.materialQuantity : undefined,
      message: this.message || '',
      anonymous: this.isAnonymous,
      transactionId: `TXN-${Date.now()}`
    };

    this.showConfirmModal = true;
  }

  cancelDonation(): void {
    this.showConfirmModal = false;
    this.pendingDonation = null;
  }

  // ══════════════════════════════════════════════════════════════
  //  confirmDonation — attend la réponse API (pas d'optimistic UI)
  //  Affiche l'erreur exacte du backend si ça échoue
  // ══════════════════════════════════════════════════════════════
  confirmDonation(): void {
    const ev = this.selectedEvent;
    if (!ev?.id || !this.pendingDonation) return;

    this.showConfirmModal = false;
    this.donateState = 'processing';
    this.errorMessage = '';

    const snapshot = { ...this.pendingDonation };

    // ── MONEY : créer le don puis Stripe ──────────────────────
    if (this.donationType === 'MONEY') {
      this.donationService.createDonationForEvent(snapshot, ev.id).subscribe({
        next: (donation) => {
          if (!donation?.id) {
            this._showError('Could not create donation record.');
            return;
          }
          // Don créé → lancer Stripe
          this.donationService.createStripeCheckout(snapshot.amount, donation.id).subscribe({
            next: (res) => { window.location.href = res.url; },
            error: (stripeErr: any) => {
              console.error('Stripe error:', stripeErr);
              this._showError('Payment initialization failed. Please try again.');
            }
          });
        },
        error: (err: any) => {
          console.error('=== DONATION ERROR ===', err);
          const msg = this._extractError(err);
          this._showError(msg);
        }
      });
      return;
    }

    // ── MATERIAL / TIME : sauvegarde directe ──────────────────
    this.donationService.createDonationForEvent(snapshot, ev.id).subscribe({
      next: (donation) => {
        this.donations = [donation, ...this.donations];
        this.donateState = 'confirmed';
        this.showSuccessModal = true;
        this.successMessage = 'Donation confirmed! Thank you 💚';
        this.resetForm();
        this.loadDonationsForEvent();
        setTimeout(() => {
          this.donateState = 'idle';
          this.successMessage = '';
        }, 3000);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('=== DONATION ERROR ===', err);
        this._showError(this._extractError(err));
      }
    });
  }

  /** Extrait le message d'erreur depuis la réponse Spring Boot */
  private _extractError(err: any): string {
    if (typeof err?.error === 'string') return err.error;
    if (err?.error?.message) return err.error.message;
    if (err?.error?.error) return err.error.error;
    if (err?.message) return err.message;
    return 'Donation failed. Please try again.';
  }

  /** Affiche une erreur et remet l'état à idle après 5s */
  private _showError(msg: string): void {
    this.donateState = 'error';
    this.errorMessage = msg;
    this.showSuccessModal = false;
    setTimeout(() => {
      this.donateState = 'idle';
      this.errorMessage = '';
    }, 5000);
    this.cdr.markForCheck();
  }

  /** Conservé pour compatibilité */
  private _rollback(previousDonations: Donation[], previousTotal: number, msg: string): void {
    this.donations = previousDonations;
    this.totalDonated = previousTotal;
    this._showError(msg);
  }

  viewMyDonations(): void {
    this.showSuccessModal = false;
    this.currentStep = 1;
    this.activeTab = 'history';
  }

  // ── Edit ──────────────────────────────────────────────────────
  openEdit(donation: Donation): void {
    this.editingDonation = { ...donation };
    this.editAmount = donation.amount;
    this.editMessage = donation.message || '';
    this.editAnonymous = donation.anonymous;
    this.editType = (donation.type as any) || 'MONEY';
    this.editQuantity = donation.quantity || '';
    this.editState = 'idle';
    this.errorMessage = '';
  }

  cancelEdit(): void {
    this.editingDonation = null;
    this.errorMessage = '';
  }

  submitEdit(): void {
    if (this.editState !== 'idle' || !this.editingDonation?.id) return;
    if (this.editType === 'MONEY' && this.editAmount <= 0) {
      this.errorMessage = 'Amount must be greater than 0';
      this.autoClearError();
      return;
    }
    this.errorMessage = '';
    this.editState = 'processing';
    this.donationService.update(this.editingDonation.id, {
      amount: this.editAmount,
      message: this.editMessage,
      anonymous: this.editAnonymous,
      type: this.editType,
      quantity: this.editType === 'MATERIAL' ? this.editQuantity : undefined
    }).subscribe({
      next: () => {
        this.editState = 'confirmed';
        this.successMessage = 'Donation updated!';
        setTimeout(() => {
          this.editState = 'idle';
          this.successMessage = '';
          this.editingDonation = null;
          this.loadDonationsForEvent();
        }, 1500);
      },
      error: (err: any) => {
        this.editState = 'idle';
        this.errorMessage = err.error?.message || 'Update failed.';
      }
    });
  }

  deleteDonation(donation: Donation): void {
    if (!donation.id || this.deletingId === donation.id) return;
    if (!confirm('Delete this donation?')) return;
    this.deletingId = donation.id;
    this.donations = this.donations.filter(d => d.id !== donation.id);
    this.donationService.delete(donation.id).subscribe({
      next: () => {
        this.deletingId = null;
        this.successMessage = 'Donation deleted!';
        setTimeout(() => this.successMessage = '', 3000);
        this.loadDonationsForEvent();
      },
      error: () => {
        this.deletingId = null;
        this.loadDonationsForEvent();
      }
    });
  }

  validateDonation(donation: Donation): void {
    if (!donation.id || this.validatingId === donation.id) return;
    this.validatingId = donation.id;
    this.donationService.validate(donation.id).subscribe({
      next: () => {
        this.validatingId = null;
        this.successMessage = 'Donation validated!';
        setTimeout(() => this.successMessage = '', 3000);
        this.loadDonationsForEvent();
      },
      error: (err: any) => {
        this.validatingId = null;
        this.errorMessage = err.error?.message || 'Validation failed.';
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  autoClearError(): void {
    setTimeout(() => this.errorMessage = '', 4000);
  }

  resetForm(): void {
    this.selectedAmount = 20;
    this.customAmount = null;
    this.message = '';
    this.isAnonymous = false;
    this.donationType = 'MONEY';
    this.materialQuantity = '';
    this.volunteerHours = null;
    this.donateState = 'idle';
    this.pendingDonation = null;
  }

  isOwner(donation: Donation): boolean { return donation.userName === this.currentUserEmail; }
  canEdit(donation: Donation): boolean { return this.isOwner(donation) || this.isAdmin; }
  canDelete(donation: Donation): boolean { return this.isOwner(donation) || this.isAdmin; }
  canValidate(): boolean { return this.isAdmin; }

  getTimeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  getDonorInitials(donation: Donation): string {
    if (donation.anonymous) return '?';
    return (donation.userName || 'U').charAt(0).toUpperCase();
  }

  getDonorName(donation: Donation): string {
    if (donation.anonymous) return 'Anonymous';
    return donation.userName || 'User';
  }

  getDonationTypeIcon(type: string): string {
    const icons: Record<string, string> = { MONEY: '💶', MATERIAL: '📦', TIME: '⏰' };
    return icons[type] || '💚';
  }

  getEventStatusClass(status?: string): string {
    const classes: Record<string, string> = {
      UPCOMING: 'status-upcoming',
      ONGOING: 'status-ongoing',
      COMPLETED: 'status-completed',
      CANCELLED: 'status-cancelled'
    };
    return classes[status || ''] || '';
  }

  getMoneyCount(): number { return this.donations.filter(d => d.type === 'MONEY').length; }
  getMaterialCount(): number { return this.donations.filter(d => d.type === 'MATERIAL').length; }
  getTimeCount(): number { return this.donations.filter(d => d.type === 'TIME').length; }
  getValidatedCount(): number { return this.donations.filter(d => d.status === 'VALIDATED').length; }
}