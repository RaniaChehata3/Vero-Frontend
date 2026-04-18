import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
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

  ngAfterViewInit() {
    setTimeout(() => {
      // Trigger fade-in animations
      document.querySelectorAll('.fade-in').forEach(el => {
        el.classList.add('visible');
      });

      // ══ CINEMATIC STORYTELLING (HORIZONTAL SCROLL) ══
      // Replaced GSAP pin with native CSS sticky in stylesheet, and a vanilla scroll listener
      const storyContainer = document.querySelector('.storytelling-container') as HTMLElement;
      const storyPanelsWrapper = document.querySelector('.story-panels-wrapper') as HTMLElement;
      
      if (storyContainer && storyPanelsWrapper) {
        // We use requestAnimationFrame for smooth scrolling without GSAP
        let ticking = false;
        
        window.addEventListener('scroll', () => {
          if (!ticking) {
            window.requestAnimationFrame(() => {
              const rect = storyContainer.getBoundingClientRect();
              
              // Only animate when the container is in view
              if (rect.top <= window.innerHeight && rect.bottom >= 0) {
                // Calculate how far we've scrolled into the container
                const scrolled = Math.max(0, -rect.top);
                // Total scrollable distance inside the container (container height - viewport height)
                const totalScrollable = rect.height - window.innerHeight;
                
                // Progress from 0 to 1
                let progress = scrolled / totalScrollable;
                progress = Math.min(Math.max(progress, 0), 1);
                
                // We have 3 panels (300vw). We want to translate from 0 to -200vw (or -66.666%)
                const xTranslate = progress * -66.666;
                storyPanelsWrapper.style.transform = `translateX(${xTranslate}%)`;
              }
              ticking = false;
            });
            ticking = true;
          }
        }, { passive: true });
      }

      // ══ SMART VIDEO MANAGER: lazy-load + play/pause on visibility ══
      // Critical: with sticky stacking, ALL videos decode simultaneously unless paused.
      // This observer loads them when near viewport, plays when visible, pauses when hidden.
      const allVideos = document.querySelectorAll('.lazy-video');
      const videoPlayPause = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            // First visit: load the source
            if (video.dataset['src'] && !video.src) {
              video.src = video.dataset['src'];
              video.removeAttribute('data-src');
              video.load();
            }
            video.play().catch(() => {});
          } else {
            // CRUCIAL: pause video when it leaves viewport to free decoder resources
            if (video.src) {
              video.pause();
            }
          }
        });
      }, { rootMargin: '200px 0px 200px 0px' });

      allVideos.forEach(v => videoPlayPause.observe(v));


      // ══ BURST ANIMATION — Pure CSS via IntersectionObserver ══
      // No GSAP ticker involved: just toggle a class, let the GPU/compositor do the rest
      const burstObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const stage = entry.target as HTMLElement;
            const items = stage.querySelector('.shop-items-container') as HTMLElement;
            const textWrapper = stage.closest('.shop-grid-layout')?.querySelector('.shop-editorial-text') as HTMLElement;

            if (items) items.classList.add('burst-active');
            if (textWrapper) textWrapper.classList.add('burst-active-text');

            observer.unobserve(stage); // Fire once, then disconnect
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

      document.querySelectorAll('.shop-visual-stage').forEach(stage => {
        burstObserver.observe(stage);
      });
    }, 100); // slight delay to ensure DOM is fully ready
  }

  ngOnDestroy() {
    if (this.textInterval) {
      clearInterval(this.textInterval);
    }
  }
}
