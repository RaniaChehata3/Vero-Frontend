import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';

export interface Donation {
  id?: number;
  amount: number;
  type: string;
  message?: string;
  anonymous: boolean;
  transactionId?: string;
  quantity?: string;
  eventId?: number;
  partnerId?: number;
  userId?: number;
  userName?: string;
  donationDate?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DonationService {

  private apiUrl = 'http://localhost:8080/api/donations';

  private eventDonationsCache = new Map<number, Observable<Donation[]>>();
  private eventTotalCache = new Map<number, Observable<number>>();

  constructor(private http: HttpClient) { }

  clearCache(): void {
    this.eventDonationsCache.clear();
    this.eventTotalCache.clear();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('vero_jwt_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // ── Créer un don pour un événement ─────────────────────────────────────────
  createDonationForEvent(donation: Donation, eventId: number): Observable<Donation> {
    return this.http.post<Donation>(`${this.apiUrl}/event/${eventId}`, donation, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()));
  }

  // ── Créer un don pour un partenaire ────────────────────────────────────────
  createDonationForPartner(donation: Donation, partnerId: number): Observable<Donation> {
    return this.http.post<Donation>(
      `${this.apiUrl}/partner/${partnerId}`,
      donation,
      { headers: this.getHeaders() }
    );
  }

  // ── Tous les dons (admin) ──────────────────────────────────────────────────
  getAll(): Observable<Donation[]> {
    return this.http.get<Donation[]>(
      this.apiUrl,
      { headers: this.getHeaders() }
    );
  }

  // ── Mes dons ───────────────────────────────────────────────────────────────
  getMyDonations(userId: number): Observable<Donation[]> {
    return this.http.get<Donation[]>(
      `${this.apiUrl}/user/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  // ── Dons d'un événement ────────────────────────────────────────────────────
  getDonationsByEvent(eventId: number): Observable<Donation[]> {
    if (!this.eventDonationsCache.has(eventId)) {
      const request = this.http.get<Donation[]>(`${this.apiUrl}/event/${eventId}`, { headers: this.getHeaders() })
        .pipe(shareReplay(1));
      this.eventDonationsCache.set(eventId, request);
    }
    return this.eventDonationsCache.get(eventId)!;
  }

  // ── Total d'un événement ───────────────────────────────────────────────────
  getTotalByEvent(eventId: number): Observable<number> {
    if (!this.eventTotalCache.has(eventId)) {
      const request = this.http.get<number>(`${this.apiUrl}/event/${eventId}/total`, { headers: this.getHeaders() })
        .pipe(shareReplay(1));
      this.eventTotalCache.set(eventId, request);
    }
    return this.eventTotalCache.get(eventId)!;
  }

  // ── Total d'un partenaire ──────────────────────────────────────────────────
  getTotalByPartner(partnerId: number): Observable<number> {
    return this.http.get<number>(
      `${this.apiUrl}/partner/${partnerId}/total`,
      { headers: this.getHeaders() }
    );
  }

  // ── Modifier un don ────────────────────────────────────────────────────────
  update(id: number, donation: Partial<Donation>): Observable<Donation> {
    return this.http.put<Donation>(`${this.apiUrl}/${id}`, donation, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()));
  }

  // ── Supprimer un don ───────────────────────────────────────────────────────
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()));
  }

  // ── Valider un don (admin) ─────────────────────────────────────────────────
  validate(id: number): Observable<Donation> {
    return this.http.put<Donation>(`${this.apiUrl}/${id}/validate`, {}, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()));
  }
}