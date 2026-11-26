import React, { useState } from 'react';
import { X, Send, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewTransactionModal: React.FC<NewTransactionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  if (!isOpen) return null;

  const [amount, setAmount] = useState<string>('8450.00');
  const [customerName, setCustomerName] = useState<string>('Elena Rostova');
  const [customerId, setCustomerId] = useState<string>('CUST-9102');
  const [transactionType, setTransactionType] = useState<string>('WIRE_TRANSFER');
  const [merchant, setMerchant] = useState<string>('Binance P2P Escrow');
  const [location, setLocation] = useState<string>('Unknown Proxy (Tor Exit Node)');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createTransaction({
        customer_id: customerId,
        customer_name: customerName,
        amount: parseFloat(amount),
        currency: 'USD',
        transaction_type: transactionType,
        merchant: merchant,
        location: location,
        device_type: 'Direct API Injector',
        ip_address: '185.220.101.5'
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to submit transaction:', err);
      alert('Failed to submit transaction: ' + (err as any).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillSuspicious = () => {
    setAmount('34500.00');
    setCustomerName('David Chen');
    setCustomerId('CUST-7723');
    setTransactionType('CRYPTO_EXCHANGE');
    setMerchant('Offshore Crypto Gateway');
    setLocation('Unknown Proxy (Tor Exit Node)');
  };

  const handleFillNormal = () => {
    setAmount('42.50');
    setCustomerName('Aria Takahashi');
    setCustomerId('CUST-1098');
    setTransactionType('ONLINE_PURCHASE');
    setMerchant('Amazon Cloud Services');
    setLocation('Tokyo, Japan');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0E1524] border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F19]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Inject Test Transaction</h3>
              <p className="text-xs text-slate-400">Trigger live risk scoring & WebSocket broadcast</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase text-slate-400">Quick Test Scenarios:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleFillSuspicious}
              className="text-[11px] px-2 py-1 rounded bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:bg-rose-900/50 transition-colors font-mono"
            >
              High Risk / Fraud
            </button>
            <button
              type="button"
              onClick={handleFillNormal}
              className="text-[11px] px-2 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/50 transition-colors font-mono"
            >
              Legitimate
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Amount ($ USD)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Transaction Channel</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="ONLINE_PURCHASE">ONLINE_PURCHASE</option>
                <option value="WIRE_TRANSFER">WIRE_TRANSFER</option>
                <option value="CRYPTO_EXCHANGE">CRYPTO_EXCHANGE</option>
                <option value="P2P_TRANSFER">P2P_TRANSFER</option>
                <option value="ATM_WITHDRAWAL">ATM_WITHDRAWAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Customer ID</label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Merchant / Destination</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Location / IP Geo</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-950/40 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Transmitting...' : 'Send Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
