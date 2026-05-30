import React, { useState } from 'react';
import { Product, Topping, OrderItem } from '../types';
import { dbService } from '../db';
import { X, Check } from 'lucide-react';

interface DrinkCustomizerModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (item: OrderItem) => void;
  existingToppings: Topping[];
}

export default function DrinkCustomizerModal({
  product,
  onClose,
  onAddToCart,
  existingToppings
}: DrinkCustomizerModalProps) {
  const [size, setSize] = useState<'M' | 'L'>('M');
  const [sweetness, setSweetness] = useState('正常甜 (100%)');
  const [ice, setIce] = useState('正常冰');
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  const sweetnessOptions = [
    '正常甜 (100%)',
    '少糖 (70%)',
    '半糖 (50%)',
    '微糖 (30%)',
    '無糖 (0%)'
  ];

  const iceOptions = [
    '正常冰',
    '少冰',
    '微冰',
    '去冰',
    '溫熱'
  ];

  const toggleTopping = (topping: Topping) => {
    if (topping.stock <= 0) return;
    
    if (selectedToppings.some(t => t.id === topping.id)) {
      setSelectedToppings(selectedToppings.filter(t => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, topping]);
    }
  };

  // Live stock counts check
  const activeStock = size === 'M' ? product.stockM : product.stockL;
  const itemBasePrice = size === 'M' ? product.priceM : product.priceL;
  const toppingsPrice = selectedToppings.reduce((total, t) => total + t.price, 0);
  const singlePrice = itemBasePrice + toppingsPrice;
  const totalPrice = singlePrice * quantity;

  const handleApply = () => {
    // 1. Check drink stock
    if (activeStock < quantity) {
      setErrorMsg(`抱歉！當前商品 ${size} 號庫存不足（僅餘 ${activeStock} 杯）`);
      return;
    }

    // 2. Check topping stock
    for (const top of selectedToppings) {
      if (top.stock < quantity) {
        setErrorMsg(`抱歉！配料「${top.name}」剩餘庫存不足（僅餘 ${top.stock} 份）`);
        return;
      }
    }

    onAddToCart({
      id: `${product.id}-${size}-${sweetness}-${ice}-${selectedToppings.map(t => t.id).sort().join('_')}`,
      product,
      size,
      sweetness,
      ice,
      toppings: selectedToppings,
      price: singlePrice,
      quantity
    });
    onClose();
  };

  const incrementQty = () => {
    const nextQty = quantity + 1;
    // Check if nextQty is allowed by main drink stock and selected toppings stock
    if (activeStock < nextQty) {
      setErrorMsg(`已達商品尺寸 ${size} 的最大庫存量上限`);
      return;
    }
    for (const top of selectedToppings) {
      if (top.stock < nextQty) {
        setErrorMsg(`配料「${top.name}」僅餘 ${top.stock} 份，不可點購更多`);
        return;
      }
    }
    setErrorMsg('');
    setQuantity(nextQty);
  };

  const decrementQty = () => {
    setErrorMsg('');
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleSizeChange = (newSize: 'M' | 'L') => {
    setSize(newSize);
    setQuantity(1);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-teal-600 text-white">
          <div>
            <span className="text-xs uppercase tracking-wider bg-teal-500/50 px-2.5 py-1 rounded-full font-semibold">
              {product.category}
            </span>
            <h3 className="text-xl font-bold mt-1">{product.name}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-teal-700 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Size Choice */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">1. 選擇尺寸 (Size)</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSizeChange('M')}
                className={`py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                  size === 'M'
                    ? 'border-teal-600 bg-teal-50/50 text-teal-800'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className="font-bold text-lg">M (中杯)</div>
                <div className="text-sm font-medium mt-0.5">${product.priceM}</div>
                <div className={`text-xs mt-1 px-1.5 py-0.5 rounded ${
                  product.stockM <= 5 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-400'
                }`}>
                  庫存: {product.stockM} 杯
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSizeChange('L')}
                className={`py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center cursor-pointer ${
                  size === 'L'
                    ? 'border-teal-600 bg-teal-50/50 text-teal-800'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className="font-bold text-lg">L (大杯)</div>
                <div className="text-sm font-medium mt-0.5">${product.priceL}</div>
                <div className={`text-xs mt-1 px-1.5 py-0.5 rounded ${
                  product.stockL <= 5 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-400'
                }`}>
                  庫存: {product.stockL} 杯
                </div>
              </button>
            </div>
            {activeStock <= 0 && (
              <div className="mt-2 text-rose-500 font-semibold text-sm">⚠️ 抱歉，本尺寸目前缺貨中</div>
            )}
          </div>

          {/* Sweetness Choice */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">2. 選擇甜度 (Sweetness)</label>
            <div className="flex flex-wrap gap-2">
              {sweetnessOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSweetness(opt)}
                  className={`px-3 py-2 rounded-lg text-sm border font-medium transition-all cursor-pointer ${
                    sweetness === opt
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Ice Options */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">3. 選擇冰度 (Ice Level)</label>
            <div className="flex flex-wrap gap-2">
              {iceOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIce(opt)}
                  className={`px-3 py-2 rounded-lg text-sm border font-medium transition-all cursor-pointer ${
                    ice === opt
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Toppings Choice */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">4. 加料複選 (Toppings Add-On)</label>
            <span className="text-xs text-slate-400 block mb-2.5">每份加料價格與目前最新配料庫存：</span>
            <div className="grid grid-cols-2 gap-2.5">
              {existingToppings.map((topping) => {
                const isSelected = selectedToppings.some(t => t.id === topping.id);
                const isSoldOut = topping.stock <= 0;
                return (
                  <button
                    key={topping.id}
                    type="button"
                    disabled={isSoldOut}
                    onClick={() => toggleTopping(topping)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all select-none ${
                      isSoldOut
                        ? 'opacity-40 bg-slate-50 border-slate-100 cursor-not-allowed'
                        : isSelected
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm block">{topping.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">+${topping.price}</div>
                    </div>
                    <div>
                      {isSoldOut ? (
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">缺貨</span>
                      ) : (
                        <div className="flex flex-col items-end">
                          {isSelected && (
                            <span className="text-emerald-600 block"><Check size={16} strokeWidth={3} /></span>
                          )}
                          <span className="text-[10px] text-slate-400 mt-1">餘 {topping.stock}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex flex-col space-y-3">
          
          {errorMsg && (
            <div className="text-rose-600 text-sm font-bold bg-rose-50 py-2 px-3.5 rounded-lg border border-rose-100 animate-pulse">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Quantity Controls */}
            <div className="flex items-center space-x-1">
              <span className="text-sm font-semibold text-slate-600 mr-2.5">數量:</span>
              <button
                type="button"
                onClick={decrementQty}
                disabled={quantity <= 1 || activeStock <= 0}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors select-none disabled:opacity-40 cursor-pointer text-lg"
              >
                -
              </button>
              <span className="w-8 text-center font-extrabold text-slate-800 text-base">{activeStock <= 0 ? 0 : quantity}</span>
              <button
                type="button"
                onClick={incrementQty}
                disabled={activeStock <= 0}
                className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold transition-colors select-none disabled:opacity-40 cursor-pointer text-lg"
              >
                +
              </button>
            </div>

            {/* Total summary */}
            <div className="text-right">
              <div className="text-xs text-slate-500">
                單杯共 ${singlePrice}
              </div>
              <div className="text-2xl font-black text-rose-600 mt-0.5">
                ${activeStock <= 0 ? 0 : totalPrice} 元
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={onClose}
              className="py-3 bg-white text-slate-600 border border-slate-300 font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-center text-sm"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={activeStock <= 0}
              className={`py-3 font-bold rounded-xl text-center text-sm text-white shadow-md transition-all select-none ${
                activeStock <= 0
                  ? 'bg-slate-400 cursor-not-allowed opacity-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95'
              }`}
            >
              加入購物車
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
