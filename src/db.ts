import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { Product, Topping, Order, AdminSettings } from './types';

// Default menu items from user-uploaded image
export const DEFAULT_PRODUCTS: Product[] = [
  { id: 'p1', name: '茉莉綠茶', priceM: 25, priceL: 30, stockM: 100, stockL: 100, category: '找好茶' },
  { id: 'p2', name: '阿薩姆紅茶', priceM: 25, priceL: 30, stockM: 100, stockL: 100, category: '找好茶' },
  { id: 'p3', name: '四季春青茶', priceM: 25, priceL: 30, stockM: 100, stockL: 100, category: '找好茶' },
  { id: 'p4', name: '黃金烏龍', priceM: 25, priceL: 30, stockM: 100, stockL: 100, category: '找好茶' },
  { id: 'p5', name: '波霸紅', priceM: 35, priceL: 45, stockM: 100, stockL: 100, category: '波霸特調' },
  { id: 'p6', name: '微檸檬青', priceM: 35, priceL: 45, stockM: 100, stockL: 100, category: '鮮果特調' },
  { id: 'p7', name: '檸檬綠', priceM: 40, priceL: 55, stockM: 100, stockL: 100, category: '鮮果特調' },
  { id: 'p8', name: '梅の綠', priceM: 40, priceL: 55, stockM: 100, stockL: 100, category: '鮮果特調' },
  { id: 'p9', name: '8冰綠', priceM: 40, priceL: 55, stockM: 100, stockL: 100, category: '鮮果特調' },
  { id: 'p10', name: '多多綠', priceM: 40, priceL: 55, stockM: 100, stockL: 100, category: '多多特調' },
  { id: 'p11', name: '旺來紅', priceM: 40, priceL: 55, stockM: 100, stockL: 100, category: '鮮果特調' },
  { id: 'p12', name: '柚子紅', priceM: 40, priceL: 55, stockM: 100, stockL: 100, category: '鮮果特調' }
];

export const DEFAULT_TOPPINGS: Topping[] = [
  { id: 't1', name: '波霸 (Boba)', price: 10, stock: 50 },
  { id: 't2', name: '椰果 (Coconut Jelly)', price: 10, stock: 40 },
  { id: 't3', name: '蘆薈 (Aloe)', price: 15, stock: 30 },
  { id: 't4', name: '布丁 (Pudding)', price: 15, stock: 25 }
];

const STORAGE_KEYS = {
  PRODUCTS: 'tea_ordering_products',
  TOPPINGS: 'tea_ordering_toppings',
  ORDERS: 'tea_ordering_orders',
  SETTINGS: 'tea_ordering_settings'
};

// Check if Firebase is actually configured
export let isFirebaseActive = false;
let db: any = null;

try {
  if (firebaseConfig && firebaseConfig.projectId && firebaseConfig.projectId !== '') {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseActive = true;
    console.log('Firebase active and configured successfully!');
  } else {
    console.log('Firebase configuration is empty. Running in robust local-fallback mode.');
  }
} catch (error) {
  console.error('Firebase initialization error. App will run in secure localStorage mode:', error);
}

// Native Cryptography SHA-256 wrapper
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_salt_tea_system_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Subscription helper type
type ListenerCallback<T> = (data: T) => void;

class DBService {
  // Local active memory states and matching local subscription lists
  private productsHash: { [id: string]: Product } = {};
  private toppingsHash: { [id: string]: Topping } = {};
  private ordersHash: { [id: string]: Order } = {};
  private settings: AdminSettings | null = null;

  private productsListeners = new Set<ListenerCallback<Product[]>>();
  private toppingsListeners = new Set<ListenerCallback<Topping[]>>();
  private ordersListeners = new Set<ListenerCallback<Order[]>>();
  private settingsListeners = new Set<ListenerCallback<AdminSettings | null>>();

  constructor() {
    this.initializeLocalStorageIfEmpty();
    this.loadAllFromLocalStorage();
    this.startFirebaseSubscriptionsIfActive();
  }

