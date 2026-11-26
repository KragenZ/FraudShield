import React, { useState, useEffect } from 'react';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ModelPerformancePage } from './pages/ModelPerformancePage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionDetailModal } from './components/modals/TransactionDetailModal';
import { AlertReviewModal } from './components/modals/AlertReviewModal';
import { NewTransactionModal } from './components/modals/NewTransactionModal';
import { SettingsProvider } from './context/SettingsContext';
import { api } from './services/api';
import { liveSocket } from './services/websocket';
import {
  applyLiveTransactionToAnalytics,
  applyTransactionStatusTransitionToAnalytics
} from './utils/analyticsCounters';
import {
  AlertStatus,
  AnalyticsSummary,
  FraudAlert,
  Transaction,
  TransactionStatus
} from './types';

interface AlertUpdatedPayload extends Partial<FraudAlert> {
  id: string;
  previous_alert_status?: AlertStatus;
  transaction_status?: TransactionStatus;
  previous_transaction_status?: TransactionStatus;
}

const isUnresolvedAlertStatus = (status?: string): boolean =>
  status === 'NEW' || status === 'IN_REVIEW';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<FraudAlert[]>([]);
  const [unresolvedAlertCount, setUnresolvedAlertCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Modals state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const loadDashboardData = async () => {
      try {
        const [analyticsRes, txRes, alertRes] = await Promise.all([
          api.getAnalyticsSummary(),
          api.getTransactions({ page: 1, page_size: 10 }),
          api.getAlerts({ limit: 10 })
        ]);

        if (!cancelled) {
          setAnalytics(analyticsRes);
          setRecentTransactions(txRes.transactions);
          setRecentAlerts(alertRes.alerts);
          setUnresolvedAlertCount(alertRes.unresolved_count);
        }
      } catch (err) {
        console.error('Failed to load initial dashboard data:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  // Setup WebSocket connection and live event listeners
  useEffect(() => {
    liveSocket.connect();

    const connCheck = setInterval(() => {
      setWsConnected(liveSocket.isConnected);
    }, 1000);

    const unsubscribe = liveSocket.subscribe((event) => {
      if (event.event_type === 'NEW_TRANSACTION') {
        const newTx = event.data as Transaction;
        setRecentTransactions((prev) => [newTx, ...prev.slice(0, 19)]);
        setAnalytics((prev) => applyLiveTransactionToAnalytics(prev, newTx));
      } else if (event.event_type === 'NEW_ALERT') {
        const newAlert = event.data as FraudAlert;
        setRecentAlerts((prev) => [newAlert, ...prev.slice(0, 19)]);
        setUnresolvedAlertCount((prev) => prev + 1);
      } else if (event.event_type === 'ALERT_UPDATED') {
        const updated = event.data as AlertUpdatedPayload;
        setRecentAlerts((prev) =>
          prev.map((al) => {
            if (al.id !== updated.id) return al;
            return {
              ...al,
              ...updated,
              transaction:
                al.transaction && updated.transaction_status
                  ? { ...al.transaction, status: updated.transaction_status }
                  : al.transaction
            };
          })
        );

        if (updated.transaction_id && updated.transaction_status) {
          const nextTxStatus = updated.transaction_status;
          setRecentTransactions((prev) =>
            prev.map((tx) =>
              tx.id === updated.transaction_id ? { ...tx, status: nextTxStatus } : tx
            )
          );
          setSelectedTransaction((prev) =>
            prev && prev.id === updated.transaction_id
              ? { ...prev, status: nextTxStatus }
              : prev
          );
        }

        setAnalytics((prev) =>
          applyTransactionStatusTransitionToAnalytics(
            prev,
            updated.previous_transaction_status,
            updated.transaction_status
          )
        );

        if (updated.previous_alert_status && updated.status) {
          const wasUnresolved = isUnresolvedAlertStatus(updated.previous_alert_status);
          const isNowUnresolved = isUnresolvedAlertStatus(updated.status);
          if (wasUnresolved && !isNowUnresolved) {
            setUnresolvedAlertCount((prev) => Math.max(0, prev - 1));
          } else if (!wasUnresolved && isNowUnresolved) {
            setUnresolvedAlertCount((prev) => prev + 1);
          }
        } else if (updated.status && !isUnresolvedAlertStatus(updated.status)) {
          setUnresolvedAlertCount((prev) => Math.max(0, prev - 1));
        }

        setRefreshTrigger((prev) => prev + 1);
      }
    });

    return () => {
      clearInterval(connCheck);
      unsubscribe();
      liveSocket.disconnect();
    };
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSaveAlertResolution = async (
    alertId: string,
    data: { status: string; reviewed_by: string; resolution_notes: string }
  ) => {
    const updatedAlert = await api.updateAlertStatus(alertId, data);

    setRecentAlerts((prev) =>
      prev.map((al) => (al.id === updatedAlert.id ? { ...al, ...updatedAlert } : al))
    );

    if (updatedAlert.transaction) {
      const updatedTx = updatedAlert.transaction;
      setRecentTransactions((prev) =>
        prev.map((tx) => (tx.id === updatedTx.id ? { ...tx, ...updatedTx } : tx))
      );
      setSelectedTransaction((prev) =>
        prev && prev.id === updatedTx.id ? { ...prev, ...updatedTx } : prev
      );
    }

    setRefreshTrigger((prev) => prev + 1);
  };

  const pageHeaders: Record<NavigationTab, { title: string; subtitle: string }> = {
    overview: {
      title: 'Real-Time Fraud Telemetry',
      subtitle: 'Continuous transaction surveillance & risk intelligence'
    },
    transactions: {
      title: 'Transaction Audit Trail',
      subtitle: 'Deep-packet transaction history with search & risk classification'
    },
    alerts: {
      title: 'Fraud Alert & Incident Queue',
      subtitle: 'High-severity alerts flagged by the real-time heuristic & machine risk engine'
    },
    analytics: {
      title: 'Fintech Risk Analytics',
      subtitle: 'Temporal fraud trends, volume exposure, and channel attack surfaces'
    },
    model: {
      title: 'Model Performance & Validation Suite',
      subtitle: 'Target evaluation metrics, PR-AUC benchmarks & confusion matrix'
    },
    settings: {
      title: 'Platform Settings & Rules Configuration',
      subtitle: 'Scoring thresholds, notification routing, and database engine'
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070A13] text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        unresolvedAlertCount={unresolvedAlertCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          title={pageHeaders[currentTab].title}
          subtitle={pageHeaders[currentTab].subtitle}
          wsConnected={wsConnected}
          onSimulateClick={() => setIsInjectModalOpen(true)}
          onRefreshClick={handleRefresh}
          isRefreshing={isLoading}
        />

        <main className="flex-1 overflow-y-auto p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'overview' && (
            <OverviewPage
              analytics={analytics}
              recentTransactions={recentTransactions}
              recentAlerts={recentAlerts}
              isLoading={isLoading}
              onSelectTransaction={setSelectedTransaction}
              onSelectAlert={setSelectedAlert}
              onNavigateToTransactions={() => setCurrentTab('transactions')}
              onNavigateToAlerts={() => setCurrentTab('alerts')}
            />
          )}

          {currentTab === 'transactions' && (
            <TransactionsPage
              onSelectTransaction={setSelectedTransaction}
              refreshTrigger={refreshTrigger}
            />
          )}

          {currentTab === 'alerts' && (
            <AlertsPage
              onSelectAlert={setSelectedAlert}
              refreshTrigger={refreshTrigger}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsPage analytics={analytics} isLoading={isLoading} />
          )}

          {currentTab === 'model' && <ModelPerformancePage />}

          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Modals */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />

      <AlertReviewModal
        key={selectedAlert?.id || 'none'}
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onSave={handleSaveAlertResolution}
      />

      <NewTransactionModal
        isOpen={isInjectModalOpen}
        onClose={() => setIsInjectModalOpen(false)}
        onSuccess={() => {
          handleRefresh();
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
};

export default App;
