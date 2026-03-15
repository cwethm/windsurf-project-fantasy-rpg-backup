/**
 * Simple VOX file loader for MagicaVoxel format
 * Supports basic VOX 150 format with size, XYZI, and RGBA chunks
 */

class VOXLoader {
    static async load(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load VOX file: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        let offset = 0;
        
        // Read header
        const magic = String.fromCharCode(
            dataView.getUint8(offset++),
            dataView.getUint8(offset++),
            dataView.getUint8(offset++),
            dataView.getUint8(offset++)
        );
        
        if (magic !== 'VOX ') {
            throw new Error('Invalid VOX file format');
        }
        
        const version = dataView.getUint32(offset, true);
        offset += 4;
        
        if (version !== 150) {
            throw new Error(`Unsupported VOX version: ${version}`);
        }
        
        // Parse chunks
        let size = [0, 0, 0];
        let voxels = [];
        let palette = new Array(256).fill([0, 0, 0, 0]);
        
        while (offset < arrayBuffer.byteLength) {
            // Read chunk header
            const chunkId = String.fromCharCode(
                dataView.getUint8(offset++),
                dataView.getUint8(offset++),
                dataView.getUint8(offset++),
                dataView.getUint8(offset++)
            );
            
            const chunkSize = dataView.getUint32(offset, true);
            offset += 4;
            
            const childSize = dataView.getUint32(offset, true);
            offset += 4;
            
            const chunkEnd = offset + chunkSize;
            const childEnd = chunkEnd + childSize;
            
            switch (chunkId) {
                case 'MAIN':
                    // MAIN is a container - don't skip, process children
                    break;
                    
                case 'SIZE':
                    size = [
                        dataView.getInt32(offset, true),
                        dataView.getInt32(offset + 4, true),
                        dataView.getInt32(offset + 8, true)
                    ];
                    offset = chunkEnd;
                    break;
                    
                case 'XYZI':
                    const numVoxels = dataView.getUint32(offset, true);
                    offset += 4;
                    
                    for (let i = 0; i < numVoxels; i++) {
                        voxels.push({
                            x: dataView.getUint8(offset++),
                            y: dataView.getUint8(offset++),
                            z: dataView.getUint8(offset++),
                            colorIndex: dataView.getUint8(offset++)
                        });
                    }
                    offset = chunkEnd;
                    break;
                    
                case 'RGBA':
                    // Read 256 palette entries (BGRA format)
                    for (let i = 0; i < 256; i++) {
                        const b = dataView.getUint8(offset++);
                        const g = dataView.getUint8(offset++);
                        const r = dataView.getUint8(offset++);
                        const a = dataView.getUint8(offset++);
                        palette[i] = [r, g, b, a];
                    }
                    offset = chunkEnd;
                    break;
                    
                default:
                    // Skip unknown chunks (both content and children)
                    offset = childEnd;
                    break;
            }
        }
        
        return {
            size: size,
            voxels: voxels,
            palette: palette
        };
    }
    
    static createGeometry(voxData) {
        const { size, voxels, palette } = voxData;
        
        // Create geometry from voxels
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const indices = [];
        
        // Center the model
        const offsetX = -size[0] / 2;
        const offsetY = 0;
        const offsetZ = -size[2] / 2;
        
        // Simple voxel rendering - create a cube for each voxel
        voxels.forEach(voxel => {
            const x = voxel.x + offsetX;
            const y = voxel.y + offsetY;
            const z = voxel.z + offsetZ;
            
            const color = palette[voxel.colorIndex];
            if (color[3] === 0) return; // Skip transparent voxels
            
            // Create a cube for this voxel
            const cubeSize = 1;
            const vertices = [
                // Front face
                x, y, z + cubeSize,
                x + cubeSize, y, z + cubeSize,
                x + cubeSize, y + cubeSize, z + cubeSize,
                x, y + cubeSize, z + cubeSize,
                // Back face
                x, y, z,
                x, y + cubeSize, z,
                x + cubeSize, y + cubeSize, z,
                x + cubeSize, y, z,
                // Top face
                x, y + cubeSize, z,
                x, y + cubeSize, z + cubeSize,
                x + cubeSize, y + cubeSize, z + cubeSize,
                x + cubeSize, y + cubeSize, z,
                // Bottom face
                x, y, z,
                x + cubeSize, y, z,
                x + cubeSize, y, z + cubeSize,
                x, y, z + cubeSize,
                // Right face
                x + cubeSize, y, z,
                x + cubeSize, y + cubeSize, z,
                x + cubeSize, y + cubeSize, z + cubeSize,
                x + cubeSize, y, z + cubeSize,
                // Left face
                x, y, z,
                x, y, z + cubeSize,
                x, y + cubeSize, z + cubeSize,
                x, y + cubeSize, z
            ];
            
            const baseIndex = positions.length / 3;
            positions.push(...vertices);
            
            // Add colors for each vertex
            for (let i = 0; i < 24; i++) {
                colors.push(color[0] / 255, color[1] / 255, color[2] / 255);
            }
            
            // Add indices for the cube faces
            const cubeIndices = [
                0, 1, 2, 0, 2, 3,    // Front
                4, 5, 6, 4, 6, 7,    // Back
                8, 9, 10, 8, 10, 11,  // Top
                12, 13, 14, 12, 14, 15, // Bottom
                16, 17, 18, 16, 18, 19, // Right
                20, 21, 22, 20, 22, 23  // Left
            ];
            
            cubeIndices.forEach(i => indices.push(baseIndex + i));
        });
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }
}
