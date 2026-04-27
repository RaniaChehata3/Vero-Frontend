import { Component, OnInit, ViewEncapsulation, AfterViewInit, ElementRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ProductService } from '../../services/product.service';
import { FormationService } from '../../services/formation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminFormationsComponent } from './admin-formations/admin-formations.component';
import { AdminForumComponent } from './admin-forum/admin-forum.component';
import { ForumService } from '../../services/forum.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminUsersComponent,
    AdminProductsComponent,
    AdminFormationsComponent,
    AdminForumComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit, AfterViewInit {
  activeTab: 'users' | 'add' | 'settings' | 'edit' | 'products' | 'formations' | 'forum' = 'users';
  adminMe: UserResponse | null = null;
  topicHeatmapTotal = 0;
  suspendedCount = 0;
  monitoredCount = 0;
  userCount = 0;
  productCount = 0;
  formationCount = 0;
  forumStats = { totalPosts: 0, flaggedCount: 0 };

  // ── Dashboard display helpers ──
  currentDate: string = '';
  currentMonth: string = '';
  calendarDates: { num: number; isToday: boolean }[] = [];

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private productService: ProductService,
    private formationService: FormationService,
    private forumService: ForumService,
    private route: ActivatedRoute,
    private router: Router,
    private el: ElementRef
  ) { }

  ngOnInit(): void {
    this._initDateHelpers();

    // Read ?tab= from navbar links
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'products') {
        this.setTab('products');
      } else if (params['tab'] === 'formations') {
        this.setTab('formations');
      }
    });

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.ensureNotificationPermission();
      },
      error: () => {
        const cached = this.authService.currentUser;
        if (cached) {
          this.adminMe = cached;
        }
      }
    });

    this._loadDashboardStats();
  }

  ngAfterViewInit(): void {
    // Trigger initial count-up after animations settle
    setTimeout(() => {
      this._animateCounter('stat-card-users', this.userCount);
      this._animateCounter('stat-card-formations', this.formationCount);
      this._animateCounter('stat-card-products', this.productCount);
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    }, 1000);
  }

  private _loadDashboardStats(): void {
    // Fetch users count
    this.adminService.getUsers(0, 1).subscribe(data => {
      this.userCount = data.totalElements;
      this._animateCounter('stat-card-users', this.userCount);
    });

    // Fetch products count
    this.productService.getAll().subscribe(products => {
      this.productCount = products.length;
      this._animateCounter('stat-card-products', this.productCount);
    });

    // Fetch formations count
    this.formationService.getAll().subscribe(formations => {
      this.formationCount = formations.length;
      this._animateCounter('stat-card-formations', this.formationCount);
    });

    // Fetch forum stats
    this.forumService.getAllPosts().subscribe(posts => {
      this.forumStats.totalPosts = posts.length;
      this.forumStats.flaggedCount = posts.filter(p => p.isFlagged).length;
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    });
  }

  private _animateCounter(cardId: string, target: number): void {
    const card = document.getElementById(cardId);
    if (!card) return;
    const span = card.querySelector<HTMLElement>('.vc-stat-number-inner');
    if (!span) return;

    if (target === 0) {
      span.textContent = '0';
      return;
    }

    const duration = 1200; // ms
    const startTime = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const progress = easeOut(elapsed / duration);
      const current = Math.round(progress * target);
      span.textContent = current.toLocaleString();
      if (elapsed < duration) requestAnimationFrame(tick);
      else span.textContent = target.toLocaleString();
    };

    requestAnimationFrame(tick);
  }

  // FIXED — tab changes instantly on first click, no blocking
  setTab(tab: 'users' | 'add' | 'settings' | 'edit' | 'products' | 'formations' | string): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab as any;
  }

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  private _initDateHelpers(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    this.currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const today = now.getDate();
    this.calendarDates = [-3, -2, -1, 0, 1, 2, 3].map(offset => ({
      num: today + offset,
      isToday: offset === 0
    }));
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }
}