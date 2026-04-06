import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FadeInDirective } from '../../fade-in.directive';

@Component({
  selector: 'app-donate',
  standalone: true,
  imports: [CommonModule, FormsModule, FadeInDirective],
  templateUrl: './donate.component.html',
  styleUrl: './donate.component.css'
})
export class DonateComponent {
  selectedAmount: number | null = 20;
  customAmount: number | null = null;
  donateState: 'idle' | 'processing' | 'confirmed' = 'idle';
  donateBtnBg = 'var(--forest)';

  selectAmount(amount: number) {
    this.selectedAmount = amount;
    this.customAmount = null;
  }

  handleDonate() {
    if (this.donateState !== 'idle') return;

    this.donateState = 'processing';
    this.donateBtnBg = 'var(--sage)';
    
    setTimeout(() => {
      this.donateState = 'confirmed';
      this.donateBtnBg = 'var(--moss)';
      
      setTimeout(() => {
        this.donateState = 'idle';
        this.donateBtnBg = 'var(--forest)';
      }, 3000);
    }, 1800);
  }
}
