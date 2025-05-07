import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const [furnitureDetails, setFurnitureDetails] = useState({});
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  // Load cart items from localStorage
  useEffect(() => {
    const loadCartItems = () => {
      setIsLoading(true);
      try {
        const cartJSON = localStorage.getItem('cart');
        if (cartJSON) {
          const parsedCart = JSON.parse(cartJSON);
          if (Array.isArray(parsedCart)) {
            setCartItems(parsedCart);
            // Load additional details for each furniture item
            fetchFurnitureDetails(parsedCart);
          } else {
            setCartItems([]);
          }
        } else {
          setCartItems([]);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        setPopup({ open: true, type: 'error', message: 'Failed to load cart items.' });
        setCartItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCartItems();
  }, []);

  // Fetch additional details for furniture items from Firestore
  const fetchFurnitureDetails = async (items) => {
    const uniqueIds = [...new Set(items.map(item => item.furnitureId))];
    const detailsPromises = uniqueIds.map(async (id) => {
      try {
        // Try to get from Firestore
        const furnitureDoc = await getDoc(doc(db, 'furniture', id));
        
        if (furnitureDoc.exists()) {
          const data = furnitureDoc.data();
          return { id, ...data };
        }
        
        // If not in Firestore, try the API
        const user = auth.currentUser;
        if (!user) return null;
        
        const idToken = await user.getIdToken();
        const response = await fetch(`${API_URL}/api/furniture/${id}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          return { id, ...data };
        }
        
        return null;
      } catch (error) {
        console.error(`Error fetching details for furniture ${id}:`, error);
        return null;
      }
    });
    
    const detailsResults = await Promise.all(detailsPromises);
    const detailsMap = {};
    
    detailsResults.forEach(result => {
      if (result) {
        detailsMap[result.id] = result;
      }
    });
    
    setFurnitureDetails(detailsMap);
  };

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    
    const updatedItems = [...cartItems];
    updatedItems[index].quantity = newQuantity;
    setCartItems(updatedItems);
    localStorage.setItem('cart', JSON.stringify(updatedItems));
  };

  const removeItem = (index) => {
    const updatedItems = [...cartItems];
    updatedItems.splice(index, 1);
    setCartItems(updatedItems);
    localStorage.setItem('cart', JSON.stringify(updatedItems));
    setPopup({ open: true, type: 'success', message: 'Item removed from cart.' });
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0).toFixed(2);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      setPopup({ open: true, type: 'error', message: 'Your cart is empty.' });
      return;
    }
    
    // Here you would implement the checkout process
    // For now, let's just navigate to a hypothetical checkout page
    navigate('/checkout');
  };

  const continueShopping = () => {
    navigate('/furniture-catalogue');
  };

  return (
    <div className="app-container">
      <Navbar />
      <Popup 
        open={popup.open} 
        type={popup.type} 
        message={popup.message} 
        onClose={() => setPopup({ ...popup, open: false })} 
      />
      
      <main className="main-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Your Cart</h2>
        
        {isLoading ? (
          <Loading />
        ) : cartItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>Your cart is empty.</p>
            <button 
              onClick={continueShopping}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '1rem',
                background: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem', 
              marginBottom: '2rem' 
            }}>
              {cartItems.map((item, index) => (
                <div 
                  key={`${item.furnitureId}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '8px',
                    background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    gap: '1rem'
                  }}
                >
                  <div style={{ width: '80px', height: '80px', position: 'relative' }}>
                    {item.textureUrl ? (
                      <img 
                        src={item.textureUrl} 
                        alt={item.name}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #E2E8F0'
                        }} 
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        background: '#E2E8F0',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ color: '#718096', fontSize: '12px' }}>No Image</span>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                    <div style={{ fontSize: '0.9rem', color: '#4A5568', marginBottom: '0.5rem' }}>
                      Price: ${item.price}
                    </div>
                    
                    {/* Additional details if available */}
                    {furnitureDetails[item.furnitureId] && (
                      <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                        {furnitureDetails[item.furnitureId].category}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      style={{
                        width: '30px',
                        height: '30px',
                        background: '#E2E8F0',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}
                    >
                      -
                    </button>
                    <span style={{ width: '30px', textAlign: 'center' }}>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                      style={{
                        width: '30px',
                        height: '30px',
                        background: '#E2E8F0',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem'
                      }}
                    >
                      +
                    </button>
                  </div>
                  
                  <div style={{ minWidth: '80px', textAlign: 'right' }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  
                  <button
                    onClick={() => removeItem(index)}
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            <div style={{ 
              borderTop: '1px solid #E2E8F0', 
              paddingTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <button 
                  onClick={continueShopping}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                    background: '#FFFFFF',
                    color: '#3B82F6',
                    border: '1px solid #3B82F6',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Continue Shopping
                </button>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: '600' }}>
                  Total: ${calculateTotal()}
                </div>
                <button
                  onClick={handleCheckout}
                  style={{
                    padding: '0.5rem 1.5rem',
                    fontSize: '1rem',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}