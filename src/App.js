import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const InsightPage = lazy(() => import("./pages/insight/InsightPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

function RouteLoading() {
  return (
    <div className="route-loading">
      <div className="route-loading-spinner" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/insight" replace />} />
          <Route path="/insight" element={<InsightPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/insight" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
