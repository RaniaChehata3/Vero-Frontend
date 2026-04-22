import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserResponse {
  id: number;
  fullName: string;
  email: string;
  role: string;
  verified: boolean;
  banned: boolean;
  image?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface PasskeyRegisterOptionsResponse {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  displayName: string;
}

export interface PasskeyLoginOptionsResponse {
  challenge: string;
  rpId: string;
  allowCredentialIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/api/auth`;
  private tokenKey = 'vero_access_token';
  private refreshTokenKey = 'vero_refresh_token';
  private roleKey = 'vero_user_role';
  private userKey = 'vero_user';

  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  private role$ = new BehaviorSubject<string | null>(this.readRoleFromStorage());

  constructor(private http: HttpClient) {}

  get isLoggedIn$(): Observable<boolean> {
    return this.loggedIn$.asObservable();
  }

  get isLoggedIn(): boolean {
    return this.hasToken();
  }

  get roleStream$(): Observable<string | null> {
    return this.role$.asObservable();
  }

  get isAdmin(): boolean {
    return this.currentUserRole === 'ADMIN';
  }

  get isPartner(): boolean {
    return this.currentUserRole === 'PARTNER';
  }

  get canManageEvents(): boolean {
    return this.isAdmin || this.isPartner;
  }

  restoreSession(): void {
    // Session lives in localStorage; emit current values so subscribers sync on boot.
    this.loggedIn$.next(this.hasToken());
    this.role$.next(this.readRoleFromStorage());
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get currentUserEmail(): string | null {
    const payload = this.getTokenPayload();
    return payload?.sub ?? this.currentUser?.email ?? null;
  }

  get currentUserRole(): string | null {
    return this.getTokenPayload()?.role || localStorage.getItem(this.roleKey);
  }

  get currentUser(): UserResponse | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserResponse;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, { email, password }).pipe(
      tap(res => this.applyAuthResponse(res))
    );
  }

  passkeyRegisterOptions(email: string): Observable<PasskeyRegisterOptionsResponse> {
    return this.http.post<PasskeyRegisterOptionsResponse>(`${this.API}/passkey/register/options`, { email });
  }

  passkeyRegisterVerify(email: string, credentialId: string, challenge: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/passkey/register/verify`, { email, credentialId, challenge });
  }

  passkeyLoginOptions(email: string): Observable<PasskeyLoginOptionsResponse> {
    return this.http.post<PasskeyLoginOptionsResponse>(`${this.API}/passkey/login/options`, { email });
  }

  passkeyLoginVerify(email: string, credentialId: string, challenge: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/passkey/login/verify`, { email, credentialId, challenge }).pipe(
      tap((res) => this.applyAuthResponse(res))
    );
  }

  register(user: { fullName: string; email: string; password: string; image?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, user).pipe(
      tap((res) => this.applyAuthResponse(res))
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API}/reset-password`, { token, newPassword });
  }

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.API}/me`).pipe(
      tap(user => localStorage.setItem(this.userKey, JSON.stringify(user)))
    );
  }

  applySocialSession(params: URLSearchParams): boolean {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const email = params.get('email');
    const fullName = params.get('fullName');
    const role = params.get('role');
    const verified = params.get('verified');
    const banned = params.get('banned');
    const id = params.get('id');

    if (!accessToken || !refreshToken || !email || !fullName || !role) {
      return false;
    }

    const user: UserResponse = {
      id: id ? Number(id) : 0,
      fullName,
      email,
      role,
      verified: verified === 'true',
      banned: banned === 'true',
      image: null
    };

    this.storeSession(accessToken, refreshToken, user);
    return true;
  }

  getSocialAuthUrl(provider: 'google' | 'github' | 'facebook'): string {
    return `${environment.authServerUrl}/oauth2/authorization/${provider}`;
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.userKey);
    this.loggedIn$.next(false);
    this.role$.next(null);
  }

  private applyAuthResponse(res: AuthResponse): void {
    this.storeSession(res.accessToken, res.refreshToken, res.user);
  }

  private storeSession(accessToken: string, refreshToken: string, user: UserResponse): void {
    localStorage.setItem(this.tokenKey, accessToken);
    localStorage.setItem(this.refreshTokenKey, refreshToken);
    const role = user?.role || 'USER';
    localStorage.setItem(this.roleKey, role);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.loggedIn$.next(true);
    this.role$.next(role);
  }

  private readRoleFromStorage(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  private getTokenPayload(): any | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }
}
