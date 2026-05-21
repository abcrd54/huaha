import { create } from 'zustand'

export const useStore = create((set) => ({
  selectedProject: null,
  setSelectedProject: (project) => set({ selectedProject: project }),

  projects: [],
  setProjects: (projects) => set({ projects }),

  orderItems: [],
  setOrderItems: (items) => set({ orderItems: items }),
}))
