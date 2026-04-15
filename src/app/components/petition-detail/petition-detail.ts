import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PetitionService, Petition } from '../../services/petition.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-petition-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './petition-detail.html',
  styleUrl: './petition-detail.css'
})
export class PetitionDetail {  // ← nom exact de la classe

  @Input() petition!: Petition;
  @Output() close = new EventEmitter<void>();
  @Output() signed = new EventEmitter<void>();

  comment = '';
  anonymous = false;
  signing = false;
  hasSigned = false;
  signError = '';
  signSuccess = false;

  get isAdmin(): boolean { return this.authService.isAdmin; }

  constructor(
    private petitionService: PetitionService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (this.petition?.id) {
      this.petitionService.hasSigned(this.petition.id).subscribe({
        next: (val: boolean) => this.hasSigned = val,
        error: () => this.hasSigned = false
      });
    }
  }

  get progress(): number {
    return this.petition?.targetSignatures
      ? Math.min(100, ((this.petition.currentSignatures || 0)
          / this.petition.targetSignatures) * 100)
      : 0;
  }

  get remaining(): number {
    return Math.max(0,
      (this.petition?.targetSignatures || 0)
      - (this.petition?.currentSignatures || 0));
  }

  sign() {
    if (this.signing || this.hasSigned || !this.petition?.id) return;
    this.signing = true;
    this.signError = '';

    this.petitionService.sign(
      this.petition.id,
      this.comment || undefined,
      this.anonymous
    ).subscribe({
      next: () => {
        this.signing = false;
        this.hasSigned = true;
        this.signSuccess = true;
        this.petition.currentSignatures =
          (this.petition.currentSignatures || 0) + 1;
        this.signed.emit();
      },
      error: (err: any) => {
        this.signing = false;
        this.signError = err.message || 'Error signing petition';
      }
    });
  }

  share(platform: string) {
    const url = window.location.href;
    const text = `Sign this petition: ${this.petition.title}`;
    if (platform === 'twitter') {
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        '_blank'
      );
    } else if (platform === 'facebook') {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        '_blank'
      );
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url).then(() => {
        alert('🔗 Link copied!');
      }).catch(() => {
        const el = document.createElement('input');
        el.value = url;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert('🔗 Link copied!');
      });
    }
  }

  formatDeadline(deadline?: string): string {
    if (!deadline) return '';
    const diff = Math.ceil(
      (new Date(deadline).getTime() - Date.now()) / 86400000
    );
    if (diff < 0) return 'Expired';
    if (diff === 0) return 'Last day!';
    if (diff <= 7) return `${diff} days left`;
    return new Date(deadline).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  getCategoryEmoji(cat: string): string {
    const map: Record<string, string> = {
      TRANSPORT: '🚲', POLLUTION: '🏭', DECHETS: '♻️',
      ESPACES_VERTS: '🌳', ENERGIE: '⚡', EAU: '💧',
      SENSIBILISATION: '📢', AUTRE: '🌍'
    };
    return map[cat] || '🌿';
  }
}