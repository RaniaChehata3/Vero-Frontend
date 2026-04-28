import { Component, OnInit, OnDestroy, ChangeDetectorRef, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MessagerieService, ConversationSummary, DirectMessage, TopicCounts } from '../../../services/messagerie.service';
import { AuthService, UserResponse } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-messages.component.html',
  styleUrls: ['./admin-messages.component.css']
})
export class AdminMessagesComponent implements OnInit, OnDestroy {
  @Input() activeTab: string = 'messages';
  @Output() tabChange = new EventEmitter<string>();

  private static readonly CONVS_CACHE_KEY = 'vero_admin_convs_cache';

  // ── Messages State ────────────────────────────────────────────────────────
  adminMe: UserResponse | null = null;
  conversationSearch = '';
  adminConversations: ConversationSummary[] = AdminMessagesComponent.readCache<ConversationSummary[]>(AdminMessagesComponent.CONVS_CACHE_KEY) ?? [];
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  topicKeys: (keyof TopicCounts)[] = ['eco', 'lifestyle', 'product', 'other'];
  selectedConversation: ConversationSummary | null = null;
  selectedConversationMessages: DirectMessage[] = [];
  messagesLoading = this.adminConversations.length === 0;
  threadLoading = false;

  private selectedConversationRequestKey = '';
  private selectedConversationRequestId = 0;
  private conversationsLoadRequestId = 0;
  private adminLiveSyncInterval: any = null;
  private messagingSubscription: Subscription | null = null;

  constructor(
    private messagerieService: MessagerieService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAdminMe();
    this.loadAdminConversations();
    this.loadTopicHeatmap();
    this.startAdminLiveSync();
    this.setupMessagingSubscription();
  }

  ngOnDestroy(): void {
    this.stopAdminLiveSync();
    if (this.messagingSubscription) {
      this.messagingSubscription.unsubscribe();
    }
  }

  // ── Cache Utilities ───────────────────────────────────────────────────────

  private static readCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private static writeCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }

  // ── Admin User ─────────────────────────────────────────────────────────────

  private loadAdminMe(): void {
    this.authService.getMe().subscribe({
      next: (user) => {
        this.adminMe = user;
      },
      error: () => {
        this.notificationService.error('Failed to load admin profile.');
      }
    });
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  loadAdminConversations(): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.messagesLoading = this.adminConversations.length === 0;

    this.messagerieService.loadAdminConversations(this.conversationSearch).subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
        this.adminConversations = conversations;
        this.messagesLoading = false;
        if (!this.conversationSearch) {
          AdminMessagesComponent.writeCache(AdminMessagesComponent.CONVS_CACHE_KEY, conversations);
        }
        this.preloadAdminVisibleHistories(conversations);
        if (!this.selectedConversation && conversations.length > 0) {
          this.openAdminConversation(conversations[0]);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.conversationsLoadRequestId !== requestId) {
          return;
        }
        this.messagesLoading = false;
        this.notificationService.error('Failed to load conversations.');
        this.cdr.detectChanges();
      }
    });
  }

  filterConversations(): void {
    this.loadAdminConversations();
  }

  private preloadAdminVisibleHistories(conversations: ConversationSummary[]): void {
    const visible = conversations.slice(0, 5);
    visible.forEach(conv => {
      this.messagerieService.loadAdminHistoryCached(conv.userA.id, conv.userB.id).subscribe();
    });
  }

  openAdminConversation(conversation: ConversationSummary): void {
    this.selectedConversation = conversation;
    const requestKey = conversation.conversationKey;
    this.selectedConversationRequestKey = requestKey;
    const requestId = ++this.selectedConversationRequestId;

    this.threadLoading = true;
    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) {
          return;
        }
        this.selectedConversationMessages = messages;
        this.threadLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) {
          return;
        }
        this.threadLoading = false;
        this.notificationService.error('Failed to load conversation messages.');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Topic Heatmap ─────────────────────────────────────────────────────────

  private loadTopicHeatmap(): void {
    this.messagerieService.loadTopicHeatmap().subscribe({
      next: (counts: TopicCounts) => {
        this.topicHeatmap = counts;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notificationService.error('Failed to load topic statistics.');
      }
    });
  }

  // ── Live Sync ─────────────────────────────────────────────────────────────

  private startAdminLiveSync(): void {
    this.stopAdminLiveSync();
    this.adminLiveSyncInterval = setInterval(() => {
      if (this.messagesLoading || this.threadLoading) {
        return;
      }
      if (this.selectedConversation) {
        this.refreshSelectedConversationSilently(this.selectedConversation);
      }
    }, 15000); // 15 seconds
  }

  private stopAdminLiveSync(): void {
    if (this.adminLiveSyncInterval) {
      clearInterval(this.adminLiveSyncInterval);
      this.adminLiveSyncInterval = null;
    }
  }

  private refreshSelectedConversationSilently(conversation: ConversationSummary): void {
    const requestKey = conversation.conversationKey;
    if (this.threadLoading) {
      return;
    }
    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey) {
          return;
        }
        this.selectedConversationMessages = messages;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Messaging Subscription ───────────────────────────────────────────────

  private setupMessagingSubscription(): void {
    if (!this.adminMe) return;

    this.messagerieService.connect(this.adminMe.id, true);
    this.messagingSubscription = this.messagerieService.adminIncoming$.subscribe(message => {
      this.ensureNotificationPermission();
      this.showDesktopMessageNotification(message.sender.fullName, message.content);

      if (!this.selectedConversation && this.activeTab === 'messages' && this.adminConversations.length > 0) {
        this.openAdminConversation(this.adminConversations[0]);
        return;
      }

      if (this.selectedConversation && this.belongsToSelectedConversation(message, this.selectedConversation)) {
        this.selectedConversationMessages = [...this.selectedConversationMessages, message];
        this.cdr.detectChanges();
      } else if (this.activeTab === 'messages') {
        // Keep monitor list in sync instantly even when another thread is open.
        this.loadAdminConversations();
      }
    });
  }

  private belongsToSelectedConversation(message: DirectMessage, conversation: ConversationSummary): boolean {
    const ids = [message.sender.id, message.receiver.id].sort((a, b) => a - b);
    const selectedIds = [conversation.userA.id, conversation.userB.id].sort((a, b) => a - b);
    return ids[0] === selectedIds[0] && ids[1] === selectedIds[1];
  }

  // ── Desktop Notifications ────────────────────────────────────────────────

  private ensureNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  private showDesktopMessageNotification(name: string, content: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`New message from ${name}`, {
        body: content.length > 100 ? content.substring(0, 100) + '...' : content,
        icon: '/assets/vero-icon.png'
      });

      setTimeout(() => notification.close(), 5000);
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  get monitoredConversationCount(): number {
    return this.adminConversations.length;
  }

  initials(name: string | undefined): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getTopicColor(topic: keyof TopicCounts | null | undefined): string {
    const colors = {
      eco: '#22c55e',
      lifestyle: '#3b82f6',
      product: '#f59e0b',
      other: '#6b7280'
    };
    return topic && topic in colors ? colors[topic as keyof TopicCounts] : colors.other;
  }

  getTopicLabel(topic: keyof TopicCounts | null | undefined): string {
    const labels = {
      eco: 'Ecology',
      lifestyle: 'Lifestyle',
      product: 'Products',
      other: 'Other'
    };
    return topic && topic in labels ? labels[topic as keyof TopicCounts] : labels.other;
  }
}