import React, { useState } from 'react';
import { Product, Topping, OrderItem, Order } from '../types';
import { dbService } from '../db';
import { 
  ShoppingBag, 
  Search, 
  Trash2, 
  History, 
  User, 
  Phone, 
  Coffee, 
  AlertCircle, 
  CheckCircle,
  Clock,
  ChevronRight,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';
import DrinkCustomizerModal from './DrinkCustomizerModal';

interface CustomerDashboardProps {
  products: Product[];
  toppings: Topping[];
  orders: Order[];
  onOpenAdmin: () => void;
}

export default function CustomerDashboard({
  products,
  toppings,
  orders,
  onOpenAdmin
}: CustomerDashboardProps) {
  // Navigation tabs: 'menu' | 'history'
  const [activeView, setActiveView] = useState<'menu' | 'history'>('menu');

  // Search & Categories filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');

  // Interactive Shopping Cart states
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Search references for historical orders lookup
  const [historySearchPhone, setHistorySearchPhone] = useState('');
  const [historyResults, setHistoryResults] = useState<Order[] | null>(null);

  // Modal control states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [orderError, setOrderError] = useState('');

  const categories = ['全部', '找好茶', '波霸特調', '鮮果特調', '多多特調'];

  // Filter products by searching and category tags
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.includes(searchQuery);
    const matchesCategory = selectedCategory === '全部' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Shopping cart calculations
  const cartItemCount = cart.reduce((add, item) => add + item.quantity, 0);
  const cartTotalAmount = cart.reduce((add, item) => add + (item.price * item.quantity), 0);

  // Cart operations
  const handleAddToCart = (item: OrderItem) => {
    // Check if identical item configuration already exists in shopping cart. If so, combine quantities!
    const existingIndex = cart.findIndex(c => c.id === item.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += item.quantity;
      setCart(updated);
    } else {
      setCart([...cart, item]);
    }
  };

  const handleUpdateCartQty = (id: string, multiplier: number) => {
    const updated = cart.map(item => {
      if (item.id === id) {
        const targetQty = item.quantity + multiplier;
        // Verify current stock capacity
        const stockRef = item.size === 'M' ? item.product.stockM : item.product.stockL;
        if (targetQty > stockRef) {
          alert(`抱歉！當前商品 ${item.product.name} 僅餘 ${stockRef} 杯庫存。`);
          return item;
        }
        return { ...item, quantity: Math.max(1, targetQty) };
      }
      return item;
    });
    setCart(updated);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Trigger Checkout Submission
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');

    if (cart.length === 0) {
      setOrderError('您的購物車中目前沒有加選任何飲料品項！');
      return;
    }
    if (!clientName.trim()) {
      setOrderError('請輸入訂購人稱呼/姓名，以便通知取餐');
      return;
    }
    if (!clientPhone.trim() || clientPhone.length < 8) {
      setOrderError('請輸入完整的聯絡電話 (至少8碼以上)');
      return;
    }

    // Prepare complete Order block
    const newOrder: Order = {
      id: 'tea_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString().slice(-4),
      items: cart,
      total: cartTotalAmount,
      quantity: cartItemCount,
      status: 'pending',
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      createdAt: new Date().toISOString()
    };

    // Attempt submittal via service validating real-time database locks
    const outcome = await dbService.submitOrder(newOrder);
    if (outcome) {
      setConfirmedOrder(newOrder);
      // Clear cart
      setCart([]);
      setClientName('');
      setClientPhone('');
    } else {
      setOrderError('下單失敗！部分飲品或加料當前現場庫存不足，已被其他顧客搶先點走。請修正後重新送出。');
    }
  };

  // Historical Order Lookup Query
  const handleLookupHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!historySearchPhone.trim()) {
      alert('請先輸入您的手機號碼進行查詢！');
      return;
    }
    const match = orders.filter(o => o.clientPhone === historySearchPhone.trim());
    setHistoryResults(match);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      
      {/* Front-end Hero header */}
      <div className="bg-teal-700 text-white shadow-xs relative overflow-hidden">
        
        {/* Decorative ambient bubble shapes */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-teal-600 rounded-full opacity-40 blur-xl" />
        <div className="absolute -bottom-8 left-1/3 w-32 h-32 bg-teal-800 rounded-full opacity-60 blur-xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-1">
              <span className="bg-teal-500 text-white font-extrabold text-[10px] uppercase.tracking-wider px-2 py-0.5 rounded-full">
                找好茶官方點餐
              </span>
              <span className="text-[10px] text-teal-200">2026 夏季新配方</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">手作特調茶飲點單系統</h1>
            <p className="text-xs text-teal-100 opacity-90 max-w-md">
              新鮮現泡茶湯搭配鮮搾檸檬、黃金波霸與養樂多多多，享用極致順口的消暑特調！支援即時庫存剩餘顯示。
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <button
              onClick={() => {
                setActiveView('menu');
                setHistoryResults(null);
                setHistorySearchPhone('');
              }}
              className={`px-4.5 py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all cursor-pointer ${
                activeView === 'menu'
                  ? 'bg-white text-teal-800 shadow-md scale-105'
                  : 'bg-teal-800/40 hover:bg-teal-800/60 text-white'
              }`}
            >
              飲品菜單點單
            </button>

            <button
              onClick={() => {
                setActiveView('history');
              }}
              className={`px-4.5 py-2.5 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeView === 'history'
                  ? 'bg-white text-teal-800 shadow-md scale-105'
                  : 'bg-teal-800/40 hover:bg-teal-800/60 text-white'
              }`}
            >
              <History size={16} />
              <span>過往點餐紀錄</span>
            </button>

            <button
              onClick={onOpenAdmin} // Actually Admin tab click
              className="px-4 py-2 text-xs bg-slate-900/60 hover:bg-slate-900/80 text-teal-300 font-bold rounded-lg transition-colors border border-teal-500/30 cursor-pointer"
            >
              進入控制後台 ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 font-sans">
        
        {/* VIEW 1: INTERACTIVE MENU WITH CUSTOMIZER & CART */}
        {activeView === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Products Grid section */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Categorization and Search controls */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
                
                {/* Search input bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    placeholder="輸入關鍵字尋找好茶飲品... (例如: 檸檬、綠、紅茶)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-sm font-medium"
                  />
                </div>

                {/* Categories Tab selectors */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4.5 py-2 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

              </div>

              {/* Drinks Showcase List */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-slate-150 p-6">
                  <Coffee size={48} className="text-slate-200 mx-auto mb-3" />
                  <p className="font-extrabold text-slate-600">抱歉，找不到符合的飲品 🥤</p>
                  <p className="text-xs text-slate-400 mt-1">請嘗試清除關鍵字，或切換其他特調系列試試！</p>
                  <button 
                    onClick={() => { setSearchQuery(''); setSelectedCategory('全部'); }}
                    className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    重置篩選
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredProducts.map(product => {
                    const isM_Out = product.stockM <= 0;
                    const isL_Out = product.stockL <= 0;
                    const isFullySoldOut = isM_Out && isL_Out;

                    return (
                      <div 
                        key={product.id}
                        className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 relative ${
                          isFullySoldOut ? 'border-dashed border-slate-200 opacity-601 grayscale select-none' : 'border-slate-100'
                        }`}
                      >
                        <div>
                          {/* Top row */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md">
                              {product.category}
                            </span>
                            
                            {/* Stock Warnings */}
                            {isFullySoldOut ? (
                              <span className="text-[10px] bg-rose-50 text-rose-600 font-extrabold px-2 py-0.5 rounded">
                                今日已售罄
                              </span>
                            ) : (
                              <div className="text-[10px] font-medium text-slate-400 font-mono space-x-1.5">
                                <span className={product.stockM <= 5 ? 'text-amber-600 font-bold' : ''}>M:{product.stockM}</span>
                                <span className={product.stockL <= 5 ? 'text-amber-600 font-bold' : ''}>L:{product.stockL}</span>
                              </div>
                            )}
                          </div>

                          <h3 className="text-lg font-extrabold text-slate-800 mt-2.5">{product.name}</h3>
                          
                          {/* Menu price tags */}
                          <div className="flex items-center space-x-4 mt-1">
                            <div className="text-xs text-slate-400 font-medium">
                              中杯 M: <span className="font-extrabold text-slate-700">${product.priceM}</span>
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                              大杯 L: <span className="font-extrabold text-slate-700">${product.priceL}</span>
                            </div>
                          </div>
                        </div>

                        {/* Order button controls */}
                        <div className="border-t border-slate-50 pt-3.5 mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">客製化：甜度/冰度/配料</span>
                          
                          <button
                            type="button"
                            disabled={isFullySoldOut}
                            onClick={() => setSelectedProduct(product)}
                            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 cursor-pointer select-none ${
                              isFullySoldOut
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs hover:shadow-sm'
                            }`}
                          >
                            <span>點選客製化</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Right Side Shopping Cart & Checkout Form section */}
            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-md space-y-6 sticky top-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="bg-rose-50 text-rose-600 p-1.5 rounded-lg">
                    <ShoppingBag size={18} />
                  </div>
                  <h2 className="text-base font-black text-slate-800">我的點餐車</h2>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                  {cartItemCount} 杯
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Coffee size={40} className="text-slate-200 mx-auto" />
                  <p className="font-bold text-xs select-none">購物車目前是空的喔～</p>
                  <p className="text-[10px] opacity-85 select-none">請在左側點選喜愛的飲品，並挑選加料進行客製化吧！</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[290px] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div 
                      key={item.id} 
                      className="text-xs p-3.5 border border-slate-100 hover:border-slate-200 bg-slate-50/50 rounded-xl relative space-y-1.5 animate-in fade-in duration-100"
                    >
                      {/* Name Price */}
                      <div className="flex justify-between font-bold text-slate-800 leading-tight">
                        <span className="text-sm font-extrabold">{item.product.name} ({item.size})</span>
                        <span className="font-mono text-slate-700">${item.price * item.quantity}</span>
                      </div>

                      {/* Customization descriptions */}
                      <div className="text-[10px] text-slate-500 font-medium space-x-1 block leading-relaxed">
                        <span>{item.sweetness}</span>
                        <span>•</span>
                        <span>{item.ice}</span>
                        {item.toppings.length > 0 && (
                          <div className="text-emerald-700 font-extrabold mt-0.5 bg-emerald-50 px-1 py-0.2 rounded-sm inline-block">
                            +配料: {item.toppings.map(t => t.name).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Interactive Controls */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100/50">
                        {/* Qty adjustments */}
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.id, -1)}
                            className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 text-[10px]"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.id, 1)}
                            className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 text-[10px]"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}

              {/* Total Summary */}
              {cart.length > 0 && (
                <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100 flex items-center justify-between text-xs text-rose-900 leading-none">
                  <span className="font-bold">總共點購杯數: {cartItemCount} 杯</span>
                  <div className="text-right">
                    <span className="text-[10px] block text-rose-700 mb-0.5">應付金額大計</span>
                    <span className="font-black text-lg text-rose-600">${cartTotalAmount} 元</span>
                  </div>
                </div>
              )}

              {/* Checkout Form */}
              <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-1.5">
                <div className="space-y-3">
                  
                  {/* Name field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center space-x-1">
                      <User size={12} />
                      <span>訂購人姓名 (稱呼)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="例：張先生"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  {/* Mobile phone field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center space-x-1">
                      <Phone size={12} />
                      <span>聯絡行動電話</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="例：0912345678"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono text-sm tracking-wide"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">＊請填寫正確號碼，之後可憑此搜尋歷史點餐紀錄！</span>
                  </div>

                </div>

                {orderError && (
                  <div className="p-3 text-xs bg-rose-50 text-rose-600 font-semibold rounded-lg border border-rose-100 select-none">
                    ⚠️ {orderError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={cart.length === 0}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md text-white ${
                    cart.length === 0
                      ? 'bg-slate-300 cursor-not-allowed opacity-50 shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[98%] cursor-pointer'
                  }`}
                >
                  確認送出 成立點單 (${cartTotalAmount} 元)
                </button>
              </form>

            </div>

          </div>
        )}

        {/* VIEW 2: HISTORICAL ORDER history lookup */}
        {activeView === 'history' && (
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Input query pane */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-md">
              <div className="flex items-center space-x-2.5 mb-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <History size={20} />
                </div>
                <h2 className="text-lg font-black text-slate-800">查詢過往點餐紀錄</h2>
              </div>
              <p className="text-xs text-slate-400">
                請輸入您當初留存在訂單中的電話號碼，即可一秒撈取您在此店家的所有消費與外帶接單狀況
              </p>

              <form onSubmit={handleLookupHistory} className="mt-5 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Phone size={14} />
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="請輸入訂購手機號碼 (例如: 0912345678)"
                    value={historySearchPhone}
                    onChange={(e) => setHistorySearchPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono tracking-wider text-sm font-semibold"
                  />
                </div>
                
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  開始撈取資料
                </button>
              </form>
            </div>

            {/* Matching Results */}
            {historyResults !== null && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-extrabold text-slate-700 text-sm">
                    🔍 為您搜尋到以下 {historyResults.length} 筆點單歷程：
                  </h3>
                  <button 
                    onClick={() => setHistoryResults(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center space-x-0.5 cursor-pointer"
                  >
                    <span>清除搜尋</span>
                  </button>
                </div>

                {historyResults.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-2xl border text-slate-400 text-xs">
                    <AlertCircle size={32} className="mx-auto mb-2 text-slate-300 animate-pulse" />
                    抱歉！找不到手機為「<span className="font-bold text-slate-800">{historySearchPhone}</span>」的任何歷史交易記錄。請檢查是否輸入正確。
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyResults.map((order) => {
                      const dt = new Date(order.createdAt);
                      return (
                        <div 
                          key={order.id} 
                          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow"
                        >
                          {/* Order top bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-50 gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm font-black text-indigo-950">
                                  點單單號: {order.id.slice(-6).toUpperCase()}
                                </span>
                                
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  order.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : order.status === 'preparing'
                                    ? 'bg-sky-100 text-sky-800'
                                    : order.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {order.status === 'pending' ? '現場待排隊接單' : order.status === 'preparing' ? '飲料精心製作調配中' : order.status === 'completed' ? '飲料已完成 (歡迎至店內取餐)' : '點單已作廢/取消'}
                                </span>
                              </div>

                              <div className="text-[10px] text-slate-400 mt-1">
                                下單時間: {dt.toLocaleDateString('zh-TW')} {dt.toLocaleTimeString('zh-TW', { hour12: false })}
                              </div>
                            </div>

                            <span className="text-lg font-black text-rose-500 font-mono">
                              NT$ {order.total} 元
                            </span>
                          </div>

                          {/* Order Items */}
                          <div className="space-y-2.5">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-slate-600 font-medium leading-relaxed">
                                <div>
                                  <span className="font-extrabold text-slate-800">{it.product.name} ({it.size})</span>
                                  <span className="text-[10px] text-slate-400 ml-2">({it.sweetness} / {it.ice})</span>
                                  {it.toppings.length > 0 && (
                                    <div className="text-emerald-700 text-[10px] font-bold mt-0.5">
                                      加配料: {it.toppings.map(t => t.name).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <span className="font-mono text-slate-500">×{it.quantity} 杯</span>
                              </div>
                            ))}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </div>

      {/* RENDER ACTIVE DRINK SELECTION OVERLAY MODAL */}
      {selectedProduct && (
        <DrinkCustomizerModal
          product={selectedProduct}
          existingToppings={toppings}
          onAddToCart={handleAddToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* RENDER SUCCESS CONFIRMED TICKET MODAL */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 text-center space-y-5 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-800">✅ 恭喜！您已成功成立點單</h3>
              <p className="text-slate-400 text-xs">茶湯現製通常需要 3 至 7 分鐘出餐，歡迎至店鋪內取茶</p>
            </div>

            {/* Receipt Box */}
            <div className="bg-slate-50/80 p-5 rounded-xl border text-left space-y-3 font-medium text-xs text-slate-600">
              <div className="flex justify-between text-sm leading-none pb-2 border-b">
                <span className="font-black text-slate-900">您的點茶單號：</span>
                <span className="font-mono text-lg font-black text-indigo-800 uppercase">
                  {confirmedOrder.id.slice(-6).toUpperCase()}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 max-h-[140px] overflow-y-auto">
                {confirmedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{it.product.name} ({it.size}) × {it.quantity}</span>
                    <span className="font-mono text-slate-800">${it.price * it.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                <span className="font-bold text-slate-800">實收小結：</span>
                <span className="font-black text-rose-600 font-mono text-base">${confirmedOrder.total} 元</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmedOrder(null)}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer text-sm"
              >
                好的，我知道了
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setConfirmedOrder(null);
                  setActiveView('history');
                  setHistorySearchPhone(confirmedOrder.clientPhone);
                  // Trigger matching fetch automatically
                  const matches = orders.filter(o => o.clientPhone === confirmedOrder.clientPhone);
                  setHistoryResults(matches);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors cursor-pointer text-xs"
              >
                追蹤杯子製作動態 🥤
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
