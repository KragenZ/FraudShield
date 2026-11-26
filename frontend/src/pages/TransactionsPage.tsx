import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { Transaction, TransactionListResponse } from '../types';
import { api } from '../services/api';
import { RiskBadge } from '../components/common/RiskBadge';
import { StatusBadge } from '../components/common/StatusBadge';

interface TransactionsPageProps {
  onSelectTransaction: (tx: Transaction) => void;
  refreshTrigger: number;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  onSelectTransaction,
  refreshTrigger
}) => {
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [submittedSearch, setSubmittedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [pageSize] = useState<number>(12);

  useEffect(() => {
    let cancelled = false;

    const loadTransactions = async () => {
      try {
        const res = await api.getTransactions({
          page,
          page_size: pageSize,
          search: submittedSearch.trim() || undefined,
          status: statusFilter,
          transaction_type: typeFilter
        });
        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, submittedSearch, statusFilter, typeFilter, refreshTrigger]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(1);
    setSubmittedSearch(search);
  };

  const handleResetFilters = () => {
    setIsLoading(true);
    setSearch('');
    setSubmittedSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="p-4 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md flex flex-wrap items-center justify-between gap-3">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, customer name, merchant, location..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
          />
        </form>

        {/* Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-slate-400 uppercase font-mono">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All</option>
              <option value="APPROVED" className="bg-slate-900">Approved</option>
              <option value="FLAGGED" className="bg-slate-900">Flagged</option>
              <option value="BLOCKED" className="bg-slate-900">Blocked</option>
              <option value="UNDER_REVIEW" className="bg-slate-900">Under Review</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-slate-400 uppercase font-mono">Channel:</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setIsLoading(true);
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none font-medium cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Types</option>
              <option value="ONLINE_PURCHASE" className="bg-slate-900">Online Purchase</option>
              <option value="WIRE_TRANSFER" className="bg-slate-900">Wire Transfer</option>
              <option value="CRYPTO_EXCHANGE" className="bg-slate-900">Crypto Exchange</option>
              <option value="P2P_TRANSFER" className="bg-slate-900">P2P Transfer</option>
              <option value="ATM_WITHDRAWAL" className="bg-slate-900">ATM Withdrawal</option>
              <option value="MERCHANT_PAYMENT" className="bg-slate-900">Merchant Payment</option>
            </select>
          </div>

          {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors flex items-center gap-1"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Transactions Data Table */}
      <div className="rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-[#0B0F19]/80 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Channel / Type</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Fraud Prob</th>
                <th className="py-3 px-4 text-center">Risk Score</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Loading transactions...
                    </div>
                  </td>
                </tr>
              ) : !data || data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No transactions match the specified search or filter criteria.
                  </td>
                </tr>
              ) : (
                data.transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onSelectTransaction(tx)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-blue-400 group-hover:underline">
                      {tx.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{tx.customer_name || 'Anonymous'}</div>
                      <div className="text-[11px] font-mono text-slate-400">{tx.customer_id}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-white">
                      ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      <span className="text-[10px] text-slate-400 ml-1 font-sans">{tx.currency}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono">
                        {tx.transaction_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(tx.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">
                      {(tx.fraud_probability * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-center">
                      <RiskBadge score={tx.risk_score} size="sm" showLabel={false} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.total_pages > 0 && (
          <div className="px-4 py-3 bg-[#0B0F19]/80 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing <span className="text-white font-mono">{data.total === 0 ? 0 : (page - 1) * pageSize + 1}</span> to{' '}
              <span className="text-white font-mono">
                {Math.min(page * pageSize, data.total)}
              </span>{' '}
              of <span className="text-white font-mono">{data.total}</span> records
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-mono text-slate-300 px-2">
                Page {page} of {data.total_pages}
              </span>

              <button
                disabled={page >= data.total_pages}
                onClick={() => {
                  setIsLoading(true);
                  setPage((p) => p + 1);
                }}
                className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
