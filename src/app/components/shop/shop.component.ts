import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FadeInDirective } from '../../fade-in.directive';

interface Product {
  cat: string;
  bg: string;
  emoji: string;
  badge: string;
  brand: string;
  name: string;
  impact: string;
  price: string;
  added?: boolean;
}

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, FadeInDirective],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css'
})
export class ShopComponent {
  currentCategory = 'all';
  
  products: Product[] = [
    { cat: 'home', bg: '#e8f4e8', emoji: '🧴', badge: 'Verified B-Corp', brand: 'Sonett', name: 'Zero-Waste Laundry Set', impact: 'Saves <span>4.2 kg CO₂</span> vs conventional', price: '€24' },
    { cat: 'beauty', bg: '#f0ece4', emoji: '🌿', badge: 'Carbon Neutral', brand: 'Odacité', name: 'Organic Serum Set', impact: 'Saves <span>1.8 kg CO₂</span> vs conventional', price: '€89' },
    { cat: 'food', bg: '#e4ede4', emoji: '🥗', badge: 'Regenerative', brand: 'Forager', name: 'Monthly Organic Box', impact: 'Saves <span>6.1 kg CO₂</span> vs supermarket', price: '€49' },
    { cat: 'fashion', bg: '#e8e4dc', emoji: '👕', badge: 'Fair Trade', brand: 'Patagonia', name: 'Recycled Fleece Pullover', impact: 'Saves <span>8.5 kg CO₂</span> vs virgin material', price: '€119' },
    { cat: 'home', bg: '#dce8dc', emoji: '💡', badge: 'Energy Star', brand: 'Nanoleaf', name: 'Smart LED Essentials Kit', impact: 'Saves <span>22 kg CO₂</span> per year', price: '€59' },
    { cat: 'beauty', bg: '#ece8e4', emoji: '🧼', badge: 'Palm-Oil Free', brand: 'Ethique', name: 'Shampoo & Conditioner Bars', impact: 'Saves <span>3.0 kg CO₂</span> vs bottles', price: '€28' }
  ];

  get filteredProducts() {
    return this.currentCategory === 'all' 
      ? this.products 
      : this.products.filter(p => p.cat === this.currentCategory);
  }

  filterProducts(cat: string) {
    this.currentCategory = cat;
  }

  addToCart(product: Product) {
    product.added = true;
    setTimeout(() => {
      product.added = false;
    }, 1800);
  }
}
