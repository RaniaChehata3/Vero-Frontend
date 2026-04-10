import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginEmail = '';
  loginPassword = '';
  loginError = '';
  loginLoading = false;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private cartService: CartService
  ) {}

  goBack(): void {
    window.history.back();
  }

  login(): void {
    if (!this.loginEmail || !this.loginPassword) return;
    this.loginError = '';
    this.loginLoading = true;
    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.loginLoading = false;
        // Reinitialize cart for the new user
        this.cartService.reinitializeCart();
        
        // Check if user is admin and redirect accordingly
        this.authService.getCurrentUser().subscribe({
          next: (user) => {
            if (user.role === 'ADMIN') {
              this.router.navigate(['/admin']);
            } else {
              this.router.navigate(['/track']);
            }
          },
          error: () => {
            // If we can't get user info, just go to track
            this.router.navigate(['/track']);
          }
        });
      },
      error: (err) => {
        this.loginLoading = false;
        this.loginError = err?.status === 401
          ? 'Invalid credentials. Please check your email and password.'
          : 'Connection failed. Is the backend running?';
      }
    });
  }
}
