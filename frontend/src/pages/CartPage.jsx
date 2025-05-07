import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Bounds } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import ConfirmationPopup from '../components/ConfirmationPopup';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import './CartPage.css';

// 3D Model preview components
function ModelPreview({ objFile, textureUrl, dimensions }) {
  const [object, setObject] = useState(null);
  const loaderRef = useRef(new OBJLoader());
  const { width = 1, height = 1, length = 1 } = dimensions || {};

  useEffect(() => {
    let currentMaterial = null;
    let cancelled = false;
    setObject(null);

    async function loadObj() {
      let objText = null;
      if (objFile instanceof Blob) {
        objText = await objFile.text();
      }
      if (!objText || cancelled) return;

      try {
        const parsedObj = loaderRef.current.parse(objText);

        const originalBox = new THREE.Box3().setFromObject(parsedObj);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        const maxObjDim = Math.max(originalSize.x, originalSize.y, originalSize.z, 0.001);
        const maxTargetDim = Math.max(width, height, length, 0.001);
        const scale = maxTargetDim / maxObjDim;

        parsedObj.scale.set(scale, scale, scale);

        const scaledBox = new THREE.Box3().setFromObject(parsedObj);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        const applyMaterial = (material) => {
          if (currentMaterial) {
            if (currentMaterial.map) currentMaterial.map.dispose();
            currentMaterial.dispose();
          }
          currentMaterial = material;
          parsedObj.traverse(child => {
            if (child.isMesh) {
              child.material = material;
              child.material.needsUpdate = true;
            }
          });
          setObject({ model: parsedObj, centerOffset: scaledCenter.clone() });
        };

        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            textureUrl,
            (mapTexture) => {
              if (cancelled) return;
              mapTexture.wrapS = mapTexture.wrapT = THREE.RepeatWrapping;
              mapTexture.encoding = THREE.sRGBEncoding;
              mapTexture.needsUpdate = true;
              applyMaterial(new THREE.MeshStandardMaterial({
                map: mapTexture,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              }));
            },
            undefined,
            () => {
              if (cancelled) return;
              applyMaterial(new THREE.MeshStandardMaterial({
                color: '#999999',
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              }));
            }
          );
        } else {
          applyMaterial(new THREE.MeshStandardMaterial({
            color: '#999999',
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.8
          }));
        }

      } catch (error) {
        console.error("Error processing model:", error);
        setObject(null);
      }
    }

    loadObj();

    return () => {
      cancelled = true;
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose();
        currentMaterial.dispose();
      }
    };
  }, [objFile, textureUrl, width, height, length]);

  return object ? (
    <group position={[-object.centerOffset.x, -object.centerOffset.y, -object.centerOffset.z]}>
      <primitive object={object.model} />
    </group>
  ) : null;
}

