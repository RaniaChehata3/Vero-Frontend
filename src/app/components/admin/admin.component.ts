import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { OrderService } from '../../services/order.service';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { Product, Order } from '../../services/product.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  currentUser: any = null;
  activeTab: string = 'overview';
  loading = true;

  // Stats
  stats = {
    totalUsers: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0
  };

  // Products
  products: Product[] = [];
  productsLoading = false;
  showProductModal = false;
  editingProduct: Product | null = null;
  productForm = {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'FOOD',
    image: '',
    origin: '',
    isEcological: true
  };
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  // Orders
  orders: any[] = [];
  ordersLoading = false;
  selectedOrder: any | null = null;
  orderCustomers: Map<number, any> = new Map(); // Cache customer data

  categories = ['NATURAL_COSMETICS', 'ECO_FRIENDLY_HOME', 'SUSTAINABLE_FASHION', 'KITCHEN_AND_DINING', 'ECO_GARDENING', 'ECO_PET_PRODUCTS', 'ECO_GIFT_SETS'];

  // Category mapping for display (same as shop)
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

  constructor(
    private authService: AuthService,
    private productService: ProductService,
    private orderService: OrderService,
    private userService: UserService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUser = user;
        if (user.role !== 'ADMIN') {
          this.router.navigate(['/']);
        } else {
          this.loadDashboardData();
        }
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.router.navigate(['/login']);
      }
    });
  }

  loadDashboardData() {
    this.loadProducts();
    this.loadOrders();
    this.loading = false;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    if (tab === 'products' && this.products.length === 0) {
      this.loadProducts();
    }
    if (tab === 'orders' && this.orders.length === 0) {
      this.loadOrders();
    }
  }

  // Product Management
  loadProducts() {
    this.productsLoading = true;
    this.productService.getAll().subscribe({
      next: (products) => {
        this.products = products;
        this.stats.totalProducts = products.length;
        this.productsLoading = false;
      },
      error: (err) => {
        console.error('Error loading products:', err);
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
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.notificationService.error('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.notificationService.error('Image size should be less than 5MB');
        return;
      }

      this.selectedImageFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
        this.productForm.image = e.target?.result as string; // Store base64 in form
      };
      reader.readAsDataURL(file);
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
    // Validation des champs obligatoires
    if (!this.productForm.name || this.productForm.name.trim() === '') {
      this.notificationService.warning('Please enter a product name');
      return;
    }

    if (!this.productForm.description || this.productForm.description.trim() === '') {
      this.notificationService.warning('Please enter a product description');
      return;
    }

    if (!this.productForm.price || this.productForm.price <= 0) {
      this.notificationService.warning('Please enter a valid price (greater than 0)');
      return;
    }

    if (this.productForm.stock === null || this.productForm.stock === undefined || this.productForm.stock < 0) {
      this.notificationService.warning('Please enter a valid stock quantity (0 or greater)');
      return;
    }

    if (!this.productForm.category) {
      this.notificationService.warning('Please select a category');
      return;
    }

    if (!this.productForm.origin || this.productForm.origin.trim() === '') {
      this.notificationService.warning('Please select a country of origin');
      return;
    }

    if (!this.productForm.image || this.productForm.image.trim() === '') {
      this.notificationService.warning('Please upload a product image');
      return;
    }

    const productData: any = { ...this.productForm };
    
    if (this.editingProduct) {
      productData.id = this.editingProduct.id;
      this.productService.update(productData).subscribe({
        next: () => {
          this.notificationService.success('Product updated successfully!');
          this.loadProducts();
          this.closeProductModal();
        },
        error: (err) => {
          console.error('Error updating product:', err);
          this.notificationService.error('Error updating product. Please try again.');
        }
      });
    } else {
      this.productService.create(productData).subscribe({
        next: () => {
          this.notificationService.success('Product created successfully!');
          this.loadProducts();
          this.closeProductModal();
        },
        error: (err) => {
          console.error('Error creating product:', err);
          this.notificationService.error('Error creating product. Please try again.');
        }
      });
    }
  }

  deleteProduct(id: number) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.productService.delete(id).subscribe({
        next: () => this.loadProducts(),
        error: (err) => console.error('Error deleting product:', err)
      });
    }
  }

  // Order Management
  loadOrders() {
    this.ordersLoading = true;
    
    // Load orders and users in parallel
    forkJoin({
      orders: this.orderService.getAll(),
      users: this.userService.getAll()
    }).subscribe({
      next: ({ orders, users }) => {
        // Create a map of users for quick lookup
        const userMap = new Map(users.map(u => [u.id, u]));
        
        // Enhance orders with customer names
        this.orders = orders.map(order => ({
          ...order,
          customerName: userMap.get(order.idUser)?.fullName || 'Unknown User',
          customerEmail: userMap.get(order.idUser)?.email || ''
        })).sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        this.stats.totalOrders = orders.length;
        this.stats.totalRevenue = orders
          .filter(o => o.status === 'ACCEPTED')
          .reduce((sum, o) => sum + o.totalAmount, 0);
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
}
