import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const fitCameraToObject = (camera, object, controls) => {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
  cameraZ *= 1.6

  camera.position.set(center.x, center.y, center.z + cameraZ)
  camera.near = Math.max(maxDim / 100, 0.01)
  camera.far = Math.max(maxDim * 100, 1000)
  camera.updateProjectionMatrix()

  if (controls) {
    controls.target.copy(center)
    controls.update()
  }
}

export default function ThreeModelPreview({ url, name }) {
  const mountRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!mountRef.current || !url) return undefined

    setLoading(true)
    setError(false)

    const mount = mountRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf8fbff)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.innerHTML = ''
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 1.8)
    scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 2.2)
    directional.position.set(3, 5, 6)
    scene.add(directional)

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.2)
    fillLight.position.set(-4, 2, -3)
    scene.add(fillLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.screenSpacePanning = false
    controls.minDistance = 0.1
    controls.maxDistance = 200

    const loader = new GLTFLoader()
    let cancelled = false
    let animationFrameId = 0

    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }

    const handleResize = () => {
      if (!mount) return
      const width = mount.clientWidth || 1
      const height = mount.clientHeight || 1
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(handleResize)
      : null

    resizeObserver?.observe(mount)
    window.addEventListener('resize', handleResize)

    loader.load(
      url,
      (gltf) => {
        if (cancelled) return

        const model = gltf.scene
        scene.add(model)
        fitCameraToObject(camera, model, controls)
        controls.update()
        setLoading(false)
        animate()
      },
      undefined,
      (loadError) => {
        console.error('GLB preview error:', loadError)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    )

    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      resizeObserver?.disconnect()
      controls.dispose()
      renderer.dispose()
      mount.innerHTML = ''
    }
  }, [url])

  if (error) {
    return (
      <div className="approval-model-fallback">
        <p className="preview-fallback-title">3D preview failed</p>
        <p className="approval-preview-note">
          {name} perlu file `GLB/GLTF` hasil convert backend untuk bisa dipreview di browser.
        </p>
      </div>
    )
  }

  return (
    <div className="approval-model-stage">
      {loading && (
        <div className="preview-loading">
          <span className="loading loading-spinner loading-lg" />
          <span className="preview-loading-text">Loading 3D preview...</span>
        </div>
      )}
      <div ref={mountRef} className="approval-model-canvas" />
    </div>
  )
}
