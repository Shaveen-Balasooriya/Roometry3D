import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import AddFurniturePage from "./pages/AddFurniturePage";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import FurnitureDashboardPage from "./pages/FurnitureDashboardPage";
import UpdateFurniturePage from "./pages/UpdateFurniturePage";
import UserManagementPage from "./pages/AddUserPage";
import UsersDashboardPage from "./pages/UsersDashboardPage";
import EditUserPage from "./pages/EditUserPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import AuthGuard from "./components/AuthGuard";
import HomePage from "./pages/HomePage";
import MyProjectsPage from "./pages/MyProjectsPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import ViewProjectPage from "./pages/ViewProjectPage";
import EditProjectPage from "./pages/EditProjectPage";

// Unauthorized page component
function Unauthorized() {
  return (
    <div className="app-container">
      <Navbar />
      <main
        className="main-content"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div>
          <h2 style={{ color: "var(--error)", marginBottom: "1.5rem" }}>
            Access Denied
          </h2>
          <p style={{ color: "var(--text-light)", marginBottom: "2rem" }}>
            You don't have permission to access this page. Please contact an
            administrator.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes - require any authenticated user */}
        <Route element={<AuthGuard allowedRoles={[]} />}>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Routes accessible to designers and client */}
        <Route element={<AuthGuard allowedRoles={["client", "designer"]} />}>
          {/* Project routes - accessible to all authenticated users */}
          <Route path="/my-projects" element={<MyProjectsPage />} />
          <Route path="/create-project" element={<CreateProjectPage />} />
          <Route path="/view-project/:id" element={<ViewProjectPage />} />{" "}
          {/* Updated path to match the URL in the links */}
          <Route path="/edit-project/:id" element={<EditProjectPage />} />
        </Route>

        {/* Routes accessible to designers and admin */}
        <Route element={<AuthGuard allowedRoles={["admin", "designer"]} />}>
          <Route
            path="/furniture-dashboard"
            element={
              <div className="app-container">
                <Navbar />
                <FurnitureDashboardPage />
                <Footer />
              </div>
            }
          />
          <Route
            path="/update-furniture/:id"
            element={
              <div className="app-container">
                <Navbar />
                <main className="main-content">
                  <UpdateFurniturePage />
                </main>
                <Footer />
              </div>
            }
          />
          <Route
            path="/add-furniture"
            element={
              <div className="app-container">
                <Navbar />
                <main className="main-content">
                  <AddFurniturePage />
                </main>
                <Footer />
              </div>
            }
          />
        </Route>

        {/* Routes accessible only to admin */}
        <Route element={<AuthGuard allowedRoles={["admin"]} />}>
          <Route
            path="/"
            element={
              <div className="app-container">
                <Navbar />
                <HomePage />
                <Footer />
              </div>
            }
          />
          <Route
            path="/add-user"
            element={
              <div className="app-container">
                <Navbar />
                <UserManagementPage />
                <Footer />
              </div>
            }
          />
          <Route
            path="/users-dashboard"
            element={
              <div className="app-container">
                <Navbar />
                <UsersDashboardPage />
                <Footer />
              </div>
            }
          />
          <Route
            path="/edit-user/:id"
            element={
              <div className="app-container">
                <Navbar />
                <EditUserPage />
                <Footer />
              </div>
            }
          />
        </Route>

        {/* Unauthorized route */}
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </Router>
  );
}
