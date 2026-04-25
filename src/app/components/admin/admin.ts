import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AdminService, AdminCreateUserRequest, AdminUpdateUserRequest, AdminUserListItem } from '../../services/admin.service';
import { AuthService, UserResponse } from '../../services/auth.service';
import { MessagerieService, ConversationSummary, DirectMessage, TopicCounts } from '../../services/messagerie.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
})
export class Admin implements OnInit, OnDestroy {
  private static readonly USERS_CACHE_KEY = 'vero_admin_users_cache';
  private static readonly CONVS_CACHE_KEY = 'vero_admin_convs_cache';

  // ── Users ─────────────────────────────────────────────────────────────────
  users: AdminUserListItem[] = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.users ?? [];
  loading   = this.users.length === 0;
  error     = '';
  totalUsers = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.total ?? 0;

  currentPage  = 1;
  usersPerPage = 10;
  totalPages   = Admin.readCache<{ users: AdminUserListItem[]; total: number; pages: number }>(Admin.USERS_CACHE_KEY)?.pages ?? 0;

  searchQuery  = '';
  selectedRole = '';

  activeTab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'events' = 'users';
  successMessage = '';
  errorMessage   = '';

  confirmDeleteId: number | null = null;
  editingUserId:   number | null = null;
  editUserForm:    AdminUpdateUserRequest = {};

  newUser: AdminCreateUserRequest = {
    fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false
  };
  addLoading = false;
  addMessage = '';

  // ── Messaging ─────────────────────────────────────────────────────────────
  adminMe: UserResponse | null = null;
  conversationSearch = '';
  adminConversations: ConversationSummary[] = Admin.readCache<ConversationSummary[]>(Admin.CONVS_CACHE_KEY) ?? [];
  topicHeatmap: TopicCounts = { eco: 0, lifestyle: 0, product: 0, other: 0 };
  selectedConversation: ConversationSummary | null = null;
  selectedConversationMessages: DirectMessage[] = [];
  messagesLoading = this.adminConversations.length === 0;
  threadLoading   = false;

  private selectedConversationRequestKey = '';
  private selectedConversationRequestId  = 0;
  private usersLoadRequestId             = 0;
  private conversationsLoadRequestId     = 0;
  private adminLiveSyncInterval:  ReturnType<typeof setInterval> | null = null;
  private usersLiveSyncInterval:  ReturnType<typeof setInterval> | null = null;
  private search$          = new Subject<string>();
  private adminMessageSub?: Subscription;

  // ── Events ────────────────────────────────────────────────────────────────
  eventsSubTab: 'list' | 'reservations' = 'list';
  adminEvents:    any[] = [];
  filteredEvents: any[] = [];
  eventsLoading   = false;
  eventSearch          = '';
  eventStatusFilter    = '';
  eventsPage     = 0;
  eventsPageSize = 15;
  confirmDeleteEventId: number | null = null;

  // ── Reservations ──────────────────────────────────────────────────────────
  adminReservations:       any[] = [];
  reservationsLoading      = false;
  reservationStatusFilter  = '';
  reservationEventFilter:  any | null = null;
  private reservationsLoadRequestId = 0;

  // FIX: cache reservations so they show instantly on tab switch
  private reservationsCache: any[] = [];
  private eventsCache: any[] = [];

  get pendingReservationsCount(): number {
    return this.adminReservations.length > 0
      ? this.adminReservations.filter(r => r.status === 'PENDING').length
      : this.reservationsCache.filter(r => r.status === 'PENDING').length;
  }

  // ── Constructor ───────────────────────────────────────────────────────────
  constructor(
    private http:             HttpClient,
    private adminService:     AdminService,
    private authService:      AuthService,
    private messagerieService: MessagerieService,
    private router:           Router
  ) {}

