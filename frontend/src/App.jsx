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
import ChangePasswordPage from "./pages/ChangePasswordPage";
import EditProfilePage from "./pages/EditProfilePage";
import AuthGuard from "./components/AuthGuard";
import HomePage from "./pages/HomePage";
import ClientDesignerHomePage from "./pages/ClientDesignerHomePage";
import MyProjectsPage from "./pages/MyProjectsPage";
import CreateProjectPage from "./pages/CreateProjectPage";
import ViewProjectPage from "./pages/ViewProjectPage";
import EditProjectPage from "./pages/EditProjectPage";
import CustomerDesignerFurnitureCataloguePage from "./pages/CustomerDesignerFurnitureCataloguePage";
import CartPage from "./pages/CartPage";
import Breadcrumb from "./components/Breadcrumb";
import UploadRoomPage from "./pages/UploadRoomPage"; // Added import for the new page


// Unauthorized page component
function Unauthorized() {
  return (
    <div className="page-content">
      <h2 style={{ color: "var(--error)", marginBottom: "1.5rem" }}>
        Access Denied
      </h2>
      <p style={{ color: "var(--text-light)", marginBottom: "2rem" }}>
        You don't have permission to access this page. Please contact an
        administrator.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Breadcrumb />
          <div className="page-content-wrapper">
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<LoginPage />} />
                
              {/* Protected routes - require any authenticated user */}
              <Route element={<AuthGuard allowedRoles={[]} />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/edit-profile" element={<EditProfilePage />} />
                <Route path="/change-password" element={<ChangePasswordPage />} />
              </Route>


              {/* Routes accessible to designers and client */}
              <Route element={<AuthGuard allowedRoles={["client", "designer"]} />}>
                {/* Project routes - accessible to all authenticated users */}
                <Route path="/my-projects" element={<MyProjectsPage />} />
                <Route path="/create-project" element={<CreateProjectPage />} />
                <Route path="/view-project/:id" element={<ViewProjectPage />} />
                <Route path="/edit-project/:id" element={<EditProjectPage />} />
                <Route
                  path="/customer-designer-furniture-catalogue"
                  element={<CustomerDesignerFurnitureCataloguePage />}
                />
                <Route path="/cart" element={<CartPage />} />
              </Route>

              {/* Routes accessible to designers and admin */}
              <Route element={<AuthGuard allowedRoles={["admin", "designer"]} />}>
                <Route path="/furniture-dashboard" element={<FurnitureDashboardPage />} />
                <Route path="/update-furniture/:id" element={<UpdateFurniturePage />} />
                <Route path="/add-furniture" element={<AddFurniturePage />} />
              </Route>

              {/* Routes accessible only to admin */}
              <Route element={<AuthGuard allowedRoles={["admin"]} />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/add-user" element={<UserManagementPage />} />
                <Route path="/users-dashboard" element={<UsersDashboardPage />} />
                <Route path="/edit-user/:id" element={<EditUserPage />} />
              </Route>

              {/* Unauthorized route */}
              <Route path="/unauthorized" element={<Unauthorized />} />
            </Routes>
          </div>
        </main>
        <Footer />
      </div>
    </Router>
  );
}