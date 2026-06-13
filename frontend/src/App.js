import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import Layout from "@/components/Layout";

import Home from "@/pages/Home";
import Search from "@/pages/Search";
import PropertyDetail from "@/pages/PropertyDetail";
import Publish from "@/pages/Publish";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import MapPage from "@/pages/MapPage";
import Contact from "@/pages/Contact";
import Payments from "@/pages/Payments";
import Feedback from "@/pages/Feedback";

const AppRouter = () => {
  const location = useLocation();
  // Detect OAuth callback via URL fragment synchronously (before render of other routes)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
};

function App() {
  useEffect(() => {
    // Register PWA service worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js").catch(() => {});
      });
    }
  }, []);

  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