  // ── Cache helpers ─────────────────────────────────────────────────────────
  private static readCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch { return null; }
  }

  private static writeCache(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.currentPage = 1;
      this.loadUsers();
    });

    this.loadUsers();
    this.startUsersLiveSync();
    this.loadAdminConversations();
    this.loadTopicHeatmap();

    // FIX: pre-load both events AND reservations in background on init
    // so they are ready instantly when the user clicks the tab
    this.preloadEventsAndReservations();

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.messagerieService.connect(me.id, me.role === 'ADMIN');
        this.ensureNotificationPermission();
      }
    });

    this.adminMessageSub = this.messagerieService.adminIncoming$.subscribe((message) => {
      if (!message) return;
      this.upsertConversationFromMessage(message);
      this.showDesktopMessageNotification(message.sender.fullName, message.content);
      const label = (message.topic ?? null) as keyof TopicCounts | null;
      if (label && this.topicHeatmap[label] != null) {
        this.topicHeatmap = { ...this.topicHeatmap, [label]: this.topicHeatmap[label] + 1 };
      }
      if (!this.selectedConversation && this.activeTab === 'messages' && this.adminConversations.length > 0) {
        this.openAdminConversation(this.adminConversations[0]);
        return;
      }
      if (this.selectedConversation && this.belongsToSelectedConversation(message, this.selectedConversation)) {
        this.selectedConversationMessages = [...this.selectedConversationMessages, message];
      } else if (this.activeTab === 'messages') {
        this.loadAdminConversations();
      }
    });
  }

  ngOnDestroy(): void {
    this.search$.complete();
    this.adminMessageSub?.unsubscribe();
    if (this.adminLiveSyncInterval != null) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; }
    this.stopUsersLiveSync();
  }

  // ── FIX: Pre-load events & reservations silently in background ────────────
  private preloadEventsAndReservations(): void {
    // Pre-load events
    this.http.get<any[]>('/api/events').subscribe({
      next: (events) => {
        this.eventsCache  = events;
        this.adminEvents  = events;
      },
      error: () => {}
    });

    // Pre-load reservations
    this.http.get<any>('/api/reservations').subscribe({
      next: (data) => {
        const list: any[] = Array.isArray(data) ? data : (data.content ?? []);
        this.reservationsCache = list;
      },
      error: () => {}
    });
  }

  // ── Users CRUD ────────────────────────────────────────────────────────────
  loadUsers(): void {
    const requestId = ++this.usersLoadRequestId;
    this.loading = this.users.length === 0;
    this.error   = '';
    this.adminService.getUsers(this.currentPage - 1, this.usersPerPage, this.searchQuery, this.selectedRole).subscribe({
      next: (data) => {
        if (this.usersLoadRequestId !== requestId) return;
        this.users      = data.content ?? [];
        this.totalUsers = data.totalElements ?? this.users.length;
        this.totalPages = Math.max(data.totalPages ?? 0, 1);
        this.currentPage = (data.number ?? 0) + 1;
        this.loading    = false;
        if (!this.searchQuery && !this.selectedRole && this.currentPage === 1) {
          Admin.writeCache(Admin.USERS_CACHE_KEY, { users: this.users, total: this.totalUsers, pages: this.totalPages });
        }
      },
      error: () => {
        if (this.usersLoadRequestId !== requestId) return;
        this.error   = 'Failed to load users. Are you an admin?';
        this.loading = false;
      }
    });
  }

  onSearchChange(): void     { this.search$.next(this.searchQuery.trim()); }
  onRoleFilterChange(): void { this.currentPage = 1; this.loadUsers(); }
  onPageSizeChange(): void   { this.currentPage = 1; this.loadUsers(); }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadUsers();
    }
  }

  startEdit(user: AdminUserListItem): void {
    this.addMessage  = '';
    this.editingUserId = user.id;
    this.editUserForm  = { fullName: user.fullName, email: user.email, role: user.role, verified: user.verified, banned: user.banned };
    this.activeTab   = 'edit';
  }

  cancelEdit(): void { this.editingUserId = null; this.activeTab = 'users'; }

  saveEdit(id: number): void {
    const payload = { ...this.editUserForm };
    const index   = this.users.findIndex(u => u.id === id);
    if (index !== -1) this.users[index] = { ...this.users[index], ...payload, id } as AdminUserListItem;
    this.editingUserId = null;
    this.setTab('users');
    this.adminService.updateUser(id, payload).subscribe({
      next:  () => this.showSuccess('User profile updated.'),
      error: () => { this.showError('Error updating user profile.'); this.loadUsers(); }
    });
  }

  toggleBan(user: AdminUserListItem): void {
    const isBanned = user.banned;
    const req = isBanned ? this.adminService.unbanUser(user.id) : this.adminService.banUser(user.id);
    req.subscribe({
      next:  () => { user.banned = !isBanned; this.showSuccess(isBanned ? 'User successfully unbanned!' : 'User access suspended!'); },
      error: (err) => this.showError('Failed to alter ban status: ' + (err?.error?.message || err.message))
    });
  }

  requestDelete(id: number): void { this.confirmDeleteId = id; }
  cancelDelete(): void            { this.confirmDeleteId = null; }

  confirmDelete(): void {
    if (!this.confirmDeleteId) return;
    const id = this.confirmDeleteId;
    this.confirmDeleteId = null;
    const previousUsers = this.users;
    const previousTotal = this.totalUsers;
    this.users      = this.users.filter(u => u.id !== id);
    this.totalUsers = Math.max(this.totalUsers - 1, 0);
    this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);
    this.adminService.deleteUser(id).subscribe({
      next: () => {
        this.showSuccess('Account permanently deleted.');
        if (this.users.length === 0 && this.currentPage > 1) { this.currentPage--; this.loadUsers(); }
      },
      error: (err) => {
        this.users      = previousUsers;
        this.totalUsers = previousTotal;
        this.totalPages = Math.max(Math.ceil(this.totalUsers / this.usersPerPage), 1);
        this.showError(err?.error?.message || 'Database Constraint: Cannot delete user because they have active platform data.');
      }
    });
  }

  createUser(): void {
    const payload = { ...this.newUser };
    this.newUser = { fullName: '', email: '', password: '', role: 'USER', verified: true, banned: false };
    this.setTab('users');
    this.adminService.createUser(payload).subscribe({
      next:  () => { this.loadUsers(); this.showSuccess('New user account provisioned.'); },
      error: (err) => this.showError(err?.error?.message || 'Failed to create user account.')
    });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  private lastTabSet = '';
  private lastTabSetTime = 0;

  setTab(tab: 'users' | 'add' | 'settings' | 'edit' | 'messages' | 'events'): void {
    const now = Date.now();
    if (tab === this.lastTabSet && now - this.lastTabSetTime < 200) return;
    this.lastTabSet     = tab;
    this.lastTabSetTime = now;

    this.activeTab  = tab;
    this.addMessage = '';

    if (tab === 'users') {
      this.loadUsers();
      this.startUsersLiveSync();
      if (this.adminLiveSyncInterval != null) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; }

    } else if (tab === 'messages') {
      this.stopUsersLiveSync();
      this.loadAdminConversations();
      this.startAdminLiveSync();

    } else if (tab === 'events') {
      this.stopUsersLiveSync();
      if (this.adminLiveSyncInterval != null) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; }

      // FIX: reset all filters and page
      this.eventsSubTab            = 'list';
      this.eventsPage              = 0;
      this.eventSearch             = '';
      this.eventStatusFilter       = '';
      this.reservationStatusFilter = '';
      this.reservationEventFilter  = null;

      // FIX: show cached data INSTANTLY, then refresh in background
      if (this.eventsCache.length > 0) {
        this.adminEvents    = [...this.eventsCache];
        this.eventsLoading  = false;
        this.applyEventFilters();
      }
      if (this.reservationsCache.length > 0) {
        this.adminReservations = [...this.reservationsCache];
      }

      // Refresh in background
      this.loadAdminEventsBackground();

    } else {
      if (this.adminLiveSyncInterval != null) { clearInterval(this.adminLiveSyncInterval); this.adminLiveSyncInterval = null; }
      this.stopUsersLiveSync();
    }
  }

  // ── Conversations ─────────────────────────────────────────────────────────
  loadAdminConversations(): void {
    const requestId = ++this.conversationsLoadRequestId;
    this.messagesLoading = this.adminConversations.length === 0;
    this.messagerieService.loadAdminConversations(this.conversationSearch).subscribe({
      next: (conversations) => {
        if (this.conversationsLoadRequestId !== requestId) return;
        this.adminConversations = conversations;
        this.messagesLoading    = false;
        if (!this.conversationSearch) Admin.writeCache(Admin.CONVS_CACHE_KEY, conversations);
        this.preloadAdminVisibleHistories(conversations);
        if (!this.selectedConversation && conversations.length > 0) this.openAdminConversation(conversations[0]);
      },
      error: () => {
        if (this.conversationsLoadRequestId !== requestId) return;
        this.messagesLoading = false;
        this.showError('Failed to load conversations.');
      }
    });
  }

  filterConversations(): void { this.loadAdminConversations(); }

  loadTopicHeatmap(): void {
    this.messagerieService.loadTopicHeatmap().subscribe({
      next:  (counts) => (this.topicHeatmap = counts),
      error: () => {}
    });
  }

  get topicHeatmapTotal(): number {
    const h = this.topicHeatmap;
    return (h.eco || 0) + (h.lifestyle || 0) + (h.product || 0) + (h.other || 0);
  }

  topicPercent(label: keyof TopicCounts): number {
    const total = this.topicHeatmapTotal;
    if (!total) return 0;
    return Math.round((this.topicHeatmap[label] / total) * 100);
  }

  openAdminConversation(conversation: ConversationSummary): void {
    this.selectedConversation           = conversation;
    const requestKey                    = conversation.conversationKey;
    this.selectedConversationRequestKey = requestKey;
    const requestId                     = ++this.selectedConversationRequestId;
    this.threadLoading                  = true;
    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) return;
        this.selectedConversationMessages = messages;
        this.threadLoading = false;
      },
      error: () => {
        if (this.selectedConversationRequestKey !== requestKey || this.selectedConversationRequestId !== requestId) return;
        this.threadLoading = false;
        this.showError('Failed to load this conversation.');
      }
    });
  }

  onAdminConversationPointerDown(conversation: ConversationSummary): void { this.openAdminConversation(conversation); }

  // ── Events ────────────────────────────────────────────────────────────────

  // FIX: called on tab switch — shows skeleton, fills from cache instantly, then refreshes
  loadAdminEvents(): void {
    // Show cache instantly if available
    if (this.eventsCache.length > 0) {
      this.adminEvents   = [...this.eventsCache];
      this.eventsLoading = false;
      this.applyEventFilters();
    } else {
      this.eventsLoading = true;
    }

    // Always refresh from server
    this.http.get<any[]>('/api/events').subscribe({
      next: (events) => {
        this.eventsCache   = events;
        this.adminEvents   = events;
        this.eventsLoading = false;
        this.applyEventFilters();
      },
      error: () => {
        this.showError('Failed to load events.');
        this.eventsLoading = false;
      }
    });
  }

  // FIX: silent background refresh — no loading spinner, no flicker
  private loadAdminEventsBackground(): void {
    this.http.get<any[]>('/api/events').subscribe({
      next: (events) => {
        this.eventsCache   = events;
        this.adminEvents   = events;
        this.eventsLoading = false;
        this.applyEventFilters();
      },
      error: () => {}
    });
  }

  filterEvents(): void { this.applyEventFilters(); }

  private applyEventFilters(): void {
    let list = [...this.adminEvents];
    if (this.eventSearch.trim()) {
      const q = this.eventSearch.toLowerCase();
      list = list.filter(ev => ev.title?.toLowerCase().includes(q) || ev.location?.toLowerCase().includes(q));
    }
    if (this.eventStatusFilter) list = list.filter(ev => ev.status === this.eventStatusFilter);
    const start = this.eventsPage * this.eventsPageSize;
    this.filteredEvents = list.slice(start, start + this.eventsPageSize);
  }

  adminCancelEvent(ev: any): void {
    this.http.put(`/api/events/${ev.id}/cancel`, {}).subscribe({
      next:  () => { ev.status = 'CANCELLED'; this.applyEventFilters(); this.showSuccess(`Event "${ev.title}" cancelled.`); },
      error: (err) => this.showError(err?.error?.message || 'Failed to cancel event.')
    });
  }

  adminCompleteEvent(ev: any): void {
    this.http.put(`/api/events/${ev.id}/complete`, {}).subscribe({
      next:  () => { ev.status = 'COMPLETED'; this.applyEventFilters(); this.showSuccess(`Event "${ev.title}" marked as completed.`); },
      error: (err) => this.showError(err?.error?.message || 'Failed to complete event.')
    });
  }

  requestDeleteEvent(id: number): void { this.confirmDeleteEventId = id; }

  confirmDeleteEvent(): void {
    if (!this.confirmDeleteEventId) return;
    const id = this.confirmDeleteEventId;
    this.confirmDeleteEventId = null;
    const backup = [...this.adminEvents];
    this.adminEvents = this.adminEvents.filter(e => e.id !== id);
    this.eventsCache = this.eventsCache.filter(e => e.id !== id);
    this.applyEventFilters();
    this.http.delete(`/api/events/${id}`).subscribe({
      next:  () => this.showSuccess('Event deleted permanently.'),
      error: (err) => { this.adminEvents = backup; this.eventsCache = backup; this.applyEventFilters(); this.showError(err?.error?.message || 'Failed to delete event.'); }
    });
  }

  viewEventReservations(ev: any): void {
    this.reservationEventFilter  = ev;
    this.reservationStatusFilter = '';
    this.eventsSubTab = 'reservations';
    this.loadAdminReservations();
  }

  // ── Reservations ──────────────────────────────────────────────────────────

  // FIX: show cache instantly, then refresh in background
  loadAdminReservations(): void {
    const requestId = ++this.reservationsLoadRequestId;

    const url = this.reservationEventFilter
      ? `/api/reservations/event/${this.reservationEventFilter.id}`
      : '/api/reservations';

    // FIX: if no event filter, show cache instantly with no spinner
    if (!this.reservationEventFilter && this.reservationsCache.length > 0) {
      let cached = [...this.reservationsCache];
      if (this.reservationStatusFilter) {
        cached = cached.filter(r => r.status === this.reservationStatusFilter);
      }
      this.adminReservations   = cached;
      this.reservationsLoading = false;
    } else {
      this.reservationsLoading = true;
    }

    // Always refresh from server in background
    this.http.get<any>(url).subscribe({
      next: (data) => {
        if (this.reservationsLoadRequestId !== requestId) return;
        let list: any[] = Array.isArray(data) ? data : (data.content ?? []);

        // Update cache only for full list (no event filter)
        if (!this.reservationEventFilter) {
          this.reservationsCache = list;
        }

        if (this.reservationStatusFilter) {
          list = list.filter(r => r.status === this.reservationStatusFilter);
        }

        this.adminReservations   = list;
        this.reservationsLoading = false;
      },
      error: (err) => {
        if (this.reservationsLoadRequestId !== requestId) return;
        this.showError('Failed to load reservations.');
        this.reservationsLoading = false;
      }
    });
  }

  // FIX: switching to Reservations sub-tab — reset filters and show instantly
  switchToReservations(): void {
    this.reservationStatusFilter = '';
    this.reservationEventFilter  = null;
    this.eventsSubTab            = 'reservations';

    // Show from cache instantly
    if (this.reservationsCache.length > 0) {
      this.adminReservations   = [...this.reservationsCache];
      this.reservationsLoading = false;
    }

    // Refresh in background
    this.loadAdminReservations();
  }

  adminConfirmReservation(r: any): void {
    this.http.put<any>(`/api/reservations/${r.id}/confirm`, {}).subscribe({
      next: (updated) => {
        const idx = this.adminReservations.findIndex(x => x.id === r.id);
        if (idx !== -1) this.adminReservations[idx] = updated;
        // Update cache too
        const cacheIdx = this.reservationsCache.findIndex(x => x.id === r.id);
        if (cacheIdx !== -1) this.reservationsCache[cacheIdx] = updated;
        this.showSuccess('Reservation confirmed. Confirmation email sent.');
      },
      error: (err) => this.showError(err?.error?.message || 'Failed to confirm reservation.')
    });
  }

  adminRejectReservation(r: any): void {
    this.http.put<any>(`/api/reservations/${r.id}/reject`, {}).subscribe({
      next: (updated) => {
        const idx = this.adminReservations.findIndex(x => x.id === r.id);
        if (idx !== -1) this.adminReservations[idx] = updated;
        const cacheIdx = this.reservationsCache.findIndex(x => x.id === r.id);
        if (cacheIdx !== -1) this.reservationsCache[cacheIdx] = updated;
        this.showSuccess('Reservation rejected.');
      },
      error: (err) => this.showError(err?.error?.message || 'Failed to reject reservation.')
    });
  }

  adminDeleteReservation(id: number): void {
    const backup      = [...this.adminReservations];
    const cacheBackup = [...this.reservationsCache];
    this.adminReservations = this.adminReservations.filter(r => r.id !== id);
    this.reservationsCache = this.reservationsCache.filter(r => r.id !== id);
    this.http.delete(`/api/reservations/${id}`).subscribe({
      next:  () => this.showSuccess('Reservation deleted.'),
      error: (err) => {
        this.adminReservations = backup;
        this.reservationsCache = cacheBackup;
        this.showError(err?.error?.message || 'Failed to delete reservation.');
      }
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  eventCategoryIcon(ev: any): string {
    const t = (ev.title + ' ' + (ev.description || '')).toLowerCase();
    if (t.includes('plant') || t.includes('tree'))                               return '🌱';
    if (t.includes('coral') || t.includes('reef') || t.includes('marine'))      return '🐠';
    if (t.includes('workshop') || t.includes('summit') || t.includes('energy')) return '🎨';
    return '🧹';
  }

  getEventFillPct(_ev: any): number { return 60; }

  eventStatusClass(status: string): string {
    const map: Record<string, string> = { UPCOMING: 'warn', ONGOING: 'ok', COMPLETED: '', CANCELLED: 'bad' };
    return map[status] ?? '';
  }

  reservationStatusClass(status: string): string {
    const map: Record<string, string> = { PENDING: 'warn', CONFIRMED: 'ok', REJECTED: 'bad', CANCELLED: '' };
    return map[status] ?? '';
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  get suspendedOnPage(): number            { return this.users.filter(u => u.banned).length; }
  get monitoredConversationCount(): number { return this.adminConversations.length; }

  initials(name: string | undefined): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private belongsToSelectedConversation(message: DirectMessage, conversation: ConversationSummary): boolean {
    const ids         = [message.sender.id, message.receiver.id].sort((a, b) => a - b);
    const selectedIds = [conversation.userA.id, conversation.userB.id].sort((a, b) => a - b);
    return ids[0] === selectedIds[0] && ids[1] === selectedIds[1];
  }

  private upsertConversationFromMessage(message: DirectMessage): void {
    const idA = Math.min(message.sender.id, message.receiver.id);
    const idB = Math.max(message.sender.id, message.receiver.id);
    const key = `${idA}_${idB}`;
    const summary: ConversationSummary = {
      conversationKey:      key,
      userA:                idA === message.sender.id ? message.sender : message.receiver,
      userB:                idB === message.sender.id ? message.sender : message.receiver,
      lastMessagePreview:   message.content.length > 80 ? `${message.content.slice(0, 77)}...` : message.content,
      lastMessageTime:      message.timestamp,
      lastMessageSenderId:  message.sender.id,
      messageCount:         1
    };
    const existingIndex = this.adminConversations.findIndex(i => i.conversationKey === key);
    if (existingIndex >= 0) this.adminConversations.splice(existingIndex, 1);
    this.adminConversations = [summary, ...this.adminConversations];
    this.messagesLoading    = false;
  }

  private preloadAdminVisibleHistories(conversations: ConversationSummary[]): void {
    conversations.slice(0, 8).forEach(conv =>
      this.messagerieService.preloadAdminHistory(conv.userA.id, conv.userB.id)
    );
  }

  private startAdminLiveSync(): void {
    if (this.adminLiveSyncInterval != null) return;
    this.adminLiveSyncInterval = setInterval(() => {
      if (this.activeTab !== 'messages') return;
      if (this.selectedConversation) this.refreshSelectedConversationSilently(this.selectedConversation);
    }, 1000);
  }

  private startUsersLiveSync(): void {
    if (this.usersLiveSyncInterval != null) return;
    this.usersLiveSyncInterval = setInterval(() => {
      if (this.activeTab !== 'users') return;
      this.refreshUsersSilently();
    }, 1000);
  }

  private stopUsersLiveSync(): void {
    if (this.usersLiveSyncInterval != null) { clearInterval(this.usersLiveSyncInterval); this.usersLiveSyncInterval = null; }
  }

  private refreshUsersSilently(): void {
    this.adminService.getUsers(this.currentPage - 1, this.usersPerPage, this.searchQuery, this.selectedRole).subscribe({
      next: (data) => {
        if (this.activeTab !== 'users') return;
        this.users       = data.content ?? [];
        this.totalUsers  = data.totalElements ?? this.users.length;
        this.totalPages  = Math.max(data.totalPages ?? 0, 1);
        this.currentPage = (data.number ?? 0) + 1;
        this.error       = '';
        this.loading     = false;
      }
    });
  }

  private refreshSelectedConversationSilently(conversation: ConversationSummary): void {
    if (this.threadLoading) return;
    const requestKey = conversation.conversationKey;
    this.messagerieService.loadAdminHistoryCached(conversation.userA.id, conversation.userB.id).subscribe({
      next: (messages) => {
        if (this.selectedConversationRequestKey !== requestKey) return;
        this.selectedConversationMessages = messages;
      }
    });
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission().catch(() => undefined);
  }

  private showDesktopMessageNotification(senderName: string, content: string): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const body = content.length > 90 ? `${content.slice(0, 87)}...` : content;
    const notification = new Notification('Nouveau message (Admin)', { body: `${senderName}: ${body}` });
    notification.onclick = () => { window.focus(); this.setTab('messages'); };
  }

  // ── Feedback ──────────────────────────────────────────────────────────────
  showSuccess(msg: string): void {
    this.successMessage = msg; this.errorMessage = '';
    setTimeout(() => this.successMessage = '', 4000);
  }

  showError(msg: string): void {
    this.errorMessage = msg; this.successMessage = '';
    setTimeout(() => this.errorMessage = '', 6000);
  }

  logout(): void { this.authService.logout(); this.router.navigate(['/login']); }
}