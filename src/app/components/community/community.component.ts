import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ForumService } from '../../services/forum.service';
import { Post } from '../../services/forum.models';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css'
})
export class CommunityComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('communityCanvas', { static: false }) communityCanvas!: ElementRef<HTMLCanvasElement>;
  private dotGridRaf: number | null = null;
  private dotMouseHandler: ((e: MouseEvent) => void) | null = null;

  posts: Post[] = [];
  currentUserEmail: string | null = null;
  editingPostId: number | null = null;
  editPostContent = '';
  loading = false;
  isLoggedIn = false;

  showForm = false;
  newPost: Partial<Post> = {
    title: '',
    content: '',
    category: 'DISCUSSION'
  };

  toxicError = '';

  constructor(
    private forumService: ForumService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn;
    this.currentUserEmail = this.authService.currentUserEmail;
    this.loadPosts();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.ngZone.runOutsideAngular(() => this.initDotGrid()), 50);

    // ── Universal Scroll-Typewriter: any element with data-tw types in when visible ──
    const typewriteEl = (el: HTMLElement) => {
      const text = el.getAttribute('data-tw') || '';
      if (!text || el.classList.contains('tw-done')) return;
      el.classList.add('tw-done');
      el.textContent = '';

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
            twObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    setTimeout(() => {
      document.querySelectorAll('[data-tw]').forEach(el => twObserver.observe(el));
    }, 600);
  }

  ngOnDestroy(): void {
    if (this.dotGridRaf)      cancelAnimationFrame(this.dotGridRaf);
    if (this.dotMouseHandler) window.removeEventListener('mousemove', this.dotMouseHandler);
  }

  private initDotGrid(): void {
    const canvas = this.communityCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Community palette — navy/gold accent (different from tracker's green)
    const SPACING   = 26;
    const DOT_R     = 1.5;
    const MAX_R     = 5;
    const REPEL_R   = 120;
    const DOT_COLOR = '200, 175, 120'; // warm gold/amber — shines on deep navy bg
    const LERP      = 0.12;

    let mouse = { x: -9999, y: -9999 };
    let dots: { ox: number; oy: number; x: number; y: number }[] = [];

    const buildGrid = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
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
      mouse.x = e.clientX;
      mouse.y = e.clientY + window.scrollY;
    };
    window.addEventListener('mousemove', this.dotMouseHandler, { passive: true });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scrollY = window.scrollY;
      const viewTop = scrollY - SPACING;
      const viewBot = scrollY + window.innerHeight + SPACING;

      for (const d of dots) {
        if (d.oy < viewTop || d.oy > viewBot) continue;

        const dx = d.ox - mouse.x;
        const dy = d.oy - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_R && dist > 0) {
          const force = (1 - dist / REPEL_R);
          const push  = force * force * 44;
          const angle = Math.atan2(dy, dx);
          d.x = d.ox + Math.cos(angle) * push;
          d.y = d.oy + Math.sin(angle) * push;
        } else {
          d.x += (d.ox - d.x) * LERP;
          d.y += (d.oy - d.y) * LERP;
        }

        const curDist  = Math.sqrt((d.x - mouse.x) ** 2 + (d.y - mouse.y) ** 2);
        const proximity = Math.max(0, 1 - curDist / REPEL_R);
        const r     = DOT_R + (MAX_R - DOT_R) * proximity;
        const alpha = 0.22 + 0.65 * proximity;

        ctx.beginPath();
        ctx.arc(d.x, d.y - scrollY, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${DOT_COLOR},${alpha})`;
        ctx.fill();
      }

      this.dotGridRaf = requestAnimationFrame(draw);
    };
    this.dotGridRaf = requestAnimationFrame(draw);
  }

  likePost(id?: number) {
    if (!this.isLoggedIn || !id) return;
    this.forumService.likePost(id).subscribe({
      next: (updated) => {
        const index = this.posts.findIndex(p => p.id === id);
        if (index > -1) this.posts[index].likes = updated.likes;
      }
    });
  }

  deletePost(id: number, event: Event) {
    event.stopPropagation();
    event.preventDefault(); // Prevents the router link
    if (!confirm('Are you sure you want to delete this discussion?')) return;
    
    this.forumService.deletePost(id).subscribe(() => {
      this.posts = this.posts.filter(p => p.id !== id);
      this.cdr.markForCheck();
    });
  }

  startEdit(post: Post, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.editingPostId = post.id!;
    this.editPostContent = post.content;
  }

  cancelEdit(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.editingPostId = null;
  }

  saveEdit(post: Post, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    if (!this.editPostContent.trim()) return;

    this.forumService.updatePost(post.id!, { ...post, content: this.editPostContent }).subscribe({
      next: (updated) => {
        post.content = updated.content;
        this.editingPostId = null;
        this.cdr.markForCheck();
      }
    });
  }

  loadPosts() {
    this.loading = true;
    this.forumService.getAllPosts().subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.posts = (data || []).sort((a,b) => 
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          this.loading = false;
          this.cdr.markForCheck();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.markForCheck();
        });
      }
    });
  }

  submitPost() {
    this.toxicError = '';
    if(!this.newPost.title || !this.newPost.content) return;

    this.forumService.createPost(this.newPost).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.showForm = false;
          this.newPost = { title: '', content: '', category: 'DISCUSSION' };
          this.loadPosts();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          if(err.error && typeof err.error === 'string' && err.error.includes('bloqué')) {
            this.toxicError = err.error;
          } else {
            this.toxicError = 'An error occurred while posting.';
          }
          this.cdr.markForCheck();
        });
      }
    });
  }



  formatDate(d?: string) {
    if(!d) return '';
    return new Date(d).toLocaleDateString();
  }
}
