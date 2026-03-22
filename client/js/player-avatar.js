/**
 * Animated Player Avatar System
 * Creates a voxel-style character with walk, idle, and attack animations
 */

class PlayerAvatar {
    constructor() {
        this.group = new THREE.Group();
        this.bones = {};
        this.animations = {};
        this.currentAnimation = 'idle';
        this.animationTime = 0;
        this.isAttacking = false;
        
        this.createModel();
        this.setupAnimations();
    }
    
    createModel() {
        // Voxel-style character with separate body parts for animation
        const voxelSize = 0.25;
        
        // Scale to make player just under 2 blocks tall (1.9 blocks)
        // Model height is 6.5 units, so 1.9/6.5 ≈ 0.292
        this.group.scale.set(0.292, 0.292, 0.292);
        
        // Offset model upward so feet are at y=0 (ground level)
        // Leg pivot at y=1, leg mesh at y=-1.5 relative to pivot, leg height=3 (±1.5)
        // Bottom of feet: 1 + (-1.5) + (-1.5) = -2.0 in model space
        // After scaling: -2.0 * 0.292 = -0.584 in world space
        // Need to offset by +0.584 to put feet at ground (y=0)
        this.group.position.y = 0.584;
        
        // Materials
        const skinMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
        const shirtMaterial = new THREE.MeshLambertMaterial({ color: 0x4a90e2 });
        const pantsMaterial = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
        const hairMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        
        // Head (8x8x8 voxels)
        const headGeometry = new THREE.BoxGeometry(2, 2, 2);
        this.bones.head = new THREE.Mesh(headGeometry, skinMaterial);
        this.bones.head.position.set(0, 5, 0);
        this.group.add(this.bones.head);
        
        // Hair/Hat
        const hairGeometry = new THREE.BoxGeometry(2.2, 0.5, 2.2);
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.position.set(0, 1.2, 0);
        this.bones.head.add(hair);
        
        // Eyes
        const eyeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
        const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.5, 0.3, 1.05);
        this.bones.head.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.5, 0.3, 1.05);
        this.bones.head.add(rightEye);
        
        // Torso (8x12x4 voxels)
        const torsoGeometry = new THREE.BoxGeometry(2, 3, 1);
        this.bones.torso = new THREE.Mesh(torsoGeometry, shirtMaterial);
        this.bones.torso.position.set(0, 2.5, 0);
        this.group.add(this.bones.torso);
        
        // Arms (pivot at shoulder)
        const armGeometry = new THREE.BoxGeometry(0.75, 3, 0.75);
        
        // Left arm
        this.bones.leftArmPivot = new THREE.Group();
        this.bones.leftArmPivot.position.set(-1.375, 3.5, 0);
        this.group.add(this.bones.leftArmPivot);
        
        this.bones.leftArm = new THREE.Mesh(armGeometry, skinMaterial);
        this.bones.leftArm.position.set(0, -1.5, 0);
        this.bones.leftArmPivot.add(this.bones.leftArm);
        
        // Right arm
        this.bones.rightArmPivot = new THREE.Group();
        this.bones.rightArmPivot.position.set(1.375, 3.5, 0);
        this.group.add(this.bones.rightArmPivot);
        
        this.bones.rightArm = new THREE.Mesh(armGeometry, skinMaterial);
        this.bones.rightArm.position.set(0, -1.5, 0);
        this.bones.rightArmPivot.add(this.bones.rightArm);
        
        // Legs (pivot at hip)
        const legGeometry = new THREE.BoxGeometry(0.75, 3, 0.75);
        
        // Left leg
        this.bones.leftLegPivot = new THREE.Group();
        this.bones.leftLegPivot.position.set(-0.5, 1, 0);
        this.group.add(this.bones.leftLegPivot);
        
        this.bones.leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        this.bones.leftLeg.position.set(0, -1.5, 0);
        this.bones.leftLegPivot.add(this.bones.leftLeg);
        
        // Right leg
        this.bones.rightLegPivot = new THREE.Group();
        this.bones.rightLegPivot.position.set(0.5, 1, 0);
        this.group.add(this.bones.rightLegPivot);
        
        this.bones.rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        this.bones.rightLeg.position.set(0, -1.5, 0);
        this.bones.rightLegPivot.add(this.bones.rightLeg);
        
        // Add shadow
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
    
    setupAnimations() {
        // Idle animation - gentle bobbing
        this.animations.idle = (time) => {
            const bob = Math.sin(time * 2) * 0.05;
            this.bones.torso.position.y = 2.5 + bob;
            this.bones.head.position.y = 5 + bob;
            
            // Gentle arm sway
            this.bones.leftArmPivot.rotation.x = Math.sin(time * 1.5) * 0.05;
            this.bones.rightArmPivot.rotation.x = Math.sin(time * 1.5 + Math.PI) * 0.05;
            
            // Reset legs
            this.bones.leftLegPivot.rotation.x = 0;
            this.bones.rightLegPivot.rotation.x = 0;
        };
        
        // Walk animation - swinging arms and legs
        this.animations.walk = (time) => {
            const speed = 8; // Animation speed
            const swing = Math.sin(time * speed);
            
            // Head bob
            const bob = Math.abs(Math.sin(time * speed * 2)) * 0.1;
            this.bones.head.position.y = 5 + bob;
            this.bones.torso.position.y = 2.5 + bob * 0.5;
            
            // Arm swing (opposite of legs)
            const armSwing = swing * 0.6;
            this.bones.leftArmPivot.rotation.x = -armSwing;
            this.bones.rightArmPivot.rotation.x = armSwing;
            
            // Leg swing
            const legSwing = swing * 0.5;
            this.bones.leftLegPivot.rotation.x = legSwing;
            this.bones.rightLegPivot.rotation.x = -legSwing;
            
            // Slight torso rotation
            this.bones.torso.rotation.y = swing * 0.05;
        };
        
        // Run animation - faster walk with more exaggerated movement
        this.animations.run = (time) => {
            const speed = 12;
            const swing = Math.sin(time * speed);
            
            // More pronounced bob
            const bob = Math.abs(Math.sin(time * speed * 2)) * 0.15;
            this.bones.head.position.y = 5 + bob;
            this.bones.torso.position.y = 2.5 + bob * 0.7;
            
            // Exaggerated arm swing
            const armSwing = swing * 0.8;
            this.bones.leftArmPivot.rotation.x = -armSwing;
            this.bones.rightArmPivot.rotation.x = armSwing;
            
            // Exaggerated leg swing
            const legSwing = swing * 0.7;
            this.bones.leftLegPivot.rotation.x = legSwing;
            this.bones.rightLegPivot.rotation.x = -legSwing;
            
            // Lean forward slightly
            this.bones.torso.rotation.x = -0.1;
            this.bones.torso.rotation.y = swing * 0.08;
        };
        
        // Attack animation - swing right arm
        this.animations.attack = (time) => {
            // Attack is a one-shot animation
            const attackDuration = 0.4; // 400ms attack
            const progress = (time % attackDuration) / attackDuration;
            
            if (progress < 0.3) {
                // Wind up
                const t = progress / 0.3;
                this.bones.rightArmPivot.rotation.x = -Math.PI * 0.5 * t;
                this.bones.rightArmPivot.rotation.z = -0.3 * t;
                this.bones.torso.rotation.y = -0.2 * t;
            } else if (progress < 0.7) {
                // Swing
                const t = (progress - 0.3) / 0.4;
                this.bones.rightArmPivot.rotation.x = -Math.PI * 0.5 + Math.PI * 1.2 * t;
                this.bones.rightArmPivot.rotation.z = -0.3 + 0.5 * t;
                this.bones.torso.rotation.y = -0.2 + 0.4 * t;
            } else {
                // Return to idle
                const t = (progress - 0.7) / 0.3;
                this.bones.rightArmPivot.rotation.x = Math.PI * 0.7 * (1 - t);
                this.bones.rightArmPivot.rotation.z = 0.2 * (1 - t);
                this.bones.torso.rotation.y = 0.2 * (1 - t);
            }
            
            // Keep left arm still
            this.bones.leftArmPivot.rotation.x = 0;
            
            // Slight leg adjustment
            this.bones.leftLegPivot.rotation.x = 0.1;
            this.bones.rightLegPivot.rotation.x = -0.1;
            
            // Auto-return to idle after attack
            if (progress > 0.95 && this.isAttacking) {
                this.isAttacking = false;
                this.setAnimation('idle');
            }
        };
        
        // Jump animation
        this.animations.jump = (time) => {
            // Arms up
            this.bones.leftArmPivot.rotation.x = -Math.PI * 0.3;
            this.bones.rightArmPivot.rotation.x = -Math.PI * 0.3;
            
            // Legs together
            this.bones.leftLegPivot.rotation.x = 0.2;
            this.bones.rightLegPivot.rotation.x = 0.2;
        };
        
        // Mining animation - swing both arms down
        this.animations.mine = (time) => {
            const speed = 6;
            const swing = Math.sin(time * speed);
            
            // Both arms swing down
            const armSwing = Math.abs(swing) * 0.8;
            this.bones.leftArmPivot.rotation.x = armSwing;
            this.bones.rightArmPivot.rotation.x = armSwing;
            
            // Slight torso lean
            this.bones.torso.rotation.x = armSwing * 0.3;
            
            // Head bob
            const bob = Math.abs(swing) * 0.05;
            this.bones.head.position.y = 5 + bob;
        };
    }
    
    setAnimation(animationName) {
        if (animationName === 'attack') {
            this.isAttacking = true;
            this.animationTime = 0; // Reset attack animation
        }
        
        if (this.animations[animationName]) {
            this.currentAnimation = animationName;
        }
    }
    
    update(deltaTime, velocity, isJumping, isMining) {
        this.animationTime += deltaTime;
        
        // Auto-select animation based on state
        if (!this.isAttacking) {
            if (isMining) {
                this.currentAnimation = 'mine';
            } else if (isJumping) {
                this.currentAnimation = 'jump';
            } else if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.z) > 0.1)) {
                // Check if running (shift key would set this)
                const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
                this.currentAnimation = speed > 5 ? 'run' : 'walk';
            } else {
                this.currentAnimation = 'idle';
            }
        }
        
        // Reset rotations before applying animation
        this.bones.torso.rotation.set(0, 0, 0);
        this.bones.head.rotation.set(0, 0, 0);
        
        // Apply current animation
        if (this.animations[this.currentAnimation]) {
            this.animations[this.currentAnimation](this.animationTime);
        }
    }
    
    getMesh() {
        return this.group;
    }
    
    /**
     * Set head rotation based on player view angle (yaw/pitch)
     * @param {number} yaw - Horizontal rotation in radians
     * @param {number} pitch - Vertical rotation in radians (optional)
     */
    setHeadRotation(yaw, pitch = 0) {
        if (this.bones.head) {
            // Rotate head to face the direction
            // Add PI to flip 180 degrees since eyes face +Z but camera looks -Z
            this.bones.head.rotation.y = yaw + Math.PI;
            // Limit pitch to prevent unnatural head angles
            this.bones.head.rotation.x = Math.max(-0.5, Math.min(0.5, pitch));
        }
    }
    
    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }
    
    setRotation(x, y, z) {
        this.group.rotation.set(x, y, z);
    }
    
    // Trigger attack animation
    attack() {
        this.setAnimation('attack');
    }
    
    // Customize colors
    setColors(skin, shirt, pants, hair) {
        if (skin) this.bones.head.material.color.setHex(skin);
        if (shirt) this.bones.torso.material.color.setHex(shirt);
        if (pants) {
            this.bones.leftLeg.material.color.setHex(pants);
            this.bones.rightLeg.material.color.setHex(pants);
        }
        if (hair) {
            this.bones.head.children[0].material.color.setHex(hair);
        }
    }
}

// Export for use in game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlayerAvatar;
}
