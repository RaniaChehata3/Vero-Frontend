import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CarbonActivityService } from '../../services/carbon-activity.service';
import { CarbonGoalService } from '../../services/carbon-goal.service';
import { CarbonTipService } from '../../services/carbon-tip.service';
import { CarbonAIService } from '../../services/carbon-ai.service';
import { AuthService } from '../../services/auth.service';
import {
  CarbonActivity, CarbonGoal, ActivityType,
  ACTIVITY_ICONS, ACTIVITY_LABELS, ACTIVITY_COLORS
} from '../../services/carbon.models';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.css'
})
export class TrackerComponent implements OnInit {
  // ─── Auth ───
  isLoggedIn = false;
  loginEmail = '';
  loginPassword = '';
  loginError = '';
  loginLoading = false;

  // ─── Data ───
  carbonByType: Record<string, number> = {};
  totalCarbon = 0;
  activities: CarbonActivity[] = [];
  activeGoals: CarbonGoal[] = [];
  tips: string[] = [];

  // ─── UI State ───
  loading = false;
  loadError = '';

  // ─── Computed ───
  categoryRows: { type: ActivityType; icon: string; label: string; value: number; pct: number; color: string }[] = [];
  ringOffset = 816.81;

  // ─── Forms ───
  showAddForm = false;
  submitting = false;
  newActivity: Partial<CarbonActivity> = {
    activityType: 'TRANSPORT',
    description: '',
    carbonKg: 0,
    source: 'MANUAL'
  };

  aiText = '';
  aiLoading = false;
  aiResult: CarbonActivity | null = null;

  // ─── Editing ───
  editingActivityId: number | null = null;
  editActivityData: Partial<CarbonActivity> = {};

  // ─── Helpers ───
  activityTypes: ActivityType[] = ['TRANSPORT', 'FOOD', 'ENERGY', 'SHOPPING'];
  icons = ACTIVITY_ICONS;
  labels = ACTIVITY_LABELS;
  colors = ACTIVITY_COLORS;

  constructor(
    private activityService: CarbonActivityService,
    private goalService: CarbonGoalService,
    private tipService: CarbonTipService,
    private aiService: CarbonAIService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn;
    if (this.isLoggedIn) {
      this.loadData();
    } else {
      this.router.navigate(['/login']);
    }
  }

