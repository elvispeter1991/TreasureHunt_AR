import * as THREE from '../libs/three.js-r132/build/three.module.js';
import { ARButton } from '../../libs/three.js-r132/examples/jsm/webxr/ARButton.js';
import { RGBELoader } from '../../libs/three.js-r132/examples/jsm/loaders/RGBELoader.js'; // ✅ Import RGBELoader
import { loadGLTF } from './libs/loader.js';

document.addEventListener('DOMContentLoaded', () => {
  const initialize = async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // ✅ Load HDR and apply to scene
    const loadHDR = async () => {
      const hdrLoader = new RGBELoader();
      try {
        const texture = await hdrLoader.loadAsync('../../assets/hdr/studio.hdr');
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.background = null; // Optional: Set HDR as background
        console.log('HDR loaded successfully!');
      } catch (error) {
        console.error('Error loading HDR:', error);
      }
    };
    await loadHDR(); // Load HDR before placing models

    // Reticle setup
    const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    // AR Button
    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.body }
    });
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(arButton);

    // Distance UI setup
    const distanceUI = document.createElement('div');
    distanceUI.id = 'distance-ui';
    distanceUI.style.position = 'fixed';
    distanceUI.style.top = '10px';
    distanceUI.style.visibility = "hidden";
    distanceUI.style.left = '10px';
    distanceUI.style.background = 'rgba(0, 0, 0, 0.7)';
    distanceUI.style.color = 'white';
    distanceUI.style.padding = '10px';
    distanceUI.style.borderRadius = '5px';
    distanceUI.style.fontFamily = 'Arial, sans-serif';
    distanceUI.style.zIndex = '999';
    distanceUI.innerHTML = 'Distance: Calculating...';
    document.body.appendChild(distanceUI);

    const title = document.getElementById("heading");

    // Load GLTF Models
    let chestModel, secondModel, mixer;
    let chestClone, secondClone; // Store models globally to track them
    let modelPlaced = false; // Flag to track if the models have been placed
    let animationPlayed = false; // Prevent playing animation multiple times

    try {
      chestModel = await loadGLTF('../../assets/models/Old_Chest.glb');
      secondModel = await loadGLTF('../../assets/models/Place_Object.glb');
    } catch (error) {
      console.error('Error loading models:', error);
    }

    // ✅ Enhance chest material with HDR environment
    const applyHDRToChest = (chest) => {
      chest.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.envMap = scene.environment;
          child.material.needsUpdate = true;
        }
      });
    };

    // Function to calculate distance and update UI
    const updateDistance = () => {
      if (chestClone) {
        const chestPosition = chestClone.position;
        const cameraPosition = camera.position;

        // Calculate distance
        const distance = chestPosition.distanceTo(cameraPosition);

        // Update UI with distance
        distanceUI.innerHTML = `Distance: ${distance.toFixed(2)} meters`;

        // Check if the distance is less than 1 meter and play animation
        if (distance < 2.3 && !animationPlayed) {
          playChestAnimation();
          animationPlayed = true;
        }
      }
    };

    // Function to play chest opening animation and trigger particles
    const playChestAnimation = () => {
      if (chestClone && chestModel.animations.length > 0) {
        mixer = new THREE.AnimationMixer(chestClone);

        // Play the first animation (assumes chest opening animation is the first one)
        const action = mixer.clipAction(chestModel.animations[0]);
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        action.play();

        console.log('Chest animation triggered!');

        //Trigger Particles
        setTimeout(() => {
          createGlowingParticles(chestClone.position);
        }, 500);

        // 🎵 Play chest opening sound
        const audio = new Audio('../../assets/audio/chest_open.mp3');
        audio.play();
      }
    };

    const createGlowingParticles = (position) => {
      const particleCount = 150;
      const particlesGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
    
      for (let i = 0; i < particleCount; i++) {
        const radius = Math.random() * 1 + 0.3; // Random radius around the chest
        const angle = Math.random() * Math.PI * 2; // Random initial angle
    
        const x = position.x + radius * Math.cos(angle);
        const y = position.y + 0.5; // Slightly above the chest for a better visual
        const z = position.z + radius * Math.sin(angle);
    
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
    
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
      const particlesMaterial = new THREE.PointsMaterial({
        color: 0xffd700, // Glowing golden particles
        size: 0.05,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      });
    
      const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particleSystem);
    
      // ✨ Animate particles to circle from left to right
      const animateParticles = () => {
        const positions = particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
          const radius = Math.sqrt(
            Math.pow(positions[i * 3] - position.x, 2) + Math.pow(positions[i * 3 + 2] - position.z, 2)
          );
          let angle = Math.atan2(positions[i * 3 + 2] - position.z, positions[i * 3] - position.x);
    
          // Rotate particles from left to right
          angle += 0.03; // Rotation speed to the right
    
          positions[i * 3] = position.x + radius * Math.cos(angle);
          positions[i * 3 + 2] = position.z + radius * Math.sin(angle);
        }
    
        particleSystem.geometry.attributes.position.needsUpdate = true;
      };
    
      // 🔥 Animate particles for 3 seconds and then remove them
      const particleAnimationInterval = setInterval(animateParticles, 30);
    
      setTimeout(() => {
        clearInterval(particleAnimationInterval);
        scene.remove(particleSystem);
        particlesGeometry.dispose();
        particlesMaterial.dispose();
      }, 15000);
    };
    

    // Automatically place models when a valid hit point is detected
    const placeModels = (position) => {
      if (!modelPlaced && chestModel && secondModel) {
        // Clone and position the chest model on the floor
        chestClone = chestModel.scene.clone(); // Store in global variable
        chestClone.position.set(0, -1.5, 3.5);
        chestClone.scale.set(1.3, 1.3, -1.3);

        // ✅ Apply HDR to the chest
        applyHDRToChest(chestClone);

        scene.add(chestClone);

        // Clone and position the second model above the chest
        secondClone = secondModel.scene.clone();
        secondClone.position.set(0, 0.7, -2);
        secondClone.scale.set(0.3, 0.3, 0.3);
        scene.add(secondClone);

        modelPlaced = true; // Prevent further placement
        reticle.visible = false;
        console.log('Models placed automatically!');
      }
    };

    // Hit testing for placing objects automatically
    renderer.xr.addEventListener('sessionstart', async () => {
      const session = renderer.xr.getSession();
      const viewerReferenceSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerReferenceSpace });
      title.style.visibility = "hidden";

      renderer.setAnimationLoop((timestamp, frame) => {
        if (!frame) return;

        if (!modelPlaced) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);

          if (hitTestResults.length) {
            const hit = hitTestResults[0];
            const referenceSpace = renderer.xr.getReferenceSpace();
            const hitPose = hit.getPose(referenceSpace);

            if (hitPose) {
              reticle.visible = true;
              reticle.matrix.fromArray(hitPose.transform.matrix);

              // Automatically place models when a valid hit point is detected
              const position = new THREE.Vector3();
              position.setFromMatrixPosition(reticle.matrix);
              placeModels(position);
            }
          } else {
            reticle.visible = false;
          }
        }

        // Update distance and check for animation
        updateDistance();

        // Update mixer for animation if available
        if (mixer) mixer.update(0.016); // ~60fps update for animation

        renderer.render(scene, camera);
      });
    });

    renderer.xr.addEventListener('sessionend', () => {
      console.log('Session ended');
    });
  };

  initialize();
});
