import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { AppLayout } from './components/layout/AppLayout'
import { AuthGuard } from './components/shared/AuthGuard'

const queryClient = new QueryClient()
const ProductListPage = lazy(() => import('./pages/ProductListPage'))
const ProductEditPage = lazy(() => import('./pages/ProductEditPage'))
const OrderListPage = lazy(() => import('./pages/OrderListPage'))
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'))
const AfterSalesPage = lazy(() => import('./pages/AfterSalesPage'))
const ShipmentListPage = lazy(() => import('./pages/ShipmentListPage'))
const ShipmentDetailPage = lazy(() => import('./pages/ShipmentDetailPage'))
const ProductSelectionPage = lazy(() => import('./pages/ProductSelectionPage'))
const PlatformSettingsPage = lazy(() => import('./pages/PlatformSettingsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AISuggestionsPage = lazy(() => import('./pages/AISuggestionsPage'))
const ContentPlannerPage = lazy(() => import('./pages/ContentPlannerPage'))
const TrendDiscoveryPage = lazy(() => import('./pages/TrendDiscoveryPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const ScoutSourcesPage = lazy(() => import('./pages/ScoutSourcesPage'))
const FinancePage = lazy(() => import('./pages/FinancePage'))
const GrowthEnginePage = lazy(() => import('./pages/GrowthEnginePage'))
const SmartRadarPage = lazy(() => import('./pages/SmartRadarPage'))
const CrossValidationPage = lazy(() => import('./pages/CrossValidationPage'))
const WarehousePage = lazy(() => import('./pages/WarehousePage'))
const BatchPublishPage = lazy(() => import('./pages/BatchPublishPage'))
const ListingTemplatesPage = lazy(() => import('./pages/ListingTemplatesPage'))
const SmartPricingPage = lazy(() => import('./pages/SmartPricingPage'))
const InventoryAlertPage = lazy(() => import('./pages/InventoryAlertPage'))
const CompetitorMonitorPage = lazy(() => import('./pages/CompetitorMonitorPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const OperationsPage = lazy(() => import('./pages/OperationsPage'))
const PromotionsPage = lazy(() => import('./pages/PromotionsPage'))
const CommandCenterPage = lazy(() => import('./pages/CommandCenterPage'))
const RiskControlPage = lazy(() => import('./pages/RiskControlPage'))
const BusinessFlowPage = lazy(() => import('./pages/BusinessFlowPage'))
const DesignSystemPage = import.meta.env.DEV ? lazy(() => import('./pages/DesignSystemPage')) : null

function RouteFallback() {
  return (
    <div className="min-h-[240px] flex items-center justify-center" style={{ color: 'var(--color-muted)' }}>
      <div className="h-8 w-8 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)] animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route element={<AuthGuard />}>
                  <Route element={<AppLayout />}>
                    <Route path="command-center" element={<CommandCenterPage />} />
                    <Route path="risk-control" element={<RiskControlPage />} />
                    <Route path="business-flow" element={<BusinessFlowPage />} />
                    <Route path="ops" element={<Navigate to="/command-center" replace />} />
                    <Route path="cockpit" element={<Navigate to="/command-center" replace />} />
                    <Route path="scout" element={<TrendDiscoveryPage />} />
                    <Route path="scout/sources" element={<ScoutSourcesPage />} />
                    <Route path="profit" element={<ProductSelectionPage />} />
                    <Route path="content" element={<ContentPlannerPage />} />
                    <Route path="content/:tab" element={<ContentPlannerPage />} />
                    <Route path="orders" element={<OrderListPage />} />
                    <Route path="orders/after-sales" element={<AfterSalesPage />} />
                    <Route path="orders/:id" element={<OrderDetailPage />} />
                    <Route path="finance" element={<FinancePage />} />
                    <Route path="operations" element={<OperationsPage />} />
                    <Route path="promotions" element={<PromotionsPage />} />
                    <Route path="growth" element={<GrowthEnginePage />} />
                    <Route path="publish" element={<BatchPublishPage />} />
                    <Route path="publish/templates" element={<ListingTemplatesPage />} />
                    <Route path="pricing" element={<SmartPricingPage />} />
                    <Route path="smart/radar" element={<SmartRadarPage />} />
                    <Route path="smart/cross" element={<CrossValidationPage />} />
                    <Route path="orders/warehouses" element={<WarehousePage />} />
                    <Route index element={<Navigate to="/command-center" replace />} />
                    <Route path="dashboard" element={<Navigate to="/command-center" replace />} />
                    <Route path="selection" element={<Navigate to="/profit" replace />} />
                    <Route path="products" element={<ProductListPage />} />
                    <Route path="products/new" element={<ProductEditPage />} />
                    <Route path="products/:id" element={<ProductEditPage />} />
                    <Route path="shipments" element={<ShipmentListPage />} />
                    <Route path="shipments/new" element={<ShipmentDetailPage />} />
                    <Route path="shipments/:id" element={<ShipmentDetailPage />} />
                    <Route path="platforms" element={<PlatformSettingsPage />} />
                    <Route path="ai-suggestions" element={<AISuggestionsPage />} />
                    <Route path="trends" element={<Navigate to="/scout" replace />} />
                    <Route path="settings" element={<Navigate to="/settings/profile" replace />} />
                    <Route path="settings/:tab" element={<SettingsPage />} />
                    <Route path="inventory-alerts" element={<InventoryAlertPage />} />
                    <Route path="monitor" element={<CompetitorMonitorPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    {DesignSystemPage && <Route path="design-system" element={<DesignSystemPage />} />}
                  </Route>
                </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
