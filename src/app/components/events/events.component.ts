import { Component } from '@angular/core';
import { FadeInDirective } from '../../fade-in.directive';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [FadeInDirective],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css'
})
export class EventsComponent {
}
