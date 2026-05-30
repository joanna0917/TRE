import React, { useState, useEffect } from 'react';
import { Product, Topping, Order } from './types';
import { dbService } from './db';
import CustomerDashboard from './components/CustomerDashboard';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdminView, setIsAdminView] = useState(false);

  // Subscribe to reactive database changes (Firestore + Local Fallback)
  useEffect(() => {
    const unsubProducts = dbService.subscribeProducts((data) => {
      setProducts(data);
    });
    
    const unsubToppings = dbService.subscribeToppings((data) => {
      setToppings(data);
    });

    const unsubOrders = dbService.subscribeOrders((data) => {
      setOrders(data);
    });

    return () => {
      unsubProducts();
      unsubToppings();
      unsubOrders();
    };
  }, []);

  return (
    <div className="min-h-screen text-slate-800 antialiased font-sans">
      
      {isAdminView ? (
        <AdminPanel
          products={products}
          toppings={toppings}
          orders={orders}
          onBack={() => setIsAdminView(false)}
        />
      ) : (
        <CustomerDashboard
          products={products}
          toppings={toppings}
          orders={orders}
          onOpenAdmin={() => setIsAdminView(true)}
        />
      )}

    </div>
  );
}
