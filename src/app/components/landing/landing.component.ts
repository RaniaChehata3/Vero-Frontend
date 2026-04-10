import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FadeInDirective } from '../../fade-in.directive';
import { StatsComponent } from '../stats/stats.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, FadeInDirective, StatsComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit, OnDestroy {
  heroTexts = [
    { text: 'Track your impact', color: 'var(--fern)' },
    { text: 'Shop sustainably', color: 'var(--forest)' },
    { text: 'Join the movement', color: 'var(--sage)' },
    { text: 'Fund the future', color: 'var(--moss)' }
  ];
  
  currentTextIndex = 0;
  textInterval: any;

  ngOnInit() {
    this.textInterval = setInterval(() => {
      this.currentTextIndex = (this.currentTextIndex + 1) % this.heroTexts.length;
    }, 3000);
  }

  ngOnDestroy() {
    if (this.textInterval) {
      clearInterval(this.textInterval);
    }
  }
}
