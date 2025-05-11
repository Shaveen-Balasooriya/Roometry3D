// Debug helper for furniture models
export const debugModelStructure = (model, name = "Model") => {
  if (!model) {
    console.log(`${name}: No model provided`);
    return;
  }
  
  console.log(`${name} structure:`);
  console.log(`- Type: ${model.type}`);
  console.log(`- Name: ${model.name}`);
  console.log(`- UUID: ${model.uuid}`);
  console.log(`- User data:`, model.userData);
  
  if (model.children && model.children.length > 0) {
    console.log(`- Children: ${model.children.length}`);
    model.children.forEach((child, index) => {
      console.log(`  Child ${index}: ${child.type} (${child.name || 'unnamed'})`);
      if (child.isMesh) {
        console.log(`    - Geometry: ${child.geometry ? 'Present' : 'Missing'}`);
        console.log(`    - Material: ${child.material ? (child.material.map ? 'Has texture' : 'No texture') : 'Missing'}`);
      }
    });
  } else {
    console.log(`- No children`);
  }
  
  let meshCount = 0;
  model.traverse(child => {
    if (child.isMesh) meshCount++;
  });
  console.log(`- Total meshes: ${meshCount}`);

  if (model.scene) {
    console.log('- Has scene property, debugging that too:');
    debugModelStructure(model.scene, `${name}.scene`);
  }
};

// Transform coordinates helper for debugging
export const transformDebug = (position, rotation) => {
  return {
    position: {
      x: parseFloat(position[0].toFixed(2)),
      y: parseFloat(position[1].toFixed(2)),
      z: parseFloat(position[2].toFixed(2))
    },
    rotation: {
      x: parseFloat((rotation[0] * (180/Math.PI)).toFixed(2)),
      y: parseFloat((rotation[1] * (180/Math.PI)).toFixed(2)),
      z: parseFloat((rotation[2] * (180/Math.PI)).toFixed(2))
    }
  };
};
