import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Plus, Search, SquarePen, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useStore } from './stores/useStore'
import GeneralInfo from './components/GeneralInfo'
import ProductList from './components/ProductList'
import ProductDetail from './components/ProductDetail'
import ProjectModal from './components/ProjectModal'
import DocumentUpload from './components/DocumentUpload'
import ApprovalButtons from './components/ApprovalButtons'

export default function App() {
  const { selectedProject, setSelectedProject, projects, setProjects } = useStore()
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showProductDetail, setShowProductDetail] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productListVersion, setProductListVersion] = useState(0)
  const [projectQuery, setProjectQuery] = useState('')
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const projectPickerRef = useRef(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    const nextValue = selectedProject?.project_name || ''
    setProjectQuery(nextValue)
  }, [selectedProject])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!projectPickerRef.current?.contains(event.target)) {
        setProjectDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
      if (selectedProject) {
        const refreshed = (data || []).find((project) => project.id === selectedProject.id)
        setSelectedProject(refreshed || null)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const handleAddProject = () => {
    setEditingProject(null)
    setShowProjectModal(true)
  }

  const handleEditProject = () => {
    if (!selectedProject) return
    setEditingProject(selectedProject)
    setShowProjectModal(true)
  }

  const handleCloseProjectModal = () => {
    setShowProjectModal(false)
    setEditingProject(null)
  }

  const handleSaveProject = async () => {
    await fetchProjects()
    setShowProjectModal(false)
    setEditingProject(null)
  }

  const handleSelectItem = (item) => {
    setEditingProduct(item)
    setShowProductDetail(true)
  }

  const handleAddProduct = () => {
    setEditingProduct(null)
    setShowProductDetail(true)
  }

  const handleCloseProductDetail = () => {
    setShowProductDetail(false)
    setEditingProduct(null)
  }

  const handleSaveProduct = () => {
    setProductListVersion((current) => current + 1)
    setShowProductDetail(false)
    setEditingProduct(null)
  }

  const filteredProjects = useMemo(() => {
    const keyword = projectQuery.trim().toLowerCase()
    if (!keyword) return projects

    return projects.filter((project) => {
      const name = project.project_name?.toLowerCase() || ''
      const company = project.company?.toLowerCase() || ''
      return name.includes(keyword) || company.includes(keyword)
    })
  }, [projectQuery, projects])

  const handleSelectProject = (project) => {
    setSelectedProject(project)
    setProjectQuery(project?.project_name || '')
    setProjectDropdownOpen(false)
  }

  return (
    <div className="app-shell min-h-screen bg-base-200">
      <div className="page-wrap">
        <section className="hero-panel hero-header">
          <div className="toolbar-grid">
            <div className="toolbar-select-wrap project-picker" ref={projectPickerRef}>
              <span className="toolbar-search-prefix">
                <Search size={18} className="toolbar-select-icon" />
              </span>
              <input
                type="text"
                className="toolbar-select"
                placeholder="Cari atau pilih project..."
                value={projectQuery}
                onChange={(e) => {
                  setProjectQuery(e.target.value)
                  setProjectDropdownOpen(true)
                  if (!e.target.value.trim()) {
                    setSelectedProject(null)
                  }
                }}
                onFocus={() => setProjectDropdownOpen(true)}
              />
              {!!projectQuery && (
                <button
                  type="button"
                  className="project-picker-clear"
                  onClick={() => {
                    setProjectQuery('')
                    setSelectedProject(null)
                    setProjectDropdownOpen(false)
                  }}
                  aria-label="Reset project filter"
                >
                  <X size={16} />
                </button>
              )}
              <button
                type="button"
                className="project-picker-toggle"
                onClick={() => setProjectDropdownOpen((current) => !current)}
                aria-label="Toggle project list"
              >
                <ChevronDown size={18} className={`project-picker-chevron ${projectDropdownOpen ? 'open' : ''}`} />
              </button>

              {projectDropdownOpen && (
                <div className="project-picker-dropdown">
                  {filteredProjects.length === 0 ? (
                    <div className="project-picker-empty">Project tidak ditemukan</div>
                  ) : (
                    filteredProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className={`project-picker-option ${selectedProject?.id === project.id ? 'active' : ''}`}
                        onClick={() => handleSelectProject(project)}
                      >
                        <span className="project-picker-name">{project.project_name}</span>
                        <span className="project-picker-meta">{project.company}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              className="btn btn-outline action-btn"
              onClick={handleAddProject}
            >
              <Plus size={18} />
              Add Project
            </button>

            {selectedProject && (
              <button
                className="btn btn-outline action-btn"
                onClick={handleEditProject}
              >
                <SquarePen size={18} />
                Edit Project
              </button>
            )}
          </div>
        </section>

        <div className="section-space section-inset info-grid">
          <GeneralInfo project={selectedProject} />
        </div>

        <div className="section-space section-inset">
          <ProductList
            onAddItem={handleAddProduct}
            onSelectItem={handleSelectItem}
            refreshKey={productListVersion}
          />
        </div>

        <div className="section-space section-inset">
          <ApprovalButtons projectId={selectedProject?.id} />
        </div>

        {selectedProject && editingProduct && (
          <div className="section-space section-inset">
            <DocumentUpload orderItemId={editingProduct.id} />
          </div>
        )}
      </div>

      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          onClose={handleCloseProjectModal}
          onSave={handleSaveProject}
        />
      )}

      {showProductDetail && (
        <ProductDetail
          item={editingProduct}
          onClose={handleCloseProductDetail}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  )
}
