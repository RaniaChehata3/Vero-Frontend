import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, NgZone, ElementRef, QueryList, ViewChildren, ViewChild } from '@angular/core';
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
import { EcosystemScene } from './scene-manager';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.css'
})
export class TrackerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ecoCanvas',    { static: false }) ecoCanvas!:    ElementRef<HTMLDivElement>;
  @ViewChild('dotCanvas',    { static: false }) dotCanvas!:    ElementRef<HTMLCanvasElement>;
  @ViewChild('typedHeadline',{ static: false }) typedHeadline!:ElementRef<HTMLSpanElement>;
  @ViewChild('typedAiDesc',  { static: false }) typedAiDesc!:  ElementRef<HTMLSpanElement>;
  private ecoScene!: EcosystemScene;
  private dotGridRaf: number | null = null;
  private dotMouseHandler: ((e: MouseEvent) => void) | null = null;
  private twRaf: number | null = null;  // typewriter RAF

  // Cycling placeholder prompts for the AI bar
  typedPlaceholder = '';
  private phraseCycle = [
    'Drove 40 km to work today...',
    'Had a steak dinner last night...',
    'Flew London to Paris...',
    'Turned on the AC for 3 hours...',
    'Ordered online delivery x2...',
    'Describe an activity — AI will calculate its impact...'
  ];
  private phraseIndex = 0;
  private phraseRaf: ReturnType<typeof setTimeout> | null = null;
  
  ecoHealth = 0;
  ecoLabel = '';
  ecoLoading = true;

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
  displayCarbon = 0;   // animated counter value
  heroReady = false;   // controls CSS class for hero entrance

  // ─── Forms ───
  showAddForm = false;
  showGoalForm = false;
  submitting = false;
  newActivity: Partial<CarbonActivity> = {
    activityType: 'TRANSPORT',
    description: '',
    carbonKg: 0,
    source: 'MANUAL'
  };

  newGoal: Partial<CarbonGoal> = {
    activityType: 'TRANSPORT',
    targetCarbonKg: 0,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
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
    if (this.authService.isLoggedIn) {
      this.loadData();
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngAfterViewInit(): void {
    if (this.ecoCanvas) {
      this.ngZone.runOutsideAngular(() => {
        this.ecoScene = new EcosystemScene(this.ecoCanvas.nativeElement);
      });
    }

    // Trigger hero entrance animation slightly after paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.heroReady = true;
          this.cdr.markForCheck();
        });
      }, 80);
    });

    // Intersection Observer for scroll-reveal on body cards
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.08 }
    );
    // Observe after data renders — slight delay
    setTimeout(() => {
      document.querySelectorAll('.vt-observe').forEach(el => observer.observe(el));
    }, 500);

    // ── Universal Scroll-Typewriter: any element with data-tw types in when visible ──
    const typewriteEl = (el: HTMLElement) => {
      const text = el.getAttribute('data-tw') || '';
      if (!text || el.classList.contains('tw-done')) return;
      el.classList.add('tw-done');
      el.textContent = '';

      // Calculate speed: shorter texts type faster
      const charSpeed = text.length > 20 ? 30 : 45;
      let i = 0;
      const tick = () => {
        if (i <= text.length) {
          el.textContent = text.substring(0, i);
          i++;
          setTimeout(tick, charSpeed);
        }
      };
      tick();
    };

    const twObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            typewriteEl(entry.target as HTMLElement);
            twObserver.unobserve(entry.target); // only once
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe all [data-tw] elements — deferred to wait for data render
    setTimeout(() => {
      document.querySelectorAll('[data-tw]').forEach(el => twObserver.observe(el));
    }, 600);

    // Init Stitch-style interactive dot grid — deferred to ensure ViewChild is painted
    setTimeout(() => this.ngZone.runOutsideAngular(() => this.initDotGrid()), 50);

    // Typewriter: headline on load
    setTimeout(() => this.typeHeadline(), 200);

    // Typewriter: cycling placeholder for AI bar
    this.cyclePlaceholder();
  }

  ngOnDestroy(): void {
    if (this.ecoScene)        this.ecoScene.dispose();
    if (this.dotGridRaf)      cancelAnimationFrame(this.dotGridRaf);
    if (this.dotMouseHandler) window.removeEventListener('mousemove', this.dotMouseHandler);
    if (this.twRaf)           cancelAnimationFrame(this.twRaf);
    if (this.phraseRaf)       clearTimeout(this.phraseRaf);
  }

  // ── Typewriter: Main Headline ─────────────────────────────────────
  private typeHeadline(): void {
    const el = this.typedHeadline?.nativeElement;
    if (!el) return;

    // HTML with the italic <em> tag preserved
    const segments = [
      { text: 'Your ', em: false },
      { text: 'Carbon', em: true },
      { text: ' Footprint', em: false }
    ];

    let segIdx = 0;
    let charIdx = 0;
    el.innerHTML = '';

    const tick = () => {
      if (segIdx >= segments.length) return; // done
      const seg = segments[segIdx];
      if (charIdx < seg.text.length) {
        // Append next character in appropriate element
        let span = el.querySelector(`[data-seg="${segIdx}"]`) as HTMLElement | null;
        if (!span) {
          span = document.createElement(seg.em ? 'em' : 'span');
          span.setAttribute('data-seg', String(segIdx));
          el.appendChild(span);
        }
        span.textContent += seg.text[charIdx];
        charIdx++;
      } else {
        segIdx++;
        charIdx = 0;
      }
      setTimeout(tick, segIdx === 1 && charIdx === 0 ? 80 : 55); // slight pause before 'Carbon'
    };
    tick();
  }

  // ── Typewriter: Cycling AI placeholder ────────────────────────────
  private cyclePlaceholder(): void {
    const phrase = this.phraseCycle[this.phraseIndex];
    let i = 0;

    const typeChar = () => {
      if (i <= phrase.length) {
        this.ngZone.run(() => { this.typedPlaceholder = phrase.substring(0, i); });
        i++;
        this.phraseRaf = setTimeout(typeChar, 45);
      } else {
        // Pause then erase
        this.phraseRaf = setTimeout(() => this.erasePhrase(phrase.length), 1800);
      }
    };
    typeChar();
  }

  private erasePhrase(len: number): void {
    let i = len;
    const erase = () => {
      if (i >= 0) {
        this.ngZone.run(() => {
          this.typedPlaceholder = this.phraseCycle[this.phraseIndex].substring(0, i);
        });
        i--;
        this.phraseRaf = setTimeout(erase, 20);
      } else {
        // Next phrase
        this.phraseIndex = (this.phraseIndex + 1) % this.phraseCycle.length;
        this.phraseRaf = setTimeout(() => this.cyclePlaceholder(), 300);
      }
    };
    erase();
  }

  // ── Typewriter: AI result description ─────────────────────────────
  private typeAiResult(text: string): void {
    const el = this.typedAiDesc?.nativeElement;
    if (!el) return;
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        el.textContent = text.substring(0, i);
        i++;
        setTimeout(tick, 18); // fast — feels like real-time AI output
      }
    };
    tick();
  }

  private initDotGrid(): void {
    const canvas = this.dotCanvas?.nativeElement;
    if (!canvas) { console.warn('[DotGrid] canvas not found'); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Config — tune these to adjust the look ──────────────────
    const SPACING   = 26;          // px between each dot
    const DOT_R     = 1.5;         // resting dot radius
    const MAX_R     = 5;           // radius at cursor center
    const REPEL_R   = 120;         // cursor influence radius in px
    const DOT_COLOR = '140, 190, 160'; // light refreshing mint/sage for dark bg
    const LERP      = 0.12;        // spring-back speed (lower = slower)
    // ────────────────────────────────────────────────────────────

    let mouse = { x: -9999, y: -9999 };
    let dots: { ox: number; oy: number; x: number; y: number }[] = [];

    const buildGrid = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight; // Must match viewport to prevent fixed element squishing
      dots = [];
      const cols = Math.ceil(canvas.width  / SPACING) + 2;
      const rows = Math.ceil(document.documentElement.scrollHeight / SPACING) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({ ox: c * SPACING, oy: r * SPACING, x: c * SPACING, y: r * SPACING });
        }
      }
    };

    buildGrid();
    window.addEventListener('resize', buildGrid, { passive: true });

    this.dotMouseHandler = (e: MouseEvent) => {
      // Account for scroll position since canvas is fixed
      mouse.x = e.clientX;
      mouse.y = e.clientY + window.scrollY;
    };
    window.addEventListener('mousemove', this.dotMouseHandler!, { passive: true });

    const draw = () => {
      // Clear the fixed viewport canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const scrollY = window.scrollY;
      const viewTop = scrollY;
      const viewBot = scrollY + window.innerHeight + SPACING;

      for (const d of dots) {
        // Skip dots not in the visible viewport (perf optimisation)
        if (d.oy < viewTop - SPACING || d.oy > viewBot) continue;

        const dx   = d.ox - mouse.x;
        const dy   = d.oy - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_R && dist > 0) {
          const force = (1 - dist / REPEL_R);       // 0→1
          const push  = force * force * 44;          // squared for sharp bubble
          const angle = Math.atan2(dy, dx);
          d.x = d.ox + Math.cos(angle) * push;
          d.y = d.oy + Math.sin(angle) * push;
        } else {
          d.x += (d.ox - d.x) * LERP;
          d.y += (d.oy - d.y) * LERP;
        }

        const curDist = Math.sqrt((d.x - mouse.x) ** 2 + (d.y - mouse.y) ** 2);
        const proximity = Math.max(0, 1 - curDist / REPEL_R);

        const r     = DOT_R + (MAX_R - DOT_R) * proximity;
        const alpha = 0.28 + 0.65 * proximity;  // 0.28 base → 0.93 at cursor

        ctx.beginPath();
        ctx.arc(d.x, d.y - scrollY, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR},${alpha})`;
        ctx.fill();
      }

      this.dotGridRaf = requestAnimationFrame(draw);
    };

    this.dotGridRaf = requestAnimationFrame(draw);
  }

  loadData(): void {
    this.loading = true;
    this.loadError = '';

    const year = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;

    // 1. Instantly load the fast database queries
    forkJoin({
      activities: this.activityService.getAll().pipe(catchError(() => of([] as CarbonActivity[]))),
      total:      this.activityService.getTotal(startDate, endDate).pipe(catchError(() => of(0))),
      byType:     this.activityService.getCarbonByType().pipe(catchError(() => of({} as Record<string, number>))),
      goals:      this.goalService.getAll().pipe(catchError(() => of([] as CarbonGoal[])))
    }).pipe(
      finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: ({ activities, total, byType, goals }) => {
        this.ngZone.run(() => {
          this.activities   = activities ?? [];
          this.totalCarbon  = typeof total === 'number' && isFinite(total)
            ? Math.round(total * 100) / 100 : 0;
          this.carbonByType = byType ?? {};
          // Display all goals belonging to the user, ensure progress is capped at 100% visually
          this.activeGoals  = (goals ?? []).map(g => ({
            ...g,
            progressPct: Math.min(g.progressPct || 0, 100)
          }));
          this.computeCategories();
          this.computeRing();
          this.computeEcoHealth();
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

    // 2. Load the slow AI personalized tips asynchronously in the background
    this.tipService.getRecommended().pipe(catchError(() => of([] as string[]))).subscribe(tips => {
      this.ngZone.run(() => {
        this.tips = tips ?? [];
        this.cdr.markForCheck();
      });
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

    // Animated counter: count up from 0 to totalCarbon
    const target   = this.totalCarbon;
    const duration = 1800;
    const start    = performance.now();
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const tick = (now: number) => {
      const elapsed  = Math.min(now - start, duration);
      const progress = easeOutQuart(elapsed / duration);
      this.ngZone.run(() => {
        this.displayCarbon = Math.round(progress * target * 10) / 10;
        this.cdr.markForCheck();
      });
      if (elapsed < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ─── Eco Health ───
  computeEcoHealth(): void {
    if (this.activeGoals.length === 0) {
      const ratio = Math.min(this.totalCarbon / 5000, 1);
      this.ecoHealth = Math.round((1 - ratio) * 100);
    } else {
      let totalScore = 0;
      let counted = 0;
      for (const goal of this.activeGoals) {
        const pct = goal.progressPct || 0;
        totalScore += Math.max(0, 100 - pct);
        counted++;
      }
      this.ecoHealth = counted > 0 ? Math.round(totalScore / counted) : 70;
    }

    if (this.ecoHealth >= 80)      this.ecoLabel = 'Thriving';
    else if (this.ecoHealth >= 60) this.ecoLabel = 'Stable';
    else if (this.ecoHealth >= 35) this.ecoLabel = 'Stressed';
    else                           this.ecoLabel = 'Declining';

    if (this.ecoScene) {
      this.ecoScene.setHealth(this.ecoHealth);
    }
  }

  // ─── CRUD ───
  submitGoal(): void {
    if (!this.newGoal.targetCarbonKg || !this.newGoal.startDate || !this.newGoal.endDate) return;
    this.submitting = true;
    
    const payload: Partial<CarbonGoal> = { ...this.newGoal };

    this.goalService.create(payload)
      .pipe(finalize(() => { this.submitting = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (created) => {
          this.activeGoals.push({ ...created, progressPct: 0 });
          this.showGoalForm = false;
          // Reset form
          this.newGoal = { 
            activityType: 'TRANSPORT', 
            targetCarbonKg: 0,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0]
          };
        },
        error: (err) => console.error('Goal submission failed', err)
      });
  }

  deleteGoal(id: number): void {
    this.activeGoals = this.activeGoals.filter(g => g.id !== id);
    this.goalService.delete(id).subscribe({
      error: () => this.loadData() // Revert on failure
    });
  }

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
        // Typewrite the AI result description after a brief render cycle
        setTimeout(() => this.typeAiResult(result.description ?? ''), 80);
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
