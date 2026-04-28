import { Component, OnInit, ViewEncapsulation, AfterViewInit, ElementRef } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { ProductService } from '../../services/product.service';
import { FormationService } from '../../services/formation.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, UserResponse } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminFormationsComponent } from './admin-formations/admin-formations.component';
import { AdminForumComponent } from './admin-forum/admin-forum.component';
import { AdminMessagesComponent } from './admin-messages/admin-messages.component';
import { ForumService } from '../../services/forum.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { SessionService } from '../../services/session.service';
import { UserService } from '../../services/user.service';
import { OrderService } from '../../services/order.service';
import { HttpClient } from '@angular/common/http';
import { Product, Order } from '../../services/product.models';
import { Formation, FormationResource, FormationStatus, Session, SessionStatus, SessionType } from '../../services/formation.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminUsersComponent,
    AdminProductsComponent,
    AdminFormationsComponent,
    AdminForumComponent,
    AdminMessagesComponent
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit, AfterViewInit {
  activeTab: 'users' | 'add' | 'settings' | 'edit' | 'products' | 'formations' | 'forum' | 'messages' = 'users';
  adminMe: UserResponse | null = null;
  topicHeatmapTotal = 0;
  suspendedCount = 0;
  monitoredCount = 0;
  userCount = 0;
  productCount = 0;
  formationCount = 0;
  forumStats = { totalPosts: 0, flaggedCount: 0 };

  // ── Dashboard display helpers ──
  currentDate: string = '';
  currentMonth: string = '';
  calendarDates: { num: number; isToday: boolean }[] = [];

  // ── Business Logic from VF ──
  loading = true;
  
  // Stats
  stats = {
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0
  };

  // Products with Cloudinary
  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'NATURAL_COSMETICS',
    image: '',
    origin: '',
    isEcological: true
  };
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  uploadingImage = false;
  uploadProgress = 0;

  // Orders
  orders: any[] = [];
  ordersLoading = false;
  selectedOrder: any | null = null;
  orderCustomers: Map<number, any> = new Map();

  // Categories and countries from VF
  categories = ['NATURAL_COSMETICS', 'ECO_FRIENDLY_HOME', 'SUSTAINABLE_FASHION', 'KITCHEN_AND_DINING', 'ECO_GARDENING', 'ECO_PET_PRODUCTS', 'ECO_GIFT_SETS'];

  categoryEmojis: Record<string, string> = {
    'NATURAL_COSMETICS': '🌿',
    'ECO_FRIENDLY_HOME': '🏠',
    'SUSTAINABLE_FASHION': '👕',
    'KITCHEN_AND_DINING': '🍽️',
    'ECO_GARDENING': '🌱',
    'ECO_PET_PRODUCTS': '🐾',
    'ECO_GIFT_SETS': '🎁'
  };

  categoryColors: Record<string, string> = {
    'NATURAL_COSMETICS': '#f0ece4',
    'ECO_FRIENDLY_HOME': '#e8f4e8',
    'SUSTAINABLE_FASHION': '#e8e4dc',
    'KITCHEN_AND_DINING': '#e4ede4',
    'ECO_GARDENING': '#dce8dc',
    'ECO_PET_PRODUCTS': '#ece8e4',
    'ECO_GIFT_SETS': '#f4e8e8'
  };

  // Countries list with flags
  countries = [
    { name: 'France', flag: '🇫🇷' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'Switzerland', flag: '🇨🇭' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Tunisia', flag: '🇹🇳' },
    { name: 'Egypt', flag: '🇪🇬' },
    { name: 'USA', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Colombia', flag: '🇨🇴' },
    { name: 'UK', flag: '🇬🇧' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Finland', flag: '🇫🇮' },
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Hungary', flag: '🇭🇺' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'China', flag: '🇨🇳' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'India', flag: '🇮🇳' },
    { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Vietnam', flag: '🇻🇳' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Philippines', flag: '🇵🇭' },
    { name: 'Malaysia', flag: '🇲🇾' },
    { name: 'Singapore', flag: '🇸🇬' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Ethiopia', flag: '🇪🇹' },
    { name: 'Local', flag: '🌍' }
  ];

  // Enhanced Formations with VF logic
  formations: Formation[] = [];
  formationsLoading = false;
  showFormationModal = false;
  editingFormation: Formation | null = null;
  formationForm: {
    title: string;
    description: string;
    duration: number;
    maxCapacity: number;
    price: number;
    status: FormationStatus;
  } = {
    title: '',
    description: '',
    duration: 0,
    maxCapacity: 0,
    price: 0,
    status: 'PLANNED' as FormationStatus
  };
  
  // Participants details
  allUsers: any[] = [];
  trainersMap: Map<number, string> = new Map();
  expandedFormationId: number | null = null;

  // Sessions
  sessions: Session[] = [];
  sessionsLoading = false;
  showSessionModal = false;
  editingSession: Session | null = null;
  sessionForm = {
    title: '',
    startDate: '',
    endDate: '',
    status: 'SCHEDULED' as SessionStatus,
    type: SessionType.ONLINE,
    meetLink: '',
    trainerId: 0,
    formationId: 0,
    isFinalSession: false
  };
  selectedFormationForSessions: Formation | null = null;

  formationStatuses = ['PLANNED', 'IN_PROGRESS', 'COMPLETED'];
  sessionStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  // AI Description
  generatingDescription = false;

  // Resources
  selectedResourceFile: File | null = null;
  resourceUploading = false;
  formationResources: FormationResource[] = [];

  // Quiz
  showQuizModal = false;
  generatingQuiz = false;

  // Quiz Preview Modal (admin)
  showQuizPreviewModal = false;
  quizPreview: any = null;
  quizPreviewAnswers: Map<number, number> = new Map();
  quizPreviewSubmitting = false;
  quizPreviewResult: any = null;
  quizPreviewLoading = false;
  quizForm: {
    title: string;
    passingScore: number;
    questions: Array<{ text: string; options: Array<{ text: string; isCorrect: boolean }> }>;
  } = { title: '', passingScore: 80, questions: [] };

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private productService: ProductService,
    private formationService: FormationService,
    private forumService: ForumService,
    private route: ActivatedRoute,
    private router: Router,
    private el: ElementRef,
    private cloudinaryService: CloudinaryService,
    private sessionService: SessionService,
    private userService: UserService,
    private orderService: OrderService,
    private http: HttpClient,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this._initDateHelpers();

    // Read ?tab= from navbar links
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'products') {
        this.setTab('products');
      } else if (params['tab'] === 'formations') {
        this.setTab('formations');
      } else if (params['tab']) {
        this.setTab(params['tab']);
      }
    });

    this.authService.getMe().subscribe({
      next: (me) => {
        this.adminMe = me;
        this.ensureNotificationPermission();
        if (me.role !== 'ADMIN') {
          this.router.navigate(['/']);
        } else {
          this.loadDashboardData();
        }
      },
      error: () => {
        const cached = this.authService.currentUser;
        if (cached) {
          this.adminMe = cached;
          if (cached.role === 'ADMIN') {
            this.loadDashboardData();
          }
        } else {
          this.router.navigate(['/login']);
        }
      }
    });

    this._loadDashboardStats();
  }

  ngAfterViewInit(): void {
    // Trigger initial count-up after animations settle
    setTimeout(() => {
      this._animateCounter('stat-card-users', this.userCount);
      this._animateCounter('stat-card-formations', this.formationCount);
      this._animateCounter('stat-card-products', this.productCount);
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    }, 1000);
  }

  private _loadDashboardStats(): void {
    // Fetch users count
    this.adminService.getUsers(0, 1).subscribe(data => {
      this.userCount = data.totalElements;
      this._animateCounter('stat-card-users', this.userCount);
    });

    // Fetch products count
    this.productService.getAll().subscribe(products => {
      this.productCount = products.length;
      this._animateCounter('stat-card-products', this.productCount);
    });

    // Fetch formations count
    this.formationService.getAll().subscribe(formations => {
      this.formationCount = formations.length;
      this._animateCounter('stat-card-formations', this.formationCount);
    });

    // Fetch forum stats
    this.forumService.getAllPosts().subscribe(posts => {
      this.forumStats.totalPosts = posts.length;
      this.forumStats.flaggedCount = posts.filter(p => p.isFlagged).length;
      this._animateCounter('stat-card-community', this.forumStats.totalPosts);
    });
  }

  private _animateCounter(cardId: string, target: number): void {
    const card = document.getElementById(cardId);
    if (!card) return;
    const span = card.querySelector<HTMLElement>('.vc-stat-number-inner');
    if (!span) return;

    if (target === 0) {
      span.textContent = '0';
      return;
    }

    const duration = 1200; // ms
    const startTime = performance.now();
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const progress = easeOut(elapsed / duration);
      const current = Math.round(progress * target);
      span.textContent = current.toLocaleString();
      if (elapsed < duration) requestAnimationFrame(tick);
      else span.textContent = target.toLocaleString();
    };

    requestAnimationFrame(tick);
  }

  // FIXED — tab changes instantly on first click, no blocking
  setTab(tab: 'users' | 'add' | 'settings' | 'edit' | 'products' | 'formations' | 'forum' | 'messages' | string): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab as any;
  }

  initials(name?: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  private _initDateHelpers(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    this.currentMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const today = now.getDate();
    this.calendarDates = [-3, -2, -1, 0, 1, 2, 3].map(offset => ({
      num: today + offset,
      isToday: offset === 0
    }));
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private ensureNotificationPermission(): void {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ENHANCED BUSINESS LOGIC FROM VF VERSION
  // ═══════════════════════════════════════════════════════════

  loadDashboardData() {
    this.loadProducts();
    this.loadOrders();
    this.loadFormations();
    this.loadAllUsers();
    this.loading = false;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab as any;
    if (tab === 'products' && this.products.length === 0) {
      this.loadProducts();
    }
    if (tab === 'orders' && this.orders.length === 0) {
      this.loadOrders();
    }
    if (tab === 'formations' && this.formations.length === 0) {
      this.loadFormations();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRODUCT MANAGEMENT WITH CLOUDINARY
  // ═══════════════════════════════════════════════════════════

  loadProducts() {
    this.productsLoading = true;
    console.log('🔄 Loading products from database...');
    this.productService.getAll().subscribe({
      next: (products) => {
        console.log('📦 Products loaded:', products.length);
        this.products = products;
        this.stats.totalProducts = products.length;
        this.productsLoading = false;
      },
      error: (err) => {
        console.error('❌ Error loading products:', err);
        this.productsLoading = false;
      }
    });
  }

  openProductModal(product?: Product) {
    if (product) {
      this.editingProduct = product;
      this.productForm = {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        category: product.category,
        image: product.image || '',
        origin: product.origin || '',
        isEcological: product.isEcological
      };
      this.imagePreview = product.image || null;
    } else {
      this.editingProduct = null;
      this.productForm = {
        name: '',
        description: '',
        price: 0,
        stock: 0,
        category: 'NATURAL_COSMETICS' as any,
        image: '',
        origin: '',
        isEcological: true
      };
      this.imagePreview = null;
    }
    this.selectedImageFile = null;
    this.showProductModal = true;
  }

  closeProductModal() {
    this.showProductModal = false;
    this.editingProduct = null;
    this.selectedImageFile = null;
    this.imagePreview = null;
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.notificationService.error('Veuillez sélectionner un fichier image valide');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.notificationService.error('La taille de l\'image doit être inférieure à 5MB');
        return;
      }

      this.selectedImageFile = file;

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);

      this.productForm.image = '';

      console.log('🚀 Starting Cloudinary upload...');
      this.uploadingImage = true;
      this.uploadProgress = 0;
      
      this.cloudinaryService.uploadImageWithTransform(file, 800, 800).subscribe({
        next: (response) => {
          console.log('✅ Cloudinary upload SUCCESS:', response);
          
          if (response.secure_url && response.secure_url.includes('cloudinary.com')) {
            this.productForm.image = response.secure_url;
            console.log('📸 Image URL saved to form:', this.productForm.image);
            this.notificationService.success('Image uploadée avec succès sur Cloudinary!');
          } else {
            console.error('❌ Invalid Cloudinary response:', response);
            this.notificationService.error('Réponse Cloudinary invalide');
            this.productForm.image = '';
          }
          
          this.uploadingImage = false;
          this.uploadProgress = 100;
        },
        error: (error) => {
          console.error('❌ Cloudinary upload FAILED:', error);
          this.uploadingImage = false;
          this.uploadProgress = 0;
          this.productForm.image = '';
          
          let errorMsg = 'Erreur lors de l\'upload de l\'image.';
          if (error.status === 400) {
            errorMsg += ' Vérifiez la configuration Cloudinary.';
          }
          
          this.notificationService.error(errorMsg);
        }
      });
    }
  }

  removeImage() {
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.productForm.image = '';
  }

  triggerFileInput() {
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    fileInput?.click();
  }

  saveProduct() {
    if (!this.productForm.name || this.productForm.name.trim() === '') {
      this.notificationService.warning('Veuillez entrer un nom de produit');
      return;
    }

    if (!this.productForm.description || this.productForm.description.trim() === '') {
      this.notificationService.warning('Veuillez entrer une description');
      return;
    }

    if (!this.productForm.price || this.productForm.price <= 0) {
      this.notificationService.warning('Veuillez entrer un prix valide');
      return;
    }

    if (this.productForm.stock === null || this.productForm.stock === undefined || this.productForm.stock < 0) {
      this.notificationService.warning('Veuillez entrer une quantité de stock valide');
      return;
    }

    if (!this.productForm.category) {
      this.notificationService.warning('Veuillez sélectionner une catégorie');
      return;
    }

    if (!this.productForm.origin || this.productForm.origin.trim() === '') {
      this.notificationService.warning('Veuillez sélectionner un pays d\'origine');
      return;
    }

    if (this.uploadingImage) {
      this.notificationService.warning('Veuillez attendre la fin de l\'upload de l\'image');
      return;
    }

    if (!this.productForm.image || this.productForm.image.trim() === '') {
      this.notificationService.warning('Veuillez uploader une image du produit');
      return;
    }

    if (this.productForm.image.startsWith('data:image')) {
      this.notificationService.error('L\'image n\'a pas été uploadée sur Cloudinary. Veuillez réessayer.');
      return;
    }

    if (!this.productForm.image.includes('cloudinary.com')) {
      this.notificationService.warning('L\'URL de l\'image doit être une URL Cloudinary valide');
      return;
    }

    try {
      new URL(this.productForm.image);
    } catch (e) {
      this.notificationService.error('URL d\'image invalide');
      return;
    }

    const productData: any = { ...this.productForm };
    
    if (this.editingProduct) {
      productData.id = this.editingProduct.id;
      this.productService.update(productData).subscribe({
        next: () => {
          this.notificationService.success('Produit mis à jour avec succès!');
          this.loadProducts();
          this.closeProductModal();
        },
        error: (err) => {
          console.error('❌ Error updating product:', err);
          this.notificationService.error('Erreur lors de la mise à jour du produit.');
        }
      });
    } else {
      this.productService.create(productData).subscribe({
        next: () => {
          this.notificationService.success('Produit créé avec succès!');
          this.loadProducts();
          this.closeProductModal();
        },
        error: (err) => {
          console.error('❌ Error creating product:', err);
          this.notificationService.error('Erreur lors de la création du produit.');
        }
      });
    }
  }

  deleteProduct(id: number) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit?')) {
      this.productService.delete(id).subscribe({
        next: () => {
          this.notificationService.success('Produit supprimé avec succès!');
          this.loadProducts();
        },
        error: (err) => {
          console.error('Error deleting product:', err);
          this.notificationService.error('Erreur lors de la suppression du produit.');
        }
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ORDER MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  loadOrders() {
    this.ordersLoading = true;
    
    forkJoin({
      orders: this.orderService.getAll(),
      users: this.userService.getAll()
    }).subscribe({
      next: ({ orders, users: usersRaw }: any) => {
        const users: any[] = Array.isArray(usersRaw) ? usersRaw : (usersRaw?.content ?? []);
        const userMap = new Map(users.map((u: any) => [u.id, u]));
        
        this.orders = orders.map((order: any) => ({
          ...order,
          customerName: userMap.get(order.idUser)?.fullName || 'Unknown User',
          customerEmail: userMap.get(order.idUser)?.email || ''
        })).sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        this.stats.totalOrders = orders.length;
        this.stats.totalRevenue = orders
          .filter((o: any) => o.status === 'ACCEPTED')
          .reduce((sum: number, o: any) => sum + o.totalAmount, 0);
        this.ordersLoading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.ordersLoading = false;
      }
    });
  }

  viewOrderDetails(order: any) {
    this.selectedOrder = order;
  }

  closeOrderDetails() {
    this.selectedOrder = null;
  }

  updateOrderStatus(orderId: number, status: string) {
    this.orderService.updateStatus(orderId, status as any).subscribe({
      next: () => {
        this.loadOrders();
        if (this.selectedOrder && this.selectedOrder.id === orderId) {
          this.selectedOrder.status = status;
        }
      },
      error: (err) => console.error('Error updating order status:', err)
    });
  }

  getProductNames(order: any): string {
    if (!order.produits || order.produits.length === 0) {
      return 'No products';
    }
    return order.produits.map((p: any) => p.name).join(', ');
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'status-pending',
      'ACCEPTED': 'status-accepted',
      'REJECTED': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
  }

  getProductEmoji(category: string): string {
    return this.categoryEmojis[category] || '📦';
  }

  getProductColor(category: string): string {
    return this.categoryColors[category] || '#f0f0f0';
  }

  // ═══════════════════════════════════════════════════════════
  // ENHANCED FORMATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  loadFormations() {
    this.formationsLoading = true;
    this.formationService.getAll().subscribe({
      next: (formations) => {
        this.formations = formations;
        this.formationsLoading = false;
      },
      error: (err) => {
        console.error('Error loading formations:', err);
        this.notificationService.error('Error loading formations');
        this.formationsLoading = false;
      }
    });
  }

  openFormationModal(formation?: Formation) {
    if (formation) {
      this.editingFormation = formation;
      this.formationForm = {
        title: formation.title,
        description: formation.description,
        duration: formation.duration,
        maxCapacity: formation.maxCapacity,
        price: formation.price || 0,
        status: formation.status
      };
    } else {
      this.editingFormation = null;
      this.formationForm = {
        title: '',
        description: '',
        duration: 0,
        maxCapacity: 0,
        price: 0,
        status: 'PLANNED' as FormationStatus
      };
    }
    this.showFormationModal = true;
  }

  closeFormationModal() {
    this.showFormationModal = false;
    this.editingFormation = null;
  }

  saveFormation() {
    if (!this.formationForm.title || this.formationForm.title.trim() === '') {
      this.notificationService.warning('Please enter a formation title');
      return;
    }

    if (!this.formationForm.description || this.formationForm.description.trim() === '') {
      this.notificationService.warning('Please enter a formation description');
      return;
    }

    if (!this.formationForm.duration || this.formationForm.duration <= 0) {
      this.notificationService.warning('Please enter a valid duration (greater than 0)');
      return;
    }

    if (!this.formationForm.maxCapacity || this.formationForm.maxCapacity <= 0) {
      this.notificationService.warning('Please enter a valid capacity (greater than 0)');
      return;
    }

    const formationData: any = { ...this.formationForm };
    
    if (this.editingFormation) {
      formationData.id = this.editingFormation.id;
      formationData.participantIds = this.editingFormation.participantIds || [];
      this.formationService.update(formationData).subscribe({
        next: () => {
          this.notificationService.success('Formation updated successfully!');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: (err) => {
          console.error('Error updating formation:', err);
          this.notificationService.error('Error updating formation. Please try again.');
        }
      });
    } else {
      this.formationService.create(formationData).subscribe({
        next: () => {
          this.notificationService.success('Formation créée avec succès !');
          this.loadFormations();
          this.closeFormationModal();
        },
        error: (err) => {
          console.error('Error creating formation:', err);
          const msg = err?.error?.message || err?.message || `Erreur ${err?.status}`;
          this.notificationService.error(`Erreur lors de la création : ${msg}`);
        }
      });
    }
  }

  deleteFormation(id: number) {
    this.formationService.delete(id).subscribe({
      next: () => {
        this.notificationService.success('Formation supprimée avec succès!');
        this.loadFormations();
      },
      error: (err) => {
        console.error('Error deleting formation:', err);
        this.notificationService.error('Erreur lors de la suppression de la formation.');
      }
    });
  }

  updateFormationStatus(id: number, status: FormationStatus) {
    this.formationService.updateStatus(id, status).subscribe({
      next: () => {
        this.notificationService.success('Formation status updated!');
        this.loadFormations();
      },
      error: (err) => {
        console.error('Error updating formation status:', err);
        this.notificationService.error('Error updating status. Please try again.');
      }
    });
  }

  // AI Description Generation
  generateDescription(): void {
    if (!this.formationForm.title || this.formationForm.title.trim() === '') {
      this.notificationService.warning('Veuillez saisir un titre avant de générer une description');
      return;
    }
    this.generatingDescription = true;
    this.formationService.generateDescription(this.formationForm.title, this.formationForm.duration).subscribe({
      next: (res) => {
        this.formationForm.description = res.description;
        this.generatingDescription = false;
      },
      error: (err) => {
        console.error('Error generating description:', err);
        this.notificationService.error('Erreur lors de la génération de la description');
        this.generatingDescription = false;
      }
    });
  }

  // Load all users for participant details
  loadAllUsers(): void {
    this.userService.getUsersByRole('TRAINER').subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.content ?? []);
        this.allUsers = list;
        this.trainersMap = new Map(list.map((u: any) => [u.id, u.fullName || u.full_name || '—']));
      },
      error: (err) => {
        console.error('Error loading trainers:', err);
        this.allUsers = [];
        this.trainersMap = new Map();
      }
    });
  }

  get trainers(): any[] {
    if (!Array.isArray(this.allUsers)) return [];
    return this.allUsers;
  }

  getTrainerName(trainerId: number): string {
    if (!trainerId) return '—';
    if (this.trainersMap && this.trainersMap.has(trainerId)) {
      return this.trainersMap.get(trainerId)!;
    }
    try {
      if (Array.isArray(this.allUsers)) {
        const trainer = this.allUsers.find((u: any) => u.id === trainerId);
        return trainer ? (trainer.fullName || trainer.full_name || '—') : '—';
      }
    } catch { /* ignore */ }
    return '—';
  }

  getFormationStatusClass(status: FormationStatus): string {
    const statusMap: Record<string, string> = {
      'PLANNED': 'status-planned',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed'
    };
    return statusMap[status] || 'status-planned';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateShort(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  formatTimeOnly(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  viewFormationSessions(formation: Formation) {
    this.selectedFormationForSessions = formation;
    this.loadSessionsForFormation(formation.id!);
    this.loadResources(formation.id!);
    if (this.trainersMap.size === 0) {
      this.loadAllUsers();
    }
  }

  closeSessionsView() {
    this.selectedFormationForSessions = null;
    this.sessions = [];
  }

  loadSessionsForFormation(formationId: number) {
    this.sessionsLoading = true;
    this.sessionService.getByFormation(formationId).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.sessionsLoading = false;
      },
      error: (err) => {
        console.error('Error loading sessions:', err);
        this.notificationService.error('Error loading sessions');
        this.sessionsLoading = false;
      }
    });
  }

  openSessionModal(session?: Session) {
    if (!this.selectedFormationForSessions) {
      this.notificationService.warning('Please select a formation first');
      return;
    }

    if (session) {
      this.editingSession = session;
      this.sessionForm = {
        title: session.title,
        startDate: session.startDate.substring(0, 16),
        endDate: session.endDate.substring(0, 16),
        status: session.status,
        type: session.type || SessionType.ONLINE,
        meetLink: session.meetLink || '',
        trainerId: session.trainerId,
        formationId: this.selectedFormationForSessions.id!,
        isFinalSession: session.isFinalSession || false
      };
    } else {
      this.editingSession = null;
      this.sessionForm = {
        title: '',
        startDate: '',
        endDate: '',
        status: 'SCHEDULED' as SessionStatus,
        type: SessionType.ONLINE,
        meetLink: '',
        trainerId: this.trainers.length > 0 ? this.trainers[0].id : 0,
        formationId: this.selectedFormationForSessions.id!,
        isFinalSession: false
      };
    }
    this.showSessionModal = true;
  }

  closeSessionModal() {
    this.showSessionModal = false;
    this.editingSession = null;
  }

  saveSession() {
    if (!this.sessionForm.title || this.sessionForm.title.trim() === '') {
      this.notificationService.warning('Please enter a session title');
      return;
    }

    if (!this.sessionForm.startDate) {
      this.notificationService.warning('Please select a start date');
      return;
    }

    if (!this.sessionForm.endDate) {
      this.notificationService.warning('Please select an end date');
      return;
    }

    const startDate = new Date(this.sessionForm.startDate);
    const endDate = new Date(this.sessionForm.endDate);

    if (endDate <= startDate) {
      this.notificationService.warning('End date must be after start date');
      return;
    }

    if (!this.sessionForm.trainerId || this.sessionForm.trainerId <= 0) {
      this.notificationService.warning('Please select a trainer');
      return;
    }

    const sessionData: any = {
      title: this.sessionForm.title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: this.sessionForm.status,
      type: this.sessionForm.type,
      meetLink: this.sessionForm.meetLink,
      trainerId: this.sessionForm.trainerId,
      isFinalSession: this.sessionForm.isFinalSession
    };
    
    if (this.editingSession) {
      sessionData.id = this.editingSession.id;
      this.sessionService.update(sessionData).subscribe({
        next: () => {
          this.notificationService.success('Session updated successfully!');
          this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
          this.closeSessionModal();
        },
        error: (err) => {
          console.error('Error updating session:', err);
          this.notificationService.error('Error updating session. Please try again.');
        }
      });
    } else {
      this.sessionService.create(sessionData, this.sessionForm.formationId).subscribe({
        next: () => {
          this.notificationService.success('Session created successfully!');
          this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
          this.closeSessionModal();
        },
        error: (err) => {
          console.error('Error creating session:', err);
          this.notificationService.error('Error creating session. Please try again.');
        }
      });
    }
  }

  deleteSession(id: number) {
    if (confirm('Are you sure you want to delete this session?')) {
      this.sessionService.delete(id).subscribe({
        next: () => {
          this.notificationService.success('Session deleted successfully!');
          this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
        },
        error: (err) => {
          console.error('Error deleting session:', err);
          this.notificationService.error('Error deleting session. Please try again.');
        }
      });
    }
  }

  updateSessionStatus(id: number, status: SessionStatus) {
    this.sessionService.updateStatus(id, status).subscribe({
      next: () => {
        this.notificationService.success('Session status updated!');
        this.loadSessionsForFormation(this.selectedFormationForSessions!.id!);
      },
      error: (err) => {
        console.error('Error updating session status:', err);
        this.notificationService.error('Error updating status. Please try again.');
      }
    });
  }

  getSessionStatusClass(status: SessionStatus): string {
    const statusMap: Record<string, string> = {
      'SCHEDULED': 'status-scheduled',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return statusMap[status] || 'status-scheduled';
  }

  getSessionStatusClassModern(status: SessionStatus): string {
    const statusMap: Record<string, string> = {
      'SCHEDULED': 'status-upcoming',
      'IN_PROGRESS': 'status-in-progress',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return statusMap[status] || 'status-upcoming';
  }

  // Toggle participants panel
  toggleParticipantsPanel(formationId: number): void {
    if (this.expandedFormationId === formationId) {
      this.expandedFormationId = null;
    } else {
      this.expandedFormationId = formationId;
    }
  }

  // Get participant details
  getParticipantDetails(participantIds: number[]): any[] {
    if (!participantIds || participantIds.length === 0) return [];
    if (!Array.isArray(this.allUsers)) return [];
    return participantIds
      .map((id: number) => this.allUsers.find((user: any) => user.id === id))
      .filter((user: any) => user !== undefined);
  }

  // ═══════════════════════════════════════════════════════════
  // RESOURCE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  onResourceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedResourceFile = input.files[0];
    }
  }

  uploadResource(formationId: number): void {
    if (!this.selectedResourceFile) {
      this.notificationService.warning('Veuillez sélectionner un fichier');
      return;
    }
    this.resourceUploading = true;
    this.formationService.uploadResource(formationId, this.selectedResourceFile).subscribe({
      next: () => {
        this.notificationService.success('Ressource uploadée avec succès');
        this.selectedResourceFile = null;
        this.resourceUploading = false;
        this.loadResources(formationId);
      },
      error: (err) => {
        console.error('Error uploading resource:', err);
        this.notificationService.error("Erreur lors de l'upload de la ressource");
        this.resourceUploading = false;
      }
    });
  }

  deleteResource(formationId: number, resourceId: number): void {
    if (confirm('Supprimer cette ressource ?')) {
      this.formationService.deleteResource(formationId, resourceId).subscribe({
        next: () => {
          this.notificationService.success('Ressource supprimée');
          this.loadResources(formationId);
        },
        error: (err) => {
          console.error('Error deleting resource:', err);
          this.notificationService.error('Erreur lors de la suppression');
        }
      });
    }
  }

  loadResources(formationId: number): void {
    this.formationService.getResources(formationId).subscribe({
      next: (resources) => { this.formationResources = resources; },
      error: (err) => { console.error('Error loading resources:', err); }
    });
  }

  downloadResource(formationId: number, resourceId: number, fileName: string): void {
    this.formationService.downloadResource(formationId, resourceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading resource:', err);
        this.notificationService.error('Erreur lors du téléchargement');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // QUIZ MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  openQuizModal(): void {
    this.quizForm = { title: '', passingScore: 80, questions: [] };
    this.showQuizModal = true;
  }

  generateQuizFromResources(): void {
    if (!this.selectedFormationForSessions) return;
    if (this.formationResources.length === 0) {
      this.notificationService.warning('Uploadez d\'abord des ressources pour cette formation.');
      return;
    }
    this.generatingQuiz = true;
    this.formationService.generateQuizFromResources(this.selectedFormationForSessions.id!, 10).subscribe({
      next: () => {
        this.notificationService.success('Quiz QCM généré !');
        this.generatingQuiz = false;
        this.router.navigate(['/formations', this.selectedFormationForSessions!.id, 'quiz'], {
          queryParams: { preview: 'true', from: 'admin' }
        });
      },
      error: (err) => {
        console.error('Error generating quiz:', err);
        const msg = err?.error?.message || err?.error || err?.message || 'Erreur lors de la génération';
        this.notificationService.error(msg);
        this.generatingQuiz = false;
      }
    });
  }

  openQuizPreview(formationId: number): void {
    this.quizPreviewLoading = true;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
    this.showQuizPreviewModal = true;
    this.formationService.getQuizPreview(formationId).subscribe({
      next: (quiz) => {
        this.quizPreview = quiz;
        this.quizPreviewLoading = false;
      },
      error: (err) => {
        console.error('Error loading quiz preview:', err);
        this.notificationService.error('Erreur lors du chargement du quiz');
        this.showQuizPreviewModal = false;
        this.quizPreviewLoading = false;
      }
    });
  }

  closeQuizPreviewModal(): void {
    this.showQuizPreviewModal = false;
    this.quizPreview = null;
    this.quizPreviewAnswers = new Map();
    this.quizPreviewResult = null;
  }

  selectQuizPreviewOption(questionId: number, optionId: number): void {
    this.quizPreviewAnswers.set(questionId, optionId);
  }

  isQuizPreviewSelected(questionId: number, optionId: number): boolean {
    return this.quizPreviewAnswers.get(questionId) === optionId;
  }

  allQuizPreviewAnswered(): boolean {
    if (!this.quizPreview) return false;
    return this.quizPreview.questions.every((q: any) => this.quizPreviewAnswers.has(q.id));
  }

  // ═══════════════════════════════════════════════════════════
  // UTILITY METHODS FROM VF
  // ═══════════════════════════════════════════════════════════

  debugImageSaving() {
    console.log('🔍 Debugging image saving...');
    this.productService.getDebugImages().subscribe({
      next: (debugInfo) => {
        console.log('📋 Products debug info:', debugInfo);
        this.notificationService.success('Check console for debug information');
      },
      error: (err) => {
        console.error('❌ Error getting debug info:', err);
        this.notificationService.error('Error getting debug information');
      }
    });
  }

  testProductCreation() {
    const testProduct: any = {
      name: 'Test Product - ' + new Date().getTime(),
      description: 'Test product to verify image saving functionality',
      price: 29.99,
      stock: 10,
      category: 'NATURAL_COSMETICS',
      origin: 'France',
      isEcological: true,
      image: 'https://res.cloudinary.com/drqf2fuvi/image/upload/v1234567890/test-image.jpg'
    };

    console.log('🧪 Testing product creation with hardcoded Cloudinary URL:', testProduct);
    
    this.productService.create(testProduct).subscribe({
      next: (createdProduct) => {
        console.log('✅ Test product created successfully:', createdProduct);
        this.notificationService.success('Test product created! Check console for details.');
        this.loadProducts();
      },
      error: (err) => {
        console.error('❌ Test product creation failed:', err);
        this.notificationService.error('Test product creation failed');
      }
    });
  }

  testCloudinaryConfig() {
    console.log('🔧 Testing Cloudinary configuration...');
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    fetch(testImageData)
      .then(res => res.blob())
      .then(blob => {
        const testFile = new File([blob], 'test.png', { type: 'image/png' });
        
        const formData = new FormData();
        formData.append('file', testFile);
        formData.append('upload_preset', 'ml_default');
        
        this.http.post('https://api.cloudinary.com/v1_1/demo/image/upload', formData).subscribe({
          next: (response) => {
            console.log('✅ Cloudinary test upload SUCCESS:', response);
            this.notificationService.success('Cloudinary configuration is working!');
          },
          error: (error) => {
            console.error('❌ Cloudinary test upload FAILED:', error);
            this.notificationService.error('Cloudinary configuration issue: ' + (error.error?.error?.message || error.message));
          }
        });
      })
      .catch(err => {
        console.error('❌ Failed to create test file:', err);
      });
  }

  setTestImageUrl() {
    const testUrl = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400';
    this.productForm.image = testUrl;
    this.imagePreview = testUrl;
    console.log('🧪 Test image URL set:', testUrl);
    this.notificationService.success('Test image URL set - now try creating the product');
  }

  debugCompleteFlow() {
    console.log('🔍 === COMPLETE DEBUG FLOW ===');
    console.log('1. Current productForm state:', this.productForm);
    console.log('2. Image preview state:', this.imagePreview);
    console.log('3. Upload state:', { uploading: this.uploadingImage, progress: this.uploadProgress });
    
    console.log('4. Testing Cloudinary service...');
    console.log('   - Cloud Name:', 'drqf2fuvi');
    console.log('   - Upload Preset:', 'vero-products');
    
    console.log('5. Testing backend connection...');
    this.productService.getAll().subscribe({
      next: (products) => {
        console.log('   ✅ Backend connection OK, products count:', products.length);
        const productsWithImages = products.filter(p => p.image && p.image.trim() !== '');
        console.log('   📸 Products with images:', productsWithImages.length);
        
        if (productsWithImages.length > 0) {
          console.log('   🔍 Sample product with image:', {
            id: productsWithImages[0].id,
            name: productsWithImages[0].name,
            imageUrl: productsWithImages[0].image
          });
        }
      },
      error: (err) => {
        console.error('   ❌ Backend connection failed:', err);
      }
    });
    
    this.notificationService.success('Debug complete - check console for details');
  }
}