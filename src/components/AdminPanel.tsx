import React, { useState, useEffect } from 'react';
import { Product, Topping, Order, AdminSettings } from '../types';
import { dbService, DEFAULT_PRODUCTS, DEFAULT_TOPPINGS } from '../db';
import { 
  Lock, 
  Unlock, 
  Settings, 
  Package, 
  ClipboardList, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Download,
  LogOut,
  ChevronRight,
  TrendingDown,
  Info
} from 'lucide-react';

interface AdminPanelProps {
  onBack: () => void;
  products: Product[];
  toppings: Topping[];
  orders: Order[];
}

export default function AdminPanel({ onBack, products, toppings, orders }: AdminPanelProps) {
  // Authentication states
  const [hasPasswordSet, setHasPasswordSet] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [setupError, setSetupError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active workspace tabs
  // 'orders' | 'inventory' | 'toppings' | 'reports'
  const [activeTab, setActiveTab] = useState<'orders' | 'inventory' | 'toppings' | 'reports'>('orders');

  // Local inventory input buffer to prevent fast re-refreshes while typing
  const [prodStocks, setProdStocks] = useState<{ [id: string]: { m: string; l: string } }>({});
  const [toppingStocks, setToppingStocks] = useState<{ [id: string]: string }>({});

  // Filter for orders table
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'preparing' | 'completed' | 'cancelled'>('all');

  // Report dates selectors
  const [selectedReportDate, setSelectedReportDate] = useState('');

  // Initialize checks
  useEffect(() => {
    setHasPasswordSet(dbService.hasAdminPasswordSet());
    // Also listen to settings change if any
    const unsub = dbService.subscribeSettings((settings) => {
      setHasPasswordSet(settings !== null);
    });
    return () => unsub();
  }, []);

  // Sync products state to local buffer when tab is selected or products adjust
  useEffect(() => {
    const fresh: { [id: string]: { m: string; l: string } } = {};
    products.forEach(p => {
      fresh[p.id] = { m: String(p.stockM), l: String(p.stockL) };
    });
    setProdStocks(fresh);
  }, [products, activeTab]);

  // Sync toppings state to local buffer
  useEffect(() => {
    const freshToppings: { [id: string]: string } = {};
    toppings.forEach(t => {
      freshToppings[t.id] = String(t.stock);
    });
    setToppingStocks(freshToppings);
  }, [toppings, activeTab]);

  // Handle setting new administrator password
  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    if (!newPassword) {
      setSetupError('請輸入管理者密碼！');
      return;
    }
    if (newPassword.length < 4) {
      setSetupError('為了安全，密碼長度至少需 4 位數以上。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetupError('兩次輸入的密碼不一致！請重新確認。');
      return;
    }

    try {
      await dbService.setAdminPassword(newPassword);
      setSuccessMessage('管理者密碼設定成功！請再次登入。');
      setHasPasswordSet(true);
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setSetupError('設定密碼時發生錯誤，請重試。');
    }
  };

  // Handle subsequent logins with password verify
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!passwordInput) {
      setAuthError('請填寫管理者密碼');
      return;
    }

    const isValid = await dbService.verifyAdminPassword(passwordInput);
    if (isValid) {
      setIsAuthenticated(true);
      setPasswordInput('');
    } else {
      setAuthError('密碼錯誤！請再次確認您的密碼');
    }
  };

  // Handle stock modification saves
  const handleSaveProductStock = async (productId: string) => {
    const val = prodStocks[productId];
    if (!val) return;
    const m = Math.max(0, parseInt(val.m) || 0);
    const l = Math.max(0, parseInt(val.l) || 0);
    await dbService.updateProductStock(productId, m, l);
    
    // Briefly alert success
    const alertSpan = document.getElementById(`save-alert-${productId}`);
    if (alertSpan) {
      alertSpan.classList.remove('hidden');
      setTimeout(() => alertSpan.classList.add('hidden'), 1500);
    }
  };

  const handleSaveToppingStock = async (toppingId: string) => {
    const val = toppingStocks[toppingId];
    if (val === undefined) return;
    const stock = Math.max(0, parseInt(val) || 0);
    await dbService.updateToppingStock(toppingId, stock);

    // Briefly alert success
    const alertSpan = document.getElementById(`topping-save-alert-${toppingId}`);
    if (alertSpan) {
      alertSpan.classList.remove('hidden');
      setTimeout(() => alertSpan.classList.add('hidden'), 1500);
    }
  };

  // Quick helper to replenish all stocks to 100 on a single click
  const handleReplenishAll = async () => {
    if (window.confirm('確定要一鍵將所有飲品的 M、L 尺寸庫存充能至滿水位 (100) 嗎？')) {
      for (const p of products) {
        await dbService.updateProductStock(p.id, 100, 100);
      }
      for (const t of toppings) {
        await dbService.updateToppingStock(t.id, 100);
      }
      alert('所有飲品與配料庫存補充完成！');
    }
  };

  // Build the list of available dates for report download
  const getAvailableDates = () => {
    const datesSet = new Set<string>();
    orders.forEach(o => {
      if (o.status === 'completed') {
        datesSet.add(o.createdAt.split('T')[0]);
      }
    });
    return Array.from(datesSet).sort().reverse();
  };

  // Export finished completed orders list to standard UTF-8 BOM CSV that Excel loads flawlessly
  const handleExportCSVReport = (dateString?: string) => {
    const targetOrders = orders.filter(o => {
      if (o.status !== 'completed') return false;
      if (!dateString) return true; // all dates combined
      return o.createdAt.startsWith(dateString);
    });

    if (targetOrders.length === 0) {
      alert('當前所選區間尚無已完成的熱銷訂單，無法生成報表。');
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM to prevent Chinese gibberish in Excel on both Mac & Win!
    csvContent += "茶飲點單系統,官方營業報表,Excel專用格式\r\n";
    csvContent += `導出日期,${new Date().toLocaleDateString('zh-TW')} ${new Date().toLocaleTimeString()}\r\n`;
    csvContent += `指定報表日期,${dateString ? dateString : '全期歷史累計'}\r\n`;
    csvContent += `總完成單量,${targetOrders.length} 件點單\r\n`;
    
    const revenue = targetOrders.reduce((sum, o) => sum + o.total, 0);
    const totalQty = targetOrders.reduce((sum, o) => sum + o.quantity, 0);
    csvContent += `累計實收金額,NT$ ${revenue} 元\r\n`;
    csvContent += `累計售出杯數,${totalQty} 杯飲品\r\n\r\n`;

    // Detailed Orders Table Header
    csvContent += "訂單編號,點餐日期,點餐時間,顧客姓名,聯絡電話,飲品品項,大/中杯,甜度,冰度,加選料,數量,單杯總價,訂單小計\r\n";

    targetOrders.forEach(o => {
      const orderDate = o.createdAt.split('T')[0];
      const orderTime = new Date(o.createdAt).toLocaleTimeString('zh-TW', { hour12: false });
      const client = o.clientName ? o.clientName.replace(/"/g, '""') : '外帶顧客';
      const phone = o.clientPhone || '無記錄';

      o.items.forEach((item, index) => {
        const prodName = item.product.name;
        const sizeTag = item.size === 'M' ? '中杯(M)' : '大杯(L)';
        const sweetnessTag = item.sweetness;
        const iceTag = item.ice;
        const toppingsText = item.toppings.map(t => t.name).join('; ');
        
        // Only write order details and total on the first item row of that order to look like a styled combined Excel sheet
        const rowId = `"${o.id}"`;
        const rowSubtotal = index === 0 ? o.total : '';

        csvContent += `${rowId},"${orderDate}","${orderTime}","${client}","${phone}","${prodName}","${sizeTag}","${sweetnessTag}","${iceTag}","${toppingsText || '無'}",${item.quantity},${item.price},${item.price * item.quantity}\r\n`;
      });
    });

    const fileLabel = dateString ? `每日明細報表_${dateString}` : '歷史總營收報表';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `茶飲點單營收系統_${fileLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick stats computed references
  const completedOrdersList = orders.filter(o => o.status === 'completed');
  const totalLifetimeRevenue = completedOrdersList.reduce((sum, o) => sum + o.total, 0);
  const totalLifetimeDrinks = completedOrdersList.reduce((sum, o) => sum + o.quantity, 0);
  const activePendingOrdersCount = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'all') return true;
    return o.status === orderFilter;
  });

  // --- RENDERING VIEWS ---

  // A. PASSWORD INITIALIZATION VIEW (First entry)
  if (!hasPasswordSet) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-100 text-center">
          <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <Settings size={32} className="animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">首次進入：設定管理者密碼</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6">
            歡迎使用茶飲點單系統！為了保障您的店面營收資料與庫存，第一次進入後台必須先設定一組您自己的管理者專屬密碼。之後進入需要憑此密碼驗證。
          </p>

          <form onSubmit={handleSetupPassword} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">店面管理者密碼</label>
              <input
                type="password"
                required
                placeholder="請輸入密碼..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono text-center tracking-widest text-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">再次確認密碼</label>
              <input
                type="password"
                required
                placeholder="再次填寫相同密碼..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono text-center tracking-widest text-lg"
              />
            </div>

            {setupError && (
              <div className="p-3 text-xs text-rose-600 font-semibold bg-rose-50 rounded-lg">
                ⚠️ {setupError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm"
            >
              確認送出，完成設定
            </button>
          </form>

          <button
            onClick={onBack}
            className="mt-5 text-sm text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
          >
            返回前台顧客點餐頁
          </button>
        </div>
      </div>
    );
  }

  // B. PASSWORD VERIFICATION LOGIN VIEW
  if (!isAuthenticated) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4 bg-slate-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
          <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">管理者密碼驗證</h2>
          <p className="text-slate-500 text-sm mt-1.5 mb-6">
            進入茶飲營運統計與庫存修改，請輸入管理者密碼。
          </p>

          {successMessage && (
            <div className="mb-4 p-3.5 text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-xl border border-emerald-100">
              🎉 {successMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase">請輸入密碼</label>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">2026 Secured</span>
              </div>
              <input
                type="password"
                required
                autoFocus
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono text-center tracking-widest text-xl"
              />
            </div>

            {authError && (
              <div className="p-3 text-xs text-rose-600 font-bold bg-rose-50 rounded-lg text-center animate-shake border border-rose-100">
                ❌ {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer text-sm tracking-wide"
            >
              進入管理後台
            </button>
          </form>

          <button
            onClick={onBack}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
          >
            返回前台顧客點餐頁
          </button>
        </div>
      </div>
    );
  }

  // C. THE COMPREHENSIVE RECONSTRUCTED WORKSPACE VIEW
  return (
    <div className="bg-slate-50 min-h-screen pb-16">
      
      {/* Workspace Header Dashboard */}
      <div className="bg-slate-950 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-teal-600 rounded-xl">
              <Unlock size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  Admin Verified
                </span>
                <span className="text-xs text-slate-400 font-mono">UTC: 2026-05-30</span>
              </div>
              <h1 className="text-xl font-black tracking-tight mt-0.5">茶飲點單後台控制系統</h1>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-center">
            <button
              onClick={handleReplenishAll}
              className="px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="快速一鍵回復所有滿水位庫存為 100 方便演示"
            >
              <RefreshCw size={14} />
              <span>一鍵充能庫存 (100)</span>
            </button>

            <button
              onClick={() => setIsAuthenticated(false)}
              className="px-3.5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <LogOut size={14} />
              <span>鎖定後台</span>
            </button>

            <button
              onClick={onBack}
              className="px-4 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors cursor-pointer"
            >
              返回顧客點餐前台
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview bento cards row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">累計已點營業額</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">NT$ {totalLifetimeRevenue}</span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">累計售出杯數</span>
              <span className="text-2xl font-black text-teal-600 mt-1 block">{totalLifetimeDrinks} 杯</span>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <Package size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">製作中 backlog</span>
              <span className="text-2xl font-black text-cyan-600 mt-1 block">{activePendingOrdersCount} 單</span>
            </div>
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
              <ClipboardList size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">總完成訂單數</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{completedOrdersList.length} 單</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
          </div>

        </div>
      </div>

      {/* Main workspace section with Left Sidebar menu & Right panel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left selector menu */}
        <div className="lg:col-span-3 space-y-2">
          
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full p-4 rounded-xl font-bold flex items-center justify-between transition-all text-left cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <ClipboardList size={18} />
              <span>訂單處理與管理</span>
            </div>
            {activePendingOrdersCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'orders' ? 'bg-white text-teal-700' : 'bg-rose-500 text-white'
              }`}>
                {activePendingOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`w-full p-4 rounded-xl font-bold flex items-center justify-between transition-all text-left cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Package size={18} />
              <span>飲品即時庫存修改</span>
            </div>
            <ChevronRight size={16} className={activeTab === 'inventory' ? 'opacity-100' : 'opacity-40'} />
          </button>

          <button
            onClick={() => setActiveTab('toppings')}
            className={`w-full p-4 rounded-xl font-bold flex items-center justify-between transition-all text-left cursor-pointer ${
              activeTab === 'toppings'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Settings size={18} />
              <span>配料庫存修改</span>
            </div>
            <ChevronRight size={16} className={activeTab === 'toppings' ? 'opacity-100' : 'opacity-40'} />
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full p-4 rounded-xl font-bold flex items-center justify-between transition-all text-left cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-teal-600 text-white shadow-md'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <TrendingUp size={18} />
              <span>營收統計與報表導出</span>
            </div>
            <ChevronRight size={16} className={activeTab === 'reports' ? 'opacity-100' : 'opacity-40'} />
          </button>

          {/* Secure Firebase indicator box */}
          <div className="bg-slate-900 text-slate-400 p-4 rounded-xl border border-slate-800 text-xs text-center space-y-1">
            <div className="font-bold flex items-center justify-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${dbService.hasAdminPasswordSet() ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
              <span>系統安全保護中</span>
            </div>
            <p className="opacity-70 mt-1">
              {dbService.hasAdminPasswordSet() ? '管理者安全密碼已生效' : '尚未設定完整密碼防護'}
            </p>
          </div>

        </div>

        {/* Right Dynamic view column */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-100 shadow-md p-6 min-h-[500px]">
          
          {/* TAB 1: ORDERS CONTROL */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 flex items-center space-x-1.5">
                    <span>點單佇列與處理系統</span>
                  </h2>
                  <p className="text-xs text-slate-400">在這裡審核最新顧客送來的客製化茶飲訂單，並更新製作流程</p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'pending', 'preparing', 'completed', 'cancelled'] as const).map(f => {
                    const count = orders.filter(o => f === 'all' ? true : o.status === f).length;
                    const labels: { [key: string]: string } = {
                      all: '全部',
                      pending: '待接單',
                      preparing: '製作中',
                      completed: '已完成',
                      cancelled: '已取消'
                    };
                    const colorStyles = f === 'pending' ? 'bg-amber-100 text-amber-700' : f === 'preparing' ? 'bg-sky-100 text-sky-700' : f === 'completed' ? 'bg-emerald-100 text-emerald-700' : f === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700';

                    return (
                      <button
                        key={f}
                        onClick={() => setOrderFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          orderFilter === f
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {labels[f]} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center">
                  <ClipboardList size={48} className="text-slate-200 mb-3" />
                  <p className="font-extrabold text-base">無此狀態的飲品點單</p>
                  <p className="text-xs mt-1">目前前台沒有成立此類型的顧客訂單喔！</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map(order => {
                    const orderTime = new Date(order.createdAt);
                    return (
                      <div 
                        key={order.id} 
                        className={`rounded-xl border p-5 space-y-4 transition-all relative ${
                          order.status === 'pending'
                            ? 'border-amber-200 bg-amber-50/10'
                            : order.status === 'preparing'
                            ? 'border-sky-200 bg-sky-50/10'
                            : order.status === 'completed'
                            ? 'border-slate-100 bg-slate-50/20'
                            : 'border-rose-100 bg-rose-50/5 opacity-70'
                        }`}
                      >
                        {/* Order info banner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-dashed border-slate-100 gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-sm font-black text-indigo-900">
                                點單編號: {order.id.slice(-6).toUpperCase()}
                              </span>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                order.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : order.status === 'preparing'
                                  ? 'bg-sky-100 text-sky-800'
                                  : order.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {order.status === 'pending' ? '待接單(Pending)' : order.status === 'preparing' ? '製作中(Preparing)' : order.status === 'completed' ? '已完成(Completed)' : '已取消(Cancelled)'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              下單時間: {orderTime.toLocaleDateString('zh-TW')} {orderTime.toLocaleTimeString('zh-TW', { hour12: false })}
                            </div>
                          </div>

                          <div className="p-2 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                            客姓名：<span className="font-black text-slate-900">{order.clientName || '現場/外帶'}</span> 
                            {order.clientPhone && <span> | 電：<a href={`tel:${order.clientPhone}`} className="underline text-indigo-600 font-mono">{order.clientPhone}</a></span>}
                          </div>
                        </div>

                        {/* Order Items list */}
                        <div className="space-y-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-sm">
                              <div>
                                <div className="font-bold text-slate-800">
                                  {item.product.name} ({item.size === 'M' ? '中杯M' : '大杯L'})
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 space-x-1.5 flex flex-wrap">
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{item.sweetness}</span>
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{item.ice}</span>
                                  {item.toppings.length > 0 && (
                                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                                      加配料: {item.toppings.map(t => t.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right font-mono text-xs text-slate-600">
                                <div>{item.price} 元 × {item.quantity}</div>
                                <div className="font-bold text-slate-800 text-sm mt-0.5">NT$ {item.price * item.quantity} 元</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Order Bottom Price & Action controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                          <div>
                            <span className="text-xs text-slate-500">
                              共 {order.quantity} 杯飲料，合計收費：
                            </span>
                            <span className="text-xl font-black text-rose-600 ml-1">
                              NT$ {order.total} 元
                            </span>
                          </div>

                          {/* Quick Interactive Actions */}
                          <div className="flex space-x-2">
                            {order.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => dbService.updateOrderStatus(order.id, 'preparing')}
                                  className="px-3.5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                  接單 & 開始製作
                                </button>
                                <button
                                  onClick={() => dbService.updateOrderStatus(order.id, 'cancelled')}
                                  className="px-3.5 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                >
                                  拒接該單
                                </button>
                              </>
                            )}

                            {order.status === 'preparing' && (
                              <>
                                <button
                                  onClick={() => dbService.updateOrderStatus(order.id, 'completed')}
                                  className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                  製作完成 (出餐)
                                </button>
                                <button
                                  onClick={() => dbService.updateOrderStatus(order.id, 'cancelled')}
                                  className="px-3.5 py-2 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                >
                                  取消訂單
                                </button>
                              </>
                            )}

                            {order.status === 'completed' && (
                              <div className="text-emerald-600 flex items-center space-x-1 font-bold text-xs">
                                <CheckCircle2 size={16} />
                                <span>已成功收訖/出餐</span>
                              </div>
                            )}

                            {order.status === 'cancelled' && (
                              <div className="text-rose-600 flex items-center space-x-1 font-bold text-xs">
                                <XCircle size={16} />
                                <span>本點單已作廢</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DRINKS STOCK CONTROL */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800">飲品即時庫存修改</h2>
                  <p className="text-xs text-slate-400">
                    直接手動調整 12 種經典飲品 M（中杯） 與 L（大杯） 的庫存份數，點擊儲存後前台即時同步
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {products.map(p => {
                  const currentInput = prodStocks[p.id] || { m: String(p.stockM), l: String(p.stockL) };
                  const isLowM = p.stockM <= 10;
                  const isLowL = p.stockL <= 10;

                  return (
                    <div 
                      key={p.id} 
                      className="p-4 border border-slate-100 hover:border-slate-200 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      {/* Name & Categories */}
                      <div className="sm:w-1/3">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-600 uppercase tracking-wide">
                          {p.category}
                        </span>
                        <h4 className="font-extrabold text-slate-800 mt-1">{p.name}</h4>
                        <div className="text-xs text-slate-400 mt-0.5">
                          中杯價格: M - ${p.priceM} | 大杯價格: L - ${p.priceL}
                        </div>
                      </div>

                      {/* Manual Editable Stock Fields */}
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        
                        {/* Stock M */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-500">M 庫存 (杯)</span>
                            {isLowM && (
                              <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
                                p.stockM === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {p.stockM === 0 ? '已售罄' : '低水位'}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={currentInput.m}
                            onChange={(e) => {
                              setProdStocks({
                                ...prodStocks,
                                [p.id]: { ...currentInput, m: e.target.value }
                              });
                            }}
                            className={`w-full px-3 py-1.5 rounded-lg border text-sm text-center font-bold ${
                              isLowM ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                            }`}
                          />
                        </div>

                        {/* Stock L */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-500">L 庫存 (杯)</span>
                            {isLowL && (
                              <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
                                p.stockL === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {p.stockL === 0 ? '已售罄' : '低水位'}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={currentInput.l}
                            onChange={(e) => {
                              setProdStocks({
                                ...prodStocks,
                                [p.id]: { ...currentInput, l: e.target.value }
                              });
                            }}
                            className={`w-full px-3 py-1.5 rounded-lg border text-sm text-center font-bold ${
                              isLowL ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                            }`}
                          />
                        </div>

                      </div>

                      {/* Manual individual save */}
                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        <span 
                          id={`save-alert-${p.id}`} 
                          className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded hidden animate-bounce"
                        >
                          已更新!
                        </span>
                        <button
                          onClick={() => handleSaveProductStock(p.id)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          儲存
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TOPPINGS STOCK CONTROL */}
          {activeTab === 'toppings' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800">配料加購庫存修改</h2>
                  <p className="text-xs text-slate-400">手動設定波霸、椰果、蘆薈與布丁等自選配料的現場儲備庫存</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {toppings.map(t => {
                  const value = toppingStocks[t.id] ?? String(t.stock);
                  const isLow = t.stock <= 5;

                  return (
                    <div 
                      key={t.id} 
                      className="p-5 border border-slate-150 rounded-xl bg-white flex items-center justify-between shadow-xs hover:shadow-md transition-shadow"
                    >
                      <div>
                        <h4 className="font-extrabold text-slate-800">{t.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          加購單價: +${t.price} 元 | 剩餘份數: <span className="font-extrabold">{t.stock}</span>
                        </p>
                        {isLow && (
                          <span className="inline-block mt-2 text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded">
                            {t.stock === 0 ? '已完全售完' : '配料水位極低'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="w-24">
                          <input
                            type="number"
                            min="0"
                            value={value}
                            onChange={(e) => {
                              setToppingStocks({
                                ...toppingStocks,
                                [t.id]: e.target.value
                              });
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-center font-bold text-sm"
                          />
                        </div>
                        
                        <div className="flex flex-col items-end">
                          <span 
                            id={`topping-save-alert-${t.id}`} 
                            className="text-[10px] text-emerald-600 font-bold block hidden animate-pulse"
                          >
                            已存
                          </span>
                          <button
                            onClick={() => handleSaveToppingStock(t.id)}
                            className="p-2 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            存
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: REVENUE & EXCEL REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-black text-slate-800">店鋪營收日報表 & Excel 導出</h2>
                <p className="text-xs text-slate-400">支援下載符合 Excel 架構點單明細的 CSV 報表檔</p>
              </div>

              {/* Performance highlights cards */}
              <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <div className="text-xs text-slate-400 font-bold tracking-widest uppercase">店面累計實收營業額</div>
                  <div className="text-3xl font-black text-rose-500 mt-2">NT$ {totalLifetimeRevenue} 元</div>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    包含歷史已完成點單共 {completedOrdersList.length} 筆，累計售出 {totalLifetimeDrinks} 杯飲品
                  </div>
                </div>

                <div className="text-right flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <button
                    onClick={() => handleExportCSVReport()}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl space-x-1.5 flex items-center justify-center transition-all cursor-pointer shadow-md text-sm active:scale-95"
                  >
                    <Download size={16} />
                    <span>下載 完整歷史累計報表</span>
                  </button>
                </div>
              </div>

              {/* Daily breakdown selectors */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-700 text-sm">🗓️ 選擇特定日期導出報表（每日營收明細）</h3>
                
                {getAvailableDates().length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border text-slate-400 text-xs">
                    <Info size={24} className="mx-auto mb-2 text-slate-300" />
                    目前尚無任何「已完成」狀態的點單，待顧客訂單完成出餐後，將在此自動列出銷售日期。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {getAvailableDates().map(dt => {
                      // Calc day summary
                      const dayOrders = orders.filter(o => o.status === 'completed' && o.createdAt.startsWith(dt));
                      const dayRevenue = dayOrders.reduce((sum, o) => sum + o.total, 0);
                      const dayDrinks = dayOrders.reduce((sum, o) => sum + o.quantity, 0);

                      return (
                        <div 
                          key={dt} 
                          className="p-4 border border-slate-150 rounded-xl bg-white shadow-xs hover:border-teal-500 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{dt}</div>
                            <div className="mt-2 space-y-1 text-xs text-slate-500 font-medium">
                              <div>單日單量: <span className="font-extrabold text-slate-800">{dayOrders.length} 單</span></div>
                              <div>售出杯數: <span className="font-extrabold text-slate-800">{dayDrinks} 杯</span></div>
                              <div>單日營業額: <span className="font-bold text-rose-600">NT$ {dayRevenue}</span></div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleExportCSVReport(dt)}
                            className="mt-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-black rounded-lg space-x-1 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Download size={14} />
                            <span>導出 Excel 報表</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CSV encoding tip */}
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 flex items-start space-x-2.5 text-xs text-amber-800 leading-relaxed">
                <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-extrabold">Excel 中相容性提示：</div>
                  <p className="mt-0.5 text-amber-700 font-medium">
                    本系統導出的 CSV 報表內嵌了標準 <strong>UTF-8 BOM (BOM 標頭)</strong>，在 Microsoft Excel，Numbers 或 Google Sheets 中直接點兩下開啟均可完美呈現繁體中文姓名、飲品選項。
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
