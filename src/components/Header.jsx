import { useStore } from '../stores/useStore'

export default function Header({ onAddProject, onEditProject }) {
  const { selectedProject, projects } = useStore()

  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1 gap-2">
        <button
          className="btn btn-primary btn-sm"
          onClick={onAddProject}
        >
          + Add Project
        </button>

        <select
          className="select select-bordered select-sm w-full max-w-xs"
          value={selectedProject?.id || ''}
          onChange={(e) => {
            const project = projects.find(p => p.id === e.target.value)
            useStore.setState({ selectedProject: project })
          }}
        >
          <option value="">Select Project</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.project_name}
            </option>
          ))}
        </select>

        <button
          className="btn btn-ghost btn-sm"
          onClick={onEditProject}
          disabled={!selectedProject}
        >
          ✏️ Edit
        </button>
      </div>
    </div>
  )
}
