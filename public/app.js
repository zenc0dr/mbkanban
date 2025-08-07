// MBKanban App

// Санитизация HTML для защиты от XSS
function sanitizeHTML(str) {
    return String(str).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

class MBKanban {
    constructor() {
        this.currentProject = null;
        this.tasks = [];
        this.projects = [];
        this.init();
    }

    async init() {
        await this.loadProjects();
        this.setupEventListeners();
        this.showLoading(false);
    }

    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error('Failed to load projects');
            }
            this.projects = await response.json();
            this.populateProjectSelector();
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showEmptyState();
        }
    }

    populateProjectSelector() {
        const selector = document.getElementById('project-select');
        selector.innerHTML = '<option value="">Выберите проект...</option>';
        
        this.projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.name;
            option.textContent = `${project.name} (${project.activeCount}/${project.taskCount})`;
            selector.appendChild(option);
        });
    }

    async loadTasks(projectName) {
        try {
            const response = await fetch(`/api/projects/${projectName}/tasks`);
            if (!response.ok) {
                throw new Error('Failed to load tasks');
            }
            this.tasks = await response.json();
            this.renderTasks();
            this.updateStats();
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    renderTasks() {
        // Clear all columns
        const columns = ['waiting', 'in-progress', 'urgent', 'completed', 'cancelled'];
        columns.forEach(status => {
            const column = document.getElementById(`${status}-column`);
            column.innerHTML = '';
        });

        // Group tasks by status
        const tasksByStatus = {
            'waiting': this.tasks.filter(t => t.status === 'waiting'),
            'in-progress': this.tasks.filter(t => t.status === 'in-progress'),
            'urgent': this.tasks.filter(t => t.status === 'urgent'),
            'completed': this.tasks.filter(t => t.status === 'completed'),
            'cancelled': this.tasks.filter(t => t.status === 'cancelled')
        };

        // Render tasks in each column
        Object.entries(tasksByStatus).forEach(([status, tasks]) => {
            const column = document.getElementById(`${status}-column`);
            const countElement = document.getElementById(`${status}-count`);
            
            countElement.textContent = tasks.length;
            
            tasks.forEach(task => {
                const taskCard = this.createTaskCard(task);
                column.appendChild(taskCard);
            });
        });
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = `task-card bg-white rounded-lg border border-gray-200 p-4 mb-3 cursor-pointer priority-${task.priority}`;
        card.onclick = () => this.showTaskModal(task);

        const priorityColors = {
            'critical': 'bg-red-100 text-red-800',
            'high': 'bg-yellow-100 text-yellow-800',
            'medium': 'bg-blue-100 text-blue-800',
            'low': 'bg-green-100 text-green-800'
        };

        const priorityIcons = {
            'critical': '🔥',
            'high': '🔶',
            'medium': '🔶',
            'low': '🔶'
        };

        const safeTitle = sanitizeHTML(task.title);
        const safeDesc = sanitizeHTML(task.description || 'Нет описания');
        const safeAssignee = sanitizeHTML(task.assignee || 'Не назначен');
        const safeDeadline = task.deadline ? `<span>${sanitizeHTML(task.deadline)}</span>` : '';
        const completedSubtasks = task.subtasks.filter(st => st.completed).length;

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-medium text-gray-900 text-sm">${safeTitle}</h4>
                <span class="text-xs ${priorityColors[task.priority]} px-2 py-1 rounded-full">
                    ${priorityIcons[task.priority]}
                </span>
            </div>
            <p class="text-xs text-gray-600 mb-3 line-clamp-2">${safeDesc}</p>
            <div class="flex justify-between items-center text-xs text-gray-500">
                <span>${safeAssignee}</span>
                ${safeDeadline}
            </div>
            ${task.subtasks.length > 0 ? `
                <div class="mt-2 text-xs text-gray-500">
                    <i class="fas fa-list-ul mr-1"></i>
                    ${completedSubtasks}/${task.subtasks.length} подзадач
                </div>
            ` : ''}
        `;

        return card;
    }

    showTaskModal(task) {
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        title.textContent = task.title;

        const statusOptions = [
            { value: 'waiting', label: '⏳ Ожидает', color: 'bg-yellow-100 text-yellow-800' },
            { value: 'in-progress', label: '🔄 В работе', color: 'bg-blue-100 text-blue-800' },
            { value: 'urgent', label: '🔥 Срочно', color: 'bg-red-100 text-red-800' },
            { value: 'completed', label: '✅ Завершено', color: 'bg-green-100 text-green-800' },
            { value: 'cancelled', label: '❌ Отменено', color: 'bg-gray-100 text-gray-800' }
        ];

        const safeDesc = sanitizeHTML(task.description || 'Нет описания');
        const safeAssignee = sanitizeHTML(task.assignee || 'Не назначен');
        const safeDeadline = sanitizeHTML(task.deadline || 'Не установлен');

        content.innerHTML = `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                    <p class="text-sm text-gray-600">${safeDesc}</p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                    <select id="task-status" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${statusOptions.map(option =>
                            `<option value="${option.value}" ${task.status === option.value ? 'selected' : ''}>
                                ${option.label}
                            </option>`
                        ).join('')}
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Исполнитель</label>
                        <p class="text-sm text-gray-600">${safeAssignee}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Дедлайн</label>
                        <p class="text-sm text-gray-600">${safeDeadline}</p>
                    </div>
                </div>

                ${task.subtasks.length > 0 ? `
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Подзадачи</label>
                        <div class="space-y-1">
                            ${task.subtasks.map(subtask => `
                                <div class="flex items-center text-sm">
                                    <i class="fas ${subtask.completed ? 'fa-check-square text-green-500' : 'fa-square text-gray-400'} mr-2"></i>
                                    <span class="${subtask.completed ? 'line-through text-gray-500' : 'text-gray-700'}">${sanitizeHTML(subtask.text)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Add event listener for status change
        const statusSelect = document.getElementById('task-status');
        statusSelect.onchange = () => this.updateTaskStatus(task.id, statusSelect.value);

        modal.classList.remove('hidden');
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await fetch(`/api/projects/${this.currentProject}/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                // Reload tasks to reflect changes
                await this.loadTasks(this.currentProject);
                this.showNotification('Статус задачи обновлен', 'success');
            } else {
                this.showNotification('Ошибка при обновлении статуса', 'error');
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showNotification('Ошибка при обновлении статуса', 'error');
        }
    }

    async updateStats() {
        if (!this.currentProject) return;

        try {
            const response = await fetch(`/api/projects/${this.currentProject}/stats`);
            const stats = await response.json();

            document.getElementById('total-tasks').textContent = stats.total;
            document.getElementById('completed-tasks').textContent = stats.completed;
            document.getElementById('critical-tasks').textContent = stats.critical;
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    setupEventListeners() {
        const projectSelect = document.getElementById('project-select');
        projectSelect.onchange = (e) => {
            const projectName = e.target.value;
            if (projectName) {
                this.currentProject = projectName;
                this.loadTasks(projectName);
                this.showKanbanBoard();
            } else {
                this.showEmptyState();
            }
        };
    }

    showLoading(show = true) {
        const loading = document.getElementById('loading');
        const board = document.getElementById('kanban-board');
        const empty = document.getElementById('empty-state');

        if (show) {
            loading.classList.remove('hidden');
            board.classList.add('hidden');
            empty.classList.add('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showKanbanBoard() {
        const board = document.getElementById('kanban-board');
        const empty = document.getElementById('empty-state');
        
        board.classList.remove('hidden');
        empty.classList.add('hidden');
    }

    showEmptyState() {
        const board = document.getElementById('kanban-board');
        const empty = document.getElementById('empty-state');
        
        board.classList.add('hidden');
        empty.classList.remove('hidden');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-md text-white ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global functions
function closeTaskModal() {
    document.getElementById('task-modal').classList.add('hidden');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mbkanban = new MBKanban();
});
