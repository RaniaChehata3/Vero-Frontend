import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/api/auth`;
  private tokenKey = 'vero_jwt_token';

  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient) {}

  get isLoggedIn$(): Observable<boolean> {
    return this.loggedIn$.asObservable();
  }

  get isLoggedIn(): boolean {
    return this.hasToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get currentUserEmail(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub; // Spring Boot JWT sets subject to email
    } catch { return null; }
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.API}/me`);
  }

  login(email: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.API}/login`, { email, password }).pipe(
      tap(res => {
        console.log('🔐 Login successful for:', email);
        console.log('📦 Clearing old user data...');
        // Clear all user-specific data before logging in
        this.clearUserData();
        console.log('✅ Old data cleared');
        // Set the new token
        localStorage.setItem(this.tokenKey, res.token);
        console.log('🎫 New token stored');
        this.loggedIn$.next(true);
        
        // Verify token was stored correctly
        const storedToken = localStorage.getItem(this.tokenKey);
        if (storedToken) {
          try {
            const payload = JSON.parse(atob(storedToken.split('.')[1]));
            console.log('👤 Logged in as:', payload.sub);
          } catch (e) {
            console.error('❌ Error decoding token:', e);
          }
        }
      })
    );
  }

  register(user: { firstName: string; lastName: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.API}/register`, user, { responseType: 'text' });
  }

  logout(): Observable<any> {
    return this.http.post<any>(`${this.API}/logout`, {}).pipe(
      tap(() => {
        this.clearUserData();
        this.loggedIn$.next(false);
      })
    );
  }

  logoutLocal(): void {
    this.clearUserData();
    this.loggedIn$.next(false);
  }

  private clearUserData(): void {
    console.log('🧹 Clearing user data from localStorage...');
    // Clear all user-specific data from localStorage
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('vero_cart');
    console.log('✨ User data cleared:', {
      token: localStorage.getItem(this.tokenKey),
      cart: localStorage.getItem('vero_cart')
    });
    // Add any other user-specific keys here if needed
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}
