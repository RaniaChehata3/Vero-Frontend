import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ForumService } from '../../services/forum.service';
import { AuthService } from '../../services/auth.service';
import { Notification } from '../../services/forum.models';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount = 0;
  showDropdown = false;
  private pollInterval: any;

  constructor(
    private forumService: ForumService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
  }

  ngOnInit() {
    if (this.authService.isLoggedIn) {
      this.fetchNotifications();
      // Poll every 30 seconds
      this.pollInterval = setInterval(() => this.fetchNotifications(), 30000);
    }
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  fetchNotifications() {
    this.forumService.getUnreadNotifications().subscribe(nots => {
      this.notifications = nots.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.unreadCount = this.notifications.filter(n => !n.isRead).length;
      this.cdr.markForCheck();
    });
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown) {
      this.fetchNotifications();
    }
  }

  markAsRead(n: Notification, event: Event) {
    event.stopPropagation();
    this.forumService.markNotificationAsRead(n.id).subscribe(() => {
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.cdr.markForCheck();
    });
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showDropdown = false;
  }
}
