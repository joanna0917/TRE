export interface Product {
  id: string;
  name: string;
  priceM: number;
  priceL: number;
  stockM: number;
  stockL: number;
  category: string;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface OrderItem {
  id: string; // unique key for items in a cart
  product: Product;
  size: 'M' | 'L';
  sweetness: string;
  ice: string;
  toppings: Topping[];
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  quantity: number;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  clientName: string;
  clientPhone: string;
  createdAt: string; // ISO date format
}

export interface AdminSettings {
  adminPasswordHash: string;
  createdAt: string;
}
