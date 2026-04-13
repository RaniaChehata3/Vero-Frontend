import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export interface Petition {
  id?: number;
  title: string;
  description: string;
  category: string;
  city?: string;
  region?: string;
  targetSignatures: number;
  currentSignatures?: number;
  status?: string;
  imageUrl?: string;
  deadline?: string;
  createdAt?: string;
  adminResponse?: string;
}

export interface PetitionSignature {
  id?: number;
  comment?: string;
  anonymous?: boolean;
  signedAt?: string;
}

export interface PetitionStats {
  total: number;
  pending: number;
  active: number;
  achieved: number;
  rejected: number;
  closed: number;
  totalSignatures: number;
  topPetition?: Petition;
}

@Injectable({ providedIn: 'root' })
export class PetitionService {

  private apiUrl = 'http://localhost:8080/api/petitions';

  // 🔥 Smart Caching Layer
  private getCache = new Map<string, any>();

  constructor(private http: HttpClient) { }

  public clearCache(): void {
    this.getCache.clear();
  }

  // 🔐 Headers sécurisés
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('vero_jwt_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    });
  }

  // 🔥 Gestion erreurs globale
  private handleError(error: HttpErrorResponse) {
    let message = 'Unexpected error';
    if (error.error?.message) message = error.error.message;
    else if (error.status === 0) message = 'Server unreachable';
    return throwError(() => new Error(message));
  }

  // 🔥 Generic Cached GET
  private getWithCache<T>(url: string): Observable<T> {
    if (this.getCache.has(url)) {
      return new Observable(o => { o.next(this.getCache.get(url)); o.complete(); });
    }
    return this.http.get<T>(url, { headers: this.getHeaders() }).pipe(
      tap((res) => this.getCache.set(url, res)),
      catchError(this.handleError.bind(this))
    );
  }

  // ── CRUD ─────────────────────────────────────────────
  create(petition: Petition): Observable<Petition> {
    return this.http.post<Petition>(this.apiUrl, petition, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()), catchError(this.handleError.bind(this)));
  }

  getActive(): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(this.apiUrl);
  }

  getById(id: number): Observable<Petition> {
    return this.getWithCache<Petition>(`${this.apiUrl}/${id}`);
  }

  getMy(): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(`${this.apiUrl}/my`);
  }

  update(id: number, petition: Petition): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}`, petition, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()), catchError(this.handleError.bind(this)));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()), catchError(this.handleError.bind(this)));
  }

  // ── Signatures ───────────────────────────────────────
  sign(id: number, comment?: string, anonymous: boolean = false): Observable<PetitionSignature> {
    let url = `${this.apiUrl}/${id}/sign?anonymous=${anonymous}`;
    if (comment) url += `&comment=${encodeURIComponent(comment)}`;

    return this.http.post<PetitionSignature>(url, {}, { headers: this.getHeaders() })
      .pipe(tap(() => { this.getCache.delete(`${this.apiUrl}/${id}/signatures`); this.getCache.delete(`${this.apiUrl}/${id}/has-signed`); this.getCache.delete(`${this.apiUrl}/${id}`); this.getCache.delete(this.apiUrl); }), catchError(this.handleError.bind(this)));
  }

  unsign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/unsign`, { headers: this.getHeaders() })
      .pipe(tap(() => { this.getCache.delete(`${this.apiUrl}/${id}/signatures`); this.getCache.delete(`${this.apiUrl}/${id}/has-signed`); this.getCache.delete(`${this.apiUrl}/${id}`); this.getCache.delete(this.apiUrl); }), catchError(this.handleError.bind(this)));
  }

  getSignatures(id: number): Observable<PetitionSignature[]> {
    return this.getWithCache<PetitionSignature[]>(`${this.apiUrl}/${id}/signatures`);
  }

  hasSigned(id: number): Observable<boolean> {
    return this.getWithCache<boolean>(`${this.apiUrl}/${id}/has-signed`);
  }

  // ── Filtres ─────────────────────────────────────────
  getByCategory(category: string): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(`${this.apiUrl}/category/${category}`);
  }

  getByCity(city: string): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(`${this.apiUrl}/city/${city}`);
  }

  getTop(): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(`${this.apiUrl}/top`);
  }

  getNearlyAchieved(): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(`${this.apiUrl}/nearly-achieved`);
  }

  // ── Admin ───────────────────────────────────────────
  validate(id: number): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}/validate`, {}, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()), catchError(this.handleError.bind(this)));
  }

  reject(id: number, reason: string): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}/reject?reason=${encodeURIComponent(reason)}`, {}, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()), catchError(this.handleError.bind(this)));
  }

  close(id: number): Observable<Petition> {
    return this.http.put<Petition>(`${this.apiUrl}/${id}/close`, {}, { headers: this.getHeaders() })
      .pipe(tap(() => this.clearCache()), catchError(this.handleError.bind(this)));
  }

  getAll(): Observable<Petition[]> {
    return this.getWithCache<Petition[]>(`${this.apiUrl}/admin/all`);
  }

  // ── Reports ─────────────────────────────────────────
  report(id: number, reason: string, details?: string): Observable<string> {
    let url = `${this.apiUrl}/${id}/report?reason=${reason}`;
    if (details) url += `&details=${encodeURIComponent(details)}`;

    return this.http.post(url, {}, { headers: this.getHeaders(), responseType: 'text' })
      .pipe(catchError(this.handleError.bind(this)));
  }

  // ── Stats ───────────────────────────────────────────
  getStats(): Observable<PetitionStats> {
    return this.getWithCache<PetitionStats>(`${this.apiUrl}/stats`);
  }
}