  login(): void {
    if (!this.loginEmail || !this.loginPassword) return;
    this.loginError = '';
    this.loginLoading = true;
    this.authService.login(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.isLoggedIn = true;
        this.loginLoading = false;
        this.loadData();
      },
      error: (err) => {
        this.loginLoading = false;
        this.loginError = err?.status === 401
          ? 'Invalid credentials. Please check your email and password.'
          : 'Connection failed. Is the backend running?';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    this.activities = [];
    this.tips = [];
    this.activeGoals = [];
    this.totalCarbon = 0;
    this.categoryRows = [];
    this.ringOffset = 816.81;
  }

  loadData(): void {
    this.loading = true;
    this.loadError = '';

    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;

    forkJoin({
      activities: this.activityService.getAll().pipe(catchError(() => of([] as CarbonActivity[]))),
      total:      this.activityService.getTotal(startDate, endDate).pipe(catchError(() => of(0))),
      byType:     this.activityService.getCarbonByType().pipe(catchError(() => of({} as Record<string, number>))),
      goals:      this.goalService.getActive().pipe(catchError(() => of([] as CarbonGoal[]))),
      tips:       this.tipService.getRecommended().pipe(catchError(() => of([] as string[]))),
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: ({ activities, total, byType, goals, tips }) => {
        this.ngZone.run(() => {
          this.activities   = activities ?? [];
          this.totalCarbon  = typeof total === 'number' && isFinite(total)
            ? Math.round(total * 100) / 100 : 0;
          this.carbonByType = byType ?? {};
          this.activeGoals  = goals ?? [];
          this.tips         = tips ?? [];
          this.computeCategories();
          this.computeRing();
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loadError = 'Failed to load data. Please try refreshing.';
          this.cdr.markForCheck();
        });
      }
    });
  }

  computeCategories(): void {
    const vals  = Object.values(this.carbonByType).filter(v => typeof v === 'number' && isFinite(v));
    const maxVal = vals.length > 0 ? Math.max(...vals) : 1;
    this.categoryRows = this.activityTypes.map(type => ({
      type,
      icon:  ACTIVITY_ICONS[type],
      label: ACTIVITY_LABELS[type],
      value: this.carbonByType[type] ?? 0,
      pct:   maxVal > 0 ? ((this.carbonByType[type] ?? 0) / maxVal) * 100 : 0,
      color: ACTIVITY_COLORS[type]
    }));
  }

  computeRing(): void {
    const CIRC = 816.81;
    const pct  = Math.min((this.totalCarbon || 0) / 10000, 1);
    this.ringOffset = CIRC * (1 - pct);
  }

  // ─── CRUD ───
  submitActivity(): void {
    if (!this.newActivity.description?.trim() || !this.newActivity.carbonKg) return;
    this.submitting = true;

    const payload: Partial<CarbonActivity> = {
      ...this.newActivity,
      date: new Date().toISOString().split('T')[0]
    };

    // ── Optimistic update: show item instantly before server confirms ──
    const optimistic: CarbonActivity = {
      activityType: (payload.activityType ?? 'TRANSPORT') as ActivityType,
      description:  payload.description ?? '',
      carbonKg:     payload.carbonKg ?? 0,
      date:         payload.date ?? '',
      source:       'MANUAL'
    };
    this.activities    = [optimistic, ...this.activities];
    this.totalCarbon   = Math.round((this.totalCarbon + optimistic.carbonKg) * 100) / 100;
    this.carbonByType  = {
      ...this.carbonByType,
      [optimistic.activityType]: (this.carbonByType[optimistic.activityType] ?? 0) + optimistic.carbonKg
    };
    this.computeCategories();
    this.cdr.markForCheck();

    // Close & reset form immediately
    this.showAddForm = false;
    this.newActivity  = { activityType: 'TRANSPORT', description: '', carbonKg: 0, source: 'MANUAL' };

    // Then persist and reconcile with server truth
    this.activityService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.loadData();
      },
      error: () => {
        // Roll back optimistic update on server failure
        this.submitting = false;
        this.loadData();
      }
    });
  }

  startEditActivity(a: CarbonActivity): void {
    this.editingActivityId = a.id!;
    this.editActivityData = { ...a };
  }

  cancelEditActivity(): void {
    this.editingActivityId = null;
    this.editActivityData = {};
  }

  saveEditActivity(): void {
    if (!this.editingActivityId || !this.editActivityData.description?.trim()) return;
    this.submitting = true;

    this.activityService.update(this.editingActivityId, this.editActivityData).subscribe({
      next: () => {
        this.submitting = false;
        this.editingActivityId = null;
        this.loadData();
      },
      error: () => {
        this.submitting = false;
        this.loadData();
      }
    });
  }

  deleteActivity(id: number): void {
    // Optimistic removal
    this.activities   = this.activities.filter(a => a.id !== id);
    this.cdr.markForCheck();
    this.activityService.delete(id).subscribe({
      next:  () => this.loadData(),
      error: () => this.loadData() // restore on failure
    });
  }

  // ─── AI ───
  analyzeWithAI(): void {
    if (!this.aiText.trim()) return;
    this.aiLoading = true;
    this.aiResult  = null;
    this.aiService.analyze(this.aiText).subscribe({
      next: result => {
        this.aiResult  = result;
        this.aiLoading = false;
        this.aiText    = '';
        this.loadData();
      },
      error: () => {
        this.aiLoading = false;
        this.aiResult  = null;
      }
    });
  }

  formatKg(kg: number): string {
    if (!kg || !isFinite(kg)) return '0 kg';
    if (kg >= 1000) return (kg / 1000).toFixed(1) + 't';
    return kg.toFixed(1) + ' kg';
  }
}
