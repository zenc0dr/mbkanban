const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
/*
// CODEX_ISSUE: Unused dependencies 'gray-matter' and 'marked'
// PROBLEM: Importing unused modules wastes memory and can introduce unnecessary security vulnerabilities.
// IMPACT: Increases attack surface and slows down application startup for no benefit.
// SOLUTION: Remove these imports until markdown parsing is actually required.
// ALTERNATIVE: Use dynamic imports when the feature is implemented.
*/
// const matter = require('gray-matter');
// const marked = require('marked');

const app = express();
/*
// CODEX_ISSUE: Hardcoded server port
// PROBLEM: Fixed ports make deployment to cloud environments or shared hosts difficult.
// IMPACT: Application may fail to start if the port is already in use.
// SOLUTION: Allow configuration via the PORT environment variable with a safe default.
// ALTERNATIVE: Use a configuration file or command-line arguments for runtime options.
*/
const PORT = process.env.PORT || 8823;

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
/*
// CODEX_ISSUE: Unrestricted CORS configuration
// PROBLEM: Allowing requests from any origin exposes the API to CSRF and data exfiltration risks.
// IMPACT: Malicious sites could interact with the API without user consent.
// SOLUTION: Restrict origins via an environment-controlled whitelist while preserving backwards compatibility.
// ALTERNATIVE: Configure CORS per-route or use a more comprehensive security middleware.
*/
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }));
/*
// CODEX_ISSUE: Unlimited JSON payload size
// PROBLEM: Large request bodies can exhaust server memory leading to denial of service.
// IMPACT: Server crashes or degraded performance under heavy load.
// SOLUTION: Impose a reasonable limit on JSON body size.
// ALTERNATIVE: Stream large uploads to disk instead of keeping them in memory.
*/
app.use(express.json({ limit: '1mb' }));
/*
// CODEX_ISSUE: Static assets served without caching
// PROBLEM: Browsers must fetch unchanged assets on every request, increasing load times.
// IMPACT: Higher bandwidth usage and slower user experience.
// SOLUTION: Enable cache headers with a modest max-age.
// ALTERNATIVE: Serve assets through a CDN for better caching.
*/
app.use(express.static('public', { maxAge: '1h' }));

// Путь к банку памяти
/*
// CODEX_ISSUE: Relative memory bank path
// PROBLEM: Relative paths depend on the current working directory and can lead to file resolution errors.
// IMPACT: The application might read or write unexpected files if executed from another directory.
// SOLUTION: Resolve to an absolute path based on the server location.
// ALTERNATIVE: Accept the path through configuration.
*/
const MEMORY_BANK_PATH = path.resolve(__dirname, '..', 'memory-bank-data');

/*
// CODEX_ISSUE: Potential path traversal via project parameter
// PROBLEM: Using unsanitized user input in file paths allows access outside the intended directory.
// IMPACT: Attackers could read or modify arbitrary files on the server.
// SOLUTION: Validate project names against a strict whitelist before constructing paths.
// ALTERNATIVE: Normalize paths and ensure they remain inside the base directory.
*/
function isValidProjectName(name) {
    return /^[a-zA-Z0-9_-]+$/.test(name);
}

