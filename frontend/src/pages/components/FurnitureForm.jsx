import React, { useState, useEffect, useCallback } from 'react';
import Loading from '../../components/Loading';
import Popup from '../../components/Popup';
import { auth } from '../../services/firebase'; // Import auth

const initialState = {
  name: '',
  category: '',
  description: '',
  price: '',
  quantity: '',
  height: '',
  width: '',
  length: '',
  wallMountable: false,
  objFile: null,
  textures: [],
};

const categories = [
  'Living Room',
  'Bedroom',
  'Dining Room',
  'Office',
  'Kitchen',
  'Bathroom',
  'Outdoor',
  'Kids',
  'Other'
];

export default function FurnitureForm({ initialData = null, onChange, onUpdateSuccess }) {
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [isObjDragging, setIsObjDragging] = useState(false);
  const [isTextureDragging, setIsTextureDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: 'success', message: '' });
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    if (initialData) {
      const dataForState = {
        ...initialData,
        price: initialData.price?.toString() || '',
        quantity: initialData.quantity?.toString() || '',
        height: initialData.height?.toString() || '',
        width: initialData.width?.toString() || '',
        length: initialData.length?.toString() || '',
        objFile: null,
        textures: [],
      };
      setForm(dataForState);
      onChange(dataForState);
    } else {
      setForm(initialState);
      onChange(initialState);
    }
    setErrors({});
  }, [initialData, onChange]);

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        return value.trim() ? '' : 'Name is required';
      case 'price':
        return value && !isNaN(value) && Number(value) >= 0 ? '' : 'Price must be a positive number';
      case 'quantity':
        return value && !isNaN(value) && Number(value) >= 0 ? '' : 'Quantity must be a positive number';
      case 'height':
      case 'width':
      case 'length':
        return value && !isNaN(value) && Number(value) > 0 ? '' : `${name.charAt(0).toUpperCase() + name.slice(1)} must be greater than 0`;
      default:
        return '';
    }
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked, files } = e.target;

    if (e.key === 'Enter') {
      e.preventDefault();
    }

    let newValue = value;
    let fieldErrors = { ...errors };

    if (type === 'checkbox') {
      newValue = checked;
    } else if (type === 'file') {
      e.preventDefault();

      if (name === 'objFile') {
        const file = files[0];
        if (file && file.name.toLowerCase().endsWith('.obj')) {
          newValue = file;
          delete fieldErrors.objFile;
        } else if (file) {
          newValue = form.objFile;
          fieldErrors.objFile = 'Invalid file type. Please select a .obj file.';
        } else {
          newValue = null;
        }
      } else if (name === 'textures') {
        const imageFiles = Array.from(files).filter(file =>
          file.type.startsWith('image/')
        );
        newValue = imageFiles.length > 0 ? imageFiles : form.textures;
      }
    } else {
      const fieldError = validateField(name, value);
      if (fieldError) {
        fieldErrors[name] = fieldError;
      } else {
        delete fieldErrors[name];
      }
    }
    const updatedFormState = { ...form, [name]: newValue };
    setForm(updatedFormState);
    onChange(updatedFormState);
    setErrors(fieldErrors);
  }, [errors, form, onChange]);

  const handleObjDragOver = (e) => { e.preventDefault(); setIsObjDragging(true); };
  const handleObjDragLeave = () => { setIsObjDragging(false); };

  const handleTextureDragOver = (e) => { e.preventDefault(); setIsTextureDragging(true); };
  const handleTextureDragLeave = () => { setIsTextureDragging(false); };

  const handleDrop = (e, fieldName) => {
    e.preventDefault();
    let updatedForm = { ...form };
    let fieldErrors = { ...errors };

    if (fieldName === 'objFile') {
      setIsObjDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.obj')) {
        updatedForm = { ...form, objFile: file };
        delete fieldErrors.objFile;
      } else if (file) {
        fieldErrors.objFile = 'Invalid file type. Please drop a .obj file.';
      }
    } else if (fieldName === 'textures') {
      setIsTextureDragging(false);
      const imageFiles = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/')
      );
      if (imageFiles.length > 0) {
        updatedForm = { ...form, textures: imageFiles };
      }
    }
    setForm(updatedForm);
    onChange(updatedForm);
    setErrors(fieldErrors);
  };

  const removeObjFile = useCallback((e) => {
    e.stopPropagation();
    const updatedFormState = { ...form, objFile: null };
    setForm(updatedFormState);
    onChange(updatedFormState);
    setErrors(prevErrors => {
      const newErrors = { ...prevErrors };
      delete newErrors.objFile;
      return newErrors;
    });
  }, [form, onChange]);

  const removeAllTextures = useCallback((e) => {
    e.stopPropagation();
    const updatedFormState = { ...form, textures: [] };
    setForm(updatedFormState);
    onChange(updatedFormState);
  }, [form, onChange]);

  const handleReset = useCallback(() => {
    if (initialData) {
      const dataForState = {
        ...initialData,
        price: initialData.price?.toString() || '',
        quantity: initialData.quantity?.toString() || '',
        height: initialData.height?.toString() || '',
        width: initialData.width?.toString() || '',
        length: initialData.length?.toString() || '',
        objFile: null,
        textures: [],
      };
      setForm(dataForState);
      onChange(dataForState);
    } else {
      setForm(initialState);
      onChange(initialState);
    }
    setErrors({});
    setIsSubmitting(false);
  }, [initialData, onChange]);

  const handleClearForm = useCallback(() => {
    setForm(initialState);
    setErrors({});
    setIsSubmitting(false);
    onChange(initialState);
  }, [onChange]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const fieldErrors = {};
    Object.entries(form).forEach(([key, value]) => {
      if (key !== 'objFile' && key !== 'textures' && key !== 'wallMountable' && key !== 'id' && key !== 'createdAt' && key !== 'objFileUrl' && key !== 'textureUrls' && key !== 'modelEndpoint') {
        const error = validateField(key, value);
        if (error) {
          fieldErrors[key] = error;
        }
      }
    });

    if (!initialData && !form.objFile) {
      fieldErrors.objFile = '3D model is required';
    }

    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length === 0) {
      try {
        const formData = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          if (key !== 'objFile' && key !== 'textures' && key !== 'id' && key !== 'createdAt' && key !== 'objFileUrl' && key !== 'textureUrls' && key !== 'modelEndpoint') {
            formData.append(key, value);
          }
        });

        if (form.objFile instanceof File) {
          formData.append('objFile', form.objFile);
        }
        if (form.textures && form.textures.length > 0) {
          form.textures.forEach((file) => {
            if (file instanceof File) {
              formData.append('textures', file);
            }
          });
        }

        const isUpdate = !!initialData;
        const url = isUpdate ? `${API_URL}/api/furniture/${initialData.id}` : '${API_URL}/api/furniture';
        const method = isUpdate ? 'PUT' : 'POST';

        console.log(`Submitting ${method} request to ${url}`);

        // Get current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to perform this action');
        }
        
        const idToken = await user.getIdToken();

        const response = await fetch(url, {
          method: method,
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
          body: formData,
        });

        console.log('Backend Response Status:', response.status);
        const responseBody = await response.text();
        console.log('Backend Response Body:', responseBody);

        if (!response.ok) {
          let errorData;
          try {
            errorData = JSON.parse(responseBody);
          } catch (parseError) {
            errorData = { message: responseBody || 'Unknown error' };
          }
          const action = isUpdate ? 'update' : 'upload';
          setPopup({ open: true, type: 'error', message: errorData.message || `Failed to ${action} furniture data` });
          setIsSubmitting(false);
          return;
        }

        if (isUpdate) {
          setPopup({ open: true, type: 'success', message: 'Furniture item updated successfully!' });
          if (onUpdateSuccess) {
            onUpdateSuccess();
          }
        } else {
          setPopup({ open: true, type: 'success', message: 'Furniture item added successfully!' });
          handleClearForm();
        }

      } catch (err) {
        console.error('Error submitting form:', err);
        setPopup({ open: true, type: 'error', message: err.message || 'Error processing request' });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      console.log('Form validation errors:', fieldErrors);
      setIsSubmitting(false);
    }
  };

  const isUpdateMode = !!initialData;

  return (
    <>
      <Popup
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ ...popup, open: false })}
      />
      <div className="form-scroll-inner">
        <form className="furniture-form" onSubmit={handleSubmit} autoComplete="off">
          {isSubmitting && <Loading overlay />}


          <div className="form-section-title">Basic Information</div>
          <div className="form-group">
            <label htmlFor="furnitureName">Name</label>
            <input
              id="furnitureName"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              required
              className={errors.name ? 'error' : ''}
              placeholder="e.g., Modern Sofa"
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="furnitureCategory">Category</label>
            <select
              id="furnitureCategory"
              name="category"
              value={form.category}
              onChange={handleChange}
              required
              className={errors.category ? 'error' : ''}
            >
              <option value="" disabled>Select category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="furnitureDescription">Description</label>
            <textarea
              id="furnitureDescription"
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Enter a brief description..."
            />
          </div>

          <div className="form-section-title">Inventory Details</div>
          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="furniturePrice">Price ($)</label>
              <input
                id="furniturePrice"
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
                className={errors.price ? 'error' : ''}
                placeholder="e.g., 499.99"
              />
              {errors.price && <div className="error-message">{errors.price}</div>}
            </div>
            <div className="form-group half">
              <label htmlFor="furnitureQuantity">Quantity</label>
              <input
                id="furnitureQuantity"
                name="quantity"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={handleChange}
                required
                className={errors.quantity ? 'error' : ''}
                placeholder="e.g., 10"
              />
              {errors.quantity && <div className="error-message">{errors.quantity}</div>}
            </div>
          </div>

          <div className="form-section-title">Dimensions</div>
          <p className="warning-text">All of the dimensions you will be entering below will be in meters.</p>
          <div className="form-row">
            <div className="form-group third">
              <label htmlFor="furnitureHeight">Height</label>
              <input
                id="furnitureHeight"
                name="height"
                type="number"
                min="0"
                step="0.01"
                value={form.height}
                onChange={handleChange}
                required
                className={errors.height ? 'error' : ''}
                placeholder="e.g., 0.8"
              />
              {errors.height && <div className="error-message">{errors.height}</div>}
            </div>
            <div className="form-group third">
              <label htmlFor="furnitureWidth">Width</label>
              <input
                id="furnitureWidth"
                name="width"
                type="number"
                min="0"
                step="0.01"
                value={form.width}
                onChange={handleChange}
                required
                className={errors.width ? 'error' : ''}
                placeholder="e.g., 2.1"
              />
              {errors.width && <div className="error-message">{errors.width}</div>}
            </div>
            <div className="form-group third">
              <label htmlFor="furnitureLength">Length/Depth</label>
              <input
                id="furnitureLength"
                name="length"
                type="number"
                min="0"
                step="0.01"
                value={form.length}
                onChange={handleChange}
                required
                className={errors.length ? 'error' : ''}
                placeholder="e.g., 0.95"
              />
              {errors.length && <div className="error-message">{errors.length}</div>}
            </div>
          </div>

          <div className="form-group checkbox">
            <input
              id="furnitureWallMountable"
              name="wallMountable"
              type="checkbox"
              checked={form.wallMountable}
              onChange={handleChange}
            />
            <label htmlFor="furnitureWallMountable">Wall Mountable</label>
          </div>

          <div className="form-section-title">3D Model & Textures</div>
          <div className="form-group">
            <label htmlFor="objFileInput">3D Model (.obj) {isUpdateMode && '(Leave blank to keep existing)'}</label>
            <div
              id="objFileDropArea"
              className={`file-input-wrapper ${isObjDragging ? 'dragging' : ''} ${errors.objFile ? 'error' : ''}`}
              onDragEnter={handleObjDragOver}
              onDragOver={handleObjDragOver}
              onDragLeave={handleObjDragLeave}
              onDrop={(e) => handleDrop(e, 'objFile')}
            >
              <input
                id="objFileInput"
                name="objFile"
                type="file"
                accept=".obj"
                onChange={handleChange}
                className="file-input-native"
                aria-describedby="objFileDropArea"
              />
              <div className="file-input-display">
                {form.objFile ? (
                  <div className="file-info">
                    <span className="file-name">{form.objFile.name}</span>
                    <span className="file-size">
                      ({(form.objFile.size / 1024).toFixed(1)} KB)
                      <button type="button" onClick={removeObjFile} className="remove-file-btn" title="Remove file">&times;</button>
                    </span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <span>{isUpdateMode ? 'Drop new .obj or click to replace' : 'Drop .obj file or click to browse'}</span>
                  </div>
                )}
              </div>
            </div>
            {errors.objFile && <div className="error-message">{errors.objFile}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="texturesInput">Texture Files (Images) {isUpdateMode && '(Replaces existing)'}</label>
            <div
              id="textureDropArea"
              className={`file-input-wrapper ${isTextureDragging ? 'dragging' : ''}`}
              onDragEnter={handleTextureDragOver}
              onDragOver={handleTextureDragOver}
              onDragLeave={handleTextureDragLeave}
              onDrop={(e) => handleDrop(e, 'textures')}
            >
              <input
                id="texturesInput"
                name="textures"
                type="file"
                accept="image/*"
                multiple
                onChange={handleChange}
                className="file-input-native"
                aria-describedby="textureDropArea"
              />
              <div className="file-input-display">
                {form.textures && form.textures.length > 0 ? (
                  <div className="file-info">
                    <span className="file-name">
                      {form.textures.length} new texture(s) selected
                      <button type="button" onClick={removeAllTextures} className="remove-file-btn" title="Remove all new textures">&times;</button>
                    </span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <span>{isUpdateMode ? 'Drop new textures or click to replace' : 'Drop texture images or click to browse'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            {isUpdateMode && (
              <button
                type="button"
                className="button-secondary"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Revert Changes
              </button>
            )}
            {!isUpdateMode && (
              <button
                type="button"
                className="button-secondary"
                onClick={handleClearForm}
                disabled={isSubmitting}
              >
                Reset Form
              </button>
            )}
            <button
              type="submit"
              className="button-primary"
              disabled={isSubmitting || Object.keys(errors).length > 0}
            >
              {isSubmitting ? <Loading size={20} /> : (isUpdateMode ? 'Update Furniture' : 'Add Furniture')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
