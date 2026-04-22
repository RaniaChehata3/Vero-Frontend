import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, filter, of, Subscription } from 'rxjs';
import { ForumService } from '../../services/forum.service';
import { AuthService, UserResponse } from '../../services/auth.service';
import type { Notification as ForumNotification } from '../../services/forum.models';
import { MessagerieService } from '../../services/messagerie.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
  styleUrl: './nav.component.css'
})
export class NavComponent implements OnInit, OnDestroy {
  notifications: ForumNotification[] = [];
  unreadCount = 0;
  messageUnreadCount = 0;
  showDropdown = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private authSub?: Subscription;
  private messageSub?: Subscription;
  private routeSub?: Subscription;
  private currentUser: UserResponse | null = null;
  private messageSyncInterval: ReturnType<typeof setInterval> | null = null;
  private knownConversationLastTime = new Map<string, number>();

  constructor(
    private forumService: ForumService,
    public authService: AuthService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private messagerieService: MessagerieService
  ) {}

  ngOnInit() {
    this.authSub = this.authService.isLoggedIn$.subscribe((loggedIn) => {
      if (loggedIn) {
        this.startNotificationPolling();
        this.messagerieService.preloadConversations();
        this.messagerieService.preloadUsers();
        this.ensureMessagingRealtime();
        this.ensureNotificationPermission();
      } else {
        this.stopNotificationPolling();
        this.stopMessageSync();
        this.notifications = [];
        this.unreadCount = 0;
        this.messageUnreadCount = 0;
        this.currentUser = null;
        this.messageSub?.unsubscribe();
        this.messageSub = undefined;
      }
      this.cdr.markForCheck();
    });

    this.routeSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      if (event.urlAfterRedirects.startsWith('/messages')) {
        this.messageUnreadCount = 0;
        this.cdr.markForCheck();
      }
    });
  }

  private startNotificationPolling(): void {
    if (this.pollInterval != null) {
      return;
    }
    this.fetchNotifications();
    this.pollInterval = setInterval(() => this.fetchNotifications(), 30000);
  }

  private stopNotificationPolling(): void {
    if (this.pollInterval != null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.messageSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.stopNotificationPolling();
    this.stopMessageSync();
  }

  /** Reliable navigation; always shows Chatbot and sends guests to login with return URL. */
  goChat(): void {
    if (this.authService.isLoggedIn) {
      void this.router.navigateByUrl('/chat');
    } else {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/chat' } });
    }
  }

  fetchNotifications() {
    this.forumService
      .getUnreadNotifications()
      .pipe(catchError(() => of<ForumNotification[]>([])))
      .subscribe((nots) => {
        this.notifications = nots.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.unreadCount = this.notifications.filter((n) => !n.isRead).length;
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

  markAsRead(n: ForumNotification, event: Event) {
    event.stopPropagation();
    this.forumService.markNotificationAsRead(n.id).subscribe(() => {
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.cdr.markForCheck();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const node = event.target;
    const inside =
      node instanceof Element
        ? node.closest('.nav-notifications')
        : node instanceof Node
          ? node.parentElement?.closest('.nav-notifications')
          : null;
    if (inside) {
      return;
    }
    this.showDropdown = false;
  }

  logout() {
    this.messagerieService.disconnect();
    this.authService.logout();
    this.showDropdown = false;
    this.notifications = [];
    this.unreadCount = 0;
    this.messageUnreadCount = 0;
  }

  openMessages(): void {
    this.ensureNotificationPermission();
    this.messageUnreadCount = 0;
    void this.router.navigateByUrl('/messages');
  }

  private ensureMessagingRealtime(): void {
    const cached = this.authService.currentUser;
    if (cached) {
      this.currentUser = cached;
      this.messagerieService.connect(cached.id, cached.role === 'ADMIN');
    }

    this.authService.getMe().subscribe({
      next: (user) => {
        this.currentUser = user;
        this.messagerieService.connect(user.id, user.role === 'ADMIN');
      }
    });

    if (this.messageSub) {
      return;
    }
    this.messageSub = this.messagerieService.incomingMessage$.subscribe((message) => {
      if (!message || !this.currentUser) {
        return;
      }
      const isIncomingForMe = message.receiver.id === this.currentUser.id;
      const isMessagesPage = this.router.url.startsWith('/messages');
      if (isIncomingForMe && !isMessagesPage) {
        this.messageUnreadCount += 1;
        this.showDesktopMessageNotification(message.sender.fullName, message.content);
        this.cdr.markForCheck();
      }
    });

    this.startMessageSync();
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }

  private showDesktopMessageNotification(senderName: string, content: string): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }
    const body = content.length > 90 ? `${content.slice(0, 87)}...` : content;
    const notification = new Notification(`Nouveau message de ${senderName}`, { body });
    notification.onclick = () => {
      window.focus();
      void this.router.navigateByUrl('/messages');
    };
  }

  private startMessageSync(): void {
    if (this.messageSyncInterval != null) {
      return;
    }
    this.syncIncomingMessages(false);
    this.messageSyncInterval = setInterval(() => this.syncIncomingMessages(true), 1000);
  }

  private stopMessageSync(): void {
    if (this.messageSyncInterval != null) {
      clearInterval(this.messageSyncInterval);
      this.messageSyncInterval = null;
    }
    this.knownConversationLastTime.clear();
  }

  private syncIncomingMessages(notify: boolean): void {
    const currentUser = this.currentUser;
    if (!currentUser) {
      return;
    }
    this.messagerieService.loadConversations().subscribe({
      next: (conversations) => {
        for (const conv of conversations) {
          const ts = new Date(conv.lastMessageTime).getTime();
          if (!Number.isFinite(ts)) {
            continue;
          }
          const previous = this.knownConversationLastTime.get(conv.conversationKey);
          this.knownConversationLastTime.set(conv.conversationKey, ts);
          if (!notify || previous == null || ts <= previous) {
            continue;
          }
          const isIncoming = conv.lastMessageSenderId !== currentUser.id;
          const isMessagesPage = this.router.url.startsWith('/messages');
          if (!isIncoming || isMessagesPage) {
            continue;
          }
          this.messageUnreadCount += 1;
          const senderName =
            conv.otherUser?.fullName
              || (conv.userA.id === currentUser.id ? conv.userB.fullName : conv.userA.fullName);
          this.showDesktopMessageNotification(senderName, conv.lastMessagePreview || 'New message');
        }
        this.cdr.markForCheck();
      }
    });
  }
}