// Функция для парсинга задач из markdown файлов
function parseTasksFromMarkdown(content) {
    const tasks = [];
    const lines = content.split('\n');
    let currentTask = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Находим заголовки задач (### TASK_XXX: Название)
        if (line.startsWith('### TASK_')) {
            if (currentTask) {
                tasks.push(currentTask);
            }
            
            const taskMatch = line.match(/### (TASK_\d+): (.+)/);
            if (taskMatch) {
                currentTask = {
                    id: taskMatch[1],
                    title: taskMatch[2],
                    status: 'unknown',
                    priority: 'medium',
                    description: '',
                    subtasks: [],
                    assignee: '',
                    deadline: '',
                    created: new Date().toISOString()
                };
            }
        }
        
        // Парсим статус
        if (line.includes('**Статус:**') && currentTask) {
            if (line.includes('⏳ Ожидает')) currentTask.status = 'waiting';
            else if (line.includes('🔄 В работе')) currentTask.status = 'in-progress';
            else if (line.includes('✅ Завершено')) currentTask.status = 'completed';
            else if (line.includes('❌ Отменено')) currentTask.status = 'cancelled';
            else if (line.includes('🔥 Срочно')) currentTask.status = 'urgent';
        }
        
        // Парсим приоритет
        if (line.includes('**Приоритет:**') && currentTask) {
            if (line.includes('🔥 Критический')) currentTask.priority = 'critical';
            else if (line.includes('🔶 Высокий')) currentTask.priority = 'high';
            else if (line.includes('🔶 Средний')) currentTask.priority = 'medium';
            else if (line.includes('🔶 Низкий')) currentTask.priority = 'low';
        }
        
        // Парсим описание
        if (line.includes('**Описание:**') && currentTask) {
            const descMatch = line.match(/\*\*Описание:\*\* (.+)/);
            if (descMatch) {
                currentTask.description = descMatch[1];
            }
        }
        
        // Парсим исполнителя
        if (line.includes('**Исполнитель:**') && currentTask) {
            const assigneeMatch = line.match(/\*\*Исполнитель:\*\* (.+)/);
            if (assigneeMatch) {
                currentTask.assignee = assigneeMatch[1];
            }
        }
        
        // Парсим дедлайн
        if (line.includes('**Дедлайн:**') && currentTask) {
            const deadlineMatch = line.match(/\*\*Дедлайн:\*\* (.+)/);
            if (deadlineMatch) {
                currentTask.deadline = deadlineMatch[1];
            }
        }
        
        // Парсим подзадачи
        if (line.includes('- [ ]') && currentTask) {
            const subtaskMatch = line.match(/- \[ \] (.+)/);
            if (subtaskMatch) {
                currentTask.subtasks.push({
                    text: subtaskMatch[1],
                    completed: false
                });
            }
        }
        if (line.includes('- [x]') && currentTask) {
            const subtaskMatch = line.match(/- \[x\] (.+)/);
            if (subtaskMatch) {
                currentTask.subtasks.push({
                    text: subtaskMatch[1],
                    completed: true
                });
            }
        }
    }
    
    if (currentTask) {
        tasks.push(currentTask);
    }
    
    return tasks;
}

// API для получения всех проектов
app.get('/api/projects', async (req, res) => {
    try {
        const projects = [];
        const projectsPath = path.join(MEMORY_BANK_PATH);
        
        if (await fs.pathExists(projectsPath)) {
            const items = await fs.readdir(projectsPath);
            
            for (const item of items) {
                const itemPath = path.join(projectsPath, item);
                const stats = await fs.stat(itemPath);
                
                if (stats.isDirectory()) {
                    const tasksPath = path.join(itemPath, 'tasks.md');
                    let taskCount = 0;
                    let activeCount = 0;
                    
                    if (await fs.pathExists(tasksPath)) {
                        const content = await fs.readFile(tasksPath, 'utf-8');
                        const tasks = parseTasksFromMarkdown(content);
                        taskCount = tasks.length;
                        activeCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
                    }
                    
                    projects.push({
                        name: item,
                        taskCount,
                        activeCount,
                        lastModified: stats.mtime
                    });
                }
            }
        }
        
        res.json(projects);
    } catch (error) {
        console.error('Error getting projects:', error);
        res.status(500).json({ error: 'Failed to get projects' });
    }
});

// API для получения задач проекта
app.get('/api/projects/:project/tasks', async (req, res) => {
    try {
        const { project } = req.params;
        /*
        // CODEX_ISSUE: Missing validation for path parameters
        // PROBLEM: Using unvalidated user input in file paths can lead to directory traversal attacks.
        // IMPACT: Attackers could access data outside of the intended project scope.
        // SOLUTION: Reject requests with disallowed characters before constructing paths.
        // ALTERNATIVE: Normalize the path and ensure it stays within the base directory.
        */
        if (!isValidProjectName(project)) {
            return res.status(400).json({ error: 'Invalid project name' });
        }
        const tasksPath = path.join(MEMORY_BANK_PATH, project, 'tasks.md');
        
        if (!await fs.pathExists(tasksPath)) {
            return res.json([]);
        }
        
        const content = await fs.readFile(tasksPath, 'utf-8');
        const tasks = parseTasksFromMarkdown(content);
        
        res.json(tasks);
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

// API для обновления статуса задачи
app.put('/api/projects/:project/tasks/:taskId/status', async (req, res) => {
    try {
        const { project, taskId } = req.params;
        const { status } = req.body;

        if (!isValidProjectName(project)) {
            return res.status(400).json({ error: 'Invalid project name' });
        }
        const tasksPath = path.join(MEMORY_BANK_PATH, project, 'tasks.md');
        
        if (!await fs.pathExists(tasksPath)) {
            return res.status(404).json({ error: 'Tasks file not found' });
        }
        
        let content = await fs.readFile(tasksPath, 'utf-8');
        
        // Маппинг статусов
        const statusMap = {
            'waiting': '⏳ Ожидает',
            'in-progress': '🔄 В работе',
            'completed': '✅ Завершено',
            'cancelled': '❌ Отменено',
            'urgent': '🔥 Срочно'
        };
        
        const newStatus = statusMap[status] || '⏳ Ожидает';
        
        // Обновляем статус в файле
        const statusRegex = new RegExp(`(### ${taskId}:.*?\\n.*?\\*\\*Статус:\\*\\* ).*?(\\n)`, 's');
        content = content.replace(statusRegex, `$1${newStatus}$2`);
        
        await fs.writeFile(tasksPath, content, 'utf-8');
        
        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ error: 'Failed to update task status' });
    }
});

// API для получения статистики проекта
app.get('/api/projects/:project/stats', async (req, res) => {
    try {
        const { project } = req.params;
        if (!isValidProjectName(project)) {
            return res.status(400).json({ error: 'Invalid project name' });
        }
        const tasksPath = path.join(MEMORY_BANK_PATH, project, 'tasks.md');
        
        if (!await fs.pathExists(tasksPath)) {
            return res.json({
                total: 0,
                active: 0,
                completed: 0,
                critical: 0,
                completionRate: 0
            });
        }
        
        const content = await fs.readFile(tasksPath, 'utf-8');
        const tasks = parseTasksFromMarkdown(content);
        
        const total = tasks.length;
        const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const critical = tasks.filter(t => t.priority === 'critical').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        res.json({
            total,
            active,
            completed,
            critical,
            completionRate
        });
    } catch (error) {
        console.error('Error getting project stats:', error);
        res.status(500).json({ error: 'Failed to get project stats' });
    }
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 MBKanban сервер запущен на порту ${PORT}`);
    console.log(`🌐 Откройте http://localhost:${PORT} в браузере`);
});