function RotatingBoundsContent({ children }) {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      <Bounds fit clip observe margin={1.2}>
        {children}
      </Bounds>
    </group>
  );
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const [confirmPopup, setConfirmPopup] = useState({ open: false, index: null });
  const [furnitureDetails, setFurnitureDetails] = useState({});
  const [objBlobs, setObjBlobs] = useState({});
  const [loadingModels, setLoadingModels] = useState({});
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState({});
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
          if (Array.isArray(parsedCart) && parsedCart.length > 0) {
            setCartItems(parsedCart);
            // Load additional details for each furniture item
            fetchFurnitureDetails(parsedCart);
          } else {
            setCartItems([]);
            setIsLoading(false);
          }
        } else {
          setCartItems([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        setPopup({ open: true, type: 'error', message: 'Failed to load cart items.' });
        setCartItems([]);
        setIsLoading(false);
      }
    };

    loadCartItems();
  }, []);

  // Fetch complete details for furniture items from Firestore
  const fetchFurnitureDetails = async (items) => {
    const uniqueIds = [...new Set(items.map(item => item.furnitureId))];
    const outOfStock = [];
    const lowStock = {};
    const detailsMap = {};
    
    try {
      const detailsPromises = uniqueIds.map(async (id) => {
        try {
          // Get from Firestore
          const furnitureDoc = await getDoc(doc(db, 'furniture', id));
          
          if (furnitureDoc.exists()) {
            const data = furnitureDoc.data();
            
            // Check stock status
            if (data.quantity <= 0) {
              outOfStock.push(id);
            } else if (data.quantity < 10) {
              lowStock[id] = data.quantity;
            }
            
            detailsMap[id] = { id, ...data };
            
            // If the furniture has a model URL or endpoint, fetch the 3D model
            if (data.objFileUrl || data.modelEndpoint) {
              fetchModelBlob(id, data.objFileUrl || data.modelEndpoint);
            }
            
            return { id, ...data };
          }
          
          // If not found in Firestore, try getting from API
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
            
            // Check stock status
            if (data.quantity <= 0) {
              outOfStock.push(id);
            } else if (data.quantity < 10) {
              lowStock[id] = data.quantity;
            }
            
            detailsMap[id] = { id, ...data };
            
            // If the furniture has a model URL or endpoint, fetch the 3D model
            if (data.objFileUrl || data.modelEndpoint) {
              fetchModelBlob(id, data.objFileUrl || data.modelEndpoint);
            }
            
            return { id, ...data };
          }
          
          return null;
        } catch (error) {
          console.error(`Error fetching details for furniture ${id}:`, error);
          return null;
        }
      });
      
      await Promise.all(detailsPromises);
      setFurnitureDetails(detailsMap);
      setOutOfStockItems(outOfStock);
      setLowStockItems(lowStock);
    } catch (error) {
      console.error('Error fetching furniture details:', error);
      setPopup({ 
        open: true,
        type: 'error',
        message: 'Failed to load complete product details.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch 3D model blob for a furniture item
  const fetchModelBlob = async (furnitureId, modelEndpoint) => {
    try {
      if (!modelEndpoint) return;
      
      setLoadingModels(prev => ({ ...prev, [furnitureId]: true }));
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to access this model');
      }
      
      const idToken = await user.getIdToken();
      
      // Check if the URL is already complete or needs the base API URL
      const modelUrl = modelEndpoint.startsWith('http') 
        ? modelEndpoint 
        : `${API_URL}${modelEndpoint}`;
      
      const response = await fetch(modelUrl, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch OBJ file');
      const blob = await response.blob();
      
      setObjBlobs(prev => ({ ...prev, [furnitureId]: blob }));
    } catch (err) {
      console.error(`Error fetching model for ${furnitureId}:`, err);
    } finally {
      setLoadingModels(prev => ({ ...prev, [furnitureId]: false }));
    }
  };

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    
    // Get the current item
    const item = cartItems[index];
    const furnitureId = item.furnitureId;
    
    // Check if there's enough stock
    if (furnitureDetails[furnitureId] && furnitureDetails[furnitureId].quantity < newQuantity) {
      const availableQuantity = furnitureDetails[furnitureId].quantity;
      setPopup({ 
        open: true, 
        type: 'error', 
        message: `Only ${availableQuantity} item(s) available in stock.` 
      });
      return;
    }
    
    const updatedItems = [...cartItems];
    updatedItems[index].quantity = newQuantity;
    setCartItems(updatedItems);
    localStorage.setItem('cart', JSON.stringify(updatedItems));
    
    // Event to notify other tabs about the cart update
    window.dispatchEvent(new Event('storage'));
  };

  const removeItem = (index) => {
    setConfirmPopup({ open: false, index: null });
    
    const updatedItems = [...cartItems];
    const removedItem = updatedItems[index];
    updatedItems.splice(index, 1);
    setCartItems(updatedItems);
    localStorage.setItem('cart', JSON.stringify(updatedItems));
    setPopup({ 
      open: true, 
      type: 'success', 
      message: `${removedItem.name || 'Item'} removed from cart.` 
    });
    
    // Event to notify other tabs about the cart update
    window.dispatchEvent(new Event('storage'));
  };

  const confirmRemoveItem = (index) => {
    setConfirmPopup({ open: true, index });
  };

  const handleCancelRemove = () => {
    setConfirmPopup({ open: false, index: null });
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => {
      // Skip out-of-stock items in total calculation
      if (outOfStockItems.includes(item.furnitureId)) return total;
      return total + (item.price * item.quantity);
    }, 0).toFixed(2);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      setPopup({ open: true, type: 'error', message: 'Your cart is empty.' });
      return;
    }
    
    // Check if there are any out-of-stock items
    if (outOfStockItems.length > 0) {
      setPopup({ 
        open: true, 
        type: 'error', 
        message: 'Please remove out-of-stock items before proceeding to checkout.' 
      });
      return;
    }
    
    try {
      setIsLoading(true);
      // Here you would implement the checkout process that connects to your backend
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to checkout');
      }
      
      const idToken = await user.getIdToken();
      
      // Filter out any out-of-stock items
      const availableItems = cartItems.filter(item => !outOfStockItems.includes(item.furnitureId));
      
      // Optional: Sync cart with backend before checkout
      await fetch(`${API_URL}/api/cart/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ cartItems: availableItems })
      }).catch(err => {
        console.log("Could not sync cart with backend, continuing with local cart:", err);
      });
      
      // Clear the cart
      localStorage.removeItem('cart');
      setCartItems([]);
      
      // Show success message and redirect
      setPopup({ 
        open: true, 
        type: 'success', 
        message: 'Your order has been placed successfully!' 
      });
      
      // In a real application, you would navigate to an order confirmation page
      setTimeout(() => {
        navigate('/customer-designer-furniture-catalogue');
      }, 2000);
      
    } catch (error) {
      console.error('Checkout error:', error);
      setPopup({ 
        open: true, 
        type: 'error', 
        message: error.message || 'Checkout failed. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const continueShopping = () => {
    navigate('/customer-designer-furniture-catalogue');
  };
  
  const getItemName = (item) => {
    // Use name from Firebase if available, otherwise use the one from localStorage
    if (furnitureDetails[item.furnitureId]?.name) {
      return furnitureDetails[item.furnitureId].name;
    }
    return item.name || 'Unknown Item';
  };
  
  const getItemPrice = (item) => {
    // Use price from Firebase if available
    if (furnitureDetails[item.furnitureId]?.price) {
      return furnitureDetails[item.furnitureId].price;
    }
    return item.price || 0;
  };
  
  const getDimensionString = (item) => {
    if (furnitureDetails[item.furnitureId]) {
      const details = furnitureDetails[item.furnitureId];
      return `${details.height || 0}m (H) × ${details.width || 0}m (W) × ${details.length || 0}m (L)`;
    }
    return 'Dimensions not available';
  };

  // Helper to get dimensions object for a furniture item
  const getDimensions = (item) => {
    if (furnitureDetails[item.furnitureId]) {
      const details = furnitureDetails[item.furnitureId];
      return {
        height: details.height || 0,
        width: details.width || 0,
        length: details.length || 0
      };
    }
    return { height: 0, width: 0, length: 0 };
  };
  
  // Check if an item is out of stock
  const isOutOfStock = (furnitureId) => {
    return outOfStockItems.includes(furnitureId);
  };
  
  // Get stock status message
  const getStockMessage = (furnitureId) => {
    if (isOutOfStock(furnitureId)) {
      return <span className="out-of-stock">Out of Stock</span>;
    } else if (lowStockItems[furnitureId]) {
      return <span className="low-stock">Only {lowStockItems[furnitureId]} left in stock</span>;
    }
    return null;
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
      
      <ConfirmationPopup
        open={confirmPopup.open}
        message="Are you sure you want to remove this item from your cart?"
        onConfirm={() => removeItem(confirmPopup.index)}
        onCancel={handleCancelRemove}
        confirmText="Remove"
        confirmButtonClass="button-danger"
      />
      
      <main className="main-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="cart-page-container">
          <h2 className="cart-page-title">Your Shopping Cart</h2>
          
          {isLoading ? (
            <div className="cart-loading">
              <Loading />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">🛒</div>
              <h3>Your cart is empty</h3>
              <p>Looks like you haven't added any furniture to your cart yet.</p>
              <button 
                onClick={continueShopping}
                className="btn-primary"
              >
                Browse Furniture Catalogue
              </button>
            </div>
          ) : (
            <div className="cart-content">
              <div className="cart-items">
                {cartItems.map((item, index) => (
                  <div 
                    key={`${item.furnitureId}-${index}`}
                    className={`cart-item ${isOutOfStock(item.furnitureId) ? 'out-of-stock-item' : ''}`}
                  >
                    <div className="cart-item-image">
                      {loadingModels[item.furnitureId] ? (
                        <div className="model-loading">
                          <Loading size={30} />
                        </div>
                      ) : objBlobs[item.furnitureId] ? (
                        <Canvas
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '4px',
                          }}
                          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
                          dpr={[1, 1.5]}
                          frameloop="always"
                          shadows
                          camera={{ fov: 45, near: 0.1, far: 50 }}
                        >
                          <color attach="background" args={['#f5f5f5']} />
                          <ambientLight intensity={0.6} />
                          <directionalLight
                            position={[3, 5, 4]}
                            intensity={1.0}
                            castShadow
                            shadow-mapSize-width={1024}
                            shadow-mapSize-height={1024}
                          />
                          <directionalLight position={[-3, 2, -4]} intensity={0.4} />
                          <Suspense fallback={null}>
                            <Environment preset="city" />
                            <RotatingBoundsContent>
                              <ModelPreview
                                objFile={objBlobs[item.furnitureId]}
                                textureUrl={item.textureUrl} // Use the customer's selected texture
                                dimensions={getDimensions(item)}
                              />
                            </RotatingBoundsContent>
                          </Suspense>
                        </Canvas>
                      ) : item.textureUrl ? (
                        <img 
                          src={item.textureUrl} 
                          alt={getItemName(item)}
                        />
                      ) : (
                        <div className="cart-item-no-image">
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="cart-item-details">
                      <h3 className="cart-item-name">{getItemName(item)}</h3>
                      <div className="cart-item-category">
                        {furnitureDetails[item.furnitureId]?.category || 'Furniture'}
                      </div>
                      <div className="cart-item-dimensions">
                        {getDimensionString(item)}
                      </div>
                      {furnitureDetails[item.furnitureId]?.wallMountable && (
                        <div className="cart-item-feature">Wall Mountable</div>
                      )}
                      {getStockMessage(item.furnitureId)}
                    </div>
                    
                    <div className="cart-item-price">
                      ${parseFloat(getItemPrice(item)).toFixed(2)}
                    </div>
                    
                    <div className="cart-item-quantity">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        className="quantity-btn"
                        disabled={item.quantity <= 1 || isOutOfStock(item.furnitureId)}
                      >
                        -
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="quantity-btn"
                        disabled={isOutOfStock(item.furnitureId)}
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="cart-item-subtotal">
                      ${(getItemPrice(item) * item.quantity).toFixed(2)}
                    </div>
                    
                    <button
                      onClick={() => confirmRemoveItem(index)}
                      className="remove-btn"
                      aria-label="Remove item"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="cart-summary">
                <div className="cart-total">
                  <h3>Order Summary</h3>
                  <div className="subtotal-row">
                    <span>Subtotal ({cartItems.filter(item => !isOutOfStock(item.furnitureId)).length} items):</span>
                    <span>${calculateTotal()}</span>
                  </div>
                  <div className="shipping-row">
                    <span>Shipping:</span>
                    <span>Free</span>
                  </div>
                  <div className="tax-row">
                    <span>Estimated Tax:</span>
                    <span>Calculated at checkout</span>
                  </div>
                  <div className="divider"></div>
                  <div className="total-row">
                    <span>Total:</span>
                    <span>${calculateTotal()}</span>
                  </div>
                  {outOfStockItems.length > 0 && (
                    <div className="stock-warning">
                      Please remove out-of-stock items before checkout.
                    </div>
                  )}
                  <button
                    onClick={handleCheckout}
                    className="checkout-btn"
                    disabled={isLoading || outOfStockItems.length > 0}
                  >
                    {isLoading ? <Loading size={18} /> : 'Proceed to Checkout'}
                  </button>
                  <button 
                    onClick={continueShopping}
                    className="continue-shopping-btn"
                  >
                    Continue Shopping
                  </button>
                </div>
                <div className="secure-checkout">
                  <div className="secure-icon">🔒</div>
                  <p>Secure Checkout</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}