  private initializeLocalStorageIfEmpty() {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TOPPINGS)) {
      localStorage.setItem(STORAGE_KEYS.TOPPINGS, JSON.stringify(DEFAULT_TOPPINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
    }
  }

  private loadAllFromLocalStorage() {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
      p.forEach((item: Product) => { this.productsHash[item.id] = item; });

      const t = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOPPINGS) || '[]');
      t.forEach((item: Topping) => { this.toppingsHash[item.id] = item; });

      const o = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
      o.forEach((item: Order) => { this.ordersHash[item.id] = item; });

      const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      this.settings = s ? JSON.parse(s) : null;
    } catch (e) {
      console.error('Error loading local storage cache: ', e);
    }
  }

  private startFirebaseSubscriptionsIfActive() {
    if (!isFirebaseActive) return;

    // A. Sync Products
    onSnapshot(collection(db, 'products'), (snapshot) => {
      if (snapshot.empty) {
        // Bootstrap Firebase products with defaults if empty
        DEFAULT_PRODUCTS.forEach(async (p) => {
          await setDoc(doc(db, 'products', p.id), p);
        });
      } else {
        const list: Product[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Product);
        });
        // Save to cache
        list.forEach(p => { this.productsHash[p.id] = p; });
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(list));
        this.notifyProducts();
      }
    }, (err) => {
      console.warn('Firebase products loading fallback:', err);
    });

    // B. Sync Toppings
    onSnapshot(collection(db, 'toppings'), (snapshot) => {
      if (snapshot.empty) {
        // Bootstrap Firebase toppings with defaults if empty
        DEFAULT_TOPPINGS.forEach(async (t) => {
          await setDoc(doc(db, 'toppings', t.id), t);
        });
      } else {
        const list: Topping[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Topping);
        });
        list.forEach(t => { this.toppingsHash[t.id] = t; });
        localStorage.setItem(STORAGE_KEYS.TOPPINGS, JSON.stringify(list));
        this.notifyToppings();
      }
    }, (err) => {
      console.warn('Firebase toppings loading fallback:', err);
    });

    // C. Sync Orders
    onSnapshot(collection(db, 'orders'), (snapshot) => {
      const list: Order[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Order);
      });
      // Sort orders descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      this.ordersHash = {};
      list.forEach(o => { this.ordersHash[o.id] = o; });
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(list));
      this.notifyOrders();
    }, (err) => {
      console.warn('Firebase orders loading fallback:', err);
    });

    // D. Sync Admin Settings
    onSnapshot(doc(db, 'settings', 'admin'), (docSnapshot) => {
      if (docSnapshot.exists()) {
        this.settings = docSnapshot.data() as AdminSettings;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        this.notifySettings();
      }
    }, (err) => {
      console.warn('Firebase settings loading fallback:', err);
    });
  }

  // --- Products API ---
  public subscribeProducts(cb: ListenerCallback<Product[]>) {
    this.productsListeners.add(cb);
    cb(this.getProductsList());
    return () => this.productsListeners.delete(cb);
  }

  public getProductsList(): Product[] {
    return Object.values(this.productsHash);
  }

  public async updateProductStock(productId: string, stockM: number, stockL: number): Promise<void> {
    const updated = { ...this.productsHash[productId], stockM, stockL };
    this.productsHash[productId] = updated;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.getProductsList()));
    this.notifyProducts();

    if (isFirebaseActive) {
      await setDoc(doc(db, 'products', productId), updated, { merge: true });
    }
  }

  // --- Toppings API ---
  public subscribeToppings(cb: ListenerCallback<Topping[]>) {
    this.toppingsListeners.add(cb);
    cb(this.getToppingsList());
    return () => this.toppingsListeners.delete(cb);
  }

  public getToppingsList(): Topping[] {
    return Object.values(this.toppingsHash);
  }

  public async updateToppingStock(toppingId: string, stock: number): Promise<void> {
    const updated = { ...this.toppingsHash[toppingId], stock };
    this.toppingsHash[toppingId] = updated;
    localStorage.setItem(STORAGE_KEYS.TOPPINGS, JSON.stringify(this.getToppingsList()));
    this.notifyToppings();

    if (isFirebaseActive) {
      await setDoc(doc(db, 'toppings', toppingId), updated, { merge: true });
    }
  }

  // --- Orders API ---
  public subscribeOrders(cb: ListenerCallback<Order[]>) {
    this.ordersListeners.add(cb);
    cb(this.getOrdersList());
    return () => this.ordersListeners.delete(cb);
  }

  public getOrdersList(): Order[] {
    return Object.values(this.ordersHash).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async submitOrder(order: Order): Promise<boolean> {
    // 1. Stock validation & atomically subtract stock level list
    const canFulfill = this.verifyAndSubtractStockLocal(order);
    if (!canFulfill) {
      return false; // Out of stock
    }

    // Save order
    this.ordersHash[order.id] = order;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.getOrdersList()));
    
    // Save stock subtraction
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(this.getProductsList()));
    localStorage.setItem(STORAGE_KEYS.TOPPINGS, JSON.stringify(this.getToppingsList()));

    this.notifyOrders();
    this.notifyProducts();
    this.notifyToppings();

    if (isFirebaseActive) {
      // Direct write
      try {
        await setDoc(doc(db, 'orders', order.id), order);
        
        // Sync products stock to firebase
        for (const item of order.items) {
          const prod = this.productsHash[item.product.id];
          await setDoc(doc(db, 'products', prod.id), prod, { merge: true });
          
          for (const top of item.toppings) {
            const toppingItem = this.toppingsHash[top.id];
            await setDoc(doc(db, 'toppings', toppingItem.id), toppingItem, { merge: true });
          }
        }
      } catch (e) {
        console.error('Firebase order submittal failed:', e);
      }
    }

    return true;
  }

  private verifyAndSubtractStockLocal(order: Order): boolean {
    // Check if enough stock exists for both selected products and chosen toppings
    const productsSnapshot = JSON.parse(JSON.stringify(this.productsHash));
    const toppingsSnapshot = JSON.parse(JSON.stringify(this.toppingsHash));

    for (const item of order.items) {
      const prod = productsSnapshot[item.product.id];
      if (!prod) return false;

      const qty = item.quantity;
      if (item.size === 'M') {
        if (prod.stockM < qty) return false;
        prod.stockM -= qty;
      } else {
        if (prod.stockL < qty) return false;
        prod.stockL -= qty;
      }

      // Check toppings
      for (const t of item.toppings) {
        const top = toppingsSnapshot[t.id];
        if (!top) return false;
        if (top.stock < qty) return false;
        top.stock -= qty;
      }
    }

    // If passed verification, transfer snapshot back to primary state
    this.productsHash = productsSnapshot;
    this.toppingsHash = toppingsSnapshot;
    return true;
  }

  public async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    if (this.ordersHash[orderId]) {
      this.ordersHash[orderId].status = status;
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(this.getOrdersList()));
      this.notifyOrders();

      if (isFirebaseActive) {
        await updateDoc(doc(db, 'orders', orderId), { status });
      }
    }
  }

  // --- Settings / Admin Password API ---
  public subscribeSettings(cb: ListenerCallback<AdminSettings | null>) {
    this.settingsListeners.add(cb);
    cb(this.settings);
    return () => this.settingsListeners.delete(cb);
  }

  public async setAdminPassword(password: string): Promise<void> {
    const hash = await hashPassword(password);
    const newSettings: AdminSettings = {
      adminPasswordHash: hash,
      createdAt: new Date().toISOString()
    };
    this.settings = newSettings;
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
    this.notifySettings();

    if (isFirebaseActive) {
      await setDoc(doc(db, 'settings', 'admin'), newSettings);
    }
  }

  public async verifyAdminPassword(password: string): Promise<boolean> {
    if (!this.settings) return false;
    const hash = await hashPassword(password);
    return this.settings.adminPasswordHash === hash;
  }

  public hasAdminPasswordSet(): boolean {
    return this.settings !== null;
  }

  // --- Notification triggers ---
  private notifyProducts() {
    const list = this.getProductsList();
    this.productsListeners.forEach(cb => cb(list));
  }

  private notifyToppings() {
    const list = this.getToppingsList();
    this.toppingsListeners.forEach(cb => cb(list));
  }

  private notifyOrders() {
    const list = this.getOrdersList();
    this.ordersListeners.forEach(cb => cb(list));
  }

  private notifySettings() {
    this.settingsListeners.forEach(cb => cb(this.settings));
  }
}

export const dbService = new DBService